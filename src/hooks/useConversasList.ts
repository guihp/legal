import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { extractMessageContent } from './useConversaMessages';

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
  const [companyPhone, setCompanyPhone] = useState<string | null>(null);

  const scopedInstance = useMemo(() => {
    if (!selectedInstance) return null;
    return String(selectedInstance).trim().toLowerCase();
  }, [selectedInstance]);

  // Buscar phone da empresa para tabela dinâmica
  useEffect(() => {
    const fetchCompanyPhone = async () => {
      if (!profile?.company_id) {
        setCompanyPhone(null);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('companies')
          .select('phone') // Alterado de whatsapp_ai_phone para phone
          .eq('id', profile.company_id)
          .single();

        if (fetchError) throw fetchError;

        if (data && data.phone) {
          // Remover tudo que não for número
          const cleanPhone = data.phone.replace(/\D/g, '');
          setCompanyPhone(cleanPhone);
        } else {
          setCompanyPhone(null);
        }
      } catch (err) {
        console.error('Erro ao buscar phone da empresa:', err);
        setCompanyPhone(null);
      }
    };

    fetchCompanyPhone();
  }, [profile?.company_id]);

  useEffect(() => {
    fetchConversas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedInstance, isManager, (profile as any)?.chat_instance, companyPhone]);

  const fetchConversas = async () => {
    try {
      setLoading(true);
      setError(null);

      // 0) Verificar se temos o telefone da empresa
      if (!companyPhone) {
        setConversas([]);
        setLoading(false);
        return;
      }

      // 1) Escopo: se corretor, forçar instância do perfil
      let effectiveInstance = scopedInstance;
      if (!isManager) {
        const inst = (profile as any)?.chat_instance;
        effectiveInstance = inst ? String(inst).trim().toLowerCase() : null;
      }

      // Se temos companyPhone (tabela dinâmica), permitimos effectiveInstance ser null (busca tudo)
      // Se NÃO temos companyPhone (legacy), precisamos de instância
      if (!companyPhone && !effectiveInstance) {
        setConversas([]);
        setLoading(false);
        return;
      }

      // 2) Buscar mensagens da tabela dinâmica usando função RPC
      const { data: rows, error: fetchError } = await (supabase.rpc as any)('list_conversations_by_phone', {
        p_phone: companyPhone,
        p_instancia: effectiveInstance || null, // Passar null explicitamente se não tiver instância selecionada
      });

      if (fetchError) throw fetchError;

      // 3) Processar resultados (já vem agrupado pela função RPC - última mensagem por session_id)
      const list: Conversa[] = ((rows as any[]) || []).map((r: any) => {
        const sid = String(r.session_id);

        // preview/mídia
        const hasMedia = !!(r.media && String(r.media).trim() && String(r.media).toLowerCase() !== 'null');
        let parsedMessage: any = r.message;
        if (typeof parsedMessage === 'string') {
          try { parsedMessage = JSON.parse(parsedMessage); } catch { parsedMessage = { content: parsedMessage, type: 'human' }; }
        }
        // Extrair conteúdo limpo (remove prefixos como "[MENSAGEM DE TEXTO ENVIADA]: ()")
        const rawContent = String(parsedMessage?.content || '');
        const cleanContent = extractMessageContent(rawContent);
        // Quando houver mídia (imagem/áudio), exibir o content com ícone correspondente
        const isImageMedia = hasMedia && (String(r.media).startsWith('/9j/') || String(r.media).startsWith('iVBORw0'));
        const mediaPrefix = hasMedia ? (isImageMedia ? '🖼️ ' : '🎧 ') : '';
        const lastContent = `${mediaPrefix}${cleanContent}`;
        const lastType = (parsedMessage?.type === 'ai' ? 'ai' : 'human') as 'ai' | 'human';

        return {
          sessionId: sid,
          instancia: String(r.instancia || effectiveInstance),
          displayName: sid, // substituído abaixo por nome do lead se existir
          leadPhone: null,
          leadStage: null,
          lastMessageDate: String(r.data),
          messageCount: 1, // A função RPC retorna apenas a última mensagem, então count = 1
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

  // Polling a cada 2 segundos para atualização automática da lista
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  useEffect(() => {
    // Limpar polling anterior
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    
    // Iniciar polling se tiver telefone da empresa configurado
    if (companyPhone) {
      pollingRef.current = setInterval(() => {
        fetchConversas();
      }, 2000); // 2 segundos
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [companyPhone]); // Re-executar quando o telefone mudar

  return {
    conversas,
    loading,
    error,
    refetch: fetchConversas,
    updateConversation
  };
}
