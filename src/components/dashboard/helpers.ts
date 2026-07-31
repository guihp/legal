import {
  format,
  subDays,
  subMonths,
  startOfDay,
  endOfDay,
  differenceInCalendarDays,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrencyCompact } from '@/lib/charts/formatters';

export type PeriodPreset = '7d' | '30d' | 'quarter' | 'year';

export type DashboardKpiItem = {
  key: string;
  label: string;
  value: string;
  hint: string;
  hintTone: 'positive' | 'negative' | 'neutral' | 'amber' | 'blue' | 'purple';
  dot: string;
  spark: number[];
  sparkClass: string;
};

export type PortfolioSlice = {
  key: string;
  label: string;
  count: number;
  pct: number;
  barClass: string;
  dotClass: string;
};

export type TypeSlice = {
  label: string;
  count: number;
};

export type ChannelRow = {
  key: string;
  label: string;
  count: number;
  pct: number;
  deltaPct: number | null;
  barClass: string;
};

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  conversionPct: number | null;
  barClass: string;
  barWidth: number;
};

export type BrokerRow = {
  id: string;
  name: string;
  roleLabel: string;
  initials: string;
  avatarClass: string;
  leads: number;
  visitas: number;
  fechamentos: number;
  conversionPct: number;
  vgv: number;
  vgvLabel: string;
};

export type AppointmentRow = {
  id: string;
  timeLabel: string;
  dayLabel: string;
  title: string;
  detail: string;
  status: 'confirmada' | 'a_confirmar' | 'outro';
  statusLabel: string;
  canConfirm: boolean;
};

export type ActivityRow = {
  id: string;
  text: string;
  when: string;
  tone: 'green' | 'blue' | 'amber' | 'purple' | 'rose';
};

export type MonthPoint = {
  key: string;
  label: string;
  vgv: number;
  qtd: number;
};

export const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Ano' },
];

const CHANNEL_MAP: Array<{
  key: string;
  label: string;
  match: (s: string) => boolean;
  barClass: string;
}> = [
  {
    key: 'whatsapp',
    label: 'WhatsApp / IA',
    match: (s) => /whatsapp|ia|sdr_whatsapp|bot/.test(s),
    barClass: 'bg-emerald-600',
  },
  {
    key: 'meta',
    label: 'Meta Ads',
    match: (s) => /facebook|meta|sdr_facebook|fb/.test(s),
    barClass: 'bg-sky-500',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    match: (s) => /instagram|ig/.test(s),
    barClass: 'bg-pink-500',
  },
  {
    key: 'site',
    label: 'Site vitrine',
    match: (s) => /site|website|vitrine|landing|lp|web/.test(s),
    barClass: 'bg-violet-500',
  },
  {
    key: 'indicacao',
    label: 'Indicação',
    match: (s) => /indic/.test(s),
    barClass: 'bg-amber-400',
  },
];

export const FUNNEL_STAGES: Array<{
  key: string;
  label: string;
  match: (stage: string) => boolean;
  barClass: string;
}> = [
  {
    key: 'novos',
    label: 'Novos leads',
    match: (s) => /novo/.test(s),
    barClass: 'bg-emerald-800',
  },
  {
    key: 'qualificados',
    label: 'Qualificados',
    match: (s) => /qualific/.test(s),
    barClass: 'bg-emerald-700',
  },
  {
    key: 'visita',
    label: 'Visita agendada',
    match: (s) => /visita\s*agendada/.test(s),
    barClass: 'bg-emerald-600',
  },
  {
    key: 'negociacao',
    label: 'Em negociação',
    match: (s) => /negoci/.test(s),
    barClass: 'bg-emerald-500',
  },
  {
    key: 'documentacao',
    label: 'Documentação',
    match: (s) => /document|contrato/.test(s),
    barClass: 'bg-emerald-400',
  },
  {
    key: 'fechados',
    label: 'Fechados',
    match: (s) => /fechamento|fechado|ganho|won|closed|vendido/.test(s),
    barClass: 'bg-[#D4C4A8]',
  },
];

