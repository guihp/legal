import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';

export interface Conversa {
  sessionId: string;
  instancia: string;
  displayName: string; // lead.name ou fallback
  leadPhone?: string | null; // reservado
  leadStage?: string | null; // reservado/label
  lastMessageDate: string;
  messageCount: number;
  lastMessageContent: string;
  lastMessageType: 'human' | 'ai';
}

export function useConversasList(selectedInstance?: string | null) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile, isManager } = useUserProfile();

  const scopedInstance = useMemo(() => {
    if (!selectedInstance) return null;
    return String(selectedInstance).trim().toLowerCase();
  }, [selectedInstance]);

  useEffect(() => {
    fetchConversas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedInstance, isManager, (profile as any)?.chat_instance]);

  const fetchConversas = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1) Escopo: se corretor, forçar instância do perfil
      let effectiveInstance = scopedInstance;
      if (!isManager) {
        const inst = (profile as any)?.chat_instance;
        effectiveInstance = inst ? String(inst).trim().toLowerCase() : null;
      }

      if (!effectiveInstance) {
        setConversas([]);
        setLoading(false);
        return;
      }

      // 2) Buscar mensagens dessa instância
      const { data: rows, error: fetchError } = await supabase
        .from('imobipro_messages')
        .select('session_id, instancia, message, data, media')
        .eq('instancia', effectiveInstance);

      if (fetchError) throw fetchError;

      // 3) Agrupar por session_id e calcular última mensagem
      const bySession = new Map<string, any[]>();
      (rows || []).forEach((r: any) => {
        const sid = String(r.session_id);
        if (!bySession.has(sid)) bySession.set(sid, []);
        bySession.get(sid)!.push(r);
      });

      const list: Conversa[] = Array.from(bySession.entries()).map(([sid, list]) => {
        // ordenar por data
        list.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
        const last = list[list.length - 1];

        // preview/mídia
        const hasMedia = !!(last.media && String(last.media).trim() && String(last.media).toLowerCase() !== 'null');
        let parsedMessage: any = last.message;
        if (typeof parsedMessage === 'string') {
          try { parsedMessage = JSON.parse(parsedMessage); } catch { parsedMessage = { content: parsedMessage, type: 'human' }; }
        }
        // Quando houver mídia (imagem/áudio), exibir o content com ícone correspondente
        const isImageMedia = hasMedia && (String(last.media).startsWith('/9j/') || String(last.media).startsWith('iVBORw0'));
        const mediaPrefix = hasMedia ? (isImageMedia ? '🖼️ ' : '🎧 ') : '';
        const lastContent = `${mediaPrefix}${String(parsedMessage?.content || '')}`;
        const lastType = (parsedMessage?.type === 'ai' ? 'ai' : 'human') as 'ai' | 'human';

        return {
          sessionId: sid,
          instancia: String(last.instancia || effectiveInstance),
          displayName: sid, // substituído abaixo por nome do lead se existir
          leadPhone: null,
          leadStage: null,
          lastMessageDate: String(last.data),
          messageCount: list.length,
          lastMessageContent: lastContent,
          lastMessageType: lastType,
        };
      });

      // 4) Trazer nomes de leads
      if (list.length > 0) {
        const sids = list.map(l => l.sessionId);
        const { data: leadRows } = await supabase
          .from('leads')
          .select('id, name')
          .in('id', sids as any);
        const leadMap = new Map<string, string>();
        (leadRows || []).forEach((lr: any) => {
          if (lr && lr.id && lr.name) leadMap.set(String(lr.id), String(lr.name));
        });

        list.forEach(item => {
          const nm = leadMap.get(item.sessionId);
          if (nm) item.displayName = nm;
          else item.displayName = 'Aguardando nome do lead...';
        });
      }

      // 5) Ordenação por última mensagem desc
      list.sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime());

      setConversas(list);
    } catch (err) {
      console.error('Erro ao buscar conversas:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const updateConversation = (sessionId: string) => {
    // Mover conversa para o topo e atualizar dados
    setConversas(prev => {
      const updated = [...prev];
      const index = updated.findIndex(c => c.sessionId === sessionId);
      
      if (index > 0) {
        // Mover para o topo
        const conversation = updated.splice(index, 1)[0];
        updated.unshift(conversation);
      }
      
      return updated;
    });
    
    // Refetch para obter dados atualizados
    fetchConversas();
  };

  return {
    conversas,
    loading,
    error,
    refetch: fetchConversas,
    updateConversation
  };
}
