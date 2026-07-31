import type { PipelineKpi } from '@/components/pipeline/PipelineKpis';

export type PlantaoKpiItem = PipelineKpi & { progress?: number; progressClass?: string };

export type EscalaSlot = { dia: string; inicio: string; fim: string };

export type CalendarRow = {
  name: string;
  id: string;
  timeZone: string;
  accessRole: string;
  color: string;
  primary: string;
};

export type EscalaConfig = {
  calendarName: string;
  assignedUserId?: string;
  assignedUserName?: string;
  slots: EscalaSlot[];
};

export const DIAS_SEMANA = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
] as const;

export const DIA_CURTO: Record<string, string> = {
  Segunda: 'Seg',
  Terça: 'Ter',
  Quarta: 'Qua',
  Quinta: 'Qui',
  Sexta: 'Sex',
  Sábado: 'Sáb',
  Domingo: 'Dom',
};

export type CalendarSyncStatus = 'synced' | 'token_expiring' | 'error' | 'unknown';

export function getCalendarSyncStatus(cal: CalendarRow): CalendarSyncStatus {
  const role = (cal.accessRole || '').toLowerCase();
  if (role === 'none' || role === 'freebusyreader') return 'token_expiring';
  if (role === 'owner' || role === 'writer' || role === 'reader') return 'synced';
  return 'synced';
}

export function getStatusLabel(status: CalendarSyncStatus): string {
  switch (status) {
    case 'synced':
      return 'Sincronizado';
    case 'token_expiring':
      return 'Token expirando';
    case 'error':
      return 'Erro';
    default:
      return 'Desconhecido';
  }
}

export function getInitials(name?: string | null): string {
  const raw = String(name || '').trim();
  if (!raw) return '?';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }
  return raw.slice(0, 1).toUpperCase();
}

/** Truncates calendar IDs for table display (e.g. c_9f18…). */
export function shortCalendarId(id: string): string {
  const raw = String(id || '').trim();
  if (!raw) return '—';
  if (raw.length <= 14) return raw;
  return `${raw.slice(0, 8)}…`;
}

/** Soft pastel avatar background from a name string. */
export function avatarPastel(name?: string | null): { bg: string; fg: string } {
  const raw = String(name || '').trim();
  if (!raw) return { bg: 'hsl(210, 30%, 92%)', fg: 'hsl(210, 35%, 38%)' };
  const hue = (raw.charCodeAt(0) * 17 + (raw.charCodeAt(1) || 0) * 7) % 360;
  return { bg: `hsl(${hue}, 42%, 90%)`, fg: `hsl(${hue}, 40%, 32%)` };
}

export function toMinutes(t: string): number {
  const [hh, mm] = (t || '00:00').split(':');
  const h = parseInt(hh || '0', 10);
  const m = parseInt(mm || '0', 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function computeDayHours(inicio: string, fim: string): number {
  const diff = toMinutes(fim) - toMinutes(inicio);
  return diff > 0 ? diff / 60 : 0;
}

export function computeWeeklyStats(slots: EscalaSlot[]): { totalHours: number; daysCount: number } {
  let totalHours = 0;
  for (const s of slots) {
    totalHours += computeDayHours(s.inicio, s.fim);
  }
  return { totalHours, daysCount: slots.length };
}

export function formatHoursPt(hours: number): string {
  return hours.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatRelativeSync(date: Date | null): string {
  if (!date) return '—';
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `hoje, ${time}`;
  if (isYesterday) return `ontem, ${time}`;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildPlantaoSubtitle(lastUpdated: Date | null): string {
  const ts = lastUpdated
    ? lastUpdated.toLocaleString('pt-BR')
    : '—';
  return `Calendários conectados e escala de atendimento · atualizado em ${ts}`;
}

export function getDayMapFromSlots(slots: EscalaSlot[]) {
  const map: Record<string, { works: boolean; start: string | null; end: string | null }> = {};
  for (const d of DIAS_SEMANA) {
    map[d] = { works: false, start: null, end: null };
  }
  for (const s of slots) {
    if (map[s.dia]) map[s.dia] = { works: true, start: s.inicio, end: s.fim };
  }
  return map;
}

export function buildPlantaoKpis(params: {
  calendarCount: number;
  syncedCount: number;
  brokersOnScale: number;
  totalBrokers: number;
  weeklyHours: number;
  daysWithPlantao: number;
  attentionCount: number;
  attentionHint: string;
}): PlantaoKpiItem[] {
  const {
    calendarCount,
    syncedCount,
    brokersOnScale,
    totalBrokers,
    weeklyHours,
    daysWithPlantao,
    attentionCount,
    attentionHint,
  } = params;

  const syncPct = calendarCount > 0 ? Math.round((syncedCount / calendarCount) * 100) : 0;
  const brokerPct = totalBrokers > 0 ? Math.round((brokersOnScale / totalBrokers) * 100) : 0;

  return [
    {
      key: 'calendars',
      label: 'Calendários',
      value: String(calendarCount),
      hint: `${syncedCount} sincronizado${syncedCount !== 1 ? 's' : ''} agora`,
      hintTone: syncedCount > 0 ? 'positive' : 'neutral',
      dot: 'bg-emerald-600',
      progress: syncPct,
      progressClass: 'bg-emerald-600',
    },
    {
      key: 'brokers',
      label: 'Corretores em escala',
      value: String(brokersOnScale),
      hint: totalBrokers > 0 ? `de ${totalBrokers} corretor${totalBrokers !== 1 ? 'es' : ''} ativo${totalBrokers !== 1 ? 's' : ''}` : 'sem corretores',
      hintTone: 'neutral',
      dot: 'bg-blue-500',
      progress: brokerPct,
      progressClass: 'bg-blue-500',
    },
    {
      key: 'coverage',
      label: 'Cobertura semanal',
      value: `${Math.round(weeklyHours)} h`,
      hint: `${daysWithPlantao} dia${daysWithPlantao !== 1 ? 's' : ''} com plantão`,
      hintTone: daysWithPlantao > 0 ? 'positive' : 'neutral',
      dot: 'bg-emerald-600',
      progress: Math.min(100, Math.round((daysWithPlantao / 7) * 100)),
      progressClass: 'bg-emerald-600',
    },
    {
      key: 'attention',
      label: 'Atenção',
      value: String(attentionCount),
      hint: attentionHint,
      hintTone: attentionCount > 0 ? 'negative' : 'positive',
      dot: attentionCount > 0 ? 'bg-amber-400' : 'bg-emerald-600',
      progress: attentionCount > 0 ? Math.min(100, attentionCount * 33) : 0,
      progressClass: attentionCount > 0 ? 'bg-amber-400' : 'bg-emerald-600',
    },
  ];
}
