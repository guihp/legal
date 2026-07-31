import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useUserProfile } from '@/hooks/useUserProfile';
import { subscribeImoveisChanges } from '@/lib/realtime/imoveisRealtimeBus';
import { supabase } from '@/integrations/supabase/client';
import { DashboardTopBar } from './DashboardTopBar';
import { DashboardToolbar } from './DashboardToolbar';
import { DashboardKpis } from './DashboardKpis';
import { DashboardVgvChart } from './DashboardVgvChart';
import { DashboardPortfolioCard } from './DashboardPortfolioCard';
import { DashboardChannelsCard } from './DashboardChannelsCard';
import { DashboardFunnelCard } from './DashboardFunnelCard';
import { DashboardBrokersTable } from './DashboardBrokersTable';
import { DashboardAppointmentsCard } from './DashboardAppointmentsCard';
import { DashboardActivityCard } from './DashboardActivityCard';
import {
  buildKpiHints,
  fetchDashboardBundle,
  type DashboardBundle,
} from './fetchDashboardData';
import {
  type DashboardKpiItem,
  type PeriodPreset,
  formatRangeArrow,
  formatUpdatedAt,
} from './helpers';

export type DashboardViewProps = {
  onNavigateToAgenda?: () => void;
  onNavigateToReports?: () => void;
  onNavigateToPipeline?: () => void;
  onNavigateToUsers?: () => void;
};

