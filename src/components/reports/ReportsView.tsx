import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { normalizeBrandDisplayName } from '@/lib/brandingDisplay';
import type { PeriodPreset } from '@/components/dashboard/helpers';
import { ReportsTopBar } from './ReportsTopBar';
import { ReportsToolbar } from './ReportsToolbar';
import { ReportsKpis } from './ReportsKpis';
import { ReportsFilters } from './ReportsFilters';
import { ReportCard } from './ReportCard';
import { ReportsExportHistory } from './ReportsExportHistory';
import { ReportsHighlights } from './ReportsHighlights';
import { ReportPreviewDialog } from './ReportPreviewDialog';
import { fetchReportsBundle, type ReportsBundle } from './fetchReportsData';
import { emptyDashboardBundle } from '@/components/dashboard/fetchDashboardData';
import { exportReportPdf } from './exportReportPdf';
import {
  buildCardMetrics,
  buildReportsKpis,
  categoryCounts,
  filterReports,
  formatPeriodSubtitle,
  formatUpdatedRelative,
  monthKey,
  prevMonthKey,
  visibleReports,
  type ExportHistoryItem,
  type ReportCardModel,
  type ReportsExtras,
  type ReportCategory,
} from './helpers';
import type { ReportId } from './constants';
import {
  clearExportHistory,
  getExportCountForMonth,
  loadExportHistory,
  pushExportHistory,
} from './localStorage';

function emptyReportsShell(preset: PeriodPreset): ReportsBundle {
  const dashboard = emptyDashboardBundle(preset);
  const extras: ReportsExtras = {
    portfolioVgv: 0,
    digital: { visits: 0, lps: 0, leads: 0, topPath: null },
    attendance: { conversas: 0, aiPct: null, responseSoft: '—' },
    agenda: { events: 0, confirmed: 0, coverageHours: 0 },
    audit: { events: 0, users: 0, alerts: 0 },
    highlights: [
      { label: 'Canal com mais leads', value: '—' },
      { label: 'Corretor destaque', value: '—' },
      { label: 'Imóvel mais visto', value: '—' },
      { label: 'VGV do mês', value: 'R$ 0' },
    ],
    softGaps: ['Falha ao carregar relatórios — shell vazio.'],
    fetchedAt: new Date(),
  };
  return { dashboard, extras, partial: true };
}

