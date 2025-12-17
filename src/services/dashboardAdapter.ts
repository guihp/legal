/**
 * Adapter que mapeia dados do novo services/metrics.ts 
 * para o formato esperado pelos componentes MUI X-Charts
 */
import {
  getLeadsByChannel,
  getLeadsByPeriod,
  getLeadsFunnel,
  getLeadsByBroker,
  getPropertyTypeDist,
  getAvailabilityRate,
  getConvoHeatmap,
  getMostSearchedProperties,
  getAvailableBrokers,
  getLastMonths,
  getCurrentMonth,
  getCurrentYear,
  type ChartPoint,
  type TimeBucket,
  type BrokerStats,
  type HeatmapData,
  type AvailabilityStats,
  type TimeGranularity,
  type DateRange
} from './metrics';
import { monthLabel } from '@/lib/charts/formatters';

// Função para preencher períodos faltantes com dados zero
function fillMissingPeriods(
  data: { month: string; vgv: number; qtd: number }[], 
  fromDate: Date, 
  toDate: Date,
  granularity: TimeGranularity
): { month: string; vgv: number; qtd: number }[] {
  const result: { month: string; vgv: number; qtd: number }[] = [];
  const dataMap = new Map(data.map(item => [item.month, item]));
  
  const current = new Date(fromDate);
  
  while (current <= toDate) {
    let periodKey: string;
    
    switch (granularity) {
      case 'year':
        periodKey = current.getFullYear().toString();
        break;
      case 'month':
        periodKey = `${current.getFullYear()}-${(current.getMonth() + 1).toString().padStart(2, '0')}`;
        break;
      case 'week':
        const startOfWeek = new Date(current);
        startOfWeek.setDate(current.getDate() - current.getDay());
        periodKey = `${startOfWeek.getFullYear()}-W${startOfWeek.getMonth() + 1}-${startOfWeek.getDate()}`;
        break;
      case 'day':
        periodKey = current.toISOString().split('T')[0];
        break;
      default:
        periodKey = current.toISOString();
    }
    
    if (dataMap.has(periodKey)) {
      result.push(dataMap.get(periodKey)!);
    } else {
      result.push({
        month: periodKey,
        vgv: 0,
        qtd: 0
      });
    }
    
    // Avançar para o próximo período
    switch (granularity) {
      case 'year':
        current.setFullYear(current.getFullYear() + 1);
        break;
      case 'month':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
      case 'day':
        current.setDate(current.getDate() + 1);
        break;
    }
  }
  
  return result;
}

// Types esperados pelo componente atual
export type VgvPeriod = 'anual' | 'mensal' | 'semanal' | 'diario';
export type TimeRange = 'total' | 'year' | 'month' | 'week' | 'day';

// Mapeamento de períodos VGV para configurações do novo serviço
function getVgvDateRange(period: VgvPeriod): DateRange & { granularity: TimeGranularity } {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  switch (period) {
    case 'anual': {
      // 7 anos antes + ano atual + 2 anos posteriores (total de 10 anos)
      // Exemplo: 2025 atual -> 2018 a 2027 (7 antes + atual + 2 depois = 10 anos)
      const fromYear = currentYear - 7;
      const toYear = currentYear + 2;
      
      const fromDate = new Date();
      fromDate.setFullYear(fromYear, 0, 1); // 1º de janeiro do ano inicial
      
      const toDate = new Date();
      toDate.setFullYear(toYear, 11, 31); // 31 de dezembro do ano final
      
      return {
        from: fromDate,
        to: toDate,
        granularity: 'year'
      };
    }
    
    case 'mensal': {
      // Últimos 12 meses
      return {
        ...getLastMonths(12),
        granularity: 'month'
      };
    }
    
    case 'semanal': {
      // Últimas 12 semanas
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(now.getDate() - (12 * 7));
      return {
        from: twelveWeeksAgo,
        to: now,
        granularity: 'week'
      };
    }
    
    case 'diario': {
      // Últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return {
        from: thirtyDaysAgo,
        to: now,
        granularity: 'day'
      };
    }
  }
}

// Mapeamento de TimeRange para configurações do novo serviço
function getTimeRangeConfig(timeRange: TimeRange): DateRange & { granularity: TimeGranularity } {
  switch (timeRange) {
    case 'total':
      return {
        ...getLastMonths(24), // 2 anos
        granularity: 'month'
      };
    
    case 'year':
      return {
        ...getCurrentYear(),
        granularity: 'month'
      };
    
    case 'month':
      return {
        ...getCurrentMonth(),
        granularity: 'day'
      };
    
    case 'week': {
      // Últimas 12 semanas
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(new Date().getDate() - (12 * 7));
      return {
        from: twelveWeeksAgo,
        to: new Date(),
        granularity: 'week'
      };
    }
    
    case 'day': {
      // Últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(new Date().getDate() - 30);
      return {
        from: thirtyDaysAgo,
        to: new Date(),
        granularity: 'day'
      };
    }
  }
}