const AVATAR_CLASSES = [
  'bg-emerald-100 text-emerald-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-900',
  'bg-rose-100 text-rose-800',
];

export function resolvePeriod(preset: PeriodPreset, now = new Date()) {
  const to = endOfDay(now);
  let from: Date;
  switch (preset) {
    case '7d':
      from = startOfDay(subDays(now, 6));
      break;
    case 'quarter':
      from = startOfDay(subDays(now, 89));
      break;
    case 'year':
      from = startOfDay(subDays(now, 364));
      break;
    case '30d':
    default:
      from = startOfDay(subDays(now, 29));
      break;
  }
  const days = differenceInCalendarDays(to, from) + 1;
  const prevTo = startOfDay(subDays(from, 1));
  const prevFrom = startOfDay(subDays(prevTo, days - 1));
  return { from, to, prevFrom, prevTo, days };
}

export function formatRangeArrow(from: Date, to: Date): string {
  return `${format(from, 'dd MMM', { locale: ptBR })} → ${format(to, 'dd MMM yyyy', { locale: ptBR })}`;
}

export function formatUpdatedAt(d: Date): string {
  return `atualizado às ${format(d, 'HH:mm')}`;
}

export function formatDeltaPct(current: number, previous: number): {
  text: string;
  tone: 'positive' | 'negative' | 'neutral';
} {
  // Avoid absurd ±100% when either side is empty (esp. current=0 → "-100%").
  if (current === 0 || previous === 0) {
    if (current === 0 && previous === 0) return { text: '0%', tone: 'neutral' };
    if (current === 0) return { text: '—', tone: 'neutral' };
    return { text: '+100%', tone: 'positive' };
  }
  const pct = ((current - previous) / previous) * 100;
  const abs = Math.abs(pct);
  const rounded = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
  if (pct > 0.05) return { text: `+${rounded}%`, tone: 'positive' };
  if (pct < -0.05) return { text: `-${rounded}%`, tone: 'negative' };
  return { text: '0%', tone: 'neutral' };
}

export function formatMoneyMil(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `R$ ${m.toFixed(m >= 10 ? 0 : 1).replace('.', ',')} M`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return `R$ ${k.toFixed(k >= 100 ? 0 : 0)} mil`.replace(' R$ 0 mil', 'R$ 0');
  }
  return formatCurrencyCompact(value);
}

/** Left Y-axis ticks for VGV: `0`, `125k`, `250k`, `1,0 M`. */
export function formatVgvAxisTick(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    const digits = m >= 10 || Number.isInteger(m) ? 0 : 1;
    return `${m.toFixed(digits).replace('.', ',')} M`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

/** Nice max for VGV axis (ceil to 1-2-5 × 10^n). */
export function niceVgvMax(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 100_000;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const n = raw / base;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * base;
}

export function peakVgvLabel(series: MonthPoint[]): string | null {
  if (!series.length) return null;
  const peak = series.reduce((best, pt) => (pt.vgv > best.vgv ? pt : best));
  return peak.vgv > 0 ? `pico em ${peak.label}` : null;
}

export function formatTicketMedio(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1_000_000) return formatMoneyMil(value);
  return `R$ ${Math.round(value / 1000)} mil`;
}

