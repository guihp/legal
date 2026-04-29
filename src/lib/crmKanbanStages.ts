import type { LeadStage } from '@/types/kanban';

/** Mesmos títulos das colunas do Kanban em `ClientsView` — fonte única para menu e badges. */
export const CRM_KANBAN_STAGE_TITLES: readonly LeadStage[] = [
  'Novo Lead',
  'Qualificado',
  'Visita Agendada',
  'Visita Cancelada',
  'Em Negociação',
  'Documentação',
  'Contrato',
  'Fechamento',
] as const;

function normalizeStageKey(stage: string): string {
  return (stage || '')
    .trim()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Classes para badge do estágio CRM (modo claro/escuro). */
export function crmStageBadgeClasses(stage: string): string {
  const s = normalizeStageKey(stage);
  const map: Record<string, string> = {
    'novo lead': 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/50',
    qualificado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/50',
    'visita agendada': 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/50',
    'visita cancelada': 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/50',
    'em negociação': 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/50',
    documentação: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/50',
    contrato: 'bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border-yellow-500/50',
    fechamento: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/50',
  };
  return map[s] || 'bg-muted/40 text-foreground border-border';
}
