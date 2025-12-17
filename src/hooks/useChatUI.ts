import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';

export interface ChatLead {
  chat_id: string;
  contact_phone: string;
  contact_name: string;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
  corretor_id: string;
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  corretor_nome: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  content: string;
  from_me: boolean;
  timestamp: string;
  message_type: string;
  contact_phone: string;
  lead_id: string;
  lead_name: string;
}

export interface CorretorInfo {
  corretor_id: string;
  corretor_nome: string;
  total_conversas: number;
  ultima_atividade: string | null;
}

/**
 * Hook de estado puramente de UI para o módulo de chat.
 * Não faz chamadas a APIs/banco. Serve como camada de apresentação enquanto a
 * nova camada de dados/serviços é reimplementada do zero.
 */
export function useChatUI() {
  const { profile } = useUserProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de UI para listas (preenchidos futuramente pela nova camada de dados)
  const [corretores, setCorretores] = useState<CorretorInfo[]>([]);
  const [selectedCorretor, setSelectedCorretor] = useState<string | null>(null);
  const [corretoresLoading, setCorretoresLoading] = useState(false);

  const [conversas, setConversas] = useState<ChatLead[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [conversasLoading, setConversasLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Ações simuladas de UI (sem I/O). A integração real virá via serviços.
  const loadCorretores = useCallback(async () => {
    setCorretoresLoading(true);
    setError(null);
    try {
      // Ler da view normalizada, com escopo por role
      let query = supabase
        .from('vw_imobipro_instances')
        .select('*')
        .order('instancia_label', { ascending: true });

      // Se o usuário é corretor, filtrar pela instância atribuída ao seu perfil
      if (profile?.role === 'corretor' && profile.chat_instance) {
        query = query.eq('instancia_key', String(profile.chat_instance).trim().toLowerCase());
      }

      const { data, error } = await query;

      if (error) throw error;

      const corretoresList: CorretorInfo[] = (data || []).map((row: any) => ({
        corretor_id: String(row.instancia_key),
        corretor_nome: String(row.instancia_label),
        total_conversas: Number(row.total_conversas || 0),
        ultima_atividade: null,
      }));

      setCorretores(corretoresList);
      return corretoresList;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar instâncias');
      setCorretores([]);
      return [] as CorretorInfo[];
    } finally {
      setCorretoresLoading(false);
      setLoading(false);
    }
  }, []);

  const loadConversas = useCallback(async (_corretorId?: string) => {
    setConversasLoading(true);
    setError(null);
    try {
      // Se corretor: instância forçada pelo perfil
      const forcedInst = profile?.role === 'corretor' ? String(profile.chat_instance || '').trim() : '';
      const instancia = (forcedInst || _corretorId || selectedCorretor || '').trim();
      if (!instancia) {
        setConversas([]);
        return [] as ChatLead[];
      }

      // Ler da view normalizada (última mensagem por session)
      const { data, error } = await supabase
        .from('vw_imobipro_conversas')
        .select('*')
        .eq('instancia_key', instancia.toLowerCase())
        .order('last_data', { ascending: false, nullsLast: true });

      if (error) throw error;

      // Pegar a última mensagem por session_id na ordem
      const seen = new Set<string>();
      const conversasList: ChatLead[] = [];

      (data || []).forEach(row => {
        const sessionId = String((row as any).session_id || '').trim();
        if (!sessionId || seen.has(sessionId)) return;
        seen.add(sessionId);

        const msg = (row as any).last_message || {};
        const content: string = String(msg?.content || '').trim();
        const when: string = (row as any).last_data || null;

        conversasList.push({
          chat_id: sessionId,
          contact_phone: '',
          contact_name: sessionId,
          last_message: content || null,
          last_message_time: when,
          unread_count: 0,
          corretor_id: instancia,
          lead_id: sessionId,
          lead_name: sessionId,
          lead_phone: '',
          corretor_nome: instancia,
        });
      });

      setConversas(conversasList);
      // Se ainda não há chat selecionado e há conversas, selecionar a mais recente
      if (!selectedChat && conversasList.length > 0) {
        setSelectedChat(conversasList[0].chat_id);
      }
      return conversasList;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar conversas');
      setConversas([]);
      return [] as ChatLead[];
    } finally {
      setConversasLoading(false);
    }
  }, [selectedCorretor]);

  const loadMessages = useCallback(async (_chatId: string) => {
    setMessagesLoading(true);
    setError(null);
    try {
      if (!_chatId) {
        setMessages([]);
        return [] as ChatMessage[];
      }

      const { data, error } = await supabase
        .from('vw_imobipro_messages')
        .select('session_id, data, message')
        .eq('session_id', _chatId)
        .order('data', { ascending: true, nullsLast: true });

      if (error) throw error;

      const msgs: ChatMessage[] = (data || []).map(row => {
        const msg = (row as any).message || {};
        const content: string = String(msg?.content || '').trim();
        const type: string = String(msg?.type || '').trim();
        const when: string = (row as any).data || null;
        const fromMe = type === 'ai'; // human -> usuário (esquerda), ai -> corretor/robô (direita)

        return {
          id: `${_chatId}-${when}`,
          chat_id: _chatId,
          content: content,
          from_me: fromMe,
          timestamp: when,
          message_type: type || 'text',
          contact_phone: '',
          lead_id: _chatId,
          lead_name: _chatId,
        } as ChatMessage;
      });

      setMessages(msgs);
      return msgs;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar mensagens');
      setMessages([]);
      return [] as ChatMessage[];
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (chatId: string, content: string) => {
    if (!chatId || !content.trim()) return false;
    // Apenas atualiza a UI local; integração real será plugada depois
    const newMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      chat_id: chatId,
      content: content.trim(),
      from_me: true,
      timestamp: new Date().toISOString(),
      message_type: 'text',
      contact_phone: '',
      lead_id: '',
      lead_name: ''
    };
    setMessages(prev => [...prev, newMessage]);

    // Atualiza resumo da conversa para feedback visual
    setConversas(prev => prev.map(c =>
      c.chat_id === chatId
        ? { ...c, last_message: newMessage.content, last_message_time: newMessage.timestamp }
        : c
    ));

    return true;
  }, []);

  const refreshData = useCallback(() => {
    // No-op: reservado para futura integração
  }, []);

  return {
    // Flags
    loading,
    error,
    messagesLoading,
    corretoresLoading,
    conversasLoading,

    // Dados
    corretores,
    selectedCorretor,
    setSelectedCorretor,
    conversas,
    selectedChat,
    setSelectedChat,
    messages,

    // Ações
    loadCorretores,
    loadConversas,
    loadMessages,
    sendMessage,
    refreshData,

    // Setters expostos para futura hidratação externa
    setCorretores,
    setConversas,
    setMessages,
    setLoading,
    setError,
  };
}


