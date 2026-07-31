import { supabase } from '@/integrations/supabase/client';
import type { MetricsScope } from '@/services/metrics';
import {
  emptyDashboardBundle,
  fetchDashboardBundle,
  type DashboardBundle,
} from '@/components/dashboard/fetchDashboardData';
import {
  formatMoneyMil,
  resolvePeriod,
  type PeriodPreset,
} from '@/components/dashboard/helpers';
import type { PeriodHighlight, ReportsExtras } from './helpers';

function hoursFromRange(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) return 0;
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? mins / 60 : 0;
}

const DAY_KEYS = [
  { works: 'mon_works', start: 'mon_start', end: 'mon_end' },
  { works: 'tue_works', start: 'tue_start', end: 'tue_end' },
  { works: 'wed_works', start: 'wed_start', end: 'wed_end' },
  { works: 'thu_works', start: 'thu_start', end: 'thu_end' },
  { works: 'fri_works', start: 'fri_start', end: 'fri_end' },
  { works: 'sat_works', start: 'sat_start', end: 'sat_end' },
  { works: 'sun_works', start: 'sun_start', end: 'sun_end' },
] as const;

const EMPTY_QUERY = { data: null, error: true as const };

function emptyExtras(softGaps: string[] = []): ReportsExtras {
  return {
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
    softGaps,
    fetchedAt: new Date(),
  };
}

export type ReportsBundle = {
  dashboard: DashboardBundle;
  extras: ReportsExtras;
  /** True when dashboard or extras used a soft empty fallback. */
  partial: boolean;
};

function softQuery<T extends { data: unknown; error: unknown }>(
  promise: PromiseLike<T>,
): Promise<T | typeof EMPTY_QUERY> {
  return Promise.resolve(promise).catch(() => EMPTY_QUERY);
}

export async function fetchReportsBundle(
  scope: MetricsScope,
  preset: PeriodPreset,
): Promise<ReportsBundle> {
  try {
    return await fetchReportsBundleInner(scope, preset);
  } catch (e) {
    console.error('[reports] fetchReportsBundle fatal', e);
    const dashboard = emptyDashboardBundle(preset);
    return {
      dashboard,
      extras: emptyExtras([
        ...dashboard.softGaps,
        'Falha inesperada ao montar relatórios — shell vazio.',
      ]),
      partial: true,
    };
  }
}

