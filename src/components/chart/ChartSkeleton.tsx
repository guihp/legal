import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface ChartSkeletonProps {
  height?: number;
  type?: 'bar' | 'line' | 'pie' | 'area' | 'combined' | 'heatmap' | 'custom';
  showLegend?: boolean;
  showAxis?: boolean;
  className?: string;
}

/**
 * Componente de skeleton (loading) para gráficos
 * Usado durante o carregamento dos dados
 */
export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({
  height = 320,
  type = 'bar',
  showLegend = true,
  showAxis = true,
  className = ""
}) => {
  const renderSkeletonByType = () => {
    switch (type) {
      case 'bar':
        return <BarChartSkeleton height={height - (showAxis ? 60 : 20)} />;
      
      case 'line':
      case 'area':
        return <LineChartSkeleton height={height - (showAxis ? 60 : 20)} />;
      
      case 'pie':
        return <PieChartSkeleton height={height - 40} />;
      
      case 'combined':
        return <CombinedChartSkeleton height={height - (showAxis ? 60 : 20)} />;
      
      case 'heatmap':
        return <HeatmapSkeleton height={height - 40} />;
      
      default:
        return <GenericChartSkeleton height={height - 40} />;
    }
  };

  return (
    <div 
      className={`bg-gray-800/20 rounded-lg p-4 animate-pulse ${className}`}
      style={{ height: `${height}px` }}
    >
      <div className="h-full flex flex-col">
        {/* Eixos (se habilitado) */}
        {showAxis && type !== 'pie' && type !== 'heatmap' && (
          <div className="flex items-end mb-4" style={{ height: `${height - 60}px` }}>
            {/* Eixo Y */}
            <div className="w-12 h-full flex flex-col justify-between pr-2">
              <Skeleton className="h-3 w-8 bg-gray-700" />
              <Skeleton className="h-3 w-6 bg-gray-700" />
              <Skeleton className="h-3 w-8 bg-gray-700" />
              <Skeleton className="h-3 w-4 bg-gray-700" />
              <Skeleton className="h-3 w-6 bg-gray-700" />
            </div>
            
            {/* Área do gráfico */}
            <div className="flex-1 h-full">
              {renderSkeletonByType()}
            </div>
          </div>
        )}
        
        {/* Gráfico sem eixos */}
        {(!showAxis || type === 'pie' || type === 'heatmap') && (
          <div className="flex-1">
            {renderSkeletonByType()}
          </div>
        )}
        
        {/* Eixo X */}
        {showAxis && type !== 'pie' && type !== 'heatmap' && (
          <div className="flex justify-between items-center ml-12 mt-2">
            <Skeleton className="h-3 w-12 bg-gray-700" />
            <Skeleton className="h-3 w-10 bg-gray-700" />
            <Skeleton className="h-3 w-14 bg-gray-700" />
            <Skeleton className="h-3 w-8 bg-gray-700" />
            <Skeleton className="h-3 w-12 bg-gray-700" />
          </div>
        )}
        
        {/* Legenda */}
        {showLegend && (
          <div className="flex justify-center mt-4 space-x-4">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-3 w-3 bg-blue-600/40" />
              <Skeleton className="h-3 w-16 bg-gray-700" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-3 w-3 bg-emerald-600/40" />
              <Skeleton className="h-3 w-20 bg-gray-700" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-3 w-3 bg-amber-600/40" />
              <Skeleton className="h-3 w-12 bg-gray-700" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Componentes de skeleton específicos por tipo
const BarChartSkeleton: React.FC<{ height: number }> = ({ height }) => (
  <div className="flex items-end justify-between h-full space-x-2">
    {[...Array(8)].map((_, i) => (
      <Skeleton 
        key={i}
        className="bg-gray-600/40 rounded-t-sm"
        style={{ 
          height: `${Math.random() * 60 + 20}%`,
          width: '100%'
        }}
      />
    ))}
  </div>
);

const LineChartSkeleton: React.FC<{ height: number }> = ({ height }) => (
  <div className="relative h-full">
    {/* Linhas de grade horizontais */}
    <div className="absolute inset-0 flex flex-col justify-between opacity-20">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-px w-full bg-gray-600" />
      ))}
    </div>
    
    {/* Linha principal simulada */}
    <svg className="w-full h-full">
      <defs>
        <linearGradient id="skeleton-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      
      <path
        d={`M 0,${height * 0.6} Q ${height * 0.3},${height * 0.4} ${height * 0.6},${height * 0.5} T ${height},${height * 0.3}`}
        fill="url(#skeleton-gradient)"
        className="animate-pulse"
      />
      
      <path
        d={`M 0,${height * 0.6} Q ${height * 0.3},${height * 0.4} ${height * 0.6},${height * 0.5} T ${height},${height * 0.3}`}
        fill="none"
        stroke="rgb(59, 130, 246)"
        strokeWidth="2"
        className="animate-pulse opacity-60"
      />
    </svg>
  </div>
);

const PieChartSkeleton: React.FC<{ height: number }> = ({ height }) => {
  const radius = Math.min(height, 200) / 3;
  const center = radius + 20;
  
  return (
    <div className="flex items-center justify-center h-full">
      <svg width={center * 2} height={center * 2}>
        {/* Fatias do gráfico de pizza */}
        {[
          { start: 0, end: 120, color: 'rgb(59, 130, 246)' },
          { start: 120, end: 200, color: 'rgb(16, 185, 129)' },
          { start: 200, end: 280, color: 'rgb(245, 158, 11)' },
          { start: 280, end: 360, color: 'rgb(239, 68, 68)' }
        ].map((slice, i) => {
          const startAngle = (slice.start - 90) * (Math.PI / 180);
          const endAngle = (slice.end - 90) * (Math.PI / 180);
          
          const x1 = center + radius * Math.cos(startAngle);
          const y1 = center + radius * Math.sin(startAngle);
          const x2 = center + radius * Math.cos(endAngle);
          const y2 = center + radius * Math.sin(endAngle);
          
          const largeArc = slice.end - slice.start > 180 ? 1 : 0;
          
          return (
            <path
              key={i}
              d={`M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={slice.color}
              opacity="0.4"
              className="animate-pulse"
            />
          );
        })}
        
        {/* Círculo interno */}
        <circle
          cx={center}
          cy={center}
          r={radius * 0.5}
          fill="rgb(31, 41, 55)"
          className="animate-pulse"
        />
      </svg>
    </div>
  );
};

const CombinedChartSkeleton: React.FC<{ height: number }> = ({ height }) => (
  <div className="relative h-full">
    {/* Barras */}
    <div className="absolute inset-0 flex items-end justify-between space-x-1">
      {[...Array(6)].map((_, i) => (
        <Skeleton 
          key={i}
          className="bg-emerald-600/30 rounded-t-sm"
          style={{ 
            height: `${Math.random() * 40 + 20}%`,
            width: '15%'
          }}
        />
      ))}
    </div>
    
    {/* Linha sobreposta */}
    <svg className="absolute inset-0 w-full h-full">
      <path
        d={`M 0,${height * 0.7} Q ${height * 0.2},${height * 0.5} ${height * 0.4},${height * 0.6} T ${height},${height * 0.4}`}
        fill="none"
        stroke="rgb(59, 130, 246)"
        strokeWidth="3"
        className="animate-pulse opacity-60"
      />
    </svg>
  </div>
);

const HeatmapSkeleton: React.FC<{ height: number }> = ({ height }) => (
  <div className="h-full">
    {/* Cabeçalho com dias da semana */}
    <div className="flex mb-2">
      <div className="w-12"></div>
      <div className="flex-1 grid grid-cols-7 gap-1">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, i) => (
          <Skeleton key={i} className="h-6 bg-gray-700 text-center" />
        ))}
      </div>
    </div>
    
    {/* Grid de horas */}
    <div className="flex-1 overflow-y-auto">
      {[...Array(12)].map((_, hour) => (
        <div key={hour} className="flex items-center mb-1">
          <Skeleton className="w-10 h-4 bg-gray-700 mr-2" />
          <div className="flex-1 grid grid-cols-7 gap-1">
            {[...Array(7)].map((_, day) => (
              <Skeleton 
                key={day}
                className="h-4 bg-blue-600/20"
                style={{ opacity: Math.random() * 0.6 + 0.2 }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const GenericChartSkeleton: React.FC<{ height: number }> = ({ height }) => (
  <div className="h-full flex items-center justify-center">
    <div className="space-y-4 w-full max-w-md">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-4 w-4 bg-gray-600" />
          <Skeleton 
            className="h-4 bg-gray-600"
            style={{ width: `${Math.random() * 60 + 40}%` }}
          />
        </div>
      ))}
    </div>
  </div>
);

/**
 * Variantes pré-configuradas para diferentes tipos de gráfico
 */
export const ChartSkeletonVariants = {
  vgv: (height?: number) => (
    <ChartSkeleton height={height} type="combined" showAxis showLegend />
  ),
  
  leadsChannel: (height?: number) => (
    <ChartSkeleton height={height} type="bar" showAxis={false} showLegend={false} />
  ),
  
  leadsTime: (height?: number) => (
    <ChartSkeleton height={height} type="area" showAxis showLegend={false} />
  ),
  
  propertyTypes: (height?: number) => (
    <ChartSkeleton height={height} type="pie" showLegend />
  ),
  
  funnel: (height?: number) => (
    <ChartSkeleton height={height} type="line" showAxis showLegend={false} />
  ),
  
  brokers: (height?: number) => (
    <ChartSkeleton height={height} type="bar" showAxis showLegend={false} />
  ),
  
  heatmap: (height?: number) => (
    <ChartSkeleton height={height} type="heatmap" showAxis={false} showLegend={false} />
  )
};

export default ChartSkeleton;
