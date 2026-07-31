import { format, formatDistanceToNow, differenceInCalendarDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatMoneyMil, type PeriodPreset } from '@/components/dashboard/helpers';
import type { DashboardBundle } from '@/components/dashboard/fetchDashboardData';
import { REPORT_DEFS, type ReportCategory, type ReportId, type ReportDef } from './constants';

export type ReportMetricCell = {
  value: string;
  label: string;
};

export type ReportCardModel = ReportDef & {
  metrics: ReportMetricCell[];
  updatedLabel: string;
  updatedTone: 'fresh' | 'stale';
};

export type ReportsKpiItem = {
  key: string;
  label: string;
  value: string;
  hint: string;
  hintTone: 'positive' | 'negative' | 'neutral' | 'blue' | 'purple' | 'amber';
  dot: string;
  progress: number;
  progressClass: string;
};

export type ExportHistoryItem = {
  id: string;
  reportId: ReportId;
  filename: string;
  generatedAt: string;
  by: string;
  sizeLabel: string;
};

export type ScheduledSend = {
  id: string;
  reportId: ReportId;
  title: string;
  schedule: string;
  enabled: boolean;
  iconTone: 'sky' | 'emerald' | 'orange' | 'violet';
};

export type PeriodHighlight = {
  label: string;
  value: string;
};

export type ReportsExtras = {
  portfolioVgv: number;
  digital: { visits: number; lps: number; leads: number; topPath: string | null };
  attendance: { conversas: number; aiPct: number | null; responseSoft: string };
  agenda: { events: number; confirmed: number; coverageHours: number };
  audit: { events: number; users: number; alerts: number };
  highlights: PeriodHighlight[];
  softGaps: string[];
  fetchedAt: Date;
};

export function roleRank(role: string | null | undefined): number {
  const r = (role || '').toLowerCase();
  if (r === 'admin') return 3;
  if (r === 'gestor') return 2;
  return 1;
}

export function canSeeReport(def: ReportDef, role: string | null | undefined): boolean {
  return roleRank(role) >= roleRank(def.minRole);
}

export function visibleReports(role: string | null | undefined): ReportDef[] {
  return REPORT_DEFS.filter((d) => canSeeReport(d, role));
}

export function categoryCounts(defs: ReportDef[]): Record<'todos' | ReportCategory, number> {
  const counts: Record<'todos' | ReportCategory, number> = {
    todos: defs.length,
    portfolio: 0,
    comercial: 0,
    marketing: 0,
    operacao: 0,
  };
  defs.forEach((d) => {
    counts[d.category] += 1;
  });
  return counts;
}

export function filterReports(
  defs: ReportDef[],
  category: 'todos' | ReportCategory,
  search: string,
): ReportDef[] {
  const q = search.trim().toLowerCase();
  return defs.filter((d) => {
    if (category !== 'todos' && d.category !== category) return false;
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
    );
  });
}

export function formatPeriodSubtitle(from: Date, to: Date): string {
  const a = format(from, 'dd MMM', { locale: ptBR }).toLowerCase().replace('.', '');
  const b = format(to, 'dd MMM yyyy', { locale: ptBR }).toLowerCase().replace('.', '');
  return `${a} → ${b}`;
}

export function formatUpdatedRelative(d: Date, now = new Date()): {
  label: string;
  tone: 'fresh' | 'stale';
} {
  const hours = (now.getTime() - d.getTime()) / 3_600_000;
  if (hours < 1) {
    return { label: 'atualizado agora', tone: 'fresh' };
  }
  if (differenceInCalendarDays(now, d) === 0) {
    return { label: 'atualizado hoje', tone: 'fresh' };
  }
  try {
    const rel = formatDistanceToNow(d, { locale: ptBR, addSuffix: false });
    return { label: `atualizado há ${rel}`, tone: hours > 6 ? 'stale' : 'fresh' };
  } catch {
    return { label: 'atualizado recentemente', tone: 'fresh' };
  }
}

export function formatTimeHHMM(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'HH:mm');
  } catch {
    return '—';
  }
}

export function formatExportWhen(iso: string): string {
  try {
    return format(new Date(iso), 'dd/MM HH:mm', { locale: ptBR });
  } catch {
    return iso;
  }
}

export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function prevMonthKey(d = new Date()): string {
  return monthKey(subMonths(d, 1));
}

export function monthBounds(d = new Date()) {
  return { from: startOfMonth(d), to: endOfMonth(d) };
}

export function estimatePdfSizeKb(pages: number, rows: number): string {
  const kb = Math.max(80, Math.round(pages * 42 + rows * 0.8));
  if (kb >= 1000) return `${(kb / 1000).toFixed(1).replace('.', ',')} MB`;
  return `${kb} KB`;
}

