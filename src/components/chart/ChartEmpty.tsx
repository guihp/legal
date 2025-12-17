import React from 'react';

interface ChartEmptyProps {
  height?: number;
  message?: string;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Componente de estado vazio para gráficos
 * Usado quando não há dados suficientes para exibir um gráfico
 */
export const ChartEmpty: React.FC<ChartEmptyProps> = ({
  height = 320,
  message = "Sem dados suficientes para exibir este gráfico no período selecionado.",
  icon,
  className = ""
}) => {
  return (
    <div 
      className={`flex flex-col items-center justify-center bg-gray-800/30 rounded-lg border-2 border-dashed border-gray-600/50 ${className}`}
      style={{ height: `${height}px` }}
    >
      <div className="flex flex-col items-center space-y-4 max-w-sm text-center px-6">
        {/* Ícone */}
        <div className="text-gray-500">
          {icon || (
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          )}
        </div>
        
        {/* Mensagem principal */}
        <div className="space-y-2">
          <h3 className="text-gray-400 font-medium text-lg">
            Nenhum dado encontrado
          </h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            {message}
          </p>
        </div>
        
        {/* Sugestões */}
        <div className="text-xs text-gray-600 space-y-1">
          <p>• Tente ajustar o período selecionado</p>
          <p>• Verifique se há dados cadastrados</p>
          <p>• Aguarde alguns minutos e tente novamente</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Variantes pré-configuradas para diferentes tipos de gráficos
 */
export const ChartEmptyVariants = {
  // VGV e contratos
  vgv: (height?: number) => (
    <ChartEmpty 
      height={height}
      message="Nenhum contrato encontrado no período selecionado."
    />
  ),
  
  // Leads
  leads: (height?: number) => (
    <ChartEmpty 
      height={height}
      message="Nenhum lead encontrado nos últimos 12 meses."
    />
  ),
  
  // Propriedades/Imóveis
  properties: (height?: number) => (
    <ChartEmpty 
      height={height}
      message="Nenhum imóvel cadastrado."
    />
  ),
  
  // Funil de vendas
  funnel: (height?: number) => (
    <ChartEmpty 
      height={height}
      message="Nenhum lead no funil de vendas."
    />
  ),
  
  // Corretores
  brokers: (height?: number) => (
    <ChartEmpty 
      height={height}
      message="Nenhum lead atribuído a corretores."
    />
  ),
  
  // Heatmap/Conversas
  conversations: (height?: number) => (
    <ChartEmpty 
      height={height}
      message="Não há dados de conversas dos corretores nos últimos 30 dias."
    />
  ),
  
  // Ocupação/Disponibilidade
  occupancy: (height?: number) => (
    <ChartEmpty 
      height={height}
      message="Nenhum imóvel cadastrado para análise de ocupação."
    />
  ),
  
  // Imóveis procurados
  searchedProperties: (height?: number) => (
    <ChartEmpty 
      height={height}
      message="Nenhum imóvel com interesse de leads registrado."
    />
  ),
  
  // Temporal genérico
  temporal: (height?: number) => (
    <ChartEmpty 
      height={height}
      message="Nenhum dado criado no período selecionado."
    />
  )
};

export default ChartEmpty;