export function normalizeStage(stage: string | null | undefined): string {
  return (stage || '')
    .trim()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** CRM stages that count as closed/won for VGV (accents stripped via normalizeStage). */
export function isClosedStage(stage: string | null | undefined): boolean {
  const s = normalizeStage(stage);
  if (!s) return false;
  // Exact-ish tokens first; avoid matching "visita cancelada" etc.
  if (/^(fechamento|fechado|fechados|ganho|won|closed|vendido)$/.test(s)) return true;
  return /fechamento|fechados?\b|ganho|won|closed|vendido/.test(s);
}

/** Stock marked sold/unavailable — fallback when CRM has no Fechamento rows. */
export function isSoldDisponibilidade(disponibilidade: string | null | undefined): boolean {
  const s = (disponibilidade || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /^(indisponivel|vendido|sold)$/.test(s) || /vendido|sold/.test(s);
}

export function isVisitStage(stage: string | null | undefined): boolean {
  const s = normalizeStage(stage);
  return /visita\s*agendada|visita\s*realizada/.test(s);
}

export function mapChannel(source: string | null | undefined): string {
  const raw = (source || '').trim().toLowerCase();
  if (!raw) return 'outros';
  for (const ch of CHANNEL_MAP) {
    if (ch.match(raw)) return ch.key;
  }
  return 'outros';
}

export function channelMeta(key: string) {
  const found = CHANNEL_MAP.find((c) => c.key === key);
  if (found) return found;
  return {
    key: 'outros',
    label: 'Outros',
    match: () => false,
    barClass: 'bg-slate-400',
  };
}

export function CHANNEL_ORDER(): string[] {
  return [...CHANNEL_MAP.map((c) => c.key), 'outros'];
}

export function normalizePropertyType(typeRaw: string | null | undefined): 'casa' | 'apt' | 'terreno' {
  const type = (typeRaw || '').toLowerCase();
  if (type.includes('apart') || type.includes('condo') || type.includes('cobertura') || type.includes('studio') || type.includes('loft')) {
    return 'apt';
  }
  if (type.includes('terreno') || type.includes('lote') || type.includes('land') || type.includes('comercial') || type.includes('loja') || type.includes('sala')) {
    return 'terreno';
  }
  return 'casa';
}

export function monthKeysLast12(now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

export function shortMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return format(new Date(y, (m || 1) - 1, 1), 'MMM', { locale: ptBR }).replace('.', '');
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function avatarClassFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_CLASSES[Math.abs(h) % AVATAR_CLASSES.length];
}

export function sparkFromBuckets(values: number[], size = 8): number[] {
  if (values.length === 0) return Array.from({ length: size }, () => 0);
  if (values.length >= size) return values.slice(-size);
  return [...Array.from({ length: size - values.length }, () => 0), ...values];
}

export function pct(n: number, total: number): number {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

export function formatActivityWhen(iso: string, now = new Date()): string {
  try {
    const d = parseISO(iso);
    const days = differenceInCalendarDays(startOfDay(now), startOfDay(d));
    const time = format(d, 'HH:mm');
    if (days === 0) return `hoje · ${time}`;
    if (days === 1) return `ontem · ${time}`;
    return `${format(d, 'dd/MM')} · ${time}`;
  } catch {
    return iso;
  }
}

export function formatActionText(action: string, actorName?: string | null): string {
  const map: Record<string, string> = {
    'lead.created': 'Novo lead cadastrado',
    'lead.updated': 'Lead atualizado',
    'lead.stage_changed': 'Estágio de lead alterado',
    'lead.deleted': 'Lead removido',
    'property.created': 'Imóvel cadastrado',
    'property.updated': 'Imóvel atualizado',
    'property.availability_changed': 'Disponibilidade de imóvel alterada',
    'whatsapp.instance_connected': 'Instância WhatsApp reconectada',
    'whatsapp.instance_disconnected': 'Instância WhatsApp desconectada',
    'whatsapp.instance_status_updated': 'Status da instância WhatsApp atualizado',
    'user.created': 'Usuário convidado',
    'user.activated': 'Acesso de usuário reativado',
    'user.deactivated': 'Acesso de usuário desativado',
    'agenda.event_created': 'Compromisso criado na agenda',
    'permissions.updated': 'Permissões atualizadas',
  };
  const base = map[action] || action.replace(/\./g, ' ');
  if (actorName) return `${base} · ${actorName}`;
  return base;
}

export function activityTone(action: string): ActivityRow['tone'] {
  if (/whatsapp|instance/.test(action)) return 'amber';
  if (/user|permission/.test(action)) return 'purple';
  if (/lead|agenda|visit/.test(action)) return 'green';
  if (/property|contract/.test(action)) return 'blue';
  return 'green';
}

export { formatCurrencyCompact };
