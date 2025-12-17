import { useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para atualizações em tempo real das métricas do dashboard
 * 
 * Monitora mudanças em tabelas críticas e dispara callbacks com debounce
 * para evitar tempestade de re-renders
 */

export interface RealtimeMetricsConfig {
  /** Callback executado quando dados são atualizados */
  onDataChange: () => void;
  /** Delay do debounce em ms (default: 1000) */
  debounceMs?: number;
  /** Tabelas para monitorar (default: todas) */
  tables?: string[];
  /** Habilitar logs de debug (default: false) */
  debug?: boolean;
}

export interface RealtimeMetricsReturn {
  /** Se está conectado ao realtime */
  isConnected: boolean;
  /** Último timestamp de atualização */
  lastUpdate: Date | null;
  /** Contador de atualizações recebidas */
  updateCount: number;
  /** Forçar reconexão manual */
  reconnect: () => void;
}

const DEFAULT_TABLES = [
  'leads',
  'imoveisvivareal', 
  'whatsapp_messages',
  'imobipro_messages',
  'whatsapp_instances',
  'contracts',
  'user_profiles'
];

export const useRealtimeMetrics = ({
  onDataChange,
  debounceMs = 1000,
  tables = DEFAULT_TABLES,
  debug = false
}: RealtimeMetricsConfig): RealtimeMetricsReturn => {
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<Date | null>(null);
  const updateCountRef = useRef<number>(0);
  const isConnectedRef = useRef<boolean>(false);

  // Função com debounce para evitar múltiplas chamadas
  const debouncedCallback = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      lastUpdateRef.current = new Date();
      updateCountRef.current += 1;
      
      if (debug) {
        console.log(`[useRealtimeMetrics] Triggering data update #${updateCountRef.current}`);
      }
      
      onDataChange();
    }, debounceMs);
  }, [onDataChange, debounceMs, debug]);

  // Handler genérico para mudanças de dados
  const handleDataChange = useCallback((payload: any) => {
    if (debug) {
      console.log('[useRealtimeMetrics] Data change detected:', {
        table: payload.table,
        eventType: payload.eventType,
        timestamp: new Date().toISOString()
      });
    }
    
    debouncedCallback();
  }, [debouncedCallback, debug]);

  // Configurar conexão realtime
  const setupRealtimeConnection = useCallback(() => {
    // Cleanup da conexão anterior
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    // Criar novo canal com timestamp único para evitar conflitos
    const channelName = `dashboard_metrics_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Subscrever a mudanças em cada tabela
    tables.forEach(table => {
      channel.on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: table
        },
        (payload) => handleDataChange({ ...payload, table })
      );
    });

    // Configurar callbacks de status
    channel.on('subscription', (status) => {
      const wasConnected = isConnectedRef.current;
      isConnectedRef.current = status === 'SUBSCRIBED';
      
      if (debug) {
        console.log(`[useRealtimeMetrics] Subscription status: ${status}`);
      }

      // Log de reconexão
      if (isConnectedRef.current && !wasConnected) {
        console.log('[useRealtimeMetrics] Realtime connection established');
      }
    });

    // Subscrever ao canal
    channel.subscribe((status) => {
      if (debug) {
        console.log(`[useRealtimeMetrics] Channel subscription: ${status}`);
      }
    });

    channelRef.current = channel;

    return channel;
  }, [tables, handleDataChange, debug]);

  // Função para reconectar manualmente
  const reconnect = useCallback(() => {
    if (debug) {
      console.log('[useRealtimeMetrics] Manual reconnection triggered');
    }
    setupRealtimeConnection();
  }, [setupRealtimeConnection, debug]);

  // Efeito principal - configurar conexão
  useEffect(() => {
    setupRealtimeConnection();

    // Cleanup na desmontagem
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      if (channelRef.current) {
        if (debug) {
          console.log('[useRealtimeMetrics] Cleaning up realtime connection');
        }
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      
      isConnectedRef.current = false;
    };
  }, [setupRealtimeConnection, debug]);

  // Efeito para monitorar conexão e reconectar se necessário
  useEffect(() => {
    const checkConnection = setInterval(() => {
      // Verificar se a conexão ainda está ativa
      if (channelRef.current && !isConnectedRef.current) {
        if (debug) {
          console.log('[useRealtimeMetrics] Connection lost, attempting reconnect...');
        }
        reconnect();
      }
    }, 30000); // Check a cada 30 segundos

    return () => clearInterval(checkConnection);
  }, [reconnect, debug]);

  return {
    isConnected: isConnectedRef.current,
    lastUpdate: lastUpdateRef.current,
    updateCount: updateCountRef.current,
    reconnect
  };
};

/**
 * Hook simplificado para uso básico no dashboard
 */
export const useRealtimeDashboard = (onDataChange: () => void) => {
  return useRealtimeMetrics({
    onDataChange,
    debounceMs: 2000, // 2 segundos para dashboard
    debug: process.env.NODE_ENV === 'development'
  });
};

/**
 * Hook para monitorar tabelas específicas
 */
export const useRealtimeTable = (
  table: string, 
  onDataChange: () => void,
  debounceMs = 1000
) => {
  return useRealtimeMetrics({
    onDataChange,
    debounceMs,
    tables: [table],
    debug: process.env.NODE_ENV === 'development'
  });
};

/**
 * Hook otimizado para múltiplas métricas com cache local
 */
export const useRealtimeMetricsWithCache = <T>(
  fetchFunction: () => Promise<T>,
  dependencies: any[] = []
) => {
  const cacheRef = useRef<T | null>(null);
  const isLoadingRef = useRef<boolean>(false);

  const refetch = useCallback(async () => {
    if (isLoadingRef.current) return cacheRef.current;
    
    isLoadingRef.current = true;
    try {
      const result = await fetchFunction();
      cacheRef.current = result;
      return result;
    } finally {
      isLoadingRef.current = false;
    }
  }, [fetchFunction, ...dependencies]);

  const { isConnected, lastUpdate } = useRealtimeDashboard(refetch);

  return {
    data: cacheRef.current,
    isLoading: isLoadingRef.current,
    isConnected,
    lastUpdate,
    refetch
  };
};

export default useRealtimeMetrics;
