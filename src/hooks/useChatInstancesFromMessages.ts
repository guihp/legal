import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';

export interface ChatInstanceRow {
  name: string;
  conversationCount: number;
}

export function useChatInstancesFromMessages() {
  const { profile, isManager, loading: profileLoading } = useUserProfile();
  const [instances, setInstances] = useState<ChatInstanceRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const scopedInstance = useMemo(() => {
    if (!profile) return null;
    if (isManager) return null; // gestores veem todas
    const inst = (profile as any)?.chat_instance;
    return inst ? String(inst).trim().toLowerCase() : null;
  }, [profile, isManager]);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);

      // Evitar mostrar todas as instâncias enquanto o perfil/escopo não está pronto
      if (profileLoading) {
        setInstances([]);
        setLoading(true);
        return;
      }

      // Para corretor: só buscar quando chat_instance estiver definido
      if (!isManager && !scopedInstance) {
        setInstances([]);
        setLoading(false);
        return;
      }

      // 1) Buscar as mensagens escopadas
      let query = supabase
        .from('imobipro_messages')
        .select('instancia, session_id');

      if (scopedInstance) {
        query = query.eq('instancia', scopedInstance);
      }

      const { data, error } = await query;
      if (error) throw error;

      const map = new Map<string, Set<string>>();
      (data || []).forEach((row: any) => {
        const name = String(row.instancia || '').trim().toLowerCase();
        if (!name) return;
        if (!map.has(name)) map.set(name, new Set<string>());
        map.get(name)!.add(String(row.session_id));
      });

      // 2) Converter para array ordenado por nome
      const out: ChatInstanceRow[] = Array.from(map.entries())
        .map(([name, sessions]) => ({ name, conversationCount: sessions.size }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setInstances(out);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar instâncias');
      setInstances([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileLoading) {
      setLoading(true);
      setInstances([]);
      return;
    }
    // Só carregar quando o escopo estiver definido (ou for gestor)
    if (isManager || scopedInstance) {
      refresh();
    } else {
      setInstances([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedInstance, isManager, profileLoading]);

  return { instances, loading, error, refresh, scopedInstance };
}