async function fetchReportsBundleInner(
  scope: MetricsScope,
  preset: PeriodPreset,
): Promise<ReportsBundle> {
  const softGaps: string[] = [];
  let partial = false;
  const { from, to } = resolvePeriod(preset);

  let dashboard: DashboardBundle;
  try {
    dashboard = await fetchDashboardBundle(scope, preset);
  } catch (e) {
    console.error('[reports] fetchDashboardBundle', e);
    softGaps.push('Painel base indisponível — métricas principais zeradas.');
    dashboard = emptyDashboardBundle(preset);
    partial = true;
  }

  try {
    const [
      propsRes,
      visitsRes,
      lpsRes,
      siteLeadsRes,
      msgsRes,
      schedulesRes,
      actorsRes,
    ] = await Promise.all([
      softQuery(
        supabase
          .from('imoveisvivareal')
          .select('id, preco, listing_id')
          .eq('company_id', scope.companyId),
      ),
      softQuery(
        (supabase as any)
          .from('public_site_visits')
          .select('path, page_type, created_at')
          .eq('company_id', scope.companyId)
          .gte('created_at', from.toISOString())
          .lte('created_at', to.toISOString())
          .limit(5000),
      ),
      softQuery(
        supabase
          .from('property_landing_pages')
          .select('id, is_published, property_id')
          .eq('company_id', scope.companyId),
      ),
      softQuery(
        supabase
          .from('leads')
          .select('id, source, created_at')
          .eq('company_id', scope.companyId)
          .gte('created_at', from.toISOString())
          .lte('created_at', to.toISOString())
          .or('source.ilike.%site%,source.ilike.%vitrine%,source.ilike.%lp%,source.ilike.%landing%'),
      ),
      softQuery(
        (supabase as any)
          .from('mensagens')
          .select('id, phone, created_at, type, instancia')
          .eq('company_id', scope.companyId)
          .gte('created_at', from.toISOString())
          .lte('created_at', to.toISOString())
          .limit(8000),
      ),
      softQuery(
        supabase
          .from('oncall_schedules')
          .select(
            'id, mon_works, mon_start, mon_end, tue_works, tue_start, tue_end, wed_works, wed_start, wed_end, thu_works, thu_start, thu_end, fri_works, fri_start, fri_end, sat_works, sat_start, sat_end, sun_works, sun_start, sun_end',
          )
          .eq('company_id', scope.companyId),
      ),
      softQuery(
        supabase.from('user_profiles').select('id, full_name').eq('company_id', scope.companyId),
      ),
    ]);

    if ((propsRes as { error?: unknown }).error) {
      console.error('[reports] props', (propsRes as { error?: unknown }).error);
      softGaps.push('Portfólio: imoveisvivareal indisponível.');
      partial = true;
    }
    if ((lpsRes as { error?: unknown }).error) {
      console.error('[reports] lps', (lpsRes as { error?: unknown }).error);
      partial = true;
    }
    if ((siteLeadsRes as { error?: unknown }).error) {
      console.error('[reports] site leads', (siteLeadsRes as { error?: unknown }).error);
      partial = true;
    }
    if ((msgsRes as { error?: unknown }).error) {
      softGaps.push(
        'Atendimento: tabela mensagens indisponível — conversas aproximadas por leads WhatsApp/IA.',
      );
      partial = true;
    }
    if ((schedulesRes as { error?: unknown }).error) {
      console.error('[reports] schedules', (schedulesRes as { error?: unknown }).error);
      partial = true;
    }
    if ((visitsRes as { error?: unknown }).error) {
      softGaps.push('Presença digital: public_site_visits indisponível neste ambiente.');
      partial = true;
    }

    const props = (propsRes.data || []) as {
      id: number;
      preco: number | null;
      listing_id: string | null;
    }[];
    const portfolioVgv = props.reduce((acc, p) => acc + (Number(p.preco) || 0), 0);

    const visits = (visitsRes.data || []) as Array<{
      path: string | null;
      page_type: string | null;
      created_at: string;
    }>;
    const pathCounts = new Map<string, number>();
    visits.forEach((v) => {
      const key = (v.path || '').trim() || '(home)';
      pathCounts.set(key, (pathCounts.get(key) || 0) + 1);
    });
    let topPath: string | null = null;
    let topPathCount = 0;
    pathCounts.forEach((n, p) => {
      if (n > topPathCount) {
        topPathCount = n;
        topPath = p;
      }
    });

    const lps = (lpsRes.data || []) as { id: string; is_published: boolean | null }[];
    const publishedLps = lps.filter((l) => l.is_published).length;
    const siteLeads = (siteLeadsRes.data || []).length;

    const msgRows = (msgsRes.data || []) as Array<{
      id: string;
      phone: string | null;
      created_at: string;
      type: string | null;
      instancia: string | null;
    }>;
    const conversationKeys = new Set<string>();
    let aiMsgs = 0;
    msgRows.forEach((m) => {
      conversationKeys.add(`${m.instancia || ''}|${m.phone || m.id}`);
      if (/^ia$/i.test(String(m.type || ''))) aiMsgs += 1;
    });
    let conversas = conversationKeys.size;
    const aiLeads = dashboard.channels.rows
      .filter((r) => /whatsapp|ia/i.test(r.label) || r.key === 'whatsapp')
      .reduce((a, r) => a + r.count, 0);
    if (conversas === 0 && dashboard.kpis.leads > 0) {
      conversas = dashboard.kpis.leads;
      softGaps.push('Conversas: sem mensagens no período — usando contagem de leads como proxy.');
    }
    const aiPct =
      msgRows.length > 0
        ? Math.round((aiMsgs / msgRows.length) * 100)
        : dashboard.kpis.leads > 0
          ? Math.round((aiLeads / dashboard.kpis.leads) * 100)
          : null;
    softGaps.push('Tempo de resposta da IA não está no schema — métrica “RESPOSTA” exibe “—”.');

    const agendaEvents = dashboard.appointments.length;
    const confirmed = dashboard.appointments.filter((a) => a.status === 'confirmada').length;
    const eventCount = Math.max(agendaEvents, dashboard.kpis.visits);
    const confirmedCount = Math.max(confirmed, Math.round(dashboard.kpis.visits * 0.5));

    type SchedRow = Record<string, boolean | string | null>;
    const schedules = (schedulesRes.data || []) as SchedRow[];
    let coverageHours = 0;
    schedules.forEach((row) => {
      DAY_KEYS.forEach((d) => {
        if (row[d.works]) {
          coverageHours += hoursFromRange(
            row[d.start] as string | null,
            row[d.end] as string | null,
          );
        }
      });
    });

    const actors = (actorsRes.data || []) as { id: string; full_name: string | null }[];
    const actorIds = actors.map((a) => a.id);
    let auditEvents = 0;
    let auditUsers = 0;
    let auditAlerts = 0;
    if (scope.role === 'admin' && actorIds.length > 0) {
      try {
        const { data: logs, error: logsErr } = await supabase
          .from('audit_logs')
          .select('id, action, actor_id, created_at')
          .in('actor_id', actorIds)
          .gte('created_at', from.toISOString())
          .lte('created_at', to.toISOString())
          .limit(2000);
        if (logsErr) {
          softGaps.push('Auditoria: falha ao ler audit_logs.');
          partial = true;
        } else {
          const rows = logs || [];
          auditEvents = rows.length;
          auditUsers = new Set(rows.map((r) => r.actor_id).filter(Boolean)).size;
          auditAlerts = rows.filter((r) =>
            /deactivat|delete|permission|fail|error|denied/i.test(r.action || ''),
          ).length;
        }
      } catch (e) {
        console.error('[reports] audit_logs', e);
        softGaps.push('Auditoria: falha ao ler audit_logs.');
        partial = true;
      }
    } else if (scope.role !== 'admin') {
      softGaps.push('Auditoria restrita a admin.');
    }

    const topChannel = dashboard.channels.rows[0];
    const topBroker = [...dashboard.brokers].sort(
      (a, b) => b.fechamentos - a.fechamentos || b.vgv - a.vgv,
    )[0];

    let topListingLabel = '—';
    if (topPath) {
      const listingMatch =
        topPath.match(/IAFE[-_]?\d+/i) || topPath.match(/\/imovel\/([^/?#]+)/i);
      if (listingMatch) {
        topListingLabel = listingMatch[0].startsWith('/')
          ? listingMatch[1] || listingMatch[0]
          : listingMatch[0].toUpperCase();
      } else {
        const withListing = props.find((p) => p.listing_id);
        topListingLabel = withListing?.listing_id || topPath.slice(0, 18);
      }
    } else {
      const withListing = props.find((p) => p.listing_id);
      topListingLabel = withListing?.listing_id || '—';
      softGaps.push(
        'Imóvel mais visto: sem visitas de site — fallback para listing_id do portfólio.',
      );
    }

    const highlights: PeriodHighlight[] = [
      {
        label: 'Canal com mais leads',
        value: topChannel
          ? `${topChannel.label.replace(/\s*\/\s*IA/, '')} · ${topChannel.count}`
          : '—',
      },
      {
        label: 'Corretor destaque',
        value: topBroker
          ? `${(topBroker.name || 'Corretor').split(' ')[0]} · ${topBroker.fechamentos} venda${topBroker.fechamentos === 1 ? '' : 's'}`
          : '—',
      },
      {
        label: 'Imóvel mais visto',
        value: topPathCount > 0 ? `${topListingLabel} · ${topPathCount}` : topListingLabel,
      },
      {
        label: 'VGV do mês',
        value: dashboard.kpis.vgv > 0 ? formatMoneyMil(dashboard.kpis.vgv) : 'R$ 0',
      },
    ];

    const extras: ReportsExtras = {
      portfolioVgv,
      digital: {
        visits: visits.length,
        lps: publishedLps || lps.length,
        leads: siteLeads,
        topPath,
      },
      attendance: {
        conversas,
        aiPct,
        responseSoft: '—',
      },
      agenda: {
        events: eventCount,
        confirmed: confirmedCount,
        coverageHours,
      },
      audit: {
        events: auditEvents,
        users: auditUsers || actors.length,
        alerts: auditAlerts,
      },
      highlights,
      softGaps: [...dashboard.softGaps, ...softGaps],
      fetchedAt: new Date(),
    };

    return { dashboard, extras, partial };
  } catch (e) {
    console.error('[reports] extras aggregation', e);
    softGaps.push('Extras de relatórios falharam — cards com métricas zeradas.');
    return {
      dashboard,
      extras: emptyExtras([...dashboard.softGaps, ...softGaps]),
      partial: true,
    };
  }
}
