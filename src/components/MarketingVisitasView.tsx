import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  format,
  parseISO,
  startOfDay,
  subDays,
  differenceInCalendarDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';
import { VisitasTopBar } from '@/components/marketing-visitas/VisitasTopBar';
import { VisitasToolbar } from '@/components/marketing-visitas/VisitasToolbar';
import { VisitasFilters } from '@/components/marketing-visitas/VisitasFilters';
import { VisitasKpis } from '@/components/marketing-visitas/VisitasKpis';
import { VisitasChart } from '@/components/marketing-visitas/VisitasChart';
import { VisitasOriginsCard } from '@/components/marketing-visitas/VisitasOriginsCard';
import { VisitasTopPagesCard } from '@/components/marketing-visitas/VisitasTopPagesCard';
import { VisitasBehaviorCard } from '@/components/marketing-visitas/VisitasBehaviorCard';
import { VisitasRecentTable } from '@/components/marketing-visitas/VisitasRecentTable';
import {
  type Granularity,
  type PageTypeFilter,
  type Preset,
  type VisitRow,
  autoGranularity,
  bucketKey,
  bucketLabel,
  buildBehaviorMetrics,
  buildTrafficChannels,
  buildVisitasKpis,
  countInWindow,
  exportVisitasCsv,
  formatRangeLabel,
  matchesVisitSearch,
  peakChartHint,
  previousMonthRange,
  resolveRange,
} from '@/components/marketing-visitas/helpers';

const RECENT_LIMIT = 12;

