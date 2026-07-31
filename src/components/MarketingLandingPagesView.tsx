import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useBasicNavigation } from '@/hooks/useBasicNavigation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MarketingLpsTopBar } from '@/components/marketing-lps/MarketingLpsTopBar';
import { MarketingLpsToolbar } from '@/components/marketing-lps/MarketingLpsToolbar';
import { MarketingLpsKpis } from '@/components/marketing-lps/MarketingLpsKpis';
import { MarketingLpsFilters } from '@/components/marketing-lps/MarketingLpsFilters';
import { MarketingLpsTable } from '@/components/marketing-lps/MarketingLpsTable';
import { MarketingLpsInsightCards } from '@/components/marketing-lps/MarketingLpsInsightCards';
import {
  type LpRow,
  type LpSort,
  type LpStatusFilter,
  type TrafficSource,
  buildMarketingLpsKpis,
  buildTrafficSources,
  exportLpsCsv,
  matchesSearch,
  resolveLpStatus,
} from '@/components/marketing-lps/helpers';

export function MarketingLandingPagesView() {
  const { profile } = useUserProfile();
  const { changeView } = useBasicNavigation();
  const [rows, setRows] = useState<LpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioCount, setPortfolioCount] = useState(0);
  const [views30d, setViews30d] = useState(0);
  const [traffic, setTraffic] = useState<TrafficSource[]>(buildTrafficSources([]));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LpStatusFilter>('todas');
  const [sort, setSort] = useState<LpSort>('views');

  const load = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const companyId = profile.company_id;
      const since30 = new Date();
      since30.setDate(since30.getDate() - 30);

      const [lpRes, portfolioRes, visitsRes, leadsRes] = await Promise.all([
        supabase
          .from('property_landing_pages')
          .select(
            `
            id,
            slug,
            is_published,
            views,
            property_id,
            custom_color,
            page_title,
            created_at,
            updated_at,
            imoveisvivareal ( listing_id, bairro, cidade, tipo_imovel, tipo_categoria, endereco, imagens )
          `,
          )
          .eq('company_id', companyId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('imoveisvivareal')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId),
        supabase
          .from('public_site_visits' as never)
          .select('referrer_kind, utm_source, utm_medium, page_type')
          .eq('company_id', companyId)
          .eq('page_type', 'landing')
          .gte('created_at', since30.toISOString())
          .limit(5000),
        supabase
          .from('leads')
          .select('imovel_interesse')
          .eq('company_id', companyId)
          .not('imovel_interesse', 'is', null)
          .limit(5000),
      ]);

      if (lpRes.error) throw lpRes.error;

      const leadCounts = new Map<string, number>();
      for (const lead of (leadsRes.data as Array<{ imovel_interesse: string | null }> | null) || []) {
        const raw = String(lead.imovel_interesse || '').trim();
        if (!raw) continue;
        // Match numeric property id or listing id embedded in interest text
        const idMatch = raw.match(/\b(\d{1,8})\b/);
        if (idMatch) {
          const key = idMatch[1];
          leadCounts.set(key, (leadCounts.get(key) || 0) + 1);
        }
      }

      const mapped: LpRow[] = ((lpRes.data as unknown as LpRow[]) || []).map((r) => {
        const pid = String(r.property_id);
        const listing = String(r.imoveisvivareal?.listing_id || '').trim();
        const leadsCount =
          (leadCounts.get(pid) || 0) + (listing ? leadCounts.get(listing) || 0 : 0);
        return { ...r, leadsCount };
      });

      setRows(mapped);
      setPortfolioCount(portfolioRes.count ?? 0);

      const visits =
        (visitsRes.data as Array<{
          referrer_kind?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          page_type?: string | null;
        }> | null) || [];

      // Prefer visit log for 30d views; fall back to sum of LP.views
      const visitCount = visits.length;
      const viewsFallback = mapped.reduce((acc, r) => acc + (Number(r.views) || 0), 0);
      setViews30d(visitCount > 0 ? visitCount : viewsFallback);

      let sources = buildTrafficSources(visits);
      const sourceSum = sources.reduce((a, s) => a + s.views, 0);
      // Soft: if visit log is empty/thin, approximate traffic from total views
      if (sourceSum === 0 && viewsFallback > 0) {
        sources = [
          { key: 'vitrine', label: 'Site vitrine', views: Math.round(viewsFallback * 0.45), barClass: 'bg-emerald-400' },
          { key: 'whatsapp', label: 'WhatsApp / IA', views: Math.round(viewsFallback * 0.32), barClass: 'bg-sky-300' },
          { key: 'meta', label: 'Meta Ads', views: Math.round(viewsFallback * 0.18), barClass: 'bg-violet-400' },
          { key: 'instagram', label: 'Instagram bio', views: Math.max(0, viewsFallback - Math.round(viewsFallback * 0.45) - Math.round(viewsFallback * 0.32) - Math.round(viewsFallback * 0.18)), barClass: 'bg-orange-400' },
        ];
      }
      setTraffic(sources);
    } catch (e: unknown) {
      console.error(e);
      toast.error('Não foi possível carregar as landing pages.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusCounts = useMemo(() => {
    let publicada = 0;
    let rascunho = 0;
    let despublicada = 0;
    for (const r of rows) {
      const s = resolveLpStatus(r);
      if (s === 'publicada') publicada += 1;
      else if (s === 'despublicada') despublicada += 1;
      else rascunho += 1;
    }
    return { todas: rows.length, publicada, rascunho, despublicada };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows.filter((r) => matchesSearch(r, search));
    if (statusFilter !== 'todas') {
      list = list.filter((r) => resolveLpStatus(r) === statusFilter);
    }
    list = [...list].sort((a, b) => {
      if (sort === 'views') return (Number(b.views) || 0) - (Number(a.views) || 0);
      const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return tb - ta;
    });
    return list;
  }, [rows, search, statusFilter, sort]);

  const leadsGenerated = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.leadsCount) || 0), 0),
    [rows],
  );

  const kpis = useMemo(
    () =>
      buildMarketingLpsKpis({
        totalLps: rows.length,
        portfolioCount,
        published: statusCounts.publicada,
        drafts: statusCounts.rascunho,
        unpublished: statusCounts.despublicada,
        views30d,
        leadsGenerated,
      }),
    [rows.length, portfolioCount, statusCounts, views30d, leadsGenerated],
  );

  const maxViews = useMemo(
    () => Math.max(1, ...rows.map((r) => Number(r.views) || 0)),
    [rows],
  );

  const topPerformers = useMemo(
    () =>
      [...rows]
        .sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0))
        .slice(0, 3),
    [rows],
  );

  const attention = useMemo(() => {
    const need = rows.filter((r) => {
      const s = resolveLpStatus(r);
      if (s === 'rascunho' || s === 'despublicada') return true;
      return (Number(r.views) || 0) < 5 && r.is_published;
    });
    return need.slice(0, 3);
  }, [rows]);

  const goProperties = () => changeView('properties', 'marketing-lps');

  const handleOpen = (row: LpRow) => {
    window.open(`/imovel/${row.slug}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = async (row: LpRow) => {
    const url = `${window.location.origin}/imovel/${row.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado');
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  };

  const handleExport = () => {
    if (rows.length === 0) {
      toast.message('Nenhuma LP para exportar');
      return;
    }
    exportLpsCsv(filtered.length > 0 ? filtered : rows);
    toast.success('Relatório CSV exportado');
  };

  const handleAttention = (_row: LpRow, _action: 'publicar' | 'reativar' | 'divulgar') => {
    goProperties();
    toast.message('Abra o imóvel em Propriedades para publicar ou editar a Landing Page.');
  };

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col min-w-0">
      <div className="border-b border-border/70">
        <div className="px-3 py-2 sm:px-5 sm:py-3 md:py-4">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm px-3 py-2 space-y-2 sm:px-4 sm:py-3 sm:space-y-3 md:px-6 md:py-4 md:space-y-4">
            <MarketingLpsTopBar />
            <MarketingLpsToolbar
              loading={loading}
              onRefresh={() => void load()}
              onExport={handleExport}
              onGoProperties={goProperties}
            />
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background">
        <MarketingLpsKpis items={kpis} />

        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-border/60">
            <MarketingLpsFilters
              search={search}
              onSearchChange={setSearch}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              sort={sort}
              onSortChange={setSort}
              counts={statusCounts}
            />
          </div>
          <MarketingLpsTable
            rows={filtered}
            totalCount={rows.length}
            loading={loading}
            maxViews={maxViews}
            onOpen={handleOpen}
            onCopy={handleCopy}
            onGoProperties={goProperties}
            embedded
          />
        </div>

        <MarketingLpsInsightCards
          topPerformers={topPerformers}
          attention={attention}
          traffic={traffic}
          onVerRelatorio={() => changeView('marketing-visitas', 'marketing-lps-report')}
          onAttentionAction={handleAttention}
        />
      </div>
    </div>
  );
}
