import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';

interface RealtimeCallbacks {
  onInstanceUpdate: () => void;
  onConversationUpdate: (sessionId: string) => void;
  onMessageUpdate: (sessionId: string, message: any) => void;
  onMessageDelete?: (sessionId: string, messageId: any) => void;
}

export function useConversasRealtime(callbacks: RealtimeCallbacks) {
  const { profile } = useUserProfile();

  const handleNewMessage = useCallback((payload: any) => {
    const newMessage = payload.new;
    
    if (!newMessage || !profile) return;

    // Aplicar filtro por role
    if (profile.role === 'corretor') {
      const userInstance = profile.chat_instance?.toLowerCase().trim();
      const messageInstance = newMessage.instancia?.toLowerCase().trim();
      
      if (userInstance !== messageInstance) {
        return; // Ignorar mensagem que não é da instância do corretor
      }
    }

    // Notificar callbacks
    callbacks.onInstanceUpdate(); // atualizar contadores
    callbacks.onConversationUpdate(newMessage.session_id); // mover conversa ao topo
    callbacks.onMessageUpdate(newMessage.session_id, newMessage); // inserir mensagem
  }, [profile, callbacks]);

  const handleDeleteMessage = useCallback((payload: any) => {
    const oldMessage = payload.old;
    if (!oldMessage || !profile) return;

    if (profile.role === 'corretor') {
      const userInstance = profile.chat_instance?.toLowerCase().trim();
      const messageInstance = oldMessage.instancia?.toLowerCase().trim();
      if (userInstance !== messageInstance) {
        return;
      }
    }

    callbacks.onInstanceUpdate();
    callbacks.onConversationUpdate(oldMessage.session_id);
    callbacks.onMessageDelete?.(oldMessage.session_id, oldMessage.id);
  }, [profile, callbacks]);

  useEffect(() => {
    if (!profile) return;

    // Subscrever inserções na tabela imobipro_messages
    const subscription = supabase
      .channel('imobipro_messages_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'imobipro_messages' },
        handleNewMessage
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'imobipro_messages' },
        handleDeleteMessage
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile, handleNewMessage, handleDeleteMessage]);
}
