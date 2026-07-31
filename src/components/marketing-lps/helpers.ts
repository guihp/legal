import type { PipelineKpi } from '@/components/pipeline/PipelineKpis';

export type MarketingLpsKpiItem = PipelineKpi & { progress?: number; progressClass?: string };

export type LpStatus = 'publicada' | 'rascunho' | 'despublicada';

export type LpStatusFilter = 'todas' | LpStatus;

export type LpSort = 'views' | 'recent';

export type LpRow = {
  id: string;
  slug: string;
  is_published: boolean;
  views: number | null;
  property_id: number;
  custom_color: string | null;
  page_title: string | null;
  created_at: string | null;
  updated_at: string | null;
  leadsCount: number;
  imoveisvivareal: {
    listing_id: string | null;
    bairro: string | null;
    cidade: string | null;
    tipo_imovel: string | null;
    tipo_categoria: string | null;
    endereco: string | null;
    imagens: string[] | null;
  } | null;
};

export type TrafficSource = {
  key: string;
  label: string;
  views: number;
  barClass: string;
};

export const SUBTITLE =
  'Cada LP fica em /imovel/slug. Para criar ou editar, abra o imóvel em Propriedades e use o bloco de Landing Page.';

/** Heurística: despublicada = já teve views e hoje não está publicada; senão rascunho. */
export function resolveLpStatus(row: Pick<LpRow, 'is_published' | 'views' | 'created_at' | 'updated_at'>): LpStatus {
  if (row.is_published) return 'publicada';
  const views = Number(row.views) || 0;
  if (views > 0) return 'despublicada';
  if (row.created_at && row.updated_at && row.created_at !== row.updated_at && views === 0) {
    // Soft: se foi editada após criação sem views, ainda trata como rascunho
  }
  return 'rascunho';
}

export function statusLabel(status: LpStatus): string {
  switch (status) {
    case 'publicada':
      return 'Publicada';
    case 'despublicada':
      return 'Despublicada';
    default:
      return 'Rascunho';
  }
}