export function MarketingVisitasView() {
  const { profile } = useUserProfile();
  const companyId = profile?.company_id ?? null;

  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [prevMonthTotal, setPrevMonthTotal] = useState(0);
  const [siteLeads, setSiteLeads] = useState(0);
  const [preset, setPreset] = useState<Preset>('30d');
  const [fromStr, setFromStr] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [toStr, setToStr] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [pageTypeFilter, setPageTypeFilter] = useState<PageTypeFilter>('all');
  const [siteSlug, setSiteSlug] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  const range = useMemo(() => resolveRange(preset, fromStr, toStr), [preset, fromStr, toStr]);

  const loadVisits = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const prev = previousMonthRange();
      const [visitsRes, prevRes, leadsRes] = await Promise.all([
        supabase
          .from('public_site_visits' as never)
          .select('created_at, referrer_kind, page_type, path, referrer, utm_source, utm_medium')
          .eq('company_id', companyId)
          .gte('created_at', range.from.toISOString())
          .lte('created_at', range.to.toISOString())
          .order('created_at', { ascending: false })
          .limit(5000),
        supabase
          .from('public_site_visits' as never)
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', prev.from.toISOString())
          .lte('created_at', prev.to.toISOString()),
        supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .or('source.ilike.%site%,source.ilike.%website%,source.ilike.%vitrine%,source.ilike.%landing%,source.ilike.%lp%'),
      ]);

      if (visitsRes.error) throw visitsRes.error;
      setRows((visitsRes.data as VisitRow[]) || []);
      setPrevMonthTotal(prevRes.count ?? 0);
      setSiteLeads(leadsRes.count ?? 0);
    } catch (e: unknown) {
      const detail =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e && 'message' in e
            ? String((e as { message: unknown }).message)
            : String(e);
      if (import.meta.env.DEV) console.error('[MarketingVisitasView] loadVisits', detail, e);
      setRows([]);
      setLoadFailed(true);
      toast.error('Não foi possível carregar as visitas. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  }, [companyId, range.from, range.to]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from('company_websites')
        .select('slug, is_published')
        .eq('company_id', companyId)
        .maybeSingle();
      if (data) {
        setSiteSlug((data as { slug?: string | null }).slug || null);
        setIsPublished(Boolean((data as { is_published?: boolean }).is_published));
      }
    })();
  }, [companyId]);

  useEffect(() => {
    void loadVisits();
  }, [loadVisits]);

  useEffect(() => {
    setGranularity(autoGranularity(range.from, range.to));
  }, [range.from, range.to]);

  const pageCounts = useMemo(() => {
    let vitrine = 0;
    let landing = 0;
    for (const r of rows) {
      if (r.page_type === 'landing') landing += 1;
      else vitrine += 1;
    }
    return { all: rows.length, vitrine, landing };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (pageTypeFilter === 'all') return rows;
    return rows.filter((r) => r.page_type === pageTypeFilter);
  }, [rows, pageTypeFilter]);

  const total = filteredRows.length;

  const totalToday = useMemo(
    () => countInWindow(filteredRows, startOfDay(new Date()), endOfDay(new Date())),
    [filteredRows],
  );

  const total7d = useMemo(
    () => countInWindow(filteredRows, startOfDay(subDays(new Date(), 6)), endOfDay(new Date())),
    [filteredRows],
  );

  const prev7d = useMemo(
    () =>
      countInWindow(
        filteredRows,
        startOfDay(subDays(new Date(), 13)),
        endOfDay(subDays(new Date(), 7)),
      ),
    [filteredRows],
  );

  const mediaDiaria = useMemo(() => {
    const dias = Math.max(1, differenceInCalendarDays(range.to, range.from) + 1);
    return Math.round((total / dias) * 10) / 10;
  }, [total, range.from, range.to]);

  const chartData = useMemo(() => {
    const { from, to } = range;
    let bucketDates: Date[] = [];
    if (granularity === 'day') {
      bucketDates = eachDayOfInterval({ start: from, end: to });
    } else if (granularity === 'week') {
      bucketDates = eachWeekOfInterval({ start: from, end: to }, { locale: ptBR });
    } else {
      bucketDates = eachMonthOfInterval({ start: from, end: to });
    }

    const counts = new Map<string, { vitrine: number; landing: number }>();
    for (const d of bucketDates) counts.set(bucketKey(d, granularity), { vitrine: 0, landing: 0 });

    for (const r of filteredRows) {
      const d = parseISO(r.created_at);
      if (d < from || d > to) continue;
      const k = bucketKey(d, granularity);
      const bucket = counts.get(k);
      if (!bucket) continue;
      if (r.page_type === 'landing') bucket.landing += 1;
      else bucket.vitrine += 1;
    }

    return bucketDates.map((d) => {
      const k = bucketKey(d, granularity);
      const c = counts.get(k) || { vitrine: 0, landing: 0 };
      return {
        key: k,
        label: bucketLabel(k, granularity),
        vitrine: c.vitrine,
        landing: c.landing,
        total: c.vitrine + c.landing,
      };
    });
  }, [filteredRows, range, granularity]);

  const bySource = useMemo(() => buildTrafficChannels(filteredRows), [filteredRows]);

  const byPage = useMemo(() => {
    const m = new Map<string, { n: number; page_type: string }>();
    for (const r of filteredRows) {
      const k = r.path || '(sem path)';
      const prev = m.get(k);
      m.set(k, { n: (prev?.n || 0) + 1, page_type: r.page_type });
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 5)
      .map(([path, v]) => ({ path, n: v.n, page_type: v.page_type }));
  }, [filteredRows]);

  const behavior = useMemo(() => buildBehaviorMetrics(filteredRows), [filteredRows]);

  const recentFiltered = useMemo(() => {
    const base = filteredRows.filter((r) => matchesVisitSearch(r, tableSearch));
    return base.slice(0, RECENT_LIMIT);
  }, [filteredRows, tableSearch]);

  const kpis = useMemo(
    () =>
      buildVisitasKpis({
        total,
        totalToday,
        total7d,
        prev7d,
        mediaDiaria,
        siteLeads,
        prevMonthTotal,
        filteredRows,
      }),
    [total, totalToday, total7d, prev7d, mediaDiaria, siteLeads, prevMonthTotal, filteredRows],
  );

  const rangeLabel = formatRangeLabel(range.from, range.to);
  const subtitle = `Tráfego do site vitrine e das landing pages · ${rangeLabel}`;
  const chartSubtitle = peakChartHint(chartData, pageTypeFilter);

  const handlePresetChange = (v: Preset) => {
    setPreset(v);
    const today = new Date();
    if (v === '7d') {
      setFromStr(format(subDays(today, 6), 'yyyy-MM-dd'));
      setToStr(format(today, 'yyyy-MM-dd'));
    } else if (v === '30d') {
      setFromStr(format(subDays(today, 29), 'yyyy-MM-dd'));
      setToStr(format(today, 'yyyy-MM-dd'));
    } else if (v === '90d') {
      setFromStr(format(subDays(today, 89), 'yyyy-MM-dd'));
      setToStr(format(today, 'yyyy-MM-dd'));
    }
  };

  const handleExport = () => {
    if (filteredRows.length === 0) {
      toast.message('Nenhuma visita para exportar');
      return;
    }
    exportVisitasCsv(filteredRows, range.from, range.to);
    toast.success('CSV exportado');
  };

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col min-w-0">
      <div className="border-b border-border/70">
        <div className="px-3 py-2 sm:px-5 sm:py-3 md:py-4">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm px-3 py-2 space-y-2 sm:px-4 sm:py-3 sm:space-y-3 md:px-6 md:py-4 md:space-y-4">
            <VisitasTopBar />
            <VisitasToolbar
              subtitle={subtitle}
              loading={loading}
              canOpenSite={Boolean(isPublished && siteSlug)}
              onOpenSite={() => window.open(`/s/${siteSlug}`, '_blank')}
              onRefresh={() => void loadVisits()}
              onExport={handleExport}
              exportDisabled={filteredRows.length === 0}
            />
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background">
        {loadFailed ? (
          <div className="rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-muted-foreground">
            Não foi possível atualizar as informações. Use{' '}
            <strong className="text-foreground font-medium">Atualizar</strong> ou tente mais tarde.
            Se o problema continuar, contacte o suporte.
          </div>
        ) : null}

        <VisitasFilters
          preset={preset}
          onPresetChange={handlePresetChange}
          granularity={granularity}
          onGranularityChange={setGranularity}
          pageTypeFilter={pageTypeFilter}
          onPageTypeFilterChange={setPageTypeFilter}
          counts={pageCounts}
          rangeLabel={rangeLabel}
          fromStr={fromStr}
          toStr={toStr}
          onFromChange={(v) => {
            setPreset('custom');
            setFromStr(v);
          }}
          onToChange={(v) => {
            setPreset('custom');
            setToStr(v);
          }}
        />

        <VisitasKpis items={kpis} />

        <VisitasChart
          data={chartData}
          subtitle={chartSubtitle}
          loading={loading}
          empty={!loading && total === 0}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VisitasOriginsCard channels={bySource} />
          <VisitasTopPagesCard pages={byPage} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VisitasBehaviorCard metrics={behavior.metrics} lowVolume={behavior.lowVolume} />
        </div>

        <VisitasRecentTable
          rows={recentFiltered}
          totalInPeriod={total}
          search={tableSearch}
          onSearchChange={setTableSearch}
        />
      </div>
    </div>
  );
}

export default MarketingVisitasView;
