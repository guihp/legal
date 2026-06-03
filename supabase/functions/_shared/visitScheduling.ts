/**
 * Regras de atribuição de corretor em visitas (schedule-api).
 * Espelha src/lib/aiVisitScheduling.ts — manter valores alinhados.
 */

export type VisitBrokerAssignmentMode = "queue" | "priority" | "manual";
export type PriorityCriterion = "numeric" | "plantao_order" | "least_busy";

export type VisitSchedulingConfig = {
  mode: VisitBrokerAssignmentMode;
  priorityCriterion: PriorityCriterion;
  brokerPriorities: Record<string, number>;
};

export type OncallRow = {
  assigned_user_id?: string | null;
  calendar_id?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

const MODES: VisitBrokerAssignmentMode[] = ["queue", "priority", "manual"];
const CRITERIA: PriorityCriterion[] = ["numeric", "plantao_order", "least_busy"];
const DEFAULT_SCORE = 50;

export function normalizeVisitSchedulingConfig(row: {
  ai_visit_broker_mode?: string | null;
  ai_visit_priority_criterion?: string | null;
  ai_visit_broker_priorities?: Record<string, number> | null;
} | null): VisitSchedulingConfig {
  const mode = MODES.includes(row?.ai_visit_broker_mode as VisitBrokerAssignmentMode)
    ? (row!.ai_visit_broker_mode as VisitBrokerAssignmentMode)
    : "queue";
  const priorityCriterion = CRITERIA.includes(
    row?.ai_visit_priority_criterion as PriorityCriterion,
  )
    ? (row!.ai_visit_priority_criterion as PriorityCriterion)
    : "numeric";
  const raw = row?.ai_visit_broker_priorities;
  const brokerPriorities: Record<string, number> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const n = Number(v);
      if (Number.isFinite(n)) brokerPriorities[k] = Math.min(100, Math.max(0, n));
    }
  }
  return { mode, priorityCriterion, brokerPriorities };
}

