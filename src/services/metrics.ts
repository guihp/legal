import { supabase } from "@/integrations/supabase/client";
import { formatImovelInteresseLabel } from "@/lib/charts/propertyLabel";

// Types
export interface ChartPoint {
  name: string;
  value: number;
}

export interface TimeBucket {
  period: string;
  value: number;
}

export interface BrokerStats {
  id: string;
  name: string;
  totalLeads: number;
  assignedLeads: number;
}

export interface HeatmapData {
  grid: number[][];  // [day][hour] onde day: 0=Seg...6=Dom, hour: 0-23
  maxValue: number;
}

export interface AvailabilityStats {
  total: number;
  available: number;
  unavailable: number;
  reform: number;
  occupancyRate: number;
  breakdown: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
}

export type TimeGranularity = 'day' | 'week' | 'month' | 'year';

export interface DateRange {
  from: Date;
  to: Date;
}

/** Escopo multi-empresa para métricas do dashboard */
export interface MetricsScope {
  companyId: string;
  userId?: string;
  role?: string;
}

const EMPTY_AVAILABILITY: AvailabilityStats = {
  total: 0,
  available: 0,
  unavailable: 0,
  reform: 0,
  occupancyRate: 0,
  breakdown: []
};

const EMPTY_HEATMAP: HeatmapData = {
  grid: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
  maxValue: 0
};

function isCorretorScope(scope: MetricsScope): boolean {
  return scope.role === 'corretor' && Boolean(scope.userId);
}

// Channel normalization mapping
const CHANNEL_MAPPING: Record<string, string> = {
  'sdr_facebook': 'Facebook',
  'sdr_google': 'Google',
  'sdr_whatsapp': 'WhatsApp',
  'vivareal': 'VivaReal',
  'zapimoveis': 'ZapImóveis',
  'whatsapp': 'WhatsApp',
  'facebook': 'Facebook',
  'google': 'Google',
  'site': 'Site Próprio',
  'indicacao': 'Indicação',
  'telefone': 'Telefone',
  'email': 'E-mail'
};

// Property type normalization
function normalizePropertyType(typeRaw: string): string {
  if (!typeRaw) return 'Não informado';
  
  const type = typeRaw.toLowerCase();
  
  if (type.includes('apart') || type.includes('condo')) return 'Apartamento';
  if (type.includes('cobertura')) return 'Cobertura';
  if (type.includes('casa') || type.includes('sobrado')) return 'Casa';
  if (type.includes('terreno') || type.includes('lote')) return 'Terreno';
  if (type.includes('comercial') || type.includes('loja') || type.includes('sala')) return 'Comercial';
  if (type.includes('industrial') || type.includes('galpao')) return 'Industrial';
  if (type.includes('rural') || type.includes('chacara') || type.includes('sitio')) return 'Rural';
  if (type.includes('studio') || type.includes('loft') || type.includes('flat')) return 'Studio/Loft';
  if (type.includes('garagem') || type.includes('vaga')) return 'Garagem';
  
  return 'Outros';
}

// Lead stage ordering
const STAGE_ORDER: Record<string, number> = {
  'Novo Lead': 1,
  'Contato Realizado': 2,
  'Visita Agendada': 3,
  'Em Negociação': 4,
  'Proposta Enviada': 5,
  'Fechamento': 6,
  'Perdido': 7,
  'Não informado': 8
};

/**
 * Stages that mean the lead has a booked/realized visit appointment.
 * Product Kanban: "Visita Agendada" + stages after the visit (excl. Visita Cancelada).
 * Also treat any lead with calendar event_id as having an appointment.
 */
const REALIZED_APPOINTMENT_STAGES = new Set([
  'visita agendada',
  'em negociacao',
  'documentacao',
  'contrato',
  'fechamento',
]);

