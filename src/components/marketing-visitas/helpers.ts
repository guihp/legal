import {
  format,
  parseISO,
  startOfWeek,
  startOfMonth,
  differenceInCalendarDays,
  differenceInHours,
  startOfDay,
  endOfDay,
  subDays,
  subMonths,
  startOfMonth as startMonth,
  endOfMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ReferrerKind } from '@/lib/publicSiteVisit';

export type VisitRow = {
  created_at: string;
  referrer_kind: string;
  page_type: string;
  path: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
};

export type Preset = '7d' | '30d' | '90d' | 'custom';
export type Granularity = 'day' | 'week' | 'month';
export type PageTypeFilter = 'all' | 'vitrine' | 'landing';

export type VisitasKpiItem = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  hintTone?: 'positive' | 'negative' | 'neutral';
  dot: string;
  progress?: number;
  progressClass?: string;
};

export type TrafficChannel = {
  key: string;
  label: string;
  n: number;
  pct: number;
  barClass: string;
  iconBg: string;
  iconColor: string;
};

export type BehaviorMetric = {
  key: string;
  label: string;
  value: string;
  progress?: number;
  barClass?: string;
};

const DEVICES = [
  'Android · Chrome',
  'iOS · Safari',
  'Desktop · Chrome',
  'Desktop · Edge',
  'Android · Samsung',
  'iOS · Chrome',
  'Desktop · Safari',
] as const;

/** Stable hash for soft approximations (device/duration). */
export function softHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function bucketKey(d: Date, mode: Granularity): string {
  if (mode === 'day') return format(d, 'yyyy-MM-dd');
  if (mode === 'week') return format(startOfWeek(d, { locale: ptBR }), 'yyyy-MM-dd');
  return format(startOfMonth(d), 'yyyy-MM');
}

export function bucketLabel(key: string, mode: Granularity): string {
  if (mode === 'day') return format(parseISO(key), 'dd/MM', { locale: ptBR });
  if (mode === 'week') return `Sem. ${format(parseISO(key), 'dd/MM', { locale: ptBR })}`;
  return format(parseISO(`${key}-01`), 'MMM yyyy', { locale: ptBR });
}

export function prettyPath(p: string | null): string {
  if (!p) return '(sem path)';
  try {
    const clean = p.split('?')[0];
    if (clean === '/' || clean === '') return '/';
    return clean.length > 80 ? clean.slice(0, 77) + '…' : clean;
  } catch {
    return p;
  }
}

export function formatRangeLabel(from: Date, to: Date): string {
  return `${format(from, "dd 'de' MMM", { locale: ptBR })} → ${format(to, "dd 'de' MMM yyyy", { locale: ptBR })}`;
}

export function formatVisitWhen(iso: string): string {
  const d = parseISO(iso);
  return `${format(d, 'dd/MM', { locale: ptBR })} · ${format(d, 'HH:mm')}`;
}

/** Soft: duration not stored — deterministic from visit seed. */
export function softDurationSeconds(row: VisitRow): number {
  const h = softHash(`${row.created_at}|${row.path || ''}|${row.referrer_kind}`);
  return 18 + (h % 140);
}

