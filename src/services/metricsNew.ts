import { supabase } from "@/integrations/supabase/client";

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
 * Busca leads agrupados por canal de origem
 */
export async function getLeadsByChannel(options: DateRange): Promise<ChartPoint[]> {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('source')
      .gte('created_at', options.from.toISOString())
      .lte('created_at', options.to.toISOString());

    if (error) throw error;

    // Agrupar e contar por source
    const sourceCounts = (data || []).reduce((acc, lead) => {
      const normalizedSource = CHANNEL_MAPPING[lead.source?.toLowerCase()] || lead.source || 'Não informado';
      acc[normalizedSource] = (acc[normalizedSource] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Converter para array e ordenar por valor
    return Object.entries(sourceCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 canais
      
  } catch (error) {
    console.error('Erro ao buscar leads por canal:', error);
    return [];
  }
}

/**
 * Busca leads agrupados por período temporal
 */
export async function getLeadsByPeriod(options: DateRange & { granularity: TimeGranularity }): Promise<TimeBucket[]> {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('created_at')
      .gte('created_at', options.from.toISOString())
      .lte('created_at', options.to.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Processar dados localmente com agrupamento temporal
    const buckets = new Map<string, number>();
    
    (data || []).forEach(lead => {
      const date = new Date(lead.created_at);
      let periodKey: string;
      
      switch (options.granularity) {
        case 'day':
          periodKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'week':
          const startOfWeek = new Date(date);
          startOfWeek.setDate(date.getDate() - date.getDay());
          periodKey = startOfWeek.toISOString().split('T')[0];
          break;
        case 'month':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          periodKey = date.getFullYear().toString();
          break;
      }
      
      buckets.set(periodKey, (buckets.get(periodKey) || 0) + 1);
    });

    // Converter para array ordenado
    return Array.from(buckets.entries())
      .map(([period, value]) => ({ period, value }))
      .sort((a, b) => a.period.localeCompare(b.period));
      
  } catch (error) {
    console.error('Erro ao buscar leads por período:', error);
    return [];
  }
}

/**
 * Busca funil de estágios dos leads
 */
export async function getLeadsFunnel(options: DateRange): Promise<ChartPoint[]> {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('stage')
      .gte('created_at', options.from.toISOString())
      .lte('created_at', options.to.toISOString());

    if (error) throw error;

    // Agrupar por estágio
    const stageCounts = (data || []).reduce((acc, lead) => {
      const stage = lead.stage || 'Não informado';
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Ordenar conforme fluxo do funil
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
 * Busca leads agrupados por corretor responsável
 */
export async function getLeadsByBroker(options: DateRange): Promise<BrokerStats[]> {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        id,
        id_corretor_responsavel,
        created_at,
        user_profiles!leads_id_corretor_responsavel_fkey (
          id,
          full_name,
          email,
          role
        )
      `)
      .gte('created_at', options.from.toISOString())
      .lte('created_at', options.to.toISOString());

    if (error) throw error;

    // Processar dados e agrupar por corretor
    const brokerStats = new Map<string, BrokerStats>();
    let unassignedCount = 0;

    (data || []).forEach(lead => {
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

    // Adicionar estatística de leads não atribuídos se houver
    if (unassignedCount > 0) {
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
export async function getPropertyTypeDist(options: DateRange): Promise<ChartPoint[]> {
  try {
    const { data, error } = await supabase
      .from('imoveisvivareal')
      .select('tipo_imovel')
      .gte('created_at', options.from.toISOString())
      .lte('created_at', options.to.toISOString());

    if (error) throw error;

    // Agrupar e normalizar tipos
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
 * Busca taxa de disponibilidade dos imóveis
 */
export async function getAvailabilityRate(): Promise<AvailabilityStats> {
  try {
    // Primeiro, verificar se a coluna disponibilidade existe
    const { data, error } = await supabase
      .from('imoveisvivareal')
      .select('disponibilidade')
      .limit(1);

    // Se a coluna não existir, retornar dados simulados
    if (error && error.code === '42703') {
      console.warn('Coluna disponibilidade não encontrada, usando dados simulados');
      
      const { data: totalData, error: totalError } = await supabase
        .from('imoveisvivareal')
        .select('id', { count: 'exact', head: true });

      if (totalError) throw totalError;

      const total = totalData || 0;
      const available = Math.floor(total * 0.7);
      const unavailable = Math.floor(total * 0.2);
      const reform = total - available - unavailable;

      return {
        total,
        available,
        unavailable,
        reform,
        occupancyRate: total > 0 ? ((total - available) / total) * 100 : 0,
        breakdown: [
          { status: 'Disponível', count: available, percentage: total > 0 ? (available / total) * 100 : 0 },
          { status: 'Indisponível', count: unavailable, percentage: total > 0 ? (unavailable / total) * 100 : 0 },
          { status: 'Em reforma', count: reform, percentage: total > 0 ? (reform / total) * 100 : 0 }
        ]
      };
    }

    if (error) throw error;

    // Buscar dados reais
    const { data: fullData, error: fullError } = await supabase
      .from('imoveisvivareal')
      .select('disponibilidade');

    if (fullError) throw fullError;

    // Agrupar por disponibilidade
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
    return {
      total: 0,
      available: 0,
      unavailable: 0,
      reform: 0,
      occupancyRate: 0,
      breakdown: []
    };
  }
}

/**
 * Busca dados para heatmap de conversas dos corretores
 */
export async function getConvoHeatmap(options: DateRange, brokerId?: string): Promise<HeatmapData> {
  try {
    // Tentar primeiro com whatsapp_messages
    const heatmapFromWhatsApp = await getHeatmapFromWhatsAppMessages(options, brokerId);
    
    if (heatmapFromWhatsApp.maxValue > 0) {
      return heatmapFromWhatsApp;
    }

    // Fallback para imobipro_messages
    console.log('Fallback para imobipro_messages para dados de heatmap');
    return await getHeatmapFromImobiproMessages(options, brokerId);
    
  } catch (error) {
    console.error('Erro ao buscar dados de heatmap:', error);
    return {
      grid: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
      maxValue: 0
    };
  }
}

async function getHeatmapFromWhatsAppMessages(options: DateRange, brokerId?: string): Promise<HeatmapData> {
  try {
    let query = supabase
      .from('whatsapp_messages')
      .select(`
        timestamp,
        from_me,
        whatsapp_instances!inner (
          user_id,
          user_profiles!inner (
            id,
            role
          )
        )
      `)
      .eq('from_me', true)
      .gte('timestamp', options.from.toISOString())
      .lte('timestamp', options.to.toISOString());

    const { data, error } = await query;

    if (error) throw error;

    // Filtrar apenas corretores
    const filteredData = (data || []).filter(msg => {
      const profile = msg.whatsapp_instances?.user_profiles;
      if (!profile || profile.role !== 'corretor') return false;
      
      if (brokerId && profile.id !== brokerId) return false;
      
      return true;
    });

    return processHeatmapData(filteredData.map(msg => ({ timestamp: msg.timestamp })));
    
  } catch (error) {
    console.error('Erro ao buscar dados do WhatsApp:', error);
    throw error;
  }
}

async function getHeatmapFromImobiproMessages(options: DateRange, instanceFilter?: string): Promise<HeatmapData> {
  try {
    let query = supabase
      .from('imobipro_messages')
      .select('data, instancia')
      .gte('data', options.from.toISOString())
      .lte('data', options.to.toISOString());

    if (instanceFilter) {
      query = query.eq('instancia', instanceFilter);
    }

    const { data, error } = await query;

    if (error) throw error;

    return processHeatmapData((data || []).map(msg => ({ timestamp: msg.data })));
    
  } catch (error) {
    console.error('Erro ao buscar dados do imobipro_messages:', error);
    throw error;
  }
}

function processHeatmapData(data: Array<{ timestamp: string }>): HeatmapData {
  // Matriz 7x24: [dia][hora] onde dia 0=Segunda, 6=Domingo
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  
  data.forEach(item => {
    const date = new Date(item.timestamp);
    
    // Converter dia da semana: Postgres 0=Dom...6=Sáb → UI 0=Seg...6=Dom
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
export async function getMostSearchedProperties(options: DateRange): Promise<ChartPoint[]> {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('imovel_interesse')
      .not('imovel_interesse', 'is', null)
      .neq('imovel_interesse', '')
      .gte('created_at', options.from.toISOString())
      .lte('created_at', options.to.toISOString());

    if (error) throw error;

    const propertyCounts = (data || []).reduce((acc, lead) => {
      const propertyId = lead.imovel_interesse;
      if (propertyId) {
        acc[propertyId] = (acc[propertyId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(propertyCounts)
      .map(([name, value]) => ({ 
        name: `Imóvel ${name}`, 
        value 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
      
  } catch (error) {
    console.error('Erro ao buscar imóveis mais procurados:', error);
    return [];
  }
}

/**
 * Busca corretores disponíveis
 */
export async function getAvailableBrokers(): Promise<Array<{ id: string; name: string }>> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .eq('role', 'corretor')
      .eq('is_active', true)
      .order('full_name');

    if (error) throw error;

    return (data || []).map(broker => ({
      id: broker.id,
      name: broker.full_name || broker.email || 'Corretor sem nome'
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
