/**
 * Preferências de atribuição de corretor em visitas agendadas pela IA.
 * Persistidas em companies (ai_visit_*) e aplicadas na schedule-api.
 */

export const AI_VISIT_SCHEDULING_API_ACTIVE = true;

export type VisitBrokerAssignmentMode = 'queue' | 'priority' | 'manual';

/** Como desempatar entre corretores elegíveis no plantão (modo prioridade). */
export type PriorityCriterion = 'numeric' | 'plantao_order' | 'least_busy';

export interface AiVisitSchedulingConfig {
  mode: VisitBrokerAssignmentMode;
  priorityCriterion: PriorityCriterion;
  /** user_id → prioridade 0–100 (maior = preferido). Usado quando priorityCriterion === 'numeric'. */
  brokerPriorities: Record<string, number>;
  updatedAt: string;
}

const STORAGE_PREFIX = 'imobi:ai-visit-scheduling:';

const VALID_MODES: VisitBrokerAssignmentMode[] = ['queue', 'priority', 'manual'];
const VALID_CRITERIA: PriorityCriterion[] = ['numeric', 'plantao_order', 'least_busy'];

export const DEFAULT_AI_VISIT_SCHEDULING_CONFIG: AiVisitSchedulingConfig = {
  mode: 'queue',
  priorityCriterion: 'numeric',
  brokerPriorities: {},
  updatedAt: '',
};

export function isAiVisitSchedulingApiActive(): boolean {
  return AI_VISIT_SCHEDULING_API_ACTIVE;
}

export type CompanyVisitSchedulingRow = {
  ai_visit_broker_mode?: string | null;
  ai_visit_priority_criterion?: string | null;
  ai_visit_broker_priorities?: Record<string, number> | null;
};

export function companyRowToVisitSchedulingConfig(
  row: CompanyVisitSchedulingRow | null | undefined
): AiVisitSchedulingConfig {
  const mode = VALID_MODES.includes(row?.ai_visit_broker_mode as VisitBrokerAssignmentMode)
    ? (row!.ai_visit_broker_mode as VisitBrokerAssignmentMode)
    : DEFAULT_AI_VISIT_SCHEDULING_CONFIG.mode;

  const priorityCriterion = VALID_CRITERIA.includes(
    row?.ai_visit_priority_criterion as PriorityCriterion
  )
    ? (row!.ai_visit_priority_criterion as PriorityCriterion)
    : DEFAULT_AI_VISIT_SCHEDULING_CONFIG.priorityCriterion;

  const brokerPriorities: Record<string, number> = {};
  const raw = row?.ai_visit_broker_priorities;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const n = Number(v);
      if (Number.isFinite(n)) brokerPriorities[k] = Math.min(100, Math.max(0, n));
    }
  }

  return { mode, priorityCriterion, brokerPriorities, updatedAt: '' };
}

export function visitSchedulingToRpcPayload(
  config: Omit<AiVisitSchedulingConfig, 'updatedAt'>
): {
  p_ai_visit_broker_mode: VisitBrokerAssignmentMode;
  p_ai_visit_priority_criterion: PriorityCriterion;
  p_ai_visit_broker_priorities: Record<string, number>;
} {
  return {
    p_ai_visit_broker_mode: config.mode,
    p_ai_visit_priority_criterion: config.priorityCriterion,
    p_ai_visit_broker_priorities: config.brokerPriorities,
  };
}

function storageKey(companyId: string): string {
  return `${STORAGE_PREFIX}${companyId}`;
}

/** Legado: migração única do localStorage para o banco. */
export function loadLegacyLocalVisitSchedulingConfig(
  companyId: string
): AiVisitSchedulingConfig | null {
  if (typeof window === 'undefined' || !companyId) return null;
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiVisitSchedulingConfig>;
    if (!parsed.updatedAt) return null;
    return {
      mode: VALID_MODES.includes(parsed.mode as VisitBrokerAssignmentMode)
        ? (parsed.mode as VisitBrokerAssignmentMode)
        : DEFAULT_AI_VISIT_SCHEDULING_CONFIG.mode,
      priorityCriterion: VALID_CRITERIA.includes(parsed.priorityCriterion as PriorityCriterion)
        ? (parsed.priorityCriterion as PriorityCriterion)
        : DEFAULT_AI_VISIT_SCHEDULING_CONFIG.priorityCriterion,
      brokerPriorities: parsed.brokerPriorities ?? {},
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function clearLegacyLocalVisitSchedulingConfig(companyId: string): void {
  if (typeof window !== 'undefined' && companyId) {
    localStorage.removeItem(storageKey(companyId));
  }
}

export function configsEqual(
  a: AiVisitSchedulingConfig,
  b: AiVisitSchedulingConfig
): boolean {
  return (
    a.mode === b.mode &&
    a.priorityCriterion === b.priorityCriterion &&
    JSON.stringify(a.brokerPriorities) === JSON.stringify(b.brokerPriorities)
  );
}

export const MODE_LABELS: Record<VisitBrokerAssignmentMode, string> = {
  queue: 'Fila rotativa',
  priority: 'Por prioridade',
  manual: 'Você escolhe o corretor',
};

export const MODE_DESCRIPTIONS: Record<VisitBrokerAssignmentMode, string> = {
  queue:
    'Entre os corretores de plantão naquele horário, a assistente distribui as visitas em rodízio — um de cada vez, na sequência.',
  priority:
    'Entre quem está de plantão e com horário livre, a assistente escolhe conforme a prioridade que você definir abaixo.',
  manual:
    'A assistente marca data e horário com o cliente; depois você ou um gestor define qual corretor fará a visita.',
};

export const PRIORITY_CRITERION_LABELS: Record<PriorityCriterion, string> = {
  numeric: 'Prioridade por corretor (recomendado)',
  plantao_order: 'Ordem na escala do Plantão',
  least_busy: 'Menos visitas no mesmo dia',
};

export type BrokerPriorityTier = 'high' | 'medium' | 'low';

export const BROKER_PRIORITY_TIER_OPTIONS: ReadonlyArray<{
  id: BrokerPriorityTier;
  label: string;
  score: number;
  hint: string;
}> = [
  { id: 'high', label: 'Alta', score: 100, hint: 'Recebe visitas antes dos demais' },
  { id: 'medium', label: 'Média', score: 50, hint: 'Prioridade padrão' },
  { id: 'low', label: 'Baixa', score: 10, hint: 'Só quando os outros não puderem' },
] as const;

export const DEFAULT_BROKER_PRIORITY_SCORE = 50;

export function scoreToBrokerPriorityTier(score: number): BrokerPriorityTier {
  if (score >= 70) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

export function brokerPriorityTierToScore(tier: BrokerPriorityTier): number {
  return BROKER_PRIORITY_TIER_OPTIONS.find((o) => o.id === tier)?.score ?? DEFAULT_BROKER_PRIORITY_SCORE;
}
