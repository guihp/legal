/**
 * Lembretes de visita agendada (1 dia antes e 3 horas antes) via webhooks n8n.
 */

export const VISIT_REMINDER_WEBHOOKS = {
  one_day: "https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/lembrete-1-dia",
  three_hours:
    "https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/lembrete-3-horas",
} as const;

export type VisitReminderType = "1_day" | "3_hours";

const TZ = "America/Sao_Paulo";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

function dateKeySP(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

export function computeVisitReminderTriggers(visitAt: Date, now = new Date()) {
  const visitMs = visitAt.getTime();
  const nowMs = now.getTime();
  const sameCalendarDay = dateKeySP(visitAt) === dateKeySP(now);
  const moreThanOneDayAway = visitMs - nowMs > ONE_DAY_MS;

  const oneDayAt = !sameCalendarDay && moreThanOneDayAway
    ? new Date(visitMs - ONE_DAY_MS)
    : null;

  const threeHoursAt = new Date(visitMs - THREE_HOURS_MS);

  return {
    oneDay: oneDayAt && oneDayAt.getTime() > nowMs ? oneDayAt : null,
    threeHours: threeHoursAt.getTime() > nowMs ? threeHoursAt : null,
  };
}

export type VisitReminderPayload = {
  company_id: string;
  lead_id: string;
  event_id: string | null;
  lembrete_tipo: VisitReminderType;
  nome_cliente: string | null;
  email_cliente: string | null;
  telefone: string | null;
  instancia: string | null;
  visita_em: string;
  visita_data: string;
  visita_hora: string;
  id_do_imovel: string | null;
  imovel: {
    listing_id: string | null;
    tipo_imovel: string | null;
    endereco: string | null;
    bairro: string | null;
    cidade: string | null;
    quartos: number | string | null;
    banheiros: number | string | null;
    garagem: number | string | null;
    tamanho_m2: number | string | null;
    preco: number | string | null;
    descricao: string | null;
  };
  corretor: {
    id: string | null;
    nome: string | null;
  };
  whatsapp_ai_phone: string | null;
};

export function buildVisitReminderPayload(input: {
  companyId: string;
  leadId: string;
  eventId: string | null;
  reminderType: VisitReminderType;
  visitAt: Date;
  nomeCliente: string | null;
  emailCliente: string | null;
  telefone: string | null;
  instancia: string | null;
  idImovel: string | null;
  propertyData: Record<string, unknown>;
  brokerId: string | null;
  brokerName: string | null;
  whatsappAiPhone: string | null;
}): VisitReminderPayload {
  const visitaData = input.visitAt.toLocaleDateString("pt-BR", { timeZone: TZ });
  const visitaHora = input.visitAt.toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = input.propertyData || {};
  const endereco = [p.endereco, p.numero].filter(Boolean).join(" ").trim() || null;

  return {
    company_id: input.companyId,
    lead_id: input.leadId,
    event_id: input.eventId,
    lembrete_tipo: input.reminderType,
    nome_cliente: input.nomeCliente,
    email_cliente: input.emailCliente,
    telefone: input.telefone,
    instancia: input.instancia,
    visita_em: input.visitAt.toISOString(),
    visita_data: visitaData,
    visita_hora: visitaHora,
    id_do_imovel: input.idImovel,
    imovel: {
      listing_id: input.idImovel,
      tipo_imovel: (p.tipo_imovel as string) ?? null,
      endereco,
      bairro: (p.bairro as string) ?? null,
      cidade: (p.cidade as string) ?? null,
      quartos: (p.quartos as number | string) ?? null,
      banheiros: (p.banheiros as number | string) ?? null,
      garagem: (p.garagem as number | string) ?? null,
      tamanho_m2: (p.tamanho_m2 as number | string) ?? null,
      preco: (p.preco as number | string) ?? null,
      descricao: (p.descricao as string) ?? null,
    },
    corretor: {
      id: input.brokerId,
      nome: input.brokerName,
    },
    whatsapp_ai_phone: input.whatsappAiPhone,
  };
}

type SupabaseService = {
  from: (table: string) => any;
};

export async function cancelPendingVisitReminders(
  service: SupabaseService,
  leadId: string,
  eventId?: string | null,
): Promise<void> {
  let query = service
    .from("visit_reminder_jobs")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("lead_id", leadId)
    .eq("status", "pending");

  if (eventId) {
    query = query.eq("event_id", eventId);
  }

  await query;
}

export async function scheduleVisitReminders(
  service: SupabaseService,
  input: {
    companyId: string;
    leadId: string;
    eventId: string | null;
    visitAt: Date;
    nomeCliente: string | null;
    emailCliente: string | null;
    telefone: string | null;
    instancia: string | null;
    idImovel: string | null;
    propertyData: Record<string, unknown>;
    brokerId: string | null;
    brokerName: string | null;
    whatsappAiPhone: string | null;
  },
): Promise<{ scheduled: VisitReminderType[]; skipped: VisitReminderType[] }> {
  if (input.eventId) {
    await cancelPendingVisitReminders(service, input.leadId, input.eventId);
  } else {
    await cancelPendingVisitReminders(service, input.leadId);
  }

  const triggers = computeVisitReminderTriggers(input.visitAt);
  const rows: Record<string, unknown>[] = [];
  const scheduled: VisitReminderType[] = [];
  const skipped: VisitReminderType[] = [];

  const specs: { type: VisitReminderType; at: Date | null; webhook: string }[] = [
    { type: "1_day", at: triggers.oneDay, webhook: VISIT_REMINDER_WEBHOOKS.one_day },
    {
      type: "3_hours",
      at: triggers.threeHours,
      webhook: VISIT_REMINDER_WEBHOOKS.three_hours,
    },
  ];

  for (const spec of specs) {
    if (!spec.at) {
      skipped.push(spec.type);
      continue;
    }
    scheduled.push(spec.type);
    rows.push({
      company_id: input.companyId,
      lead_id: input.leadId,
      event_id: input.eventId,
      reminder_type: spec.type,
      visit_at: input.visitAt.toISOString(),
      trigger_at: spec.at.toISOString(),
      webhook_url: spec.webhook,
      payload: buildVisitReminderPayload({
        ...input,
        reminderType: spec.type,
      }),
      status: "pending",
    });
  }

  if (rows.length) {
    const { error } = await service.from("visit_reminder_jobs").insert(rows);
    if (error) throw new Error(error.message);
  }

  return { scheduled, skipped };
}