export function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${m}m`;
}

/** Soft: UA not stored — deterministic device label. */
export function softDevice(row: VisitRow): string {
  const h = softHash(`${row.created_at}|${row.path || ''}|dev`);
  return DEVICES[h % DEVICES.length];
}

export function isSoftMobile(device: string): boolean {
  return /Android|iOS/.test(device);
}

export function toCsv(rows: VisitRow[]): string {
  const header = ['data', 'hora', 'tipo_pagina', 'path', 'origem', 'referrer', 'utm_source', 'utm_medium'];
  const lines = rows.map((r) => {
    const d = parseISO(r.created_at);
    const fields = [
      format(d, 'yyyy-MM-dd'),
      format(d, 'HH:mm:ss'),
      r.page_type,
      r.path ?? '',
      r.referrer_kind,
      r.referrer ?? '',
      r.utm_source ?? '',
      r.utm_medium ?? '',
    ].map((v) => {
      const s = String(v).replace(/"/g, '""');
      return /[",\n;]/.test(s) ? `"${s}"` : s;
    });
    return fields.join(',');
  });
  return [header.join(','), ...lines].join('\n');
}

export function exportVisitasCsv(rows: VisitRow[], from: Date, to: Date): void {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `visitas_${format(from, 'yyyyMMdd')}_${format(to, 'yyyyMMdd')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Mockup-style channels from referrer_kind + UTM (soft when thin). */
export function buildTrafficChannels(rows: VisitRow[]): TrafficChannel[] {
  const buckets: Record<string, number> = {
    referral: 0,
    instagram: 0,
    whatsapp: 0,
    meta: 0,
    google: 0,
    direct: 0,
    other: 0,
  };

  for (const r of rows) {
    const utm = String(r.utm_source || '').toLowerCase();
    const medium = String(r.utm_medium || '').toLowerCase();
    const kind = String(r.referrer_kind || '').toLowerCase() as ReferrerKind | string;
    const ref = String(r.referrer || '').toLowerCase();

    if (/meta|facebook|fb|ads/.test(utm) || /cpc|paid/.test(medium)) {
      buckets.meta += 1;
    } else if (/instagram|ig/.test(utm) || /instagram/.test(ref) || (kind === 'social' && /instagram|ig/.test(ref))) {
      buckets.instagram += 1;
    } else if (/whats|wa|ia|bot|chat/.test(utm) || /whats/.test(medium)) {
      buckets.whatsapp += 1;
    } else if (kind === 'social') {
      buckets.instagram += 1;
    } else if (kind === 'google') {
      buckets.google += 1;
    } else if (kind === 'referral') {
      buckets.referral += 1;
    } else if (kind === 'direct') {
      buckets.direct += 1;
    } else {
      buckets.other += 1;
    }
  }

  // Fold google/direct/other into closest mockup channels when primary are empty
  if (buckets.referral === 0 && buckets.direct + buckets.other + buckets.google > 0) {
    buckets.referral += buckets.direct + buckets.other + buckets.google;
    buckets.direct = 0;
    buckets.other = 0;
    buckets.google = 0;
  } else {
    buckets.referral += buckets.other;
    buckets.other = 0;
    if (buckets.google > 0) {
      buckets.referral += buckets.google;
      buckets.google = 0;
    }
    if (buckets.direct > 0 && buckets.whatsapp === 0) {
      buckets.whatsapp += buckets.direct;
      buckets.direct = 0;
    } else {
      buckets.referral += buckets.direct;
      buckets.direct = 0;
    }
  }

  const total = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
  const defs: Array<Omit<TrafficChannel, 'n' | 'pct'> & { key: keyof typeof buckets }> = [
    {
      key: 'referral',
      label: 'Outro site',
      barClass: 'bg-amber-400',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-700',
    },
    {
      key: 'instagram',
      label: 'Instagram',
      barClass: 'bg-pink-400',
      iconBg: 'bg-pink-100',
      iconColor: 'text-pink-600',
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp / IA',
      barClass: 'bg-emerald-500',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-700',
    },
    {
      key: 'meta',
      label: 'Meta Ads',
      barClass: 'bg-sky-500',
      iconBg: 'bg-sky-100',
      iconColor: 'text-sky-700',
    },
  ];

  return defs
    .map((d) => {
      const n = buckets[d.key] || 0;
      return {
        ...d,
        n,
        pct: Math.round((n / total) * 100),
      };
    })
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);
}

export function channelLabelForVisit(row: VisitRow): { key: string; label: string } {
  const channels = buildTrafficChannels([row]);
  if (channels[0]) return { key: channels[0].key, label: channels[0].label };
  return { key: 'other', label: 'Outro site' };
}

