import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { extractMessageContent } from './useConversaMessages';

/** Rótulo quando não há nome (evita texto genérico longo; RPC já envia nome para corretor quando permitido). */
function conversaFallbackLabel(sessionId: string): string {
  const id = String(sessionId || '').trim();
  if (id.length >= 8) return `Cliente · ${id.slice(0, 8)}…`;
  return 'Cliente';
}

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
        // IMPORTANTE: usar `whatsapp_ai_phone` (e não `phone`) — esse é o número
        // que nomeia a tabela dinâmica `crm_whatsapp_messages_{phone}` onde o
        // n8n grava as mensagens. `companies.phone` é apenas o telefone comercial
        // (endereço/contato) e NÃO tem relação com as tabelas de mensagens.
        // Se trocar, a RPC `list_conversations_by_phone` não acha a tabela e
        // a lista aparece vazia pra todos os perfis.
        const { data, error: fetchError } = await supabase
          .from('companies')
          .select('whatsapp_ai_phone')
          .eq('id', profile.company_id)
          .single();

        if (fetchError) throw fetchError;

        const raw = (data as any)?.whatsapp_ai_phone;
        if (raw) {
          // Remover tudo que não for número
          const cleanPhone = String(raw).replace(/\D/g, '');
          setCompanyPhone(cleanPhone || null);
        } else {
          setCompanyPhone(null);
        }
      } catch (err) {
        console.error('Erro ao buscar whatsapp_ai_phone da empresa:', err);
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

        const fromRpc = String((r as any).lead_display_name ?? '').trim();

        return {
          sessionId: sid,
          instancia: String(r.instancia || effectiveInstance),
          displayName: fromRpc,
          leadPhone: null,
          leadStage: null,
          lastMessageDate: String(r.data),
          messageCount: 1, // A função RPC retorna apenas a última mensagem, então count = 1
          lastMessageContent: lastContent,
          lastMessageType: lastType,
        };
      });

      // 4) Complementar com leads visíveis ao usuário (RLS); RPC já preenche lead_display_name para corretor
      if (list.length > 0) {
        const sids = list.map(l => l.sessionId);
        const { data: leadRows } = await supabase
          .from('leads')
          .select('id, name, phone')
          .in('id', sids as any);
        const leadMap = new Map<string, string>();
        (leadRows || []).forEach((lr: any) => {
          if (!lr?.id) return;
          const id = String(lr.id);
          const nm = lr.name != null ? String(lr.name).trim() : '';
          const ph = lr.phone != null ? String(lr.phone).trim() : '';
          const label = nm || ph;
          if (label) leadMap.set(id, label);
        });

        list.forEach(item => {
          const nm = leadMap.get(item.sessionId);
          if (nm) item.displayName = nm;
          else if (!item.displayName) item.displayName = conversaFallbackLabel(item.sessionId);
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