export async function loadCompanyVisitScheduling(
  service: { from: (t: string) => any },
  companyId: string,
): Promise<VisitSchedulingConfig> {
  const { data, error } = await service
    .from("companies")
    .select("ai_visit_broker_mode, ai_visit_priority_criterion, ai_visit_broker_priorities")
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar config de agendamento: ${error.message}`);
  return normalizeVisitSchedulingConfig(data);
}

function brokerId(row: OncallRow): string {
  return String(row.assigned_user_id || "").trim();
}

function stableSortByUserId(rows: OncallRow[]): OncallRow[] {
  const seen = new Set<string>();
  const unique: OncallRow[] = [];
  for (const r of rows) {
    const id = brokerId(r);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(r);
  }
  return unique.sort((a, b) => brokerId(a).localeCompare(brokerId(b), "pt-BR"));
}

function queueOrderAmongAvailable(
  allSorted: OncallRow[],
  available: OncallRow[],
  lastIndex: number,
): OncallRow[] {
  const availById = new Map(available.map((r) => [brokerId(r), r]));
  const n = allSorted.length;
  if (!n) return available;

  const ordered: OncallRow[] = [];
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    const idx = (lastIndex + 1 + i) % n;
    const id = brokerId(allSorted[idx]);
    const row = availById.get(id);
    if (row && !used.has(id)) {
      ordered.push(row);
      used.add(id);
    }
  }
  for (const r of available) {
    const id = brokerId(r);
    if (!used.has(id)) ordered.push(r);
  }
  return ordered;
}

function numericOrder(available: OncallRow[], priorities: Record<string, number>): OncallRow[] {
  return [...available].sort((a, b) => {
    const sa = priorities[brokerId(a)] ?? DEFAULT_SCORE;
    const sb = priorities[brokerId(b)] ?? DEFAULT_SCORE;
    if (sb !== sa) return sb - sa;
    return brokerId(a).localeCompare(brokerId(b), "pt-BR");
  });
}

function plantaoOrder(available: OncallRow[]): OncallRow[] {
  return [...available].sort((a, b) => {
    const ta = new Date(String(a.created_at || 0)).getTime();
    const tb = new Date(String(b.created_at || 0)).getTime();
    if (ta !== tb) return ta - tb;
    return brokerId(a).localeCompare(brokerId(b), "pt-BR");
  });
}

export async function orderAvailableBrokers(
  service: { from: (t: string) => any },
  companyId: string,
  allScheduleRows: OncallRow[],
  available: OncallRow[],
  scheduling: VisitSchedulingConfig,
  visitDayKey: string,
): Promise<{ ordered: OncallRow[]; queueIndexToPersist: number | null }> {
  if (!available.length) return { ordered: [], queueIndexToPersist: null };

  const allSorted = stableSortByUserId(
    allScheduleRows.filter((r) => brokerId(r) && r.calendar_id),
  );

  if (scheduling.mode === "queue") {
    const { data: queueState } = await service
      .from("broker_queue_state")
      .select("last_index")
      .eq("company_id", companyId)
      .maybeSingle();
    const lastIndex = Number(queueState?.last_index ?? -1);
    const ordered = queueOrderAmongAvailable(allSorted, available, lastIndex);
    const firstId = brokerId(ordered[0]);
    const queueIndexToPersist = allSorted.findIndex((r) => brokerId(r) === firstId);
    return {
      ordered,
      queueIndexToPersist: queueIndexToPersist >= 0 ? queueIndexToPersist : null,
    };
  }

  if (scheduling.mode === "manual") {
    const ordered = queueOrderAmongAvailable(allSorted, available, -1);
    return { ordered, queueIndexToPersist: null };
  }

  // priority
  let ordered: OncallRow[];
  if (scheduling.priorityCriterion === "plantao_order") {
    ordered = plantaoOrder(available);
  } else if (scheduling.priorityCriterion === "least_busy") {
    const counts = await countVisitsByBrokerOnDay(service, companyId, available, visitDayKey);
    ordered = [...available].sort((a, b) => {
      const ca = counts.get(brokerId(a)) ?? 0;
      const cb = counts.get(brokerId(b)) ?? 0;
      if (ca !== cb) return ca - cb;
      return brokerId(a).localeCompare(brokerId(b), "pt-BR");
    });
  } else {
    ordered = numericOrder(available, scheduling.brokerPriorities);
  }

  // Desempate (prioridade numérica): fila rotativa entre corretores com a mesma nota máxima
  if (scheduling.priorityCriterion === "numeric" && ordered.length > 1) {
    const topScore = scheduling.brokerPriorities[brokerId(ordered[0])] ?? DEFAULT_SCORE;
    const tied = ordered.filter(
      (r) => (scheduling.brokerPriorities[brokerId(r)] ?? DEFAULT_SCORE) === topScore,
    );
    if (tied.length > 1) {
      const { data: queueState } = await service
        .from("broker_queue_state")
        .select("last_index")
        .eq("company_id", companyId)
        .maybeSingle();
      const lastIndex = Number(queueState?.last_index ?? -1);
      const rotated = queueOrderAmongAvailable(allSorted, tied, lastIndex);
      const rest = ordered.filter((r) => !tied.includes(r));
      ordered = [...rotated, ...rest];
      const firstId = brokerId(rotated[0]);
      const queueIndexToPersist = allSorted.findIndex((r) => brokerId(r) === firstId);
      return {
        ordered,
        queueIndexToPersist: queueIndexToPersist >= 0 ? queueIndexToPersist : null,
      };
    }
  }

  return { ordered, queueIndexToPersist: null };
}

async function countVisitsByBrokerOnDay(
  service: { from: (t: string) => any },
  companyId: string,
  available: OncallRow[],
  visitDayKey: string,
): Promise<Map<string, number>> {
  const ids = available.map((r) => brokerId(r)).filter(Boolean);
  const map = new Map<string, number>();
  for (const id of ids) map.set(id, 0);
  if (!ids.length) return map;

  const dayStart = `${visitDayKey}T00:00:00-03:00`;
  const dayEnd = `${visitDayKey}T23:59:59-03:00`;

  const { data: leads } = await service
    .from("leads")
    .select("id_corretor_responsavel")
    .eq("company_id", companyId)
    .eq("stage", "visita-agendada")
    .in("id_corretor_responsavel", ids)
    .gte("updated_at", dayStart)
    .lte("updated_at", dayEnd);

  for (const row of leads || []) {
    const id = String(row.id_corretor_responsavel || "");
    if (id) map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

export async function pickFreeBrokerForSlot(
  service: { from: (t: string) => any },
  companyId: string,
  allScheduleRows: OncallRow[],
  available: OncallRow[],
  scheduling: VisitSchedulingConfig,
  visitDayKey: string,
  checkFree: (row: OncallRow) => Promise<boolean>,
): Promise<{
  broker: OncallRow | null;
  queueIndexToPersist: number | null;
}> {
  const { ordered, queueIndexToPersist } = await orderAvailableBrokers(
    service,
    companyId,
    allScheduleRows,
    available,
    scheduling,
    visitDayKey,
  );

  for (const b of ordered) {
    if (!b.calendar_id) continue;
    if (await checkFree(b)) {
      return { broker: b, queueIndexToPersist };
    }
  }
  return { broker: null, queueIndexToPersist: null };
}

export async function persistQueueIndex(
  service: { from: (t: string) => any },
  companyId: string,
  queueIndex: number | null,
): Promise<void> {
  if (queueIndex === null || queueIndex < 0) return;
  await service.from("broker_queue_state").upsert({
    company_id: companyId,
    last_index: queueIndex,
    updated_at: new Date().toISOString(),
  }, { onConflict: "company_id" });
}
