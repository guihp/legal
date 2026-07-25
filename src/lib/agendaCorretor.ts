export type AgendaCalendarRef = {
  id: string;
  full_name: string;
  /** Nome do corretor vinculado em oncall_schedules (preferido no badge). */
  brokerName?: string | null;
};

/**
 * Resolve o corretor de um evento do Google Calendar.
 * Prioridade: extendedProperties.broker_name → calendário (calendarId) →
 * descrição "Corretor responsável:" → creator/organizer → agenda filtrada.
 */
export function resolveAgendaEventCorretor(params: {
  event: any;
  description?: string;
  selectedAgenda: string;
  selectedAgendaName?: string;
  calendars: AgendaCalendarRef[];
}): string {
  const { event, selectedAgenda, selectedAgendaName, calendars } = params;
  const description = String(params.description ?? event?.description ?? "");

  const brokerFromProps = String(event?.extendedProperties?.private?.broker_name || "").trim();
  if (brokerFromProps) return brokerFromProps;

  const calendarId = String(
    event?.calendarId ||
      event?.calendar_id ||
      event?.organizer?.id ||
      event?.calendar?.id ||
      "",
  ).trim();

  if (calendarId) {
    const cal = calendars.find((c) => c.id === calendarId);
    const name = String(cal?.brokerName || cal?.full_name || "").trim();
    if (name) return name;
  }

  const fromDesc = description.match(/corretor\s+respons[aá]vel\s*:\s*([^\n\r.]+)/i);
  if (fromDesc?.[1]?.trim()) return fromDesc[1].trim();

  const creatorName = String(event?.creator?.displayName || "").trim();
  if (creatorName) return creatorName;

  const organizerName = String(event?.organizer?.displayName || "").trim();
  if (organizerName) return organizerName;

  if (selectedAgenda && selectedAgenda !== "Todos") {
    const cal = calendars.find((c) => c.id === selectedAgenda);
    return String(cal?.brokerName || cal?.full_name || selectedAgendaName || "Corretor").trim();
  }

  return "Não informado";
}
