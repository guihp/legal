/**
 * Componentes de estado para gráficos
 * 
 * Estes componentes padronizam a exibição de estados
 * vazios, erro e carregamento em todos os gráficos
 */

export { ChartEmpty, ChartEmptyVariants } from './ChartEmpty';
export { ChartError, ChartErrorVariants } from './ChartError';
export { ChartSkeleton, ChartSkeletonVariants } from './ChartSkeleton';

// Types para facilitar uso
export interface ChartStateProps {
  height?: number;
  className?: string;
}

export interface ChartErrorStateProps extends ChartStateProps {
  error?: Error | string;
  onRetry?: () => void;
}

export interface ChartEmptyStateProps extends ChartStateProps {
  message?: string;
}

export interface ChartLoadingStateProps extends ChartStateProps {
  type?: 'bar' | 'line' | 'pie' | 'area' | 'combined' | 'heatmap' | 'custom';
}