function normalizeLeadStage(stage: string | null | undefined): string {
  return (stage || '')
    .trim()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function hasRealizedAppointment(lead: {
  stage?: string | null;
  event_id?: string | null;
}): boolean {
  if (lead.event_id) return true;
  return REALIZED_APPOINTMENT_STAGES.has(normalizeLeadStage(lead.stage));
}

/**
 * Query base de leads no escopo da empresa (e do corretor quando aplicável).
 */
function leadsScopedQuery(select: string, options: DateRange, scope: MetricsScope) {
  let query = supabase
    .from('leads')
    .select(select)
    .eq('company_id', scope.companyId)
    .gte('created_at', options.from.toISOString())
    .lte('created_at', options.to.toISOString());

  if (isCorretorScope(scope)) {
    query = query.eq('id_corretor_responsavel', scope.userId!);
  }

  return query;
}

/**
 * Busca leads agrupados por canal de origem
 */
export async function getLeadsByChannel(options: DateRange, scope: MetricsScope): Promise<ChartPoint[]> {
  try {
    const { data, error } = await leadsScopedQuery('source', options, scope);

    if (error) throw error;

    const sourceCounts = (data || []).reduce((acc, lead) => {
      const normalizedSource = CHANNEL_MAPPING[lead.source?.toLowerCase()] || lead.source || 'Não informado';
      acc[normalizedSource] = (acc[normalizedSource] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(sourceCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
      
  } catch (error) {
    console.error('Erro ao buscar leads por canal:', error);
    return [];
  }
}

/**
 * Processa dados de leads por período
 */
function processLeadsData(data: { created_at: string }[], granularity: TimeGranularity): TimeBucket[] {
  const buckets = new Map<string, number>();
  
  (data || []).forEach((lead) => {
    const date = new Date(lead.created_at);
    let periodKey: string;
    
    switch (granularity) {
      case 'day':
        periodKey = date.toISOString().split('T')[0];
        break;
      case 'week': {
        const startOfWeek = new Date(date);
        const dayOfWeek = date.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setDate(date.getDate() + diff);
        periodKey = startOfWeek.toISOString().split('T')[0];
        break;
      }
      case 'month':
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'year':
        periodKey = date.getFullYear().toString();
        break;
    }
    
    buckets.set(periodKey, (buckets.get(periodKey) || 0) + 1);
  });

  return Array.from(buckets.entries())
    .map(([period, value]) => ({ period, value }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Busca leads agrupados por período temporal (query direta, sem RPC admin)
 */
export async function getLeadsByPeriod(
  options: DateRange & { granularity: TimeGranularity },
  scope: MetricsScope
): Promise<TimeBucket[]> {
  try {
    const { data, error } = await leadsScopedQuery('created_at', options, scope)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('📊 [getLeadsByPeriod] Query falhou:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return processLeadsData(data, options.granularity);
      
  } catch (error) {
    console.error('📊 [getLeadsByPeriod] Erro ao buscar leads por período:', error);
    return [];
  }
}

/**
 * Busca funil de estágios dos leads
 */
export async function getLeadsFunnel(options: DateRange, scope: MetricsScope): Promise<ChartPoint[]> {
  try {
    const { data, error } = await leadsScopedQuery('stage', options, scope);

    if (error) throw error;

    const stageCounts = (data || []).reduce((acc, lead) => {
      const stage = lead.stage || 'Não informado';
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(stageCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const orderA = STAGE_ORDER[a.name] || 999;
        const orderB = STAGE_ORDER[b.name] || 999;
        return orderA - orderB;
      })
      .filter(item => item.value > 0);
      
  } catch (error) {
    console.error('Erro ao buscar funil de leads:', error);
    return [];
  }
}

/**
 * Busca leads agrupados por corretor responsável.
 * By default counts only leads with agendamento realizado
 * (stage Visita Agendada+ or linked calendar event_id).
 */
export async function getLeadsByBroker(
  options: DateRange,
  scope: MetricsScope,
  opts: { onlyWithRealizedAppointments?: boolean } = { onlyWithRealizedAppointments: true }
): Promise<BrokerStats[]> {
  try {
    const { data, error } = await leadsScopedQuery(
      `
        id,
        id_corretor_responsavel,
        created_at,
        stage,
        event_id,
        user_profiles!leads_id_corretor_responsavel_fkey (
          id,
          full_name,
          email,
          role
        )
      `,
      options,
      scope
    );

    if (error) throw error;

    const brokerStats = new Map<string, BrokerStats>();
    let unassignedCount = 0;
    const onlyAppointments = opts.onlyWithRealizedAppointments !== false;

    (data || []).forEach((lead: any) => {
      if (onlyAppointments && !hasRealizedAppointment(lead)) return;

      if (!lead.id_corretor_responsavel) {
        unassignedCount++;
        return;
      }

      const broker = lead.user_profiles;
      if (!broker || broker.role !== 'corretor') return;

      const brokerId = broker.id;
      const brokerName = broker.full_name || broker.email || 'Corretor sem nome';

      if (!brokerStats.has(brokerId)) {
        brokerStats.set(brokerId, {
          id: brokerId,
          name: brokerName,
          totalLeads: 0,
          assignedLeads: 0
        });
      }

      const stats = brokerStats.get(brokerId)!;
      stats.totalLeads++;
      stats.assignedLeads++;
    });

    const result = Array.from(brokerStats.values())
      .sort((a, b) => b.totalLeads - a.totalLeads);

    if (unassignedCount > 0 && !isCorretorScope(scope)) {
      result.unshift({
        id: 'unassigned',
        name: 'Sem corretor',
        totalLeads: unassignedCount,
        assignedLeads: 0
      });
    }

    return result;
      
  } catch (error) {
    console.error('Erro ao buscar leads por corretor:', error);
    return [];
  }
}

/**
 * Busca distribuição de imóveis por tipo
 */
export async function getPropertyTypeDist(options: DateRange, scope: MetricsScope): Promise<ChartPoint[]> {
  try {
    const { data, error } = await supabase
      .from('imoveisvivareal')
      .select('tipo_imovel')
      .eq('company_id', scope.companyId)
      .gte('created_at', options.from.toISOString())
      .lte('created_at', options.to.toISOString());

    if (error) throw error;

    const typeCounts = (data || []).reduce((acc, property) => {
      const normalizedType = normalizePropertyType(property.tipo_imovel);
      acc[normalizedType] = (acc[normalizedType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(typeCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
      
  } catch (error) {
    console.error('Erro ao buscar distribuição por tipo:', error);
    return [];
  }
}

/**
 * Busca taxa de disponibilidade dos imóveis (sem simulação 70/20/10)
 */
export async function getAvailabilityRate(scope: MetricsScope): Promise<AvailabilityStats> {
  try {
    const { data: fullData, error: fullError } = await supabase
      .from('imoveisvivareal')
      .select('disponibilidade')
      .eq('company_id', scope.companyId);

    if (fullError) {
      console.error('Erro ao buscar disponibilidade:', fullError);
      return EMPTY_AVAILABILITY;
    }

    const statusCounts = (fullData || []).reduce((acc, property) => {
      const status = property.disponibilidade || 'disponivel';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    const available = statusCounts['disponivel'] || 0;
    const unavailable = statusCounts['indisponivel'] || 0;
    const reform = statusCounts['reforma'] || 0;

    const breakdown = Object.entries(statusCounts).map(([status, count]) => ({
      status: status === 'disponivel' ? 'Disponível' : 
              status === 'indisponivel' ? 'Indisponível' : 
              status === 'reforma' ? 'Em reforma' : status,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }));

    return {
      total,
      available,
      unavailable,
      reform,
      occupancyRate: total > 0 ? ((total - available) / total) * 100 : 0,
      breakdown
    };
      
  } catch (error) {
    console.error('Erro ao buscar taxa de disponibilidade:', error);
    return EMPTY_AVAILABILITY;
  }
}

/**
 * Busca dados para heatmap de conversas dos corretores
 */
export async function getConvoHeatmap(
  options: DateRange,
  scope: MetricsScope,
  brokerId?: string
): Promise<HeatmapData> {
  try {
    return await getHeatmapFromMensagens(options, scope, brokerId);
  } catch (error) {
    console.error('❌ Erro ao buscar dados de heatmap:', error);
    return EMPTY_HEATMAP;
  }
}

async function getHeatmapFromMensagens(
  options: DateRange,
  scope: MetricsScope,
  brokerFilter?: string
): Promise<HeatmapData> {
  try {
    let instanceFilter: string | null = null;
    const effectiveBrokerId =
      brokerFilter || (isCorretorScope(scope) ? scope.userId : undefined);

    if (effectiveBrokerId) {
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('full_name, chat_instance, company_id')
        .eq('id', effectiveBrokerId)
        .eq('company_id', scope.companyId)
        .single();

      if (userError || !userData?.chat_instance) {
        return EMPTY_HEATMAP;
      }

      instanceFilter = userData.chat_instance;
    }

    let query = supabase
      .from('mensagens')
      .select('created_at, instancia')
      .eq('company_id', scope.companyId)
      .gte('created_at', options.from.toISOString())
      .lte('created_at', options.to.toISOString());

    if (instanceFilter) {
      query = query.eq('instancia', instanceFilter);
    }

    const { data, error } = await query;

    if (error) throw error;

    return processHeatmapData((data || []).map(msg => ({ timestamp: msg.created_at })));
  } catch (error) {
    console.error('Erro ao buscar dados de mensagens (heatmap):', error);
    throw error;
  }
}

function processHeatmapData(data: Array<{ timestamp: string }>): HeatmapData {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  
  data.forEach((item) => {
    const date = new Date(item.timestamp);
    const dow = date.getDay();
    const uiDay = dow === 0 ? 6 : dow - 1;
    const hour = date.getHours();
    
    if (uiDay >= 0 && uiDay < 7 && hour >= 0 && hour < 24) {
      grid[uiDay][hour]++;
    }
  });
  
  const maxValue = Math.max(...grid.flat());
  return { grid, maxValue };
}

/**
 * Busca imóveis mais procurados
 */
export async function getMostSearchedProperties(options: DateRange, scope: MetricsScope): Promise<ChartPoint[]> {
  try {
    let query = supabase
      .from('leads')
      .select('imovel_interesse')
      .eq('company_id', scope.companyId)
      .not('imovel_interesse', 'is', null)
      .neq('imovel_interesse', '')
      .gte('created_at', options.from.toISOString())
      .lte('created_at', options.to.toISOString());

    if (isCorretorScope(scope)) {
      query = query.eq('id_corretor_responsavel', scope.userId!);
    }

    const { data, error } = await query;

    if (error) throw error;

    const propertyCounts = (data || []).reduce((acc, lead) => {
      const propertyId = lead.imovel_interesse;
      if (propertyId) {
        acc[propertyId] = (acc[propertyId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Short labels only — imovel_interesse is often a full ficha técnica dump
    return Object.entries(propertyCounts)
      .map(([raw, value]) => ({ raw, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map(({ raw, value }) => ({
        name: formatImovelInteresseLabel(raw),
        value,
      }));
      
  } catch (error) {
    console.error('Erro ao buscar imóveis mais procurados:', error);
    return [];
  }
}

/**
 * Busca corretores disponíveis com instâncias configuradas (da empresa)
 */
export async function getAvailableBrokers(scope: MetricsScope): Promise<Array<{ id: string; name: string }>> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, chat_instance')
      .eq('company_id', scope.companyId)
      .eq('role', 'corretor')
      .eq('is_active', true)
      .not('chat_instance', 'is', null)
      .neq('chat_instance', '')
      .order('full_name');

    if (error) throw error;

    let brokers = data || [];
    if (isCorretorScope(scope)) {
      brokers = brokers.filter(b => b.id === scope.userId);
    }

    return brokers.map(broker => ({
      id: broker.id,
      name: `${broker.full_name || broker.email || 'Corretor sem nome'} (${broker.chat_instance})`
    }));
    
  } catch (error) {
    console.error('Erro ao buscar corretores disponíveis:', error);
    return [];
  }
}

// Helper functions para ranges de data
export function getLastDays(days: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from, to };
}

export function getLastMonths(months: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  return { from, to };
}

export function getCurrentMonth(): DateRange {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from, to };
}

export function getCurrentYear(): DateRange {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1);
  const to = new Date(now.getFullYear(), 11, 31);
  return { from, to };
}