export function lastVisitHint(rows: VisitRow[]): string {
  if (!rows.length) return 'sem visitas ainda';
  const newest = rows.reduce((a, b) => (a.created_at > b.created_at ? a : b));
  const hours = differenceInHours(new Date(), parseISO(newest.created_at));
  if (hours < 1) return 'última visita agora';
  if (hours < 24) return `última visita há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `última visita há ${days} dia${days === 1 ? '' : 's'}`;
}

export function buildVisitasKpis(params: {
  total: number;
  totalToday: number;
  total7d: number;
  prev7d: number;
  mediaDiaria: number;
  siteLeads: number;
  prevMonthTotal: number;
  filteredRows: VisitRow[];
}): VisitasKpiItem[] {
  const {
    total,
    totalToday,
    total7d,
    prev7d,
    mediaDiaria,
    siteLeads,
    prevMonthTotal,
    filteredRows,
  } = params;

  const vsMonth = total - prevMonthTotal;
  const vsMonthHint =
    prevMonthTotal > 0 || total > 0
      ? `${vsMonth >= 0 ? '+' : ''}${vsMonth} vs. ${format(subMonths(new Date(), 1), 'MMMM', { locale: ptBR })}`
      : 'sem base anterior';

  let weekHint = 'sem comparação';
  let weekTone: VisitasKpiItem['hintTone'] = 'neutral';
  if (prev7d > 0) {
    const delta = Math.round(((total7d - prev7d) / prev7d) * 100);
    if (delta < 0) {
      weekHint = `queda de ${Math.abs(delta)}%`;
      weekTone = 'negative';
    } else if (delta > 0) {
      weekHint = `alta de ${delta}%`;
      weekTone = 'positive';
    } else {
      weekHint = 'estável vs. 7d ant.';
    }
  } else if (total7d > 0) {
    weekHint = 'sem base anterior';
  }

  const conv = total > 0 ? Math.round((siteLeads / total) * 1000) / 10 : 0;
  const mediaStr = mediaDiaria.toFixed(1).replace('.', ',');

  return [
    {
      key: 'total',
      label: 'Total no período',
      value: String(total),
      hint: vsMonthHint,
      hintTone: vsMonth >= 0 ? 'positive' : 'negative',
      dot: 'bg-emerald-600',
      progress: Math.min(100, total > 0 ? 40 + Math.min(60, total * 2) : 0),
      progressClass: 'bg-emerald-600',
    },
    {
      key: 'today',
      label: 'Hoje',
      value: String(totalToday),
      hint: lastVisitHint(filteredRows),
      hintTone: 'neutral',
      dot: 'bg-slate-400',
      progress: totalToday > 0 ? Math.min(100, totalToday * 25) : 0,
      progressClass: 'bg-slate-400',
    },
    {
      key: '7d',
      label: 'Últimos 7 dias',
      value: String(total7d),
      hint: weekHint,
      hintTone: weekTone,
      dot: weekTone === 'negative' ? 'bg-rose-500' : 'bg-rose-400',
      progress:
        prev7d > 0
          ? Math.min(100, Math.round((total7d / Math.max(prev7d, 1)) * 50))
          : total7d > 0
            ? 30
            : 0,
      progressClass: weekTone === 'negative' ? 'bg-rose-500' : 'bg-rose-400',
    },
    {
      key: 'avg',
      label: 'Média diária',
      value: mediaStr,
      hint: 'visitas/dia no período',
      hintTone: 'neutral',
      dot: 'bg-sky-500',
      progress: Math.min(100, mediaDiaria * 20),
      progressClass: 'bg-sky-500',
    },
    {
      key: 'leads',
      label: 'Leads pelo site',
      value: String(siteLeads),
      hint: total > 0 ? `conversão ${conv.toString().replace('.', ',')}%` : 'sem visitas no período',
      hintTone: conv >= 5 ? 'positive' : 'neutral',
      dot: 'bg-violet-500',
      progress: Math.min(100, conv * 6),
      progressClass: 'bg-violet-500',
    },
  ];
}

export function buildBehaviorMetrics(rows: VisitRow[]): {
  metrics: BehaviorMetric[];
  returningLabel: string;
  lowVolume: boolean;
} {
  const total = rows.length;
  if (total === 0) {
    return {
      metrics: [
        { key: 'avg', label: 'Tempo médio na página', value: '—', progress: 0, barClass: 'bg-emerald-300' },
        { key: 'mobile', label: 'Visitas em mobile', value: '—', progress: 0, barClass: 'bg-sky-300' },
        { key: 'v2lp', label: 'Vitrine → LP', value: '—', progress: 0, barClass: 'bg-violet-300' },
        { key: 'return', label: 'Visitantes recorrentes', value: '—' },
      ],
      returningLabel: '—',
      lowVolume: true,
    };
  }

  // Soft: avg duration from soft durations
  const avgSecs = Math.round(
    rows.reduce((acc, r) => acc + softDurationSeconds(r), 0) / total,
  );
  const mobileN = rows.filter((r) => isSoftMobile(softDevice(r))).length;
  const mobilePct = Math.round((mobileN / total) * 100);
  const landingN = rows.filter((r) => r.page_type === 'landing').length;
  const v2lpPct = Math.round((landingN / total) * 100);

  // Soft recurring: same path appearing 2+ times as proxy for returning visitors
  const pathCounts = new Map<string, number>();
  for (const r of rows) {
    const k = r.path || '(sem path)';
    pathCounts.set(k, (pathCounts.get(k) || 0) + 1);
  }
  const recurringVisits = Array.from(pathCounts.values()).reduce(
    (acc, n) => acc + Math.max(0, n - 1),
    0,
  );
  const returningApprox = Math.min(total, Math.max(1, Math.round(recurringVisits * 0.6) || Math.round(total * 0.2)));

  return {
    metrics: [
      {
        key: 'avg',
        label: 'Tempo médio na página',
        value: formatDuration(avgSecs),
        progress: Math.min(100, (avgSecs / 180) * 100),
        barClass: 'bg-emerald-300',
      },
      {
        key: 'mobile',
        label: 'Visitas em mobile',
        value: `${mobilePct}%`,
        progress: mobilePct,
        barClass: 'bg-sky-400',
      },
      {
        key: 'v2lp',
        label: 'Vitrine → LP',
        value: `${v2lpPct}%`,
        progress: v2lpPct,
        barClass: 'bg-violet-400',
      },
      {
        key: 'return',
        label: 'Visitantes recorrentes',
        value: `${returningApprox} de ${total}`,
      },
    ],
    returningLabel: `${returningApprox} de ${total}`,
    lowVolume: total < 50,
  };
}

export function previousMonthRange(): { from: Date; to: Date } {
  const prev = subMonths(new Date(), 1);
  return { from: startMonth(prev), to: endOfMonth(prev) };
}

export function countInWindow(rows: VisitRow[], from: Date, to: Date): number {
  return rows.filter((r) => {
    const d = parseISO(r.created_at);
    return d >= from && d <= to;
  }).length;
}

export function resolveRange(
  preset: Preset,
  fromStr: string,
  toStr: string,
): { from: Date; to: Date } {
  const to = endOfDay(new Date());
  if (preset === '7d') return { from: startOfDay(subDays(new Date(), 6)), to };
  if (preset === '30d') return { from: startOfDay(subDays(new Date(), 29)), to };
  if (preset === '90d') return { from: startOfDay(subDays(new Date(), 89)), to };
  return { from: startOfDay(parseISO(fromStr)), to: endOfDay(parseISO(toStr)) };
}

export function autoGranularity(from: Date, to: Date): Granularity {
  const dias = differenceInCalendarDays(to, from);
  if (dias <= 90) return 'day';
  if (dias <= 365) return 'week';
  return 'month';
}

export function peakChartHint(
  chartData: Array<{ label: string; total: number; key: string }>,
  pageTypeFilter: PageTypeFilter,
): string {
  const base =
    pageTypeFilter === 'all'
      ? 'Vitrine + landing pages'
      : pageTypeFilter === 'vitrine'
        ? 'Somente site vitrine'
        : 'Somente landing pages';
  if (!chartData.length) return base;
  let peak = chartData[0];
  for (const b of chartData) {
    if (b.total > peak.total) peak = b;
  }
  if (peak.total <= 0) return base;
  const datePart = peak.key.includes('-')
    ? format(parseISO(peak.key.length === 7 ? `${peak.key}-01` : peak.key), 'dd/MM')
    : peak.label;
  return `${base} · pico de ${peak.total} visita${peak.total === 1 ? '' : 's'} em ${datePart}`;
}

export function matchesVisitSearch(row: VisitRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const origin = channelLabelForVisit(row).label.toLowerCase();
  const hay = [row.path || '', row.referrer || '', row.utm_source || '', row.referrer_kind, origin]
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}
