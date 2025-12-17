import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ConversasInstance {
  instancia: string;
  conversationCount: number;
  displayName: string;
}

export function useConversasInstances() {
  const [instances, setInstances] = useState<ConversasInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obter o usuário atual
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Erro ao obter usuário:', userError);
        setError('Usuário não autenticado');
        return;
      }

      // Usar RPC para contar conversas (DISTINCT session_id) por instância
      const { data, error: fetchError } = await supabase.rpc('get_instances_with_conversation_count', {
        user_id: user.id
      });

      if (fetchError) {
        console.error('Erro ao buscar instâncias:', fetchError);
        setError(fetchError.message);
        return;
      }

      // Converter para o formato esperado
      const instancesArray: ConversasInstance[] = (data || []).map((row: any) => ({
        instancia: row.instancia,
        conversationCount: row.conversation_count,
        displayName: row.instancia
      }));

      setInstances(instancesArray);
    } catch (err) {
      console.error('Erro ao buscar instâncias:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return {
    instances,
    loading,
    error,
    refetch: fetchInstances
  };
}
