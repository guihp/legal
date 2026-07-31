import { differenceInCalendarDays, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { fetchUpcomingFromAgenda } from '@/services/agenda/events';
import type { MetricsScope } from '@/services/metrics';
import {
  type ActivityRow,
  type AppointmentRow,
  type BrokerRow,
  type ChannelRow,
  type FunnelStage,
  type MonthPoint,
  type PeriodPreset,
  type PortfolioSlice,
  type TypeSlice,
  CHANNEL_ORDER,
  FUNNEL_STAGES,
  avatarClassFor,
  channelMeta,
  formatActionText,
  formatActivityWhen,
  formatDeltaPct,
  formatMoneyMil,
  formatTicketMedio,
  initials,
  isClosedStage,
  isSoldDisponibilidade,
  isVisitStage,
  mapChannel,
  monthKeysLast12,
  normalizePropertyType,
  normalizeStage,
  pct,
  resolvePeriod,
  shortMonthLabel,
  sparkFromBuckets,
  activityTone,
} from './helpers';

export type DashboardBundle = {
  synced: boolean;
  updatedAt: Date;
  range: { from: Date; to: Date };
  kpis: {
    vgv: number;
    vgvPrev: number;
    vgvSpark: number[];
    sold: number;
    soldPrev: number;
    soldSpark: number[];
    available: number;
    portfolioTotal: number;
    availableSpark: number[];
    leads: number;
    leadsPrev: number;
    leadsSpark: number[];
    visits: number;
    visitsAi: number;
    visitsSpark: number[];
    ticket: number;
    cycleDays: number | null;
    ticketSpark: number[];
  };
  vgvSeries: MonthPoint[];
  vgvPeakLabel: string | null;
  portfolio: {
    total: number;
    slices: PortfolioSlice[];
    types: TypeSlice[];
  };
  channels: {
    total: number;
    rows: ChannelRow[];
    monthly: { label: string; value: number }[];
  };
  funnel: {
    stages: FunnelStage[];
    conversionTotalPct: number;
    cycleDays: number | null;
    unassigned: number;
  };
  brokers: BrokerRow[];
  appointments: AppointmentRow[];
  activities: ActivityRow[];
  softGaps: string[];
  /** How VGV/vendidos/ticket were derived for this load. */
  vgvSource: 'leads' | 'properties' | 'listings';
};

type LeadRow = {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  source: string | null;
  stage: string | null;
  estimated_value: number | null;
  id_corretor_responsavel: string | null;
  event_id?: string | null;
  user_profiles?: {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string | null;
  } | null;
};

type PropRow = {
  id: number;
  preco: number | null;
  disponibilidade: string | null;
  tipo_imovel: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/** Sale-like unit used for VGV / vendidos / ticket. */
type SaleUnit = {
  value: number;
  at: string | null;
  source: 'lead' | 'property' | 'listing';
};

type VgvMode = 'leads' | 'properties' | 'listings';

function inRange(iso: string | null | undefined, from: Date, to: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function monthKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function leadValue(lead: LeadRow): number {
  return Number(lead.estimated_value) || 0;
}

function propValue(prop: PropRow): number {
  return Number(prop.preco) || 0;
}

function salesInPeriod(sales: SaleUnit[], from: Date, to: Date): SaleUnit[] {
  return sales.filter((s) => inRange(s.at, from, to));
}

function sumSales(sales: SaleUnit[]): number {
  return sales.reduce((acc, s) => acc + s.value, 0);
}

/** Pick data source: CRM closings → sold stock → listing cadastro (legacy chart). */
function resolveVgvMode(leadSales: SaleUnit[], propSales: SaleUnit[], listingSales: SaleUnit[]): VgvMode {
  if (leadSales.some((s) => s.value > 0)) return 'leads';
  if (propSales.some((s) => s.value > 0)) return 'properties';
  if (listingSales.some((s) => s.value > 0)) return 'listings';
  return 'leads';
}

function hasVisit(lead: LeadRow): boolean {
  if (lead.event_id) return true;
  return isVisitStage(lead.stage) || /visita/.test(normalizeStage(lead.stage));
}

function isAiishSource(source: string | null | undefined): boolean {
  const s = (source || '').toLowerCase();
  return /whatsapp|ia|bot|sdr/.test(s);
}

/** Empty shell used when dashboard fetch fails — keeps Relatórios/Painel usable. */
export function emptyDashboardBundle(preset: PeriodPreset): DashboardBundle {
  const { from, to } = resolvePeriod(preset);
  const months = monthKeysLast12();
  const zeroSpark = sparkFromBuckets([]);
  return {
    synced: false,
    updatedAt: new Date(),
    range: { from, to },
    kpis: {
      vgv: 0,
      vgvPrev: 0,
      vgvSpark: zeroSpark,
      sold: 0,
      soldPrev: 0,
      soldSpark: zeroSpark,
      available: 0,
      portfolioTotal: 0,
      availableSpark: zeroSpark,
      leads: 0,
      leadsPrev: 0,
      leadsSpark: zeroSpark,
      visits: 0,
      visitsAi: 0,
      visitsSpark: zeroSpark,
      ticket: 0,
      cycleDays: null,
      ticketSpark: zeroSpark,
    },
    vgvSeries: months.map((key) => ({
      key,
      label: shortMonthLabel(key),
      vgv: 0,
      qtd: 0,
    })),
    vgvPeakLabel: null,
    portfolio: { total: 0, slices: [], types: [] },
    channels: { total: 0, rows: [], monthly: [] },
    funnel: { stages: [], conversionTotalPct: 0, cycleDays: null, unassigned: 0 },
    brokers: [],
    appointments: [],
    activities: [],
    softGaps: ['Painel: falha ao carregar dados — métricas zeradas.'],
    vgvSource: 'leads',
  };
}

const EMPTY_QUERY = { data: null, error: true as const };

export async function fetchDashboardBundle(
  scope: MetricsScope,
  preset: PeriodPreset,
): Promise<DashboardBundle> {
  const softGaps: string[] = [];
  const { from, to, prevFrom, prevTo } = resolvePeriod(preset);
  const months = monthKeysLast12();
  const twelveFrom = new Date(months[0] + '-01T00:00:00');

  const leadsSelect =
    'id, created_at, updated_at, source, stage, estimated_value, id_corretor_responsavel, event_id, user_profiles!leads_id_corretor_responsavel_fkey(id, full_name, email, role)';

  // Broad company pull (period filters applied in memory). Include older leads
  // that may have closed recently (updated_at) even if created_at is older.
  let leadsQuery = supabase
    .from('leads')
    .select(leadsSelect)
    .eq('company_id', scope.companyId)
    .or(`created_at.gte.${twelveFrom.toISOString()},updated_at.gte.${twelveFrom.toISOString()}`)
    .limit(5000);

  if (scope.role === 'corretor' && scope.userId) {
    leadsQuery = leadsQuery.eq('id_corretor_responsavel', scope.userId);
  }

  const propsPromise = supabase
    .from('imoveisvivareal')
    .select('id, preco, disponibilidade, tipo_imovel, created_at, updated_at')
    .eq('company_id', scope.companyId);

  const lpPromise = supabase
    .from('property_landing_pages')
    .select('property_id, is_published')
    .eq('company_id', scope.companyId);

  const brokersPromise = supabase
    .from('user_profiles')
    .select('id, full_name, email, role, is_active')
    .eq('company_id', scope.companyId)
    .eq('role', 'corretor')
    .eq('is_active', true);

  const actorsPromise = supabase
    .from('user_profiles')
    .select('id, full_name')
    .eq('company_id', scope.companyId);

  const [
    leadsRes,
    propsRes,
    lpRes,
    brokersRes,
    actorsRes,
    appointmentsRaw,
  ] = await Promise.all([
    Promise.resolve(leadsQuery).catch(() => EMPTY_QUERY),
    Promise.resolve(propsPromise).catch(() => EMPTY_QUERY),
    Promise.resolve(lpPromise).catch(() => EMPTY_QUERY),
    Promise.resolve(brokersPromise).catch(() => EMPTY_QUERY),
    Promise.resolve(actorsPromise).catch(() => EMPTY_QUERY),
    fetchUpcomingFromAgenda(14, 6, 'Todos').catch(() => []),
  ]);

  if ((leadsRes as { error?: unknown }).error) {
    console.error('[dashboard] leads', (leadsRes as { error?: unknown }).error);
    softGaps.push('Leads: consulta indisponível — KPIs de leads/funil/canais zerados.');
  }
  if ((propsRes as { error?: unknown }).error) {
    console.error('[dashboard] props', (propsRes as { error?: unknown }).error);
  }
  if ((lpRes as { error?: unknown }).error) {
    console.error('[dashboard] lps', (lpRes as { error?: unknown }).error);
  }

  const leads = (leadsRes.data || []) as unknown as LeadRow[];
  const props = (propsRes.data || []) as PropRow[];
  const publishedLpIds = new Set(
    ((lpRes.data || []) as { property_id: number; is_published: boolean | null }[])
      .filter((r) => r.is_published)
      .map((r) => r.property_id),
  );

  softGaps.push(
    'Portfólio: Disponíveis=disponivel; Reservados≈reforma; Vendidos≈indisponivel (schema sem reservado/vendido).',
  );
  softGaps.push('Meta mensal de vendas e “visitas pela IA” não têm campos dedicados — IA aproximada por source WhatsApp/IA.');

  // —— Closings / VGV ——
  // Prefer CRM Fechamento/won (estimated_value + updated_at). Fall back to sold stock,
  // then to listing cadastro VGV (legacy dashboardAdapter) when no sales exist in 12m.
  const leadSales: SaleUnit[] = leads
    .filter((l) => isClosedStage(l.stage) && leadValue(l) > 0)
    .map((l) => ({
      value: leadValue(l),
      at: l.updated_at || l.created_at,
      source: 'lead' as const,
    }));

  const propSales: SaleUnit[] = props
    .filter((p) => isSoldDisponibilidade(p.disponibilidade) && propValue(p) > 0)
    .map((p) => ({
      value: propValue(p),
      at: p.updated_at || p.created_at,
      source: 'property' as const,
    }));

  const listingSales: SaleUnit[] = props
    .filter((p) => propValue(p) > 0)
    .map((p) => ({
      value: propValue(p),
      at: p.created_at,
      source: 'listing' as const,
    }));

  const vgvMode = resolveVgvMode(leadSales, propSales, listingSales);
  const salesPool =
    vgvMode === 'leads' ? leadSales : vgvMode === 'properties' ? propSales : listingSales;

  if (vgvMode === 'leads') {
    softGaps.push(
      'VGV/vendidos/ticket: leads em Fechamento/ganho (estimated_value + updated_at).',
    );
  } else if (vgvMode === 'properties') {
    softGaps.push(
      'VGV/vendidos/ticket: fallback estoque indisponivel/vendido (preco + updated_at) — sem fechamentos CRM.',
    );
  } else {
    softGaps.push(
      'VGV/vendidos/ticket: fallback legado (soma preco de imóveis cadastrados no período) — sem fechamentos CRM nem estoque vendido.',
    );
  }

  const closings = salesInPeriod(salesPool, from, to);
  const closingsPrev = salesInPeriod(salesPool, prevFrom, prevTo);
  const vgv = sumSales(closings);
  const vgvPrev = sumSales(closingsPrev);
  const sold = closings.length;
  const soldPrev = closingsPrev.length;
  const ticket = sold > 0 ? vgv / sold : 0;

  const cycleSamples = leads
    .filter((l) => {
      if (!isClosedStage(l.stage) || leadValue(l) <= 0) return false;
      return inRange(l.updated_at || l.created_at, from, to);
    })
    .map((l) => {
      if (!l.created_at || !l.updated_at) return null;
      const days = differenceInCalendarDays(parseISO(l.updated_at), parseISO(l.created_at));
      return days >= 0 ? days : null;
    })
    .filter((n): n is number => n != null);
  const cycleDays =
    cycleSamples.length > 0
      ? Math.round(cycleSamples.reduce((a, b) => a + b, 0) / cycleSamples.length)
      : null;

  // Monthly VGV series (12m)
  const vgvByMonth = new Map<string, { vgv: number; qtd: number }>();
  months.forEach((k) => vgvByMonth.set(k, { vgv: 0, qtd: 0 }));
  salesPool.forEach((s) => {
    const key = monthKey(s.at);
    if (!key || !vgvByMonth.has(key)) return;
    const cur = vgvByMonth.get(key)!;
    cur.vgv += s.value;
    cur.qtd += 1;
  });
  const vgvSeries: MonthPoint[] = months.map((key) => {
    const cur = vgvByMonth.get(key)!;
    return { key, label: shortMonthLabel(key), vgv: cur.vgv, qtd: cur.qtd };
  });
  const peak = [...vgvSeries].sort((a, b) => b.vgv - a.vgv)[0];
  const vgvPeakLabel = peak && peak.vgv > 0 ? `pico em ${peak.label}` : null;

  // Sparklines from monthly series / weekly-ish buckets of leads
  const vgvSpark = sparkFromBuckets(vgvSeries.map((p) => p.vgv));
  const soldSpark = sparkFromBuckets(vgvSeries.map((p) => p.qtd));

  // —— Portfolio ——
  const available = props.filter((p) => (p.disponibilidade || 'disponivel') === 'disponivel').length;
  const reserved = props.filter((p) => p.disponibilidade === 'reforma').length;
  const soldStock = props.filter((p) => p.disponibilidade === 'indisponivel').length;
  const semLp = props.filter((p) => !publishedLpIds.has(p.id)).length;
  const portfolioTotal = props.length;

  const portfolioSlices: PortfolioSlice[] = [
    {
      key: 'disp',
      label: 'Disponíveis',
      count: available,
      pct: pct(available, portfolioTotal),
      barClass: 'bg-emerald-600',
      dotClass: 'bg-emerald-600',
    },
    {
      key: 'res',
      label: 'Reservados',
      count: reserved,
      pct: pct(reserved, portfolioTotal),
      barClass: 'bg-amber-400',
      dotClass: 'bg-amber-400',
    },
    {
      key: 'vend',
      label: 'Vendidos',
      count: soldStock,
      pct: pct(soldStock, portfolioTotal),
      barClass: 'bg-violet-500',
      dotClass: 'bg-violet-500',
    },
    {
      key: 'lp',
      label: 'Sem LP publicada',
      count: semLp,
      pct: pct(semLp, portfolioTotal),
      barClass: 'bg-rose-500',
      dotClass: 'bg-rose-500',
    },
  ];

  const typeCounts = { casa: 0, apt: 0, terreno: 0 };
  props.forEach((p) => {
    typeCounts[normalizePropertyType(p.tipo_imovel)] += 1;
  });
  const types: TypeSlice[] = [
    { label: 'Casas', count: typeCounts.casa },
    { label: 'Apartamentos', count: typeCounts.apt },
    { label: 'Terrenos e comercial', count: typeCounts.terreno },
  ];

  // Available spark — new available listings by month (created)
  const availByMonth = months.map((key) => {
    return props.filter((p) => {
      if ((p.disponibilidade || 'disponivel') !== 'disponivel') return false;
      return monthKey(p.created_at) === key;
    }).length;
  });
  const availableSpark = sparkFromBuckets(availByMonth);

  // —— Leads period ——
  const leadsPeriod = leads.filter((l) => inRange(l.created_at, from, to));
  const leadsPrevPeriod = leads.filter((l) => inRange(l.created_at, prevFrom, prevTo));
  const leadsSpark = sparkFromBuckets(
    months.map(
      (key) => leads.filter((l) => monthKey(l.created_at) === key).length,
    ),
  );

  // —— Visits ——
  const visitsPeriod = leadsPeriod.filter(hasVisit);
  const visits = visitsPeriod.length;
  const visitsAi = visitsPeriod.filter((l) => isAiishSource(l.source)).length;
  const visitsSpark = sparkFromBuckets(
    months.map(
      (key) =>
        leads.filter((l) => monthKey(l.created_at) === key && hasVisit(l)).length,
    ),
  );

  const ticketSpark = sparkFromBuckets(
    vgvSeries.map((p) => (p.qtd > 0 ? p.vgv / p.qtd : 0)),
  );

  // —— Channels ——
  const countByChannel = (list: LeadRow[]) => {
    const map = new Map<string, number>();
    list.forEach((l) => {
      const key = mapChannel(l.source);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  };
  const chNow = countByChannel(leadsPeriod);
  const chPrev = countByChannel(leadsPrevPeriod);
  const channelRows: ChannelRow[] = CHANNEL_ORDER()
    .map((key) => {
      const meta = channelMeta(key);
      const count = chNow.get(key) || 0;
      const prev = chPrev.get(key) || 0;
      let deltaPct: number | null = null;
      if (prev > 0) deltaPct = Math.round(((count - prev) / prev) * 100);
      else if (count > 0) deltaPct = 100;
      return {
        key,
        label: meta.label,
        count,
        pct: pct(count, leadsPeriod.length),
        deltaPct,
        barClass: meta.barClass,
      };
    })
    .filter((r) => r.count > 0 || r.key !== 'outros')
    .sort((a, b) => b.count - a.count);

  const channelMonthly = months.map((key) => ({
    label: shortMonthLabel(key),
    value: leads.filter((l) => monthKey(l.created_at) === key).length,
  }));

  // —— Funnel (current stage distribution in period) ——
  const stageCounts = new Map<string, number>();
  FUNNEL_STAGES.forEach((s) => stageCounts.set(s.key, 0));
  let unmatched = 0;
  leadsPeriod.forEach((l) => {
    const norm = normalizeStage(l.stage);
    const hit = FUNNEL_STAGES.find((s) => s.match(norm));
    if (hit) stageCounts.set(hit.key, (stageCounts.get(hit.key) || 0) + 1);
    else unmatched += 1;
  });
  // Put unmatched into "novos" if stage empty, else ignore
  if (unmatched > 0) {
    softGaps.push(`Funil: ${unmatched} leads do período com estágio fora do mapeamento mockup.`);
  }

  const funnelStages: FunnelStage[] = FUNNEL_STAGES.map((s, idx) => {
    const count = stageCounts.get(s.key) || 0;
    const prevCount = idx === 0 ? null : stageCounts.get(FUNNEL_STAGES[idx - 1].key) || 0;
    const conversionPct =
      idx === 0 || prevCount == null || prevCount === 0
        ? null
        : Math.round((count / prevCount) * 100);
    const maxCount = Math.max(...FUNNEL_STAGES.map((x) => stageCounts.get(x.key) || 0), 1);
    return {
      key: s.key,
      label: s.label,
      count,
      conversionPct,
      barClass: s.barClass,
      barWidth: Math.max(4, Math.round((count / maxCount) * 100)),
    };
  });

  const closedCount = stageCounts.get('fechados') || 0;
  const conversionTotalPct =
    leadsPeriod.length > 0 ? Math.round((closedCount / leadsPeriod.length) * 1000) / 10 : 0;

  const unassigned = leadsPeriod.filter((l) => !l.id_corretor_responsavel).length;

  // —— Brokers ——
  const brokerProfiles = (brokersRes.data || []) as {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string | null;
  }[];

  const brokerMap = new Map<string, BrokerRow>();
  const ensureBroker = (id: string, name: string) => {
    if (!brokerMap.has(id)) {
      brokerMap.set(id, {
        id,
        name,
        roleLabel: 'Corretor',
        initials: initials(name),
        avatarClass: avatarClassFor(id),
        leads: 0,
        visitas: 0,
        fechamentos: 0,
        conversionPct: 0,
        vgv: 0,
        vgvLabel: '—',
      });
    }
    return brokerMap.get(id)!;
  };

  brokerProfiles.forEach((b) => {
    ensureBroker(b.id, b.full_name || b.email || 'Corretor');
  });

  leadsPeriod.forEach((l) => {
    if (!l.id_corretor_responsavel) return;
    const profile = l.user_profiles;
    const name = profile?.full_name || profile?.email || 'Corretor';
    const row = ensureBroker(l.id_corretor_responsavel, name);
    row.leads += 1;
    if (hasVisit(l)) row.visitas += 1;
  });

  // Broker fechamentos: always from CRM closings in period (not listing fallback)
  const leadClosingsPeriod = leads.filter((l) => {
    if (!isClosedStage(l.stage) || leadValue(l) <= 0) return false;
    return inRange(l.updated_at || l.created_at, from, to);
  });

  leadClosingsPeriod.forEach((l) => {
    if (!l.id_corretor_responsavel) return;
    const profile = l.user_profiles;
    const name = profile?.full_name || profile?.email || 'Corretor';
    const row = ensureBroker(l.id_corretor_responsavel, name);
    row.fechamentos += 1;
    row.vgv += leadValue(l);
  });

  let brokers = Array.from(brokerMap.values())
    .map((b) => ({
      ...b,
      conversionPct: b.leads > 0 ? Math.round((b.fechamentos / b.leads) * 1000) / 10 : 0,
      vgvLabel: b.vgv > 0 ? formatMoneyMil(b.vgv) : '—',
    }))
    .filter((b) => b.leads > 0 || b.fechamentos > 0 || b.visitas > 0)
    .sort((a, b) => b.leads - a.leads || b.vgv - a.vgv);

  if (scope.role === 'corretor' && scope.userId) {
    brokers = brokers.filter((b) => b.id === scope.userId);
  }

  // —— Appointments ——
  const appointments: AppointmentRow[] = (appointmentsRaw || []).flatMap((ev) => {
    try {
      const date = ev?.date instanceof Date ? ev.date : new Date(ev?.date as unknown as string);
      if (Number.isNaN(date.getTime())) return [];
      const now = new Date();
      const isToday =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
      const timeLabel = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const dayLabel = isToday
        ? 'HOJE'
        : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const st = (ev.status || '').toLowerCase();
      const confirmada = st.includes('confirm');
      const aConfirmar = st.includes('aguard') || st.includes('needs') || st.includes('talvez');
      const status: AppointmentRow['status'] = confirmada
        ? 'confirmada'
        : aConfirmar
          ? 'a_confirmar'
          : 'outro';
      const title =
        ev.type && ev.property
          ? `${ev.type} · ${ev.property}`.replace(/\s+/g, ' ').slice(0, 60)
          : ev.property || ev.type || 'Compromisso';
      const detail = [ev.client, ev.corretor, ev.address].filter(Boolean).join(' · ');
      return [
        {
          id: String(ev.id),
          timeLabel,
          dayLabel,
          title,
          detail,
          status,
          statusLabel:
            status === 'confirmada'
              ? 'CONFIRMADA'
              : status === 'a_confirmar'
                ? 'A CONFIRMAR'
                : (ev.status || '').toUpperCase(),
          canConfirm: status === 'a_confirmar',
        },
      ];
    } catch {
      return [];
    }
  });

  // —— Activity feed ——
  const actorIds = ((actorsRes.data || []) as { id: string; full_name: string | null }[]).map(
    (u) => u.id,
  );
  const actorName = new Map(
    ((actorsRes.data || []) as { id: string; full_name: string | null }[]).map((u) => [
      u.id,
      u.full_name,
    ]),
  );

  let activities: ActivityRow[] = [];
  if (actorIds.length > 0 && scope.role !== 'corretor') {
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('id, action, actor_id, created_at, meta')
      .in('actor_id', actorIds)
      .order('created_at', { ascending: false })
      .limit(8);

    activities = (logs || []).map((log) => ({
      id: log.id,
      text: formatActionText(log.action, actorName.get(log.actor_id)),
      when: formatActivityWhen(log.created_at),
      tone: activityTone(log.action),
    }));
  } else if (scope.role === 'corretor') {
    softGaps.push('Atividade recente oculta para corretor (audit_logs restrito).');
  }

  return {
    synced: true,
    updatedAt: new Date(),
    range: { from, to },
    kpis: {
      vgv,
      vgvPrev,
      vgvSpark,
      sold,
      soldPrev,
      soldSpark,
      available,
      portfolioTotal,
      availableSpark,
      leads: leadsPeriod.length,
      leadsPrev: leadsPrevPeriod.length,
      leadsSpark,
      visits,
      visitsAi,
      visitsSpark,
      ticket,
      cycleDays,
      ticketSpark,
    },
    vgvSeries,
    vgvPeakLabel,
    portfolio: {
      total: portfolioTotal,
      slices: portfolioSlices,
      types,
    },
    channels: {
      total: leadsPeriod.length,
      rows: channelRows,
      monthly: channelMonthly,
    },
    funnel: {
      stages: funnelStages,
      conversionTotalPct,
      cycleDays,
      unassigned,
    },
    brokers,
    appointments,
    activities,
    softGaps,
    vgvSource: vgvMode,
  };
}

export function buildKpiHints(bundle: DashboardBundle) {
  const { kpis, vgvSource } = bundle;
  const availPct = pct(kpis.available, kpis.portfolioTotal);
  const emptySales = kpis.vgv <= 0 && kpis.sold <= 0;
  const soldLabel =
    vgvSource === 'leads'
      ? 'fechamentos CRM no período'
      : vgvSource === 'properties'
        ? 'estoque indisponível/vendido no período'
        : 'imóveis cadastrados no período';
  return {
    vgvHint: (() => {
      if (emptySales) {
        return { text: 'sem fechamentos no período', tone: 'neutral' as const };
      }
      const d = formatDeltaPct(kpis.vgv, kpis.vgvPrev);
      return { text: `${d.text} vs. período anterior`, tone: d.tone };
    })(),
    soldHint: emptySales
      ? { text: 'sem fechamentos no período', tone: 'neutral' as const }
      : { text: soldLabel, tone: 'amber' as const },
    availableHint: {
      text: `${availPct}% do portfólio`,
      tone: 'neutral' as const,
    },
    leadsHint: (() => {
      const d = formatDeltaPct(kpis.leads, kpis.leadsPrev);
      return { text: `${d.text} vs. período anterior`, tone: d.tone === 'neutral' ? 'blue' : d.tone };
    })(),
    visitsHint: {
      text: kpis.visitsAi > 0 ? `${kpis.visitsAi} via WhatsApp/IA` : 'no período',
      tone: 'neutral' as const,
    },
    ticketHint: emptySales
      ? { text: 'sem fechamentos no período', tone: 'neutral' as const }
      : {
          text: kpis.cycleDays != null ? `ciclo de ${kpis.cycleDays} dias` : 'ciclo —',
          tone: 'neutral' as const,
        },
    ticketValue: formatTicketMedio(kpis.ticket),
    vgvValue: kpis.vgv > 0 ? formatMoneyMil(kpis.vgv) : 'R$ 0',
  };
}
