import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Clock, MessageSquareText, ScrollText } from 'lucide-react';
import type { DaySchedule } from '@/lib/businessHours';
import type { AiVisitSchedulingConfig } from '@/lib/aiVisitScheduling';
import type { AiConfigFormState, AiConfigSectionId } from './constants';

/** Forest green for AI bubbles / impact card (match cream mockups). */
export const AI_CONFIG_EMERALD = '#0C2919';

export const INITIAL_MESSAGE_MAX = 400;

export const MESSAGE_VARS = ['{nome}', '{imovel}', '{corretor}', '{empresa}'] as const;

export type TonePresetId = 'consultivo' | 'direto' | 'caloroso';

export const TONE_PRESETS: ReadonlyArray<{
  id: TonePresetId;
  label: string;
  keywords: string[];
}> = [
  { id: 'consultivo', label: 'Consultivo', keywords: ['consultivo', 'consultor'] },
  { id: 'direto', label: 'Direto', keywords: ['direto', 'objetivo', 'sem rodeio'] },
  { id: 'caloroso', label: 'Caloroso', keywords: ['caloroso', 'acolhedor', 'amigável', 'amigavel'] },
];

export type ChecklistItem = {
  id: string;
  label: string;
  detail: string;
  ok: boolean;
};

export type ImpactMetric = {
  id: string;
  label: string;
  value: string;
  percent: number | null;
  barClass: string;
};

export const SECTION_NAV: ReadonlyArray<{
  id: AiConfigSectionId;
  label: string;
  Icon: LucideIcon;
  iconBg: string;
  iconClass: string;
}> = [
  {
    id: 'identidade',
    label: 'Identidade e mensagens',
    Icon: MessageSquareText,
    iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',
    iconClass: 'text-emerald-800 dark:text-emerald-300',
  },
  {
    id: 'contexto',
    label: 'Contexto e regras',
    Icon: ScrollText,
    iconBg: 'bg-sky-100 dark:bg-sky-950/40',
    iconClass: 'text-sky-800 dark:text-sky-300',
  },
  {
    id: 'horario',
    label: 'Horário de funcionamento',
    Icon: Clock,
    iconBg: 'bg-amber-100 dark:bg-amber-950/40',
    iconClass: 'text-amber-800 dark:text-amber-300',
  },
  {
    id: 'visitas',
    label: 'Agendamento de visitas',
    Icon: CalendarDays,
    iconBg: 'bg-violet-100 dark:bg-violet-950/40',
    iconClass: 'text-violet-800 dark:text-violet-300',
  },
];

/** Coerce DB/JSON values to a safe textarea string (fixes `[object Object]`). */
export function asText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    try {
      if (
        'text' in (value as object) &&
        typeof (value as { text: unknown }).text === 'string'
      ) {
        return (value as { text: string }).text;
      }
      if (
        'content' in (value as object) &&
        typeof (value as { content: unknown }).content === 'string'
      ) {
        return (value as { content: string }).content;
      }
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }
  return String(value);
}

export function filled(v: string | null | undefined): boolean {
  return Boolean((v || '').trim());
}

export function detectTonePreset(tone: string): TonePresetId | null {
  const lower = tone.toLowerCase();
  for (const preset of TONE_PRESETS) {
    if (preset.keywords.some((k) => lower.includes(k))) return preset.id;
  }
  return null;
}

export function countRules(rules: string): number {
  const text = rules.trim();
  if (!text) return 0;
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean);
  if (lines.length >= 2) return lines.length;
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 8);
  return Math.max(1, sentences.length);
}

export function openDaysCount(schedule: DaySchedule[]): number {
  return schedule.filter((d) => !d.closed).length;
}

export function applyHoursToAll(
  schedule: DaySchedule[],
  openTime = '09:00',
  closeTime = '18:00',
  lunchStart = '12:00',
  lunchEnd = '13:00',
): DaySchedule[] {
  return schedule.map((day) => {
    if (day.dayKey === 'sunday') {
      return { ...day, closed: true, openTime: '', lunchStart: '', lunchEnd: '', closeTime: '' };
    }
    if (day.dayKey === 'saturday') {
      return {
        ...day,
        closed: false,
        openTime,
        lunchStart: '',
        lunchEnd: '',
        closeTime: '12:00',
      };
    }
    return {
      ...day,
      closed: false,
      openTime,
      lunchStart,
      lunchEnd,
      closeTime,
    };
  });
}

