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
  type MetricsScope,
  type TimeGranularity,
  type DateRange
} from './metrics';
import { monthLabel } from '@/lib/charts/formatters';

export type DashboardScope = MetricsScope;

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
      case 'week': {
        const startOfWeek = new Date(current);
        startOfWeek.setDate(current.getDate() - current.getDay());
        periodKey = `${startOfWeek.getFullYear()}-W${startOfWeek.getMonth() + 1}-${startOfWeek.getDate()}`;
        break;
      }
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

function getVgvDateRange(period: VgvPeriod): DateRange & { granularity: TimeGranularity } {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  switch (period) {
    case 'anual': {
      const fromYear = currentYear - 7;
      const toYear = currentYear + 2;
      
      const fromDate = new Date();
      fromDate.setFullYear(fromYear, 0, 1);
      
      const toDate = new Date();
      toDate.setFullYear(toYear, 11, 31);
      
      return {
        from: fromDate,
        to: toDate,
        granularity: 'year'
      };
    }
    
    case 'mensal': {
      return {
        ...getLastMonths(12),
        granularity: 'month'
      };
    }
    
    case 'semanal': {
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(now.getDate() - (12 * 7));
      return {
        from: twelveWeeksAgo,
        to: now,
        granularity: 'week'
      };
    }
    
    case 'diario': {
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

function getTimeRangeConfig(timeRange: TimeRange): DateRange & { granularity: TimeGranularity } {
  switch (timeRange) {
    case 'total':
      return {
        ...getLastMonths(24),
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
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(new Date().getDate() - (12 * 7));
      return {
        from: twelveWeeksAgo,
        to: new Date(),
        granularity: 'week'
      };
    }
    
    case 'day': {
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
export async function fetchVgvByPeriod(
  period: VgvPeriod,
  scope: DashboardScope
): Promise<{ month: string; vgv: number; qtd: number }[]> {
  try {
    const config = getVgvDateRange(period);
    const { supabase } = await import('../integrations/supabase/client');
    
    const { data, error } = await supabase
      .from('imoveisvivareal')
      .select('preco, created_at')
      .eq('company_id', scope.companyId)
      .gte('created_at', config.from.toISOString())
      .lte('created_at', config.to.toISOString())
      .not('preco', 'is', null);
    
    if (error) {
      console.error('Erro ao buscar dados de VGV:', error);
      return [];
    }
    
    const grouped = new Map<string, { vgv: number; qtd: number }>();
    
    data?.forEach(item => {
      const date = new Date(item.created_at);
      let key: string;
      
      if (config.granularity === 'year') {
        key = date.getFullYear().toString();
      } else if (config.granularity === 'month') {
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      } else if (config.granularity === 'week') {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        key = `${startOfWeek.getFullYear()}-W${startOfWeek.getMonth() + 1}-${startOfWeek.getDate()}`;
      } else {
        key = date.toISOString().split('T')[0];
      }
      
      if (!grouped.has(key)) {
        grouped.set(key, { vgv: 0, qtd: 0 });
      }
      
      const current = grouped.get(key)!;
      current.vgv += Number(item.preco) || 0;
      current.qtd += 1;
    });
    
    const result = Array.from(grouped.entries()).map(([periodKey, periodData]) => ({
      month: periodKey,
      vgv: periodData.vgv,
      qtd: periodData.qtd
    })).sort((a, b) => a.month.localeCompare(b.month));
    
    return fillMissingPeriods(result, config.from, config.to, config.granularity);
    
  } catch (error) {
    console.error('Erro ao buscar VGV:', error);
    return [];
  }
}

export async function fetchLeadsPorCanalTop8(scope: DashboardScope): Promise<{ name: string; value: number }[]> {
  try {
    return await getLeadsByChannel(getLastMonths(12), scope);
  } catch (error) {
    console.error('Erro ao buscar leads por canal:', error);
    return [];
  }
}

export async function fetchDistribuicaoPorTipo(scope: DashboardScope): Promise<{ name: string; value: number }[]> {
  try {
    return await getPropertyTypeDist(getLastMonths(12), scope);
  } catch (error) {
    console.error('Erro ao buscar distribuição por tipo:', error);
    return [];
  }
}

export async function fetchFunilLeads(scope: DashboardScope): Promise<{ name: string; value: number }[]> {
  try {
    return await getLeadsFunnel(getLastMonths(12), scope);
  } catch (error) {
    console.error('Erro ao buscar funil de leads:', error);
    return [];
  }
}

export async function fetchLeadsPorCorretor(scope: DashboardScope): Promise<{ name: string; value: number }[]> {
  try {
    // Conta apenas leads com agendamento realizado (Visita Agendada+ / event_id)
    const data = await getLeadsByBroker(getLastMonths(12), scope, {
      onlyWithRealizedAppointments: true,
    });
    return data.map(broker => ({
      name: broker.name,
      value: broker.totalLeads
    }));
  } catch (error) {
    console.error('Erro ao buscar leads por corretor:', error);
    return [];
  }
}

export async function fetchLeadsSemCorretor(scope: DashboardScope): Promise<number> {
  try {
    const data = await getLeadsByBroker(getLastMonths(12), scope, {
      onlyWithRealizedAppointments: true,
    });
    const unassigned = data.find(broker => broker.id === 'unassigned');
    return unassigned?.totalLeads || 0;
  } catch (error) {
    console.error('Erro ao buscar leads sem corretor:', error);
    return 0;
  }
}

export async function fetchLeadsPorTempo(
  timeRange: TimeRange,
  scope: DashboardScope
): Promise<{ month: string; count: number }[]> {
  try {
    const config = getTimeRangeConfig(timeRange);
    const data = await getLeadsByPeriod(config, scope);
    
    return data.map(item => ({
      month: config.granularity === 'month' ? monthLabel(item.period) : item.period,
      count: item.value
    }));
  } catch (error) {
    console.error('🕐 [fetchLeadsPorTempo] ERRO ao buscar leads por tempo:', error);
    return [];
  }
}

export async function fetchHeatmapConversasPorCorretor(
  scope: DashboardScope,
  brokerId?: string
): Promise<number[][]> {
  try {
    const data = await getConvoHeatmap(getLastMonths(1), scope, brokerId);
    return data.grid;
  } catch (error) {
    console.error('Erro ao buscar heatmap de conversas:', error);
    return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  }
}

export async function fetchCorretoresComConversas(
  scope: DashboardScope
): Promise<{ id: string; name: string }[]> {
  try {
    return await getAvailableBrokers(scope);
  } catch (error) {
    console.error('Erro ao buscar corretores com conversas:', error);
    return [];
  }
}

export async function fetchTaxaOcupacao(scope: DashboardScope): Promise<{
  ocupacao: number;
  total: number;
  disponiveis: number;
  reforma?: number;
  indisponiveis?: number;
  breakdown?: { status: string; total: number; percent: number }[]
}> {
  try {
    const data = await getAvailabilityRate(scope);
    
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

export async function fetchImoveisMaisProcurados(
  scope: DashboardScope
): Promise<{ id: string; name: string; value: number }[]> {
  try {
    const data = await getMostSearchedProperties(getLastMonths(12), scope);
    // name is already a short label (tipo · bairro/área); id mirrors it for legend keys
    return data.map(item => ({
      id: item.name,
      name: item.name,
      value: item.value
    }));
  } catch (error) {
    console.error('Erro ao buscar imóveis mais procurados:', error);
    return [];
  }
}

export async function fetchLeadsCorretorEstagio(
  _scope?: DashboardScope
): Promise<Map<string, Record<string, number>>> {
  try {
    return new Map();
  } catch (error) {
    console.error('Erro ao buscar leads por corretor e estágio:', error);
    return new Map();
  }
}

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

export async function fetchHeatmapConversas(scope: DashboardScope): Promise<number[][]> {
  return fetchHeatmapConversasPorCorretor(scope);
}
