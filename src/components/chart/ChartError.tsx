import React from 'react';
import { Button } from '@/components/ui/button';

interface ChartErrorProps {
  height?: number;
  title?: string;
  message?: string;
  error?: Error | string;
  onRetry?: () => void;
  showRetryButton?: boolean;
  className?: string;
}

/**
 * Componente de estado de erro para gráficos
 * Usado quando há falha ao carregar dados de um gráfico
 */
export const ChartError: React.FC<ChartErrorProps> = ({
  height = 320,
  title = "Erro ao carregar dados",
  message = "Ocorreu um problema ao carregar os dados do gráfico.",
  error,
  onRetry,
  showRetryButton = true,
  className = ""
}) => {
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } catch (err) {
      console.error('Erro ao tentar novamente:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  // Extrair mensagem de erro limpa
  const errorMessage = React.useMemo(() => {
    if (!error) return null;
    
    if (typeof error === 'string') return error;
    
    if (error instanceof Error) {
      // Tentar extrair mensagens mais amigáveis
      if (error.message.includes('network')) {
        return 'Problema de conexão. Verifique sua internet.';
      }
      if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        return 'Sem permissão para acessar estes dados.';
      }
      if (error.message.includes('timeout')) {
        return 'Tempo limite excedido. Tente novamente.';
      }
      
      return error.message;
    }
    
    return 'Erro desconhecido';
  }, [error]);

  return (
    <div 
      className={`flex flex-col items-center justify-center bg-red-900/10 rounded-lg border border-red-500/20 ${className}`}
      style={{ height: `${height}px` }}
    >
      <div className="flex flex-col items-center space-y-4 max-w-sm text-center px-6">
        {/* Ícone de erro */}
        <div className="text-red-400">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        
        {/* Título e mensagem */}
        <div className="space-y-2">
          <h3 className="text-red-300 font-medium text-lg">
            {title}
          </h3>
          <p className="text-red-200/80 text-sm leading-relaxed">
            {message}
          </p>
          
          {/* Mensagem técnica do erro (se disponível) */}
          {errorMessage && (
            <details className="mt-3">
              <summary className="text-xs text-red-300/60 cursor-pointer hover:text-red-300/80 transition-colors">
                Detalhes técnicos
              </summary>
              <p className="text-xs text-red-200/60 mt-2 font-mono bg-red-900/20 p-2 rounded border">
                {errorMessage}
              </p>
            </details>
          )}
        </div>
        
        {/* Botão de retry */}
        {showRetryButton && onRetry && (
          <Button
            onClick={handleRetry}
            disabled={isRetrying}
            variant="outline"
            size="sm"
            className="border-red-400/30 text-red-300 hover:bg-red-900/20 hover:text-red-200 disabled:opacity-50"
          >
            {isRetrying ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Tentando novamente...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Tentar novamente
              </>
            )}
          </Button>
        )}
        
        {/* Dicas para resolução */}
        <div className="text-xs text-red-300/60 space-y-1">
          <p>• Verifique sua conexão com a internet</p>
          <p>• Atualize a página se o problema persistir</p>
          <p>• Entre em contato com o suporte se necessário</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Variantes pré-configuradas para diferentes tipos de erro
 */
export const ChartErrorVariants = {
  // Erro de conexão/rede
  network: (height?: number, onRetry?: () => void) => (
    <ChartError 
      height={height}
      title="Sem conexão"
      message="Não foi possível conectar ao servidor."
      onRetry={onRetry}
    />
  ),
  
  // Erro de permissão
  permission: (height?: number) => (
    <ChartError 
      height={height}
      title="Acesso negado"
      message="Você não tem permissão para visualizar estes dados."
      showRetryButton={false}
    />
  ),
  
  // Timeout
  timeout: (height?: number, onRetry?: () => void) => (
    <ChartError 
      height={height}
      title="Tempo limite excedido"
      message="A consulta demorou mais que o esperado."
      onRetry={onRetry}
    />
  ),
  
  // Erro genérico de dados
  data: (height?: number, onRetry?: () => void) => (
    <ChartError 
      height={height}
      title="Erro nos dados"
      message="Problema ao processar os dados do gráfico."
      onRetry={onRetry}
    />
  ),
  
  // Erro de configuração
  config: (height?: number) => (
    <ChartError 
      height={height}
      title="Configuração inválida"
      message="O gráfico está mal configurado. Entre em contato com o suporte."
      showRetryButton={false}
    />
  )
};

export default ChartError;
