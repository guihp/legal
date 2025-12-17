
import { PropertyWithImages } from "@/hooks/useProperties";
import { DatabaseClient } from "@/hooks/useClients";

// Função para gerar CSV
const generateCSV = (data: any[], headers: string[]): string => {
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',')
    )
  ].join('\n');
  
  return csvContent;
};

// Função para download de arquivo
const downloadFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const exportSalesReport = (properties: PropertyWithImages[], clients: DatabaseClient[]) => {
  // Relatório de vendas - propriedades vendidas e alugadas
  const soldProperties = properties.filter(p => p.status === 'sold');
  const rentedProperties = properties.filter(p => p.status === 'rented');
  
  const salesData = [
    ...soldProperties.map(p => ({
      titulo: p.title,
      tipo: p.type === 'house' ? 'Casa' : 
            p.type === 'apartment' ? 'Apartamento' : 
            p.type === 'commercial' ? 'Comercial' : 'Terreno',
      preco: `R$ ${p.price.toLocaleString('pt-BR')}`,
      status: 'Vendido',
      cidade: p.city,
      data: new Date(p.created_at || '').toLocaleDateString('pt-BR')
    })),
    ...rentedProperties.map(p => ({
      titulo: p.title,
      tipo: p.type === 'house' ? 'Casa' : 
            p.type === 'apartment' ? 'Apartamento' : 
            p.type === 'commercial' ? 'Comercial' : 'Terreno',
      preco: `R$ ${p.price.toLocaleString('pt-BR')}`,
      status: 'Alugado',
      cidade: p.city,
      data: new Date(p.created_at || '').toLocaleDateString('pt-BR')
    }))
  ];

  const headers = ['titulo', 'tipo', 'preco', 'status', 'cidade', 'data'];
  const csvContent = generateCSV(salesData, headers);
  
  downloadFile(csvContent, `relatorio-vendas-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
};

export const exportPropertiesReport = (properties: PropertyWithImages[]) => {
  const propertiesData = properties.map(p => ({
    titulo: p.title,
    tipo: p.type === 'house' ? 'Casa' : 
          p.type === 'apartment' ? 'Apartamento' : 
          p.type === 'commercial' ? 'Comercial' : 'Terreno',
    preco: `R$ ${p.price.toLocaleString('pt-BR')}`,
    area: `${p.area} m²`,
    quartos: p.bedrooms || 0,
    banheiros: p.bathrooms || 0,
    status: p.status === 'available' ? 'Disponível' : 
            p.status === 'sold' ? 'Vendido' : 'Alugado',
    cidade: p.city,
    estado: p.state,
    endereco: p.address,
    data_criacao: new Date(p.created_at || '').toLocaleDateString('pt-BR')
  }));

  const headers = ['titulo', 'tipo', 'preco', 'area', 'quartos', 'banheiros', 'status', 'cidade', 'estado', 'endereco', 'data_criacao'];
  const csvContent = generateCSV(propertiesData, headers);
  
  downloadFile(csvContent, `relatorio-propriedades-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
};

export const exportMarketAnalysisReport = (properties: PropertyWithImages[], clients: DatabaseClient[]) => {
  // Análise de mercado por tipo de propriedade
  const typeAnalysis = ['house', 'apartment', 'commercial', 'land'].map(type => {
    const typeProperties = properties.filter(p => p.type === type);
    const avgPrice = typeProperties.length > 0 
      ? typeProperties.reduce((sum, p) => sum + p.price, 0) / typeProperties.length 
      : 0;
    
    return {
      tipo: type === 'house' ? 'Casa' : 
            type === 'apartment' ? 'Apartamento' : 
            type === 'commercial' ? 'Comercial' : 'Terreno',
      total_propriedades: typeProperties.length,
      preco_medio: `R$ ${avgPrice.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
      disponiveis: typeProperties.filter(p => p.status === 'available').length,
      vendidos: typeProperties.filter(p => p.status === 'sold').length,
      alugados: typeProperties.filter(p => p.status === 'rented').length
    };
  });

  // Análise por origem de clientes
  const sourceAnalysis = Object.entries(
    clients.reduce((acc, client) => {
      acc[client.source] = (acc[client.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([source, count]) => ({
    origem: source,
    total_leads: count,
    percentual: `${((count / clients.length) * 100).toFixed(1)}%`
  }));

  // Combinar ambas as análises
  const marketData = [
    { secao: 'ANÁLISE POR TIPO DE PROPRIEDADE' },
    ...typeAnalysis,
    { secao: '' },
    { secao: 'ANÁLISE POR ORIGEM DE CLIENTES' },
    ...sourceAnalysis
  ];

  const headers = ['secao', 'tipo', 'total_propriedades', 'preco_medio', 'disponiveis', 'vendidos', 'alugados', 'origem', 'total_leads', 'percentual'];
  const csvContent = generateCSV(marketData, headers);
  
  downloadFile(csvContent, `analise-mercado-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
};
