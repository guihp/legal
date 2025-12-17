import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { sendWhatsAppMessage, sendWhatsAppMessageMock, WEBHOOK_DEVELOPMENT_CONFIG } from '@/services/whatsappWebhook';

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

export function useChatsData() {
  const { profile } = useUserProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para corretores (gestores)
  const [corretores, setCorretores] = useState<CorretorInfo[]>([]);
  const [selectedCorretor, setSelectedCorretor] = useState<string | null>(null);
  
  // Estados para conversas
  const [conversas, setConversas] = useState<ChatLead[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  
  // Estados para mensagens
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Carregar corretores com conversas (apenas para gestores/admins)
  const loadCorretores = useCallback(async () => {
    console.log('🔍 loadCorretores chamado. Profile:', profile);
    if (!profile || profile.role === 'corretor') return;
    
    try {
      console.log('📞 Chamando get_corretores_conversas_dev...');
      const { data, error } = await supabase.rpc('get_corretores_conversas_dev');
      
      if (error) throw error;
      
      console.log('✅ Corretores carregados:', data?.length || 0);
      setCorretores(data || []);
    } catch (err) {
      console.error('❌ Erro ao carregar corretores:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar corretores');
    }
  }, [profile]);

  // Carregar conversas do corretor
  const loadConversas = useCallback(async (corretorId?: string) => {
    console.log('💬 loadConversas chamado. Profile:', profile, 'corretorId:', corretorId);
    if (!profile) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('📞 Buscando conversas na view vw_chat_conversas_dev...');
      let query = supabase.from('vw_chat_conversas_dev').select('*');
      
      // Se é corretor, filtrar apenas suas conversas
      if (profile.role === 'corretor') {
        query = query.eq('corretor_id', profile.id);
      } 
      // Se é gestor/admin e tem corretor selecionado
      else if (corretorId) {
        query = query.eq('corretor_id', corretorId);
      }
      
      const { data, error } = await query.order('last_message_time', { ascending: false, nullsLast: true });
      
      if (error) throw error;
      
      console.log('✅ Conversas carregadas:', data?.length || 0);
      setConversas(data || []);
    } catch (err) {
      console.error('❌ Erro ao carregar conversas:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar conversas');
      setConversas([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // Carregar mensagens de uma conversa específica
  const loadMessages = useCallback(async (chatId: string) => {
    if (!chatId) return;
    
    try {
      setMessagesLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('vw_chat_messages_dev')
        .select('*')
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: true });
      
      if (error) throw error;
      
      setMessages(data || []);
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar mensagens');
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Enviar mensagem (webhook)
  const sendMessage = useCallback(async (chatId: string, content: string) => {
    if (!profile || !chatId || !content.trim()) return false;
    
    try {
      setError(null);
      
      // Buscar dados do chat para validação
      const chat = conversas.find(c => c.chat_id === chatId);
      if (!chat) {
        throw new Error('Conversa não encontrada');
      }
      
      // Validar permissões: apenas corretor responsável pode enviar
      if (profile.role === 'corretor' && chat.corretor_id !== profile.id) {
        throw new Error('Você só pode enviar mensagens para seus próprios leads');
      }
      
      // Gestores/admins não podem enviar mensagens como se fossem corretores
      if (profile.role !== 'corretor') {
        throw new Error('Apenas o corretor responsável pode enviar mensagens');
      }
      
      // Preparar payload para webhook
      const webhookPayload = {
        chat_id: chatId,
        lead_id: chat.lead_id,
        lead_name: chat.lead_name,
        lead_phone: chat.lead_phone,
        corretor_id: chat.corretor_id,
        corretor_nome: chat.corretor_nome,
        message: content.trim(),
        timestamp: new Date().toISOString(),
        from_corretor: true
      };
      
      // Enviar via webhook (usar mock se não houver URL configurada)
      const isDevelopment = !import.meta.env.VITE_EVOLUTION_API_URL;
      const webhookResult = isDevelopment 
        ? await sendWhatsAppMessageMock(webhookPayload)
        : await sendWhatsAppMessage(webhookPayload);
      
      if (!webhookResult.success) {
        throw new Error(webhookResult.error || 'Falha ao enviar mensagem via webhook');
      }
      // Adicionar mensagem localmente para feedback imediato
      const newMessage: ChatMessage = {
        id: webhookResult.message_id || `temp-${Date.now()}`,
        chat_id: chatId,
        content: content.trim(),
        from_me: true,
        timestamp: new Date().toISOString(),
        message_type: 'text',
        contact_phone: chat.contact_phone,
        lead_id: chat.lead_id,
        lead_name: chat.lead_name
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      // Atualizar última mensagem na conversa
      setConversas(prev => prev.map(c => 
        c.chat_id === chatId 
          ? { ...c, last_message: content.trim(), last_message_time: new Date().toISOString() }
          : c
      ));
      
      return true;
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem');
      return false;
    }
  }, [profile, conversas]);

  // Efeito para carregar dados iniciais
  useEffect(() => {
    console.log('🚀 useEffect inicial. Profile:', profile);
    if (!profile) {
      console.log('⏳ Aguardando profile...');
      return;
    }
    
    if (profile.role === 'corretor') {
      console.log('👤 Usuário é corretor - carregando conversas');
      // Corretor: carregar apenas suas conversas
      loadConversas();
    } else {
      console.log('👑 Usuário é gestor/admin - carregando corretores');
      // Gestor/admin: carregar lista de corretores
      loadCorretores();
    }
  }, [profile, loadConversas, loadCorretores]);

  // Efeito para carregar conversas quando corretor é selecionado
  useEffect(() => {
    if (profile?.role !== 'corretor' && selectedCorretor) {
      loadConversas(selectedCorretor);
    }
  }, [selectedCorretor, profile, loadConversas]);

  // Efeito para carregar mensagens quando chat é selecionado
  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat);
    } else {
      setMessages([]);
    }
  }, [selectedChat, loadMessages]);

  return {
    // Estados
    loading,
    error,
    messagesLoading,
    
    // Dados para gestores
    corretores,
    selectedCorretor,
    setSelectedCorretor,
    
    // Dados de conversas
    conversas,
    selectedChat,
    setSelectedChat,
    
    // Dados de mensagens
    messages,
    
    // Ações
    loadConversas,
    loadMessages,
    sendMessage,
    refreshData: () => {
      if (profile?.role === 'corretor') {
        loadConversas();
      } else {
        loadCorretores();
        if (selectedCorretor) {
          loadConversas(selectedCorretor);
        }
      }
    }
  };
}