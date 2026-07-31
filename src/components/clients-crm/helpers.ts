import type { KanbanLead } from '@/types/kanban';
import type { PipelineKpi } from '@/components/pipeline/PipelineKpis';
import {
  formatCompactBRL,
  formatCurrencyBRL,
  formatRelativePt,
  leadInterestSnippet,
  normalizeStage,
  sumLeadValues,
} from '@/components/pipeline/helpers';
import { crmStageBadgeClasses } from '@/lib/crmKanbanStages';

export type CrmFilterTab =
  | 'todos'
  | 'ativos'
  | 'prospects'
  | 'negociacao'
  | 'fechados'
  | 'perdidos';

export type CrmViewMode = 'tabela' | 'cards';

const ATIVOS = new Set([
  'qualificado',
  'visita agendada',
  'visita realizada',
  'em negociação',
  'documentação',
  'contrato',
]);

const PROSPECTS = new Set(['novo lead']);

const NEGOCIACAO = new Set(['em negociação', 'documentação', 'contrato']);

const FECHADOS = new Set(['fechamento', 'fechado']);

const PERDIDOS = new Set(['visita cancelada', 'perdido', 'desistiu']);

export function leadMatchesCrmTab(lead: KanbanLead, tab: CrmFilterTab): boolean {
  if (tab === 'todos') return true;
  const s = normalizeStage(lead.stage || '');
  switch (tab) {
    case 'ativos':
      return ATIVOS.has(s);
    case 'prospects':
      return PROSPECTS.has(s);
    case 'negociacao':
      return NEGOCIACAO.has(s);
    case 'fechados':
      return FECHADOS.has(s);
    case 'perdidos':
      return PERDIDOS.has(s);
    default:
      return true;
  }
}

export function countByCrmTab(leads: KanbanLead[]): Record<CrmFilterTab, number> {
  const counts: Record<CrmFilterTab, number> = {
    todos: leads.length,
    ativos: 0,
    prospects: 0,
    negociacao: 0,
    fechados: 0,
    perdidos: 0,
  };
  for (const lead of leads) {
    const s = normalizeStage(lead.stage || '');
    if (ATIVOS.has(s)) counts.ativos += 1;
    if (PROSPECTS.has(s)) counts.prospects += 1;
    if (NEGOCIACAO.has(s)) counts.negociacao += 1;
    if (FECHADOS.has(s)) counts.fechados += 1;
    if (PERDIDOS.has(s)) counts.perdidos += 1;
  }
  return counts;
}

export function sourceBadgeClasses(source: string): string {
  const s = (source || '').toLowerCase();
  if (s.includes('whatsapp') || s === 'wa') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40';
  }
  if (s.includes('instagram') || s === 'ig') {
    return 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/40';
  }
  if (s.includes('facebook') || s.includes('meta')) {
    return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40';
  }
  if (s.includes('site') || s.includes('website') || s.includes('web')) {
    return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40';
  }
  return 'bg-muted/50 text-muted-foreground border-border';
}

export function stageSubLabel(lead: KanbanLead): string {
  const s = normalizeStage(lead.stage || '');
  const rel = formatRelativePt(lead.updatedAt || lead.createdAt);
  if (FECHADOS.has(s) && lead.updatedAt) {
    try {
      const d = new Date(lead.updatedAt);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      }
    } catch {
      /* ignore */
    }
  }
  if (PERDIDOS.has(s) && rel) return rel;
  if (!lead.id_corretor_responsavel && PROSPECTS.has(s)) return 'sem corretor';
  if (rel) return `${rel} neste estágio`;
  return '';
}

export function buildCrmKpis(leads: KanbanLead[]): PipelineKpi[] {
  const items: PipelineKpi[] = [];
  const total = leads.length;
  const counts = countByCrmTab(leads);
  const unassigned = leads.filter((l) => !l.id_corretor_responsavel).length;

  const monthAgo = Date.now() - 30 * 86_400_000;
  const newLast30 = leads.filter((l) => {
    const t = l.createdAt ? new Date(l.createdAt).getTime() : NaN;
    return !Number.isNaN(t) && t >= monthAgo;
  }).length;

  items.push({
    key: 'total',
    label: 'Total de clientes',
    value: String(total),
    hint: newLast30 > 0 ? `+${newLast30} nos últimos 30 dias` : undefined,
    hintTone: newLast30 > 0 ? 'positive' : 'neutral',
    dot: 'bg-emerald-500',
  });

  const ativosPct = total > 0 ? Math.round((counts.ativos / total) * 100) : 0;
  items.push({
    key: 'ativos',
    label: 'Carteira ativa',
    value: String(counts.ativos),
    hint: total > 0 ? `${ativosPct}% da base` : undefined,
    hintTone: 'neutral',
    dot: 'bg-sky-500',
  });

  items.push({
    key: 'prospects',
    label: 'Prospects',
    value: String(counts.prospects),
    hint: unassigned > 0 ? `${unassigned} sem corretor atribuído` : undefined,
    hintTone: 'neutral',
    dot: 'bg-amber-400',
  });

  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const fechadosAno = leads.filter((l) => {
    if (!FECHADOS.has(normalizeStage(l.stage || ''))) return false;
    const ts = l.updatedAt || l.createdAt;
    if (!ts) return true;
    const t = new Date(ts).getTime();
    return Number.isNaN(t) || t >= yearStart;
  });
  const fechadosValue = sumLeadValues(fechadosAno);
  items.push({
    key: 'fechados',
    label: 'Fechados (ano)',
    value: String(fechadosAno.length),
    hint: fechadosValue > 0 ? `${formatCompactBRL(fechadosValue)} em vendas` : undefined,
    hintTone: 'neutral',
    dot: 'bg-violet-500',
  });

  if (total > 0) {
    const conv = (counts.fechados / total) * 100;
    items.push({
      key: 'conversao',
      label: 'Taxa de conversão',
      value: `${conv.toFixed(1).replace('.', ',')}%`,
      hint: `${counts.fechados} fechados · ${total} na base`,
      hintTone: 'neutral',
      dot: 'bg-lime-500',
    });
  }

  return items;
}

export function brokerDisplayName(
  lead: KanbanLead,
  brokers: { id: string; full_name: string }[],
  profileId?: string | null,
): string {
  if (lead.corretor?.nome) return lead.corretor.nome;
  if (!lead.id_corretor_responsavel) return 'Sem corretor';
  const fromList = brokers.find((b) => b.id === lead.id_corretor_responsavel)?.full_name;
  if (fromList) return fromList;
  if (profileId && lead.id_corretor_responsavel === profileId) return 'Você';
  return 'Corretor';
}

export {
  formatCurrencyBRL,
  formatRelativePt,
  leadInterestSnippet,
  normalizeStage,
  crmStageBadgeClasses,
};
