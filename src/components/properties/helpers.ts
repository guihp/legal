import type { PipelineKpi } from '@/components/pipeline/PipelineKpis';
import { formatCompactBRL } from '@/components/pipeline/helpers';

export type PropertiesFilterTab = 'todos' | 'disponiveis' | 'venda' | 'aluguel';

export type PropertiesSortKey = 'recentes' | 'valor' | 'area';

export type PropertiesStats = {
  total: number;
  disponiveis: number;
  indisponiveis: number;
  reforma: number;
  aluguel: number;
  venda: number;
  ticketMedio: number;
  cadastradosMes: number;
};

export const EMPTY_PROPERTIES_STATS: PropertiesStats = {
  total: 0,
  disponiveis: 0,
  indisponiveis: 0,
  reforma: 0,
  aluguel: 0,
  venda: 0,
  ticketMedio: 0,
  cadastradosMes: 0,
};

export function formatPropertyPrice(price: number, modalidade?: string | null): string {
  if (!price || price <= 0) return '—';
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(price);
  if (modalidade === 'Rent') return `${formatted} / mês`;
  return formatted;
}

export function formatTicketMedio(value: number): string {
  if (!value || value <= 0) return '—';
  return formatCompactBRL(value) || '—';
}

export function translateTipoImovel(v: string): string {
  const map: Record<string, string> = {
    Home: 'Casa',
    Apartment: 'Apartamento',
    Building: 'Prédio',
    Condo: 'Condomínio',
    'Land Lot': 'Terreno',
    Sobrado: 'Sobrado',
    Loja: 'Loja',
    Agricultural: 'Agrícola',
    Studio: 'Studio',
    House: 'Casa',
    Land: 'Terreno',
    Store: 'Loja',
  };
  return map[v] || v;
}

export function translateModalidade(v?: string | null): string | null {
  if (!v) return null;
  if (v === 'For Sale') return 'Venda';
  if (v === 'Rent') return 'Aluguel';
  if (v === 'Sale/Rent') return 'Venda/Aluguel';
  return v;
}

export function translateCategoria(v?: string | null): string | null {
  if (!v) return null;
  if (v === 'Residential') return 'Residencial';
  if (v === 'Commercial') return 'Comercial';
  return v;
}

export function availabilityLabel(
  availability?: 'disponivel' | 'indisponivel' | 'reforma' | string | null,
): string {
  const v = availability || 'disponivel';
  if (v === 'disponivel') return 'Disponível';
  if (v === 'indisponivel') return 'Indisponível';
  if (v === 'reforma') return 'Reforma';
  return String(v);
}

export function availabilityBadgeClasses(
  availability?: 'disponivel' | 'indisponivel' | 'reforma' | string | null,
): string {
  const v = availability || 'disponivel';
  if (v === 'indisponivel') {
    return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';
  }
  if (v === 'reforma') {
    return 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
  }
  return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
}

export function availabilityDotClass(
  availability?: 'disponivel' | 'indisponivel' | 'reforma' | string | null,
): string {
  const v = availability || 'disponivel';
  if (v === 'indisponivel') return 'bg-rose-500';
  if (v === 'reforma') return 'bg-amber-400';
  return 'bg-emerald-600';
}

export function buildPropertiesKpis(stats: PropertiesStats): PipelineKpi[] {
  const pct =
    stats.total > 0 ? Math.round((stats.disponiveis / stats.total) * 100) : 0;

  return [
    {
      key: 'total',
      label: 'Total',
      value: String(stats.total),
      hint:
        stats.cadastradosMes > 0
          ? `+${stats.cadastradosMes} cadastrado${stats.cadastradosMes !== 1 ? 's' : ''} no mês`
          : undefined,
      hintTone: 'positive',
      dot: 'bg-emerald-600',
    },
    {
      key: 'disponiveis',
      label: 'Disponíveis',
      value: String(stats.disponiveis),
      hint: stats.total > 0 ? `${pct}% do estoque` : undefined,
      hintTone: 'neutral',
      dot: 'bg-teal-500',
    },
    {
      key: 'indisponiveis',
      label: 'Indisponíveis',
      value: String(stats.indisponiveis),
      hint: stats.indisponiveis > 0 ? 'fora do estoque ativo' : 'nenhum no momento',
      hintTone: 'neutral',
      dot: 'bg-amber-400',
    },
    {
      key: 'reforma',
      label: 'Em reforma',
      value: String(stats.reforma),
      hint: stats.reforma > 0 ? 'aguardando liberação' : undefined,
      hintTone: 'neutral',
      dot: 'bg-violet-500',
    },
    {
      key: 'ticket',
      label: 'Ticket',
      value: formatTicketMedio(stats.ticketMedio),
      hint: stats.ticketMedio > 0 ? 'média do portfólio' : undefined,
      hintTone: 'neutral',
      dot: 'bg-sky-500',
    },
  ];
}

export function buildPropertiesSubtitle(total: number): string {
  return `Portfólio ativo · ${total} unidade${total !== 1 ? 's' : ''}`;
}

export type PageItem = number | 'ellipsis';

export function buildPaginationRange(
  current: number,
  total: number,
  siblingCount = 1,
): PageItem[] {
  if (total <= 1) return [1];
  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (let i = current - siblingCount; i <= current + siblingCount; i++) {
    if (i >= 1 && i <= total) pages.add(i);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: PageItem[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('ellipsis');
    result.push(p);
    prev = p;
  }
  return result;
}
