import type { PipelineKpi } from '@/components/pipeline/PipelineKpis';

export type AgendaViewMode = 'month' | 'week' | 'list';
export type AgendaStatusFilter = 'all' | 'confirmed' | 'pending';

export type AgendaEventLike = {
  id: number | string;
  date: Date;
  client: string;
  property: string;
  address: string;
  type: string;
  status: string;
  corretor?: string;
  phone?: string;
  leadId?: string;
};

export const AGENT_DOT_COLORS = [
  'bg-emerald-600',
  'bg-blue-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-teal-500',
] as const;

export function normalizeAgendaStatus(status: string): string {
  return String(status || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function isConfirmedStatus(status: string): boolean {
  const s = normalizeAgendaStatus(status);
  return s === 'confirmado' || s === 'confirmada';
}

export function isVisitedStatus(status: string): boolean {
  const s = normalizeAgendaStatus(status);
  return s === 'visitado' || s === 'visita realizada' || s === 'realizado';
}

/** Prefer persisted custom status (Google extendedProperties) over attendee RSVP. */
export function resolveAgendaEventStatus(
  attendeeStatus: string,
  extendedPrivate?: Record<string, string | undefined> | null,
): string {
  const custom = String(extendedPrivate?.event_status || '').trim();
  if (custom && isVisitedStatus(custom)) return 'Visitado';
  if (custom && isConfirmedStatus(custom)) return 'Confirmado';
  if (custom) return custom;
  return attendeeStatus;
}

export function isEventPastVisitThreshold(eventStart: Date): boolean {
  const threshold = new Date(eventStart.getTime() + 60 * 60 * 1000);
  return Date.now() >= threshold.getTime();
}

export function isPendingStatus(status: string): boolean {
  const s = normalizeAgendaStatus(status);
  return (
    s === 'aguardando confirmacao' ||
    s === 'agendada' ||
    s === 'agendado' ||
    s === 'pendente' ||
    s === 'talvez'
  );
}

export function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function getAgentDotClass(agentName: string, sortedAgents: string[]): string {
  const idx = sortedAgents.indexOf(agentName.trim());
  const i = idx >= 0 ? idx : 0;
  return AGENT_DOT_COLORS[i % AGENT_DOT_COLORS.length];
}

export function getAgentInitial(name?: string): string {
  const text = String(name || '?').trim();
  return text.charAt(0).toUpperCase();
}

export function formatAgendaTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatAgendaShortDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function getStatusBadgeClasses(status: string): string {
  if (isVisitedStatus(status)) {
    return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800';
  }
  if (isConfirmedStatus(status)) {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
  }
  if (isPendingStatus(status)) {
    return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
  }
  const s = status.toLowerCase();
  if (s.includes('cancel') || s.includes('recus')) {
    return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
  }
  return 'bg-muted text-muted-foreground border-border';
}

export function getStatusLabel(status: string): string {
  if (isVisitedStatus(status)) return 'Visitado';
  if (isConfirmedStatus(status)) return 'Confirmado';
  if (isPendingStatus(status)) return 'Pendente';
  return status;
}

export function getTypeBadgeClasses(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('visita')) {
    return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
  }
  if (t.includes('avalia')) {
    return 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800';
  }
  if (t.includes('apresent')) {
    return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800';
  }
  return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800';
}

export type AgendaKpiItem = PipelineKpi & { progress?: number; progressClass?: string };

export function buildAgendaKpis(events: AgendaEventLike[]): AgendaKpiItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = getStartOfWeek(today);
  const weekEnd = getEndOfWeek(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const todayEvents = events.filter((e) => e.date.toDateString() === today.toDateString());
  const weekEvents = events.filter((e) => e.date >= weekStart && e.date <= weekEnd);
  const monthEvents = events.filter((e) => e.date >= monthStart);
  const confirmedEvents = events.filter((e) => isConfirmedStatus(e.status));
  const pendingEvents = events.filter((e) => isPendingStatus(e.status));

  const visitsTomorrow = events.filter(
    (e) =>
      e.date.toDateString() === tomorrow.toDateString() &&
      e.type.toLowerCase().includes('visita'),
  ).length;

  const confirmedPct =
    events.length > 0 ? Math.round((confirmedEvents.length / events.length) * 100) : 0;
  const pendingPct =
    events.length > 0 ? Math.round((pendingEvents.length / events.length) * 100) : 0;
  const weekPct =
    monthEvents.length > 0 ? Math.round((weekEvents.length / monthEvents.length) * 100) : 0;

  return [
    {
      key: 'today',
      label: 'Hoje',
      value: String(todayEvents.length),
      hint:
        todayEvents.length === 0
          ? 'nenhum compromisso'
          : `${todayEvents.length} compromisso${todayEvents.length !== 1 ? 's' : ''}`,
      hintTone: 'neutral',
      dot: 'bg-muted-foreground/40',
    },
    {
      key: 'week',
      label: 'Esta semana',
      value: String(weekEvents.length),
      hint:
        visitsTomorrow > 0
          ? `${visitsTomorrow} visita${visitsTomorrow !== 1 ? 's' : ''} amanhã`
          : weekEvents.length > 0
            ? 'na semana atual'
            : 'sem compromissos',
      hintTone: visitsTomorrow > 0 ? 'positive' : 'neutral',
      dot: 'bg-emerald-600',
      progress: weekPct,
      progressClass: 'bg-emerald-600',
    },
    {
      key: 'month',
      label: 'Este mês',
      value: String(monthEvents.length),
      hint: monthEvents.length > 0 ? 'no mês atual' : 'sem eventos',
      hintTone: 'neutral',
      dot: 'bg-blue-500',
      progress: monthEvents.length > 0 ? 100 : 0,
      progressClass: 'bg-blue-500',
    },
    {
      key: 'confirmed',
      label: 'Confirmados',
      value: String(confirmedEvents.length),
      hint: events.length > 0 ? `${confirmedPct}% dos eventos` : undefined,
      hintTone: 'positive',
      dot: 'bg-emerald-600',
    },
    {
      key: 'pending',
      label: 'Pendentes',
      value: String(pendingEvents.length),
      hint: pendingEvents.length > 0 ? 'confirmar até 24h antes' : 'nenhum pendente',
      hintTone: pendingEvents.length > 0 ? 'neutral' : 'neutral',
      dot: 'bg-amber-400',
      progress: pendingPct,
      progressClass: 'bg-amber-400',
    },
  ];
}

export function filterEventsByStatus(
  events: AgendaEventLike[],
  statusFilter: AgendaStatusFilter,
): AgendaEventLike[] {
  if (statusFilter === 'confirmed') {
    return events.filter((e) => isConfirmedStatus(e.status));
  }
  if (statusFilter === 'pending') {
    return events.filter((e) => isPendingStatus(e.status));
  }
  return events;
}

export function getUpcomingEvents(
  events: AgendaEventLike[],
  fromDate: Date,
  limit = 5,
): AgendaEventLike[] {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  return events
    .filter((e) => e.date >= start)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, limit);
}