export function dayRangeLabel(day: DaySchedule): string {
  if (day.closed) return 'fechado';
  if (!day.openTime || !day.closeTime) return '—';
  return `${day.openTime}–${day.closeTime}`;
}

export function formatSavedAt(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

export function interpolatePreview(
  template: string,
  vars: { nome?: string; imovel?: string; corretor?: string; empresa?: string },
): string {
  return template
    .replaceAll('{nome}', vars.nome ?? 'Tayelle')
    .replaceAll('{imovel}', vars.imovel ?? 'o imóvel')
    .replaceAll('{corretor}', vars.corretor ?? 'o corretor')
    .replaceAll('{empresa}', vars.empresa ?? 'nossa imobiliária');
}

export function fillPercent(
  form: AiConfigFormState,
  visitConfig: AiVisitSchedulingConfig,
  brokerCount: number,
): number {
  const checks = [
    filled(form.aiAssistantName),
    filled(form.aiInitialMessage),
    filled(form.aiUnknownInfoMessage),
    filled(form.aiTone),
    filled(form.aiCompanyMission),
    filled(form.aiPaymentMethods),
    filled(form.aiVisitPolicy),
    filled(form.aiTargetAudience),
    filled(form.aiRules),
    openDaysCount(form.businessHoursSchedule) > 0,
    Boolean(visitConfig.mode),
    visitConfig.mode !== 'priority' ||
      visitConfig.priorityCriterion !== 'numeric' ||
      brokerCount === 0 ||
      Object.keys(visitConfig.brokerPriorities).length > 0,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

export function buildChecklist(
  form: AiConfigFormState,
  visitConfig: AiVisitSchedulingConfig,
  brokerCount: number,
): ChecklistItem[] {
  const rulesN = countRules(form.aiRules);
  const days = openDaysCount(form.businessHoursSchedule);
  const prioritized =
    visitConfig.mode !== 'priority' || visitConfig.priorityCriterion !== 'numeric'
      ? brokerCount
      : Object.keys(visitConfig.brokerPriorities).filter((id) =>
          Number.isFinite(visitConfig.brokerPriorities[id]),
        ).length;
  const priorityOk =
    visitConfig.mode !== 'priority' ||
    visitConfig.priorityCriterion !== 'numeric' ||
    brokerCount === 0 ||
    prioritized >= brokerCount;

  return [
    {
      id: 'initial',
      label: 'Mensagem inicial',
      detail: filled(form.aiInitialMessage) ? 'definida' : 'pendente',
      ok: filled(form.aiInitialMessage),
    },
    {
      id: 'rules',
      label: 'Regras da IA',
      detail: rulesN > 0 ? `${rulesN} regra${rulesN === 1 ? '' : 's'}` : 'pendente',
      ok: rulesN > 0,
    },
    {
      id: 'hours',
      label: 'Horário de funcionamento',
      detail: days > 0 ? `${days} dia${days === 1 ? '' : 's'}` : 'pendente',
      ok: days > 0,
    },
    {
      id: 'priority',
      label: 'Prioridade dos corretores',
      detail:
        brokerCount === 0
          ? 'sem corretores'
          : visitConfig.mode !== 'priority' || visitConfig.priorityCriterion !== 'numeric'
            ? 'modo sem tabela'
            : `${prioritized} de ${brokerCount}`,
      ok: priorityOk,
    },
  ];
}

/**
 * Soft metrics — not persisted in DB yet.
 * Values approximate the cream mockup for layout fidelity until analytics exist.
 */
export function softImpactMetrics(): ImpactMetric[] {
  return [
    {
      id: 'conversations',
      label: 'Conversas atendidas pela IA',
      value: '82%',
      percent: 82,
      barClass: 'bg-emerald-400',
    },
    {
      id: 'qualified',
      label: 'Leads qualificados sem humano',
      value: '64%',
      percent: 64,
      barClass: 'bg-sky-400',
    },
    {
      id: 'visits',
      label: 'Visitas agendadas pela IA',
      value: '11 no mês',
      percent: 40,
      barClass: 'bg-violet-400',
    },
    {
      id: 'escalate',
      label: 'Escalonamento para corretor',
      value: '18%',
      percent: 18,
      barClass: 'bg-amber-400',
    },
  ];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}