/**
 * Adapter para VGV - busca dados reais da tabela imoveisvivareal
 */
export async function fetchVgvByPeriod(period: VgvPeriod): Promise<{ month: string; vgv: number; qtd: number }[]> {
  try {
    const config = getVgvDateRange(period);
    
    console.log(`🎯 [fetchVgvByPeriod] Período: ${period}`);
    console.log(`🎯 [fetchVgvByPeriod] Config:`, { 
      from: config.from.toISOString(), 
      to: config.to.toISOString(), 
      granularity: config.granularity 
    });
    
    // Importar supabase client
    const { supabase } = await import('../integrations/supabase/client');
    
    // Buscar dados reais da tabela imoveisvivareal
    const { data, error } = await supabase
      .from('imoveisvivareal')
      .select('preco, created_at')
      .gte('created_at', config.from.toISOString())
      .lte('created_at', config.to.toISOString())
      .not('preco', 'is', null);
    
    if (error) {
      console.error('Erro ao buscar dados de VGV:', error);
      return [];
    }
    
    console.log(`🎯 [fetchVgvByPeriod] Dados retornados: ${data?.length || 0} registros`);
    if (data && data.length > 0) {
      console.log(`🎯 [fetchVgvByPeriod] Primeiro registro:`, data[0]);
    }
    
    // Agrupar por período baseado na granularidade
    const grouped = new Map<string, { vgv: number; qtd: number }>();
    
    data?.forEach(item => {
      const date = new Date(item.created_at);
      let key: string;
      
      if (config.granularity === 'year') {
        key = date.getFullYear().toString();
      } else if (config.granularity === 'month') {
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      } else if (config.granularity === 'week') {
        // Calcular semana do ano usando ISO week
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        key = `${startOfWeek.getFullYear()}-W${startOfWeek.getMonth() + 1}-${startOfWeek.getDate()}`;
      } else { // day
        key = date.toISOString().split('T')[0];
      }
      
      if (!grouped.has(key)) {
        grouped.set(key, { vgv: 0, qtd: 0 });
      }
      
      const current = grouped.get(key)!;
      current.vgv += Number(item.preco) || 0;
      current.qtd += 1;
    });
    
    // Converter para formato esperado pelo gráfico
    const result = Array.from(grouped.entries()).map(([period, data]) => ({
      month: period,
      vgv: data.vgv,
      qtd: data.qtd
    })).sort((a, b) => a.month.localeCompare(b.month));
    
    console.log(`🎯 [fetchVgvByPeriod] Resultado final:`, result);
    
    // Preencher períodos faltantes para melhor visualização do gráfico
    if (result.length > 0) {
      const filledResult = fillMissingPeriods(result, config.from, config.to, config.granularity);
      console.log(`🎯 [fetchVgvByPeriod] Resultado preenchido:`, filledResult);
      return filledResult;
    }
    
    // Se não há dados, criar pelo menos alguns pontos vazios para o gráfico não ficar completamente vazio
    if (result.length === 0) {
      const emptyResult = fillMissingPeriods([], config.from, config.to, config.granularity);
      console.log(`🎯 [fetchVgvByPeriod] Resultado vazio preenchido:`, emptyResult);
      return emptyResult;
    }
    
    return result;
    
  } catch (error) {
    console.error('Erro ao buscar VGV:', error);
    return [];
  }
}

/**
 * Adapter para leads por canal (já compatível)
 */
export async function fetchLeadsPorCanalTop8(): Promise<{ name: string; value: number }[]> {
  try {
    const data = await getLeadsByChannel(getLastMonths(12));
    return data;
  } catch (error) {
    console.error('Erro ao buscar leads por canal:', error);
    return [];
  }
}

/**
 * Adapter para distribuição por tipo (já compatível)
 */
export async function fetchDistribuicaoPorTipo(): Promise<{ name: string; value: number }[]> {
  try {
    const data = await getPropertyTypeDist(getLastMonths(12));
    return data;
  } catch (error) {
    console.error('Erro ao buscar distribuição por tipo:', error);
    return [];
  }
}

/**
 * Adapter para funil de leads (já compatível)
 */
export async function fetchFunilLeads(): Promise<{ name: string; value: number }[]> {
  try {
    const data = await getLeadsFunnel(getLastMonths(12));
    return data;
  } catch (error) {
    console.error('Erro ao buscar funil de leads:', error);
    return [];
  }
}

/**
 * Adapter para leads por corretor
 */