function ReportsView() {
  const { profile } = useUserProfile();
  const { settings } = useCompanySettings();
  const companyId = profile?.company_id ?? null;
  const role = profile?.role ?? null;

  const [period, setPeriod] = useState<PeriodPreset>('30d');
  const [bundle, setBundle] = useState<ReportsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [category, setCategory] = useState<'todos' | ReportCategory>('todos');
  const [search, setSearch] = useState('');
  const [exportingId, setExportingId] = useState<ReportId | null>(null);
  const [history, setHistory] = useState<ExportHistoryItem[]>([]);
  const [previewId, setPreviewId] = useState<ReportId | null>(null);

  const scope = useMemo(() => {
    if (!companyId || !profile) return null;
    return {
      companyId,
      userId: profile.id,
      role: profile.role,
    };
  }, [companyId, profile]);

  const catalog = useMemo(() => visibleReports(role), [role]);
  const counts = useMemo(() => categoryCounts(catalog), [catalog]);
  const filtered = useMemo(
    () => filterReports(catalog, category, search),
    [catalog, category, search],
  );

  const loadLocal = useCallback(() => {
    if (!companyId) return;
    setHistory(loadExportHistory(companyId));
  }, [companyId]);

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    setLoadError(false);
    try {
      const data = await fetchReportsBundle(scope, period);
      setBundle(data);
      if (data.partial) {
        setLoadError(true);
        toast.message('Relatórios parcialmente carregados', {
          description: 'Algumas fontes falharam — métricas zeradas nesses cards.',
        });
      }
    } catch (e) {
      console.error('[ReportsView] load', e);
      toast.error('Não foi possível carregar os relatórios.');
      setLoadError(true);
      setBundle((prev) => prev ?? emptyReportsShell(period));
    } finally {
      setLoading(false);
    }
  }, [scope, period]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  const cards: ReportCardModel[] = useMemo(() => {
    if (!bundle) return [];
    const updated = formatUpdatedRelative(bundle.extras.fetchedAt);
    return filtered.map((def) => ({
      ...def,
      metrics: buildCardMetrics(def.id, bundle.dashboard, bundle.extras),
      updatedLabel: updated.label,
      updatedTone: updated.tone,
    }));
  }, [bundle, filtered]);

  const kpiItems = useMemo(() => {
    if (!companyId) return [];
    const cats = new Set(catalog.map((c) => c.category)).size;
    const exportedThisMonth = getExportCountForMonth(companyId, monthKey());
    const exportedPrevMonth = getExportCountForMonth(companyId, prevMonthKey());
    return buildReportsKpis({
      available: catalog.length,
      categoryCount: cats,
      exportedThisMonth,
      exportedPrevMonth,
      scheduledCount: 0,
      lastExport: history[0] || null,
    });
  }, [companyId, catalog, history]);

  const periodLabel = bundle
    ? formatPeriodSubtitle(bundle.dashboard.range.from, bundle.dashboard.range.to)
    : '—';

  const handleExport = async (reportId: ReportId) => {
    if (!bundle || !companyId) return;
    setExportingId(reportId);
    try {
      const result = await exportReportPdf({
        reportId,
        bundle: bundle.dashboard,
        extras: bundle.extras,
        companyName:
          normalizeBrandDisplayName(settings?.display_name) ||
          settings?.display_name ||
          'Imobiliária',
        userName: profile?.full_name || profile?.email || 'Usuário',
      });
      const next = pushExportHistory(companyId, {
        reportId,
        filename: result.filename,
        generatedAt: new Date().toISOString(),
        by: (profile?.full_name || 'Você').split(' ')[0],
        sizeLabel: result.sizeLabel,
      });
      setHistory(next);
      toast.success('PDF exportado', { description: result.filename });
    } catch (e) {
      console.error('[ReportsView] export', e);
      toast.error('Falha ao gerar PDF');
    } finally {
      setExportingId(null);
    }
  };

  const handleNewReport = () => {
    toast.message('Novo relatório', {
      description:
        'Os 8 tipos oficiais já estão no catálogo. Personalizados sob demanda em breve.',
    });
  };

  const previewCard = cards.find((c) => c.id === previewId) || null;

  if (!companyId) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center bg-[#F7F5F0] dark:bg-background p-6">
        <p className="text-muted-foreground">Empresa não identificada.</p>
      </div>
    );
  }

  if (loading && !bundle) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center bg-[#F7F5F0] dark:bg-background">
        <p className="text-muted-foreground">Carregando relatórios…</p>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 bg-[#F7F5F0] dark:bg-background p-6">
        <p className="text-muted-foreground">Não foi possível carregar os dados.</p>
        <button
          type="button"
          className="text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
          onClick={() => void load()}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col min-w-0">
      <div className="border-b border-border/70">
        <div className="px-3 py-2 sm:px-5 sm:py-3 md:py-4">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm px-3 py-2 space-y-2 sm:px-4 sm:py-3 sm:space-y-3 md:px-6 md:py-4 md:space-y-4">
            <ReportsTopBar />
            <ReportsToolbar
              periodLabel={periodLabel}
              period={period}
              onPeriodChange={setPeriod}
              onNewReport={handleNewReport}
            />
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background">
        {loadError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            Algumas fontes de dados falharam. Cards podem mostrar métricas zeradas.{' '}
            <button
              type="button"
              className="font-medium underline-offset-2 hover:underline"
              onClick={() => void load()}
            >
              Recarregar
            </button>
          </div>
        ) : null}
        <ReportsKpis items={kpiItems} />

        <div className="rounded-2xl border border-border/70 bg-white dark:bg-card shadow-sm px-3 py-3 sm:px-4">
          <ReportsFilters
            category={category}
            onCategoryChange={setCategory}
            counts={counts}
            search={search}
            onSearchChange={setSearch}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cards.map((card) => (
            <ReportCard
              key={card.id}
              card={card}
              exporting={exportingId === card.id}
              onExport={() => void handleExport(card.id)}
              onPreview={() => setPreviewId(card.id)}
            />
          ))}
          {cards.length === 0 ? (
            <div className="lg:col-span-2 rounded-2xl border border-dashed border-border bg-white/60 dark:bg-card p-8 text-center text-muted-foreground">
              Nenhum relatório nesta categoria.
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ReportsExportHistory
            items={history}
            onClear={() => {
              clearExportHistory(companyId);
              setHistory([]);
              toast.message('Histórico limpo');
            }}
          />
          <ReportsHighlights items={bundle.extras.highlights} />
        </div>
      </div>

      <ReportPreviewDialog
        open={!!previewCard}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null);
        }}
        title={previewCard?.title || ''}
        description={previewCard?.description || ''}
        metrics={previewCard?.metrics || []}
        periodLabel={periodLabel}
        onExport={() => {
          if (previewCard) void handleExport(previewCard.id);
        }}
      />
    </div>
  );
}

export default ReportsView;
