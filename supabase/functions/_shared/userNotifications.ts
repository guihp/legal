/**
 * Best-effort inserts into public.user_notifications (inbox / push outbox).
 * Callers use service_role; failures never fail the main flow.
 */

import {
  channelFromPlataforma,
  isClientInboundType,
  type FollowUpChannel,
} from "./followUpCycle.ts";

export type SupabaseService = {
  from: (table: string) => any;
};

export type UserNotificationType =
  | "chat_human_reply"
  | "chat_human_requested"
  | "agenda_reminder"
  | "appointment"
  | "lead_stage_changed"
  | "general";

const HUMAN_ATTENDANCE = ["humano", "humano_solicitado"] as const;

export async function listNotificationRecipientIds(
  service: SupabaseService,
  companyId: string,
  brokerId: string | null | undefined,
): Promise<string[]> {
  const ids = new Set<string>();
  if (brokerId) ids.add(String(brokerId));

  const { data, error } = await service
    .from("user_profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .in("role", ["gestor", "admin"]);

  if (error) {
    console.warn("[userNotifications] recipients query:", error.message);
  }
  for (const row of data || []) {
    if (row?.id) ids.add(String(row.id));
  }
  return [...ids];
}

export async function insertUserNotifications(
  service: SupabaseService,
  rows: Array<{
    company_id: string;
    user_id: string;
    type: UserNotificationType | string;
    title: string;
    body: string;
    meta?: Record<string, unknown>;
  }>,
): Promise<number> {
  if (!rows.length) return 0;
  const { error } = await service.from("user_notifications").insert(rows);
  if (error) {
    console.warn("[userNotifications] insert failed:", error.message);
    return 0;
  }
  return rows.length;
}

async function alreadyNotified(
  service: SupabaseService,
  companyId: string,
  type: string,
  metaKey: string,
  metaValue: string,
): Promise<boolean> {
  if (!metaValue) return false;
  const { data, error } = await service
    .from("user_notifications")
    .select("id")
    .eq("company_id", companyId)
    .eq("type", type)
    .contains("meta", { [metaKey]: metaValue })
    .limit(1);
  if (error) {
    console.warn("[userNotifications] dedupe check:", error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

export async function sessionHasHumanAttendance(
  service: SupabaseService,
  companyId: string,
  channel: FollowUpChannel | string,
  sessionId: string,
): Promise<boolean> {
  const { data, error } = await service
    .from("conversation_contact_labels")
    .select("status")
    .eq("company_id", companyId)
    .eq("channel", channel)
    .eq("session_id", sessionId)
    .in("status", [...HUMAN_ATTENDANCE])
    .limit(1);
  if (error) {
    console.warn("[userNotifications] label check:", error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

export type ResolvedLead = {
  id: string;
  brokerId: string | null;
  displayName: string;
};

export async function resolveLeadForSession(
  service: SupabaseService,
  companyId: string,
  channel: FollowUpChannel | string,
  sessionId: string,
): Promise<ResolvedLead | null> {
  const session = String(sessionId || "").trim();
  if (!companyId || !session) return null;

  const selectCols =
    "id, id_corretor_responsavel, user_id, name, phone, nome_instagram_cliente, arroba_instagram_cliente";

  // 1) Recent mensagem with lead_id for this session key
  const { data: msg } = await service
    .from("mensagens")
    .select("lead_id")
    .eq("company_id", companyId)
    .eq("phone", session)
    .not("lead_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (msg?.lead_id) {
    const { data: lead } = await service
      .from("leads")
      .select(selectCols)
      .eq("id", msg.lead_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (lead?.id) return mapLead(lead);
  }

  // 2) Direct lead match
  if (String(channel).toLowerCase() === "instagram") {
    const ig = session.toLowerCase();
    const { data: byIg } = await service
      .from("leads")
      .select(selectCols)
      .eq("company_id", companyId)
      .ilike("instagram_id_cliente", ig)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byIg?.id) return mapLead(byIg);

    // UUID session = lead id
    const { data: byId } = await service
      .from("leads")
      .select(selectCols)
      .eq("company_id", companyId)
      .eq("id", session)
      .maybeSingle();
    if (byId?.id) return mapLead(byId);
  } else {
    const digits = session.replace(/\D/g, "");
    if (digits) {
      const { data: leads } = await service
        .from("leads")
        .select(selectCols)
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(40);
      const match = (leads || []).find((l: Record<string, unknown>) => {
        const p = String(l.phone || "").replace(/\D/g, "");
        return p && (p === digits || p.endsWith(digits) || digits.endsWith(p));
      });
      if (match?.id) return mapLead(match);
    }
  }

  return null;
}

function mapLead(lead: Record<string, unknown>): ResolvedLead {
  const name = String(lead.name || "").trim();
  const ig = String(lead.nome_instagram_cliente || "").trim();
  const arroba = String(lead.arroba_instagram_cliente || "").trim();
  const phone = String(lead.phone || "").trim();
  const displayName =
    (name && name !== "~" ? name : "") ||
    ig ||
    (arroba ? (arroba.startsWith("@") ? arroba : `@${arroba}`) : "") ||
    phone ||
    "Contato";
  const broker =
    (lead.id_corretor_responsavel ? String(lead.id_corretor_responsavel) : null) ||
    (lead.user_id ? String(lead.user_id) : null);
  return { id: String(lead.id), brokerId: broker, displayName };
}

/**
 * Client inbound while attendance is humano / humano_solicitado → chat_human_reply.
 */
export async function notifyChatHumanReply(
  service: SupabaseService,
  input: {
    companyId: string;
    phone: string;
    type?: string | null;
    plataforma?: string | null;
    mensagemId?: string | null;
    textPreview?: string | null;
  },
): Promise<void> {
  try {
    if (!isClientInboundType(input.type)) return;
    const sessionId = String(input.phone || "").trim();
    const companyId = String(input.companyId || "").trim();
    if (!companyId || !sessionId) return;

    const channel = channelFromPlataforma(input.plataforma);
    const human = await sessionHasHumanAttendance(service, companyId, channel, sessionId);
    if (!human) return;

    const mensagemId = String(input.mensagemId || "").trim();
    if (mensagemId) {
      const dup = await alreadyNotified(
        service,
        companyId,
        "chat_human_reply",
        "mensagem_id",
        mensagemId,
      );
      if (dup) return;
    }

    const lead = await resolveLeadForSession(service, companyId, channel, sessionId);
    const recipients = await listNotificationRecipientIds(
      service,
      companyId,
      lead?.brokerId ?? null,
    );
    if (!recipients.length) return;

    const preview = String(input.textPreview || "").trim().slice(0, 120);
    const who = lead?.displayName || sessionId;
    const body = preview
      ? `${who}: ${preview}`
      : `${who} enviou uma mensagem no atendimento humano.`;

    const rows = recipients.map((userId) => ({
      company_id: companyId,
      user_id: userId,
      type: "chat_human_reply" as const,
      title: "Resposta no atendimento humano",
      body,
      meta: {
        route: "/conversas",
        session_id: sessionId,
        channel,
        lead_id: lead?.id ?? null,
        lead_name: lead?.displayName ?? null,
        mensagem_id: mensagemId || null,
      },
    }));

    await insertUserNotifications(service, rows);
  } catch (e) {
    console.warn(
      "[userNotifications] chat_human_reply:",
      e instanceof Error ? e.message : e,
    );
  }
}

/**
 * Label set to humano_solicitado → chat_human_requested.
 */
export async function notifyChatHumanRequested(
  service: SupabaseService,
  input: {
    companyId: string;
    channel: string;
    sessionId: string;
    /** Skip if this attendance label already existed */
    previousWasRequested?: boolean;
  },
): Promise<void> {
  try {
    if (input.previousWasRequested) return;
    const companyId = String(input.companyId || "").trim();
    const sessionId = String(input.sessionId || "").trim();
    const channel = String(input.channel || "").trim().toLowerCase();
    if (!companyId || !sessionId || !channel) return;

    const lead = await resolveLeadForSession(service, companyId, channel, sessionId);
    const recipients = await listNotificationRecipientIds(
      service,
      companyId,
      lead?.brokerId ?? null,
    );
    if (!recipients.length) return;

    const who = lead?.displayName || sessionId;
    const rows = recipients.map((userId) => ({
      company_id: companyId,
      user_id: userId,
      type: "chat_human_requested" as const,
      title: "Atendimento humano solicitado",
      body: `O contato ${who} solicitou atendimento humano.`,
      meta: {
        route: "/conversas",
        session_id: sessionId,
        channel,
        lead_id: lead?.id ?? null,
        lead_name: lead?.displayName ?? null,
      },
    }));

    await insertUserNotifications(service, rows);
  } catch (e) {
    console.warn(
      "[userNotifications] chat_human_requested:",
      e instanceof Error ? e.message : e,
    );
  }
}

/**
 * Visit reminder job fired → agenda_reminder.
 */
export async function notifyAgendaReminder(
  service: SupabaseService,
  input: {
    companyId: string;
    leadId?: string | null;
    eventId?: string | null;
    jobId?: string | null;
    brokerId?: string | null;
    clientName?: string | null;
    reminderType?: string | null;
    visitAtLabel?: string | null;
  },
): Promise<void> {
  try {
    const companyId = String(input.companyId || "").trim();
    if (!companyId) return;

    const jobId = String(input.jobId || "").trim();
    if (jobId) {
      const dup = await alreadyNotified(
        service,
        companyId,
        "agenda_reminder",
        "job_id",
        jobId,
      );
      if (dup) return;
    }

    const recipients = await listNotificationRecipientIds(
      service,
      companyId,
      input.brokerId ?? null,
    );
    if (!recipients.length) return;

    const who = String(input.clientName || "").trim() || "Cliente";
    const when = String(input.visitAtLabel || "").trim();
    const kind =
      input.reminderType === "1_day"
        ? "1 dia"
        : input.reminderType === "3_hours"
          ? "3 horas"
          : "em breve";
    const body = when
      ? `Lembrete (${kind}): visita com ${who} em ${when}.`
      : `Lembrete (${kind}): visita com ${who}.`;

    const rows = recipients.map((userId) => ({
      company_id: companyId,
      user_id: userId,
      type: "agenda_reminder" as const,
      title: "Lembrete de visita",
      body,
      meta: {
        route: "/agenda",
        lead_id: input.leadId ?? null,
        event_id: input.eventId ?? null,
        job_id: jobId || null,
        reminder_type: input.reminderType ?? null,
        lead_name: who,
      },
    }));

    await insertUserNotifications(service, rows);
  } catch (e) {
    console.warn(
      "[userNotifications] agenda_reminder:",
      e instanceof Error ? e.message : e,
    );
  }
}

/**
 * CRM Agenda create_event path (no lead.stage change) → appointment inbox row.
 * book_visit already covered by DB trigger on visita-agendada.
 */
export async function notifyAppointmentBooked(
  service: SupabaseService,
  input: {
    companyId: string;
    brokerId?: string | null;
    clientName?: string | null;
    eventId?: string | null;
    visitAtLabel?: string | null;
    leadId?: string | null;
  },
): Promise<void> {
  try {
    const companyId = String(input.companyId || "").trim();
    if (!companyId) return;

    const eventId = String(input.eventId || "").trim();
    if (eventId) {
      const dup = await alreadyNotified(
        service,
        companyId,
        "appointment",
        "event_id",
        eventId,
      );
      if (dup) return;
    }

    const recipients = await listNotificationRecipientIds(
      service,
      companyId,
      input.brokerId ?? null,
    );
    if (!recipients.length) return;

    const who = String(input.clientName || "").trim() || "Cliente";
    const when = String(input.visitAtLabel || "").trim();
    const body = when
      ? `Visita agendada para ${who} (${when}).`
      : `Visita agendada para ${who}.`;

    const rows = recipients.map((userId) => ({
      company_id: companyId,
      user_id: userId,
      type: "appointment" as const,
      title: "Visita agendada",
      body,
      meta: {
        route: "/agenda",
        lead_id: input.leadId ?? null,
        event_id: eventId || null,
        lead_name: who,
      },
    }));

    await insertUserNotifications(service, rows);
  } catch (e) {
    console.warn(
      "[userNotifications] appointment:",
      e instanceof Error ? e.message : e,
    );
  }
}