export async function fetchLeadsPorCorretor(): Promise<{ name: string; value: number }[]> {
  try {
    const data = await getLeadsByBroker(getLastMonths(12));
    return data.map(broker => ({
      name: broker.name,
      value: broker.totalLeads
    }));
  } catch (error) {
    console.error('Erro ao buscar leads por corretor:', error);
    return [];
  }
}

/**
 * Adapter para leads sem corretor
 */
export async function fetchLeadsSemCorretor(): Promise<number> {
  try {
    const data = await getLeadsByBroker(getLastMonths(12));
    const unassigned = data.find(broker => broker.id === 'unassigned');
    return unassigned?.totalLeads || 0;
  } catch (error) {
    console.error('Erro ao buscar leads sem corretor:', error);
    return 0;
  }
}

/**
 * Adapter para leads por tempo
 */
export async function fetchLeadsPorTempo(timeRange: TimeRange): Promise<{ month: string; count: number }[]> {
  try {
    console.log('🕐 [fetchLeadsPorTempo] Iniciando busca para timeRange:', timeRange);
    const config = getTimeRangeConfig(timeRange);
    console.log('🕐 [fetchLeadsPorTempo] Configuração:', config);
    
    const data = await getLeadsByPeriod(config);
    console.log('🕐 [fetchLeadsPorTempo] Dados recebidos:', data);
    
    const result = data.map(item => ({
      month: config.granularity === 'month' ? monthLabel(item.period) : item.period,
      count: item.value
    }));
    
    console.log('🕐 [fetchLeadsPorTempo] Resultado formatado:', result);
    return result;
  } catch (error) {
    console.error('🕐 [fetchLeadsPorTempo] ERRO ao buscar leads por tempo:', error);
    return [];
  }
}

/**
 * Adapter para heatmap de conversas
 */
export async function fetchHeatmapConversasPorCorretor(brokerId?: string): Promise<number[][]> {
  try {
    const data = await getConvoHeatmap(getLastMonths(1), brokerId);
    return data.grid;
  } catch (error) {
    console.error('Erro ao buscar heatmap de conversas:', error);
    // Retorna matriz vazia 7x24
    return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  }
}

/**
 * Adapter para corretores com conversas
 */
export async function fetchCorretoresComConversas(): Promise<{ id: string; name: string }[]> {
  try {
    return await getAvailableBrokers();
  } catch (error) {
    console.error('Erro ao buscar corretores com conversas:', error);
    return [];
  }
}

/**
 * Adapter para taxa de ocupação
 */
export async function fetchTaxaOcupacao(): Promise<{
  ocupacao: number;
  total: number;
  disponiveis: number;
  reforma?: number;
  indisponiveis?: number;
  breakdown?: { status: string; total: number; percent: number }[]
}> {
  try {
    const data = await getAvailabilityRate();
    
    return {
      ocupacao: data.occupancyRate,
      total: data.total,
      disponiveis: data.available,
      reforma: data.reform,
      indisponiveis: data.unavailable,
      breakdown: data.breakdown.map(item => ({
        status: item.status,
        total: item.count,
        percent: item.percentage
      }))
    };
  } catch (error) {
    console.error('Erro ao buscar taxa de ocupação:', error);
    return {
      ocupacao: 0,
      total: 0,
      disponiveis: 0,
      reforma: 0,
      indisponiveis: 0,
      breakdown: []
    };
  }
}

/**
 * Adapter para imóveis mais procurados
 */
export async function fetchImoveisMaisProcurados(): Promise<{ id: string; name: string; value: number }[]> {
  try {
    const data = await getMostSearchedProperties(getLastMonths(12));
    return data.map(item => ({
      id: item.name.replace('Imóvel ', ''), // Remove prefixo "Imóvel "
      name: item.name,
      value: item.value
    }));
  } catch (error) {
    console.error('Erro ao buscar imóveis mais procurados:', error);
    return [];
  }
}

/**
 * Adapter para leads por corretor e estágio (função legada mantida para compatibilidade)
 */
export async function fetchLeadsCorretorEstagio(): Promise<Map<string, Record<string, number>>> {
  try {
    // Esta função era usada para dados mais detalhados de estágios por corretor
    // Por simplicidade, retorna Map vazio - pode ser implementada futuramente se necessário
    return new Map();
  } catch (error) {
    console.error('Erro ao buscar leads por corretor e estágio:', error);
    return new Map();
  }
}

/**
 * Função helper para gerar fallback de dados temporais vazios
 */
export function generateTemporalFallback(months: number = 6): { month: string; count: number }[] {
  const fallback = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    fallback.push({
      month: monthLabel(key),
      count: 0
    });
  }
  return fallback;
}

// Função legada mantida para compatibilidade - apenas placeholder
export async function fetchHeatmapConversas(): Promise<number[][]> {
  return fetchHeatmapConversasPorCorretor();
}
