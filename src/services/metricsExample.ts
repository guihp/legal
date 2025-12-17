/**
 * Exemplos de uso do novo sistema de métricas diretas
 * Este arquivo demonstra como usar as novas funções sem views
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
  type DateRange,
  type TimeGranularity
} from './metrics';

/**
 * Exemplo: Buscar dados dos últimos 12 meses para todos os gráficos
 */
export async function getDashboardDataLast12Months() {
  const dateRange = getLastMonths(12);
  
  console.log('Buscando dados para o período:', dateRange);

  try {
    // Buscar todos os dados em paralelo
    const [
      leadsByChannel,
      leadsByPeriodMonthly,
      leadsFunnel,
      leadsByBroker,
      propertyTypes,
      availabilityStats,
      heatmapData,
      mostSearchedProperties,
      availableBrokers
    ] = await Promise.all([
      getLeadsByChannel(dateRange),
      getLeadsByPeriod({ ...dateRange, granularity: 'month' }),
      getLeadsFunnel(dateRange),
      getLeadsByBroker(dateRange),
      getPropertyTypeDist(dateRange),
      getAvailabilityRate(),
      getConvoHeatmap(dateRange),
      getMostSearchedProperties(dateRange),
      getAvailableBrokers()
    ]);

    return {
      dateRange,
      metrics: {
        leadsByChannel,
        leadsByPeriodMonthly,
        leadsFunnel,
        leadsByBroker,
        propertyTypes,
        availabilityStats,
        heatmapData,
        mostSearchedProperties,
        availableBrokers
      }
    };
    
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    throw error;
  }
}

/**
 * Exemplo: Buscar dados do mês atual com granularidade diária
 */
export async function getCurrentMonthDetailedData() {
  const dateRange = getCurrentMonth();
  
  try {
    const [
      dailyLeads,
      weeklyLeads,
      monthlyFunnel
    ] = await Promise.all([
      getLeadsByPeriod({ ...dateRange, granularity: 'day' }),
      getLeadsByPeriod({ ...dateRange, granularity: 'week' }),
      getLeadsFunnel(dateRange)
    ]);

    return {
      dateRange,
      metrics: {
        dailyLeads,
        weeklyLeads,
        monthlyFunnel
      }
    };
    
  } catch (error) {
    console.error('Erro ao buscar dados detalhados do mês:', error);
    throw error;
  }
}

/**
 * Exemplo: Heatmap filtrado por corretor específico
 */
export async function getBrokerHeatmapData(brokerId: string) {
  const dateRange = getLastMonths(1); // Último mês
  
  try {
    const heatmapData = await getConvoHeatmap(dateRange, brokerId);
    
    console.log(`Heatmap para corretor ${brokerId}:`, {
      maxValue: heatmapData.maxValue,
      totalMessages: heatmapData.grid.flat().reduce((sum, val) => sum + val, 0)
    });
    
    return heatmapData;
    
  } catch (error) {
    console.error('Erro ao buscar heatmap do corretor:', error);
    throw error;
  }
}

/**
 * Exemplo: Comparação de períodos (ano atual vs ano anterior)
 */
export async function getYearComparisonData() {
  const currentYear = getCurrentYear();
  const lastYear: DateRange = {
    from: new Date(currentYear.from.getFullYear() - 1, 0, 1),
    to: new Date(currentYear.from.getFullYear() - 1, 11, 31)
  };
  
  try {
    const [currentYearData, lastYearData] = await Promise.all([
      Promise.all([
        getLeadsByChannel(currentYear),
        getLeadsFunnel(currentYear),
        getPropertyTypeDist(currentYear)
      ]),
      Promise.all([
        getLeadsByChannel(lastYear),
        getLeadsFunnel(lastYear),
        getPropertyTypeDist(lastYear)
      ])
    ]);

    return {
      currentYear: {
        period: currentYear,
        leadsByChannel: currentYearData[0],
        funnel: currentYearData[1],
        propertyTypes: currentYearData[2]
      },
      lastYear: {
        period: lastYear,
        leadsByChannel: lastYearData[0],
        funnel: lastYearData[1],
        propertyTypes: lastYearData[2]
      }
    };
    
  } catch (error) {
    console.error('Erro ao buscar dados de comparação:', error);
    throw error;
  }
}

/**
 * Exemplo: Dados para um período customizado
 */
export async function getCustomPeriodData(from: Date, to: Date, granularity: TimeGranularity = 'month') {
  const dateRange: DateRange = { from, to };
  
  try {
    const [
      leadsByPeriod,
      leadsByChannel,
      funnel
    ] = await Promise.all([
      getLeadsByPeriod({ ...dateRange, granularity }),
      getLeadsByChannel(dateRange),
      getLeadsFunnel(dateRange)
    ]);

    return {
      dateRange,
      granularity,
      metrics: {
        leadsByPeriod,
        leadsByChannel,
        funnel
      }
    };
    
  } catch (error) {
    console.error('Erro ao buscar dados do período customizado:', error);
    throw error;
  }
}

/**
 * Exemplo: Estados vazios - Como detectar quando não há dados
 */
export async function checkEmptyStates() {
  const dateRange = getLastMonths(12);
  
  try {
    const data = await getDashboardDataLast12Months();
    
    const emptyStates = {
      noLeadsByChannel: data.metrics.leadsByChannel.length === 0,
      noFunnel: data.metrics.leadsFunnel.length === 0,
      noBrokers: data.metrics.leadsByBroker.length === 0,
      noPropertyTypes: data.metrics.propertyTypes.length === 0,
      noConversations: data.metrics.heatmapData.maxValue === 0,
      noSearchedProperties: data.metrics.mostSearchedProperties.length === 0
    };
    
    console.log('Estados vazios detectados:', emptyStates);
    
    return emptyStates;
    
  } catch (error) {
    console.error('Erro ao verificar estados vazios:', error);
    throw error;
  }
}

// Exemplo de uso direto nas chamadas:
// const dashboardData = await getDashboardDataLast12Months();
// const currentMonthData = await getCurrentMonthDetailedData();
// const brokerHeatmap = await getBrokerHeatmapData('broker-uuid-here');
// const yearComparison = await getYearComparisonData();