export function buildCardMetrics(
  id: ReportId,
  bundle: DashboardBundle,
  extras: ReportsExtras,
): ReportMetricCell[] {
  switch (id) {
    case 'portfolio': {
      const available =
        bundle.portfolio.slices.find((s) => s.key === 'disp')?.count ?? bundle.kpis.available;
      return [
        { value: formatIntPt(bundle.portfolio.total), label: 'IMÓVEIS' },
        { value: formatIntPt(available), label: 'DISPONÍVEIS' },
        {
          value: extras.portfolioVgv > 0 ? formatMoneyMil(extras.portfolioVgv) : '—',
          label: 'VGV',
        },
      ];
    }
    case 'funnel':
      return [
        { value: formatIntPt(bundle.kpis.leads), label: 'LEADS' },
        {
          value: `${String(bundle.funnel.conversionTotalPct).replace('.', ',')}%`,
          label: 'CONVERSÃO',
        },
        {
          value: bundle.funnel.cycleDays != null ? `${bundle.funnel.cycleDays} d` : '—',
          label: 'CICLO',
        },
      ];
    case 'brokers': {
      const brokers = bundle.brokers.length;
      const visitas = bundle.brokers.reduce((a, b) => a + b.visitas, 0);
      const vendas = bundle.brokers.reduce((a, b) => a + b.fechamentos, 0);
      return [
        { value: formatIntPt(brokers), label: 'CORRETORES' },
        { value: formatIntPt(visitas), label: 'VISITAS' },
        { value: formatIntPt(vendas), label: 'VENDAS' },
      ];
    }
    case 'market': {
      const top = bundle.channels.rows[0];
      return [
        { value: formatIntPt(bundle.kpis.leads), label: 'LEADS' },
        { value: formatIntPt(bundle.channels.rows.length), label: 'CANAIS' },
        {
          value: top ? top.label.replace(/\s*\/\s*IA/, '').split(' ')[0] : '—',
          label: 'TOP CANAL',
        },
      ];
    }
    case 'digital':
      return [
        { value: formatIntPt(extras.digital.visits), label: 'VISITAS' },
        { value: formatIntPt(extras.digital.lps), label: 'LPS' },
        { value: formatIntPt(extras.digital.leads), label: 'LEADS' },
      ];
    case 'attendance':
      return [
        { value: formatIntPt(extras.attendance.conversas), label: 'CONVERSAS' },
        {
          value:
            extras.attendance.aiPct != null
              ? `${Math.round(extras.attendance.aiPct)}%`
              : '—',
          label: 'PELA IA',
        },
        { value: extras.attendance.responseSoft, label: 'RESPOSTA' },
      ];
    case 'agenda':
      return [
        { value: formatIntPt(extras.agenda.events), label: 'EVENTOS' },
        { value: formatIntPt(extras.agenda.confirmed), label: 'CONFIRMADOS' },
        { value: `${Math.round(extras.agenda.coverageHours)} h`, label: 'COBERTURA' },
      ];
    case 'audit':
      return [
        { value: formatIntPt(extras.audit.events), label: 'EVENTOS' },
        { value: formatIntPt(extras.audit.users), label: 'USUÁRIOS' },
        { value: formatIntPt(extras.audit.alerts), label: 'ALERTAS' },
      ];
    default:
      return [
        { value: '—', label: '—' },
        { value: '—', label: '—' },
        { value: '—', label: '—' },
      ];
  }
}

export function formatIntPt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR');
}

export function buildReportsKpis(params: {
  available: number;
  categoryCount: number;
  exportedThisMonth: number;
  exportedPrevMonth: number;
  scheduledCount: number;
  lastExport: ExportHistoryItem | null;
}): ReportsKpiItem[] {
  const {
    available,
    categoryCount,
    exportedThisMonth,
    exportedPrevMonth,
    scheduledCount,
    lastExport,
  } = params;

  const delta = exportedThisMonth - exportedPrevMonth;
  const deltaText =
    delta > 0
      ? `+${delta} vs. mês anterior`
      : delta < 0
        ? `${delta} vs. mês anterior`
        : 'igual ao mês anterior';

  const lastTitle = lastExport
    ? REPORT_DEFS.find((d) => d.id === lastExport.reportId)?.title || lastExport.filename
    : 'nenhuma ainda';

  return [
    {
      key: 'available',
      label: 'Relatórios disponíveis',
      value: String(available),
      hint: `em ${categoryCount} categorias`,
      hintTone: 'neutral',
      dot: 'bg-emerald-600',
      progress: Math.min(100, available * 12),
      progressClass: 'bg-emerald-600',
    },
    {
      key: 'exported',
      label: 'Exportados no mês',
      value: String(exportedThisMonth),
      hint: deltaText,
      hintTone: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'blue',
      dot: 'bg-sky-500',
      progress: Math.min(100, exportedThisMonth * 4),
      progressClass: 'bg-sky-500',
    },
    {
      key: 'scheduled',
      label: 'Envios agendados',
      value: String(scheduledCount),
      hint: scheduledCount > 0 ? 'local · semanal e mensal' : 'nenhum agendado',
      hintTone: 'purple',
      dot: 'bg-violet-500',
      progress: Math.min(100, scheduledCount * 40),
      progressClass: 'bg-violet-500',
    },
    {
      key: 'last',
      label: 'Última geração',
      value: lastExport ? formatTimeHHMM(lastExport.generatedAt) : '—',
      hint: lastTitle,
      hintTone: 'amber',
      dot: 'bg-amber-500',
      progress: lastExport ? 70 : 0,
      progressClass: 'bg-amber-500',
    },
  ];
}

export function periodLabel(preset: PeriodPreset): string {
  return (
    {
      '7d': '7 dias',
      '30d': '30 dias',
      quarter: 'Trimestre',
      year: 'Ano',
    } as const
  )[preset];
}