export function categoryBadge(tipo?: string | null, categoria?: string | null): {
  label: string;
  className: string;
} {
  const raw = String(categoria || tipo || '').trim().toLowerCase();
  if (/apto|apart/.test(raw)) {
    return { label: 'APTO', className: 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300' };
  }
  if (/terreno|lote/.test(raw)) {
    return { label: 'TERRENO', className: 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200' };
  }
  if (/sala|comercial|loja/.test(raw)) {
    return { label: 'COMERCIAL', className: 'bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300' };
  }
  if (/casa|home/.test(raw)) {
    return { label: 'CASA', className: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' };
  }
  const fallback = String(tipo || categoria || 'IMÓVEL')
    .trim()
    .slice(0, 10)
    .toUpperCase() || 'IMÓVEL';
  return { label: fallback, className: 'bg-muted text-muted-foreground' };
}

export function propertyTitle(row: LpRow): string {
  const title = String(row.page_title || '').trim();
  if (title) return title;
  const tipo = String(row.imoveisvivareal?.tipo_imovel || '').trim();
  const bairro = String(row.imoveisvivareal?.bairro || '').trim();
  if (tipo && bairro) return `${tipo} · ${bairro}`;
  if (tipo) return tipo;
  if (bairro) return bairro;
  return `Imóvel #${row.property_id}`;
}

export function propertyAddress(row: LpRow): string {
  const end = String(row.imoveisvivareal?.endereco || '').trim();
  if (end) {
    const short = end.length > 48 ? `${end.slice(0, 48).trim()}…` : end;
    return short;
  }
  const loc = [row.imoveisvivareal?.bairro, row.imoveisvivareal?.cidade].filter(Boolean).join(', ');
  return loc || '—';
}

export function listingCode(row: LpRow): string {
  const listing = String(row.imoveisvivareal?.listing_id || '').trim();
  if (listing) {
    if (/^iafe/i.test(listing)) return listing.toUpperCase();
    const padded = listing.padStart(3, '0');
    return `IAFE-${padded}`;
  }
  return `ID-${row.property_id}`;
}

export function thumbUrl(row: LpRow): string | null {
  const imgs = row.imoveisvivareal?.imagens;
  if (Array.isArray(imgs) && imgs.length > 0 && imgs[0]) return String(imgs[0]);
  return null;
}

export function formatLpUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  }).format(d);
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${date}, ${time}`;
}

export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

export function conversionPct(views: number, leads: number): number {
  if (views <= 0) return 0;
  return Math.round((leads / views) * 1000) / 10;
}

export function performanceBarPct(views: number, maxViews: number): number {
  if (maxViews <= 0) return 0;
  return Math.min(100, Math.round((views / maxViews) * 100));
}

export function matchesSearch(row: LpRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    propertyTitle(row),
    row.slug,
    row.imoveisvivareal?.bairro,
    row.imoveisvivareal?.cidade,
    row.imoveisvivareal?.endereco,
    row.imoveisvivareal?.listing_id,
    listingCode(row),
    String(row.property_id),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

export function buildMarketingLpsKpis(params: {
  totalLps: number;
  portfolioCount: number;
  published: number;
  drafts: number;
  unpublished: number;
  views30d: number;
  leadsGenerated: number;
}): MarketingLpsKpiItem[] {
  const { totalLps, portfolioCount, published, drafts, views30d, leadsGenerated } = params;
  const pubPct = totalLps > 0 ? Math.round((published / totalLps) * 100) : 0;
  const avgViews = totalLps > 0 ? Math.round(views30d / totalLps) : 0;
  const conv = conversionPct(views30d, leadsGenerated);

  return [
    {
      key: 'total',
      label: 'Total de LPs',
      value: String(totalLps),
      hint: `de ${portfolioCount} imóveis do portfólio`,
      hintTone: 'neutral',
      dot: 'bg-emerald-600',
      progress: portfolioCount > 0 ? Math.min(100, (totalLps / portfolioCount) * 100) : 0,
      progressClass: 'bg-emerald-600',
    },
    {
      key: 'published',
      label: 'Publicadas',
      value: String(published),
      hint: `${pubPct}% do total`,
      hintTone: 'positive',
      dot: 'bg-emerald-500',
      progress: pubPct,
      progressClass: 'bg-emerald-500',
    },
    {
      key: 'drafts',
      label: 'Rascunhos',
      value: String(drafts),
      hint: drafts > 0 ? 'aguardando publicação' : 'nenhum rascunho',
      hintTone: drafts > 0 ? 'negative' : 'neutral',
      dot: 'bg-amber-500',
      progress: totalLps > 0 ? (drafts / totalLps) * 100 : 0,
      progressClass: 'bg-amber-500',
    },
    {
      key: 'views',
      label: 'Views (30 d)',
      value: String(views30d),
      hint: totalLps > 0 ? `média ${avgViews} por LP` : 'sem LPs',
      hintTone: 'neutral',
      dot: 'bg-sky-500',
      progress: Math.min(100, views30d > 0 ? 40 + Math.min(60, views30d / 5) : 0),
      progressClass: 'bg-sky-500',
    },
    {
      key: 'leads',
      label: 'Leads geradas',
      value: String(leadsGenerated),
      hint: views30d > 0 ? `conversão ${conv.toString().replace('.', ',')}%` : 'sem views no período',
      hintTone: conv >= 5 ? 'positive' : 'neutral',
      dot: 'bg-violet-500',
      progress: Math.min(100, conv * 8),
      progressClass: 'bg-violet-500',
    },
  ];
}

/** Agrupa visitas de LP em buckets amigáveis do mockup. */
export function buildTrafficSources(
  visits: Array<{ referrer_kind?: string | null; utm_source?: string | null; utm_medium?: string | null }>,
): TrafficSource[] {
  const buckets: Record<string, number> = {
    vitrine: 0,
    whatsapp: 0,
    meta: 0,
    instagram: 0,
    other: 0,
  };

  for (const v of visits) {
    const utm = String(v.utm_source || '').toLowerCase();
    const medium = String(v.utm_medium || '').toLowerCase();
    const kind = String(v.referrer_kind || '').toLowerCase();

    if (/meta|facebook|fb|ads/.test(utm) || /cpc|paid/.test(medium)) {
      buckets.meta += 1;
    } else if (/instagram|ig/.test(utm) || /instagram/.test(kind)) {
      buckets.instagram += 1;
    } else if (/whats|wa|ia|bot|chat/.test(utm) || /whats/.test(medium)) {
      buckets.whatsapp += 1;
    } else if (/vitrine|site|organic/.test(utm) || kind === 'referral' || kind === 'direct') {
      buckets.vitrine += 1;
    } else if (kind === 'social') {
      buckets.instagram += 1;
    } else {
      buckets.other += 1;
    }
  }

  // Redistribute "other" into vitrine soft bucket so the card isn't empty
  if (buckets.other > 0 && buckets.vitrine === 0 && buckets.whatsapp === 0 && buckets.meta === 0) {
    buckets.vitrine = buckets.other;
    buckets.other = 0;
  }

  const rows: TrafficSource[] = [
    { key: 'vitrine', label: 'Site vitrine', views: buckets.vitrine, barClass: 'bg-emerald-400' },
    { key: 'whatsapp', label: 'WhatsApp / IA', views: buckets.whatsapp, barClass: 'bg-sky-300' },
    { key: 'meta', label: 'Meta Ads', views: buckets.meta, barClass: 'bg-violet-400' },
    { key: 'instagram', label: 'Instagram bio', views: buckets.instagram, barClass: 'bg-orange-400' },
  ];

  // If everything is zero, show a soft proportional placeholder from total LP views context — caller may pass empty
  return rows;
}

export function exportLpsCsv(rows: LpRow[]): void {
  const header = ['titulo', 'slug', 'status', 'views', 'leads', 'listing_id', 'bairro', 'atualizado_em'];
  const lines = rows.map((r) => {
    const status = statusLabel(resolveLpStatus(r));
    const cells = [
      propertyTitle(r),
      `/imovel/${r.slug}`,
      status,
      String(r.views ?? 0),
      String(r.leadsCount ?? 0),
      listingCode(r),
      r.imoveisvivareal?.bairro || '',
      r.updated_at || '',
    ];
    return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
  });
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `landing-pages-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
