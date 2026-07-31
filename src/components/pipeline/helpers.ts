import type { LeadStage } from '@/types/kanban';
import type { KanbanLead } from '@/types/kanban';
import { shortListingLabel, shortPropertyId } from '@/lib/listingBasics';

export type StageAccent = {
  id: string;
  title: LeadStage;
  shortLabel: string;
  /** Tailwind bg class for dots / bars */
  dot: string;
  /** Accent bar under column header */
  bar: string;
  /** Soft column header bg */
  softBg: string;
};

export const PIPELINE_STAGES: readonly StageAccent[] = [
  { id: 'novo-lead', title: 'Novo Lead', shortLabel: 'Novo', dot: 'bg-sky-400', bar: 'bg-sky-400', softBg: 'bg-sky-50 dark:bg-sky-950/30' },
  { id: 'qualificado', title: 'Qualificado', shortLabel: 'Qualif.', dot: 'bg-emerald-500', bar: 'bg-emerald-500', softBg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { id: 'visita-agendada', title: 'Visita Agendada', shortLabel: 'Visita', dot: 'bg-violet-500', bar: 'bg-violet-500', softBg: 'bg-violet-50 dark:bg-violet-950/30' },
  { id: 'visita-realizada', title: 'Visita Realizada', shortLabel: 'Realiz.', dot: 'bg-teal-500', bar: 'bg-teal-500', softBg: 'bg-teal-50 dark:bg-teal-950/30' },
  { id: 'visita-cancelada', title: 'Visita Cancelada', shortLabel: 'Cancel.', dot: 'bg-rose-400', bar: 'bg-rose-400', softBg: 'bg-rose-50 dark:bg-rose-950/30' },
  { id: 'em-negociacao', title: 'Em Negociação', shortLabel: 'Negoc.', dot: 'bg-amber-400', bar: 'bg-amber-400', softBg: 'bg-amber-50 dark:bg-amber-950/30' },
  { id: 'documentacao', title: 'Documentação', shortLabel: 'Docs', dot: 'bg-blue-700', bar: 'bg-blue-700', softBg: 'bg-blue-50 dark:bg-blue-950/30' },
  { id: 'contrato', title: 'Contrato', shortLabel: 'Contrato', dot: 'bg-amber-700', bar: 'bg-amber-700', softBg: 'bg-amber-50 dark:bg-amber-950/40' },
  { id: 'fechamento', title: 'Fechamento', shortLabel: 'Fechado', dot: 'bg-emerald-800', bar: 'bg-emerald-800', softBg: 'bg-emerald-50 dark:bg-emerald-950/40' },
] as const;

export function normalizeStage(stage: string): string {
  return (stage || '')
    .trim()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function formatCurrencyBRL(value: number): string {
  if (!value || value <= 0) return '';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** Compact money: R$ 3,2 M / R$ 498 mil / R$ 12.500 */
export function formatCompactBRL(value: number): string {
  if (!value || value <= 0) return '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    const formatted = m >= 10 ? m.toFixed(0) : m.toFixed(1).replace('.', ',');
    return `R$ ${formatted} M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    if (k >= 100) return `R$ ${Math.round(k)} mil`;
    return `R$ ${k.toFixed(k >= 10 ? 0 : 1).replace('.', ',')} mil`;
  }
  return formatCurrencyBRL(value);
}

export function formatRelativePt(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  if (diffMs < 0) return 'agora';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} mês${months > 1 ? 'es' : ''}`;
  const years = Math.floor(days / 365);
  return `há ${years}a`;
}

export function leadInterestSnippet(lead: KanbanLead): string {
  const interest = shortListingLabel(lead.interesse);
  if (interest) return interest;
  const propertyId = shortPropertyId(lead.imovel_interesse);
  if (propertyId) {
    return lead.imovel_tipo ? `${propertyId} · ${lead.imovel_tipo}` : propertyId;
  }
  // Dump stored in imovel_interesse → show tipo only
  return shortListingLabel(lead.imovel_interesse);
}

/** Initials for pipeline card avatar (mockup). Empty / placeholder names → null (show User icon). */
export function leadInitials(nome?: string | null): string | null {
  const raw = String(nome || '').trim();
  if (!raw || raw === 'Sem nome' || raw === '~') return null;
  if (raw.startsWith('@')) {
    const handle = raw.slice(1).replace(/[^a-zA-Z0-9]/g, '');
    if (!handle) return null;
    return handle.slice(0, 2).toUpperCase();
  }
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ''}${words[words.length - 1][0] ?? ''}`.toUpperCase() || null;
}

export function sumLeadValues(leads: KanbanLead[]): number {
  return leads.reduce((sum, l) => sum + (l.valorEstimado || l.valor || 0), 0);
}

export function isOpenPipelineStage(stage: string): boolean {
  return normalizeStage(stage) !== 'fechamento';
}

export function periodLabelPt(date = new Date()): string {
  const month = date.toLocaleDateString('pt-BR', { month: 'long' });
  return `${month} ${date.getFullYear()}`;
}

export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function daysBetween(aIso: string, bIso: string): number | null {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