function exportCsv(bundle: DashboardBundle) {
  const lines: string[] = [
    'secao,campo,valor',
    `periodo,de,${bundle.range.from.toISOString()}`,
    `periodo,ate,${bundle.range.to.toISOString()}`,
    `kpi,vgv,${bundle.kpis.vgv}`,
    `kpi,vendidos,${bundle.kpis.sold}`,
    `kpi,disponiveis,${bundle.kpis.available}`,
    `kpi,leads,${bundle.kpis.leads}`,
    `kpi,visitas,${bundle.kpis.visits}`,
    `kpi,ticket,${bundle.kpis.ticket}`,
  ];
  bundle.channels.rows.forEach((r) => {
    lines.push(`canal,${r.label},${r.count}`);
  });
  bundle.funnel.stages.forEach((s) => {
    lines.push(`funil,${s.label},${s.count}`);
  });
  bundle.brokers.forEach((b) => {
    lines.push(`corretor,${b.name},${b.leads}|${b.visitas}|${b.fechamentos}|${b.vgv}`);
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `painel-${bundle.range.from.toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DashboardView({
  onNavigateToAgenda,
  onNavigateToReports,
  onNavigateToPipeline,
  onNavigateToUsers,
}: DashboardViewProps) {
  const { profile } = useUserProfile();
  const companyId = profile?.company_id ?? null;
  const [period, setPeriod] = useState<PeriodPreset>('30d');
  const [bundle, setBundle] = useState<DashboardBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const scope = useMemo(() => {
    if (!companyId || !profile) return null;
    return {
      companyId,
      userId: profile.id,
      role: profile.role,
    };
  }, [companyId, profile]);

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    try {
      const data = await fetchDashboardBundle(scope, period);
      setBundle(data);
    } catch (e) {
      console.error('[DashboardView] load', e);
      toast.error('Não foi possível carregar o painel.');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [scope, period]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!companyId) return;
    const unsub = subscribeImoveisChanges(() => {
      void load();
    });
    const channel = supabase
      .channel(`dashboard_painel_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        void load();
      })
      .subscribe();
    return () => {
      unsub();
      supabase.removeChannel(channel);
    };
  }, [companyId, load]);

  const kpiItems: DashboardKpiItem[] = useMemo(() => {
    if (!bundle) return [];
    const hints = buildKpiHints(bundle);
    const { kpis } = bundle;
    return [
      {
        key: 'vgv',
        label: 'VGV do mês',
        value: hints.vgvValue,
        hint: hints.vgvHint.text,
        hintTone: hints.vgvHint.tone,
        dot: 'bg-emerald-600',
        spark: kpis.vgvSpark,
        sparkClass: 'bg-emerald-500',
      },
      {
        key: 'sold',
        label: 'Imóveis vendidos',
        value: String(kpis.sold),
        hint: hints.soldHint.text,
        hintTone: hints.soldHint.tone,
        dot: 'bg-amber-400',
        spark: kpis.soldSpark,
        sparkClass: 'bg-amber-400',
      },
      {
        key: 'avail',
        label: 'Disponíveis',
        value: String(kpis.available),
        hint: hints.availableHint.text,
        hintTone: hints.availableHint.tone,
        dot: 'bg-emerald-500',
        spark: kpis.availableSpark,
        sparkClass: 'bg-emerald-400',
      },
      {
        key: 'leads',
        label: 'Leads no período',
        value: String(kpis.leads),
        hint: hints.leadsHint.text,
        hintTone: hints.leadsHint.tone as DashboardKpiItem['hintTone'],
        dot: 'bg-sky-500',
        spark: kpis.leadsSpark,
        sparkClass: 'bg-sky-400',
      },
      {
        key: 'visits',
        label: 'Visitas agendadas',
        value: String(kpis.visits),
        hint: hints.visitsHint.text,
        hintTone: hints.visitsHint.tone,
        dot: 'bg-violet-500',
        spark: kpis.visitsSpark,
        sparkClass: 'bg-violet-400',
      },
      {
        key: 'ticket',
        label: 'Ticket médio',
        value: hints.ticketValue,
        hint: hints.ticketHint.text,
        hintTone: hints.ticketHint.tone,
        dot: 'bg-cyan-400',
        spark: kpis.ticketSpark,
        sparkClass: 'bg-cyan-400',
      },
    ];
  }, [bundle]);

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
        <p className="text-muted-foreground">Carregando painel…</p>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center bg-[#F7F5F0] dark:bg-background p-6">
        <p className="text-muted-foreground">Não foi possível carregar os dados.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col min-w-0">
      <div className="border-b border-border/70">
        <div className="px-3 py-2 sm:px-5 sm:py-3 md:py-4">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm px-3 py-2 space-y-2 sm:px-4 sm:py-3 sm:space-y-3 md:px-6 md:py-4 md:space-y-4">
            <DashboardTopBar />
            <DashboardToolbar
              synced={bundle.synced}
              rangeLabel={formatRangeArrow(bundle.range.from, bundle.range.to)}
              updatedLabel={formatUpdatedAt(bundle.updatedAt)}
              period={period}
              onPeriodChange={setPeriod}
              exporting={exporting}
              onExport={() => {
                setExporting(true);
                try {
                  exportCsv(bundle);
                  toast.success('CSV exportado');
                } finally {
                  setExporting(false);
                }
              }}
              onReports={() => {
                if (onNavigateToReports) onNavigateToReports();
                else toast.message('Relatórios', { description: 'Abra Analytics → Relatórios no menu.' });
              }}
            />
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background">
        <DashboardKpis items={kpiItems} />

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-3">
            <DashboardVgvChart series={bundle.vgvSeries} peakLabel={bundle.vgvPeakLabel} />
          </div>
          <div className="xl:col-span-2">
            <DashboardPortfolioCard
              total={bundle.portfolio.total}
              slices={bundle.portfolio.slices}
              types={bundle.portfolio.types}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DashboardChannelsCard
            total={bundle.channels.total}
            rows={bundle.channels.rows}
            monthly={bundle.channels.monthly}
          />
          <DashboardFunnelCard
            stages={bundle.funnel.stages}
            conversionTotalPct={bundle.funnel.conversionTotalPct}
            cycleDays={bundle.funnel.cycleDays}
            unassigned={bundle.funnel.unassigned}
            onOpenPipeline={() => {
              if (onNavigateToPipeline) onNavigateToPipeline();
              else toast.message('Pipeline', { description: 'Abra CRM → Pipeline no menu.' });
            }}
          />
        </div>

        <DashboardBrokersTable
          brokers={bundle.brokers}
          onOpenTeam={() => {
            if (onNavigateToUsers) onNavigateToUsers();
            else toast.message('Time', { description: 'Abra Usuários no menu.' });
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <DashboardAppointmentsCard
              items={bundle.appointments}
              onOpenAgenda={() => onNavigateToAgenda?.()}
            />
          </div>
          <div className="lg:col-span-2">
            <DashboardActivityCard items={bundle.activities} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardView;
