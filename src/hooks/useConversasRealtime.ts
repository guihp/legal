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
    // Buscar telefone da empresa para saber qual tabela escutar
    const setupSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('phone')
          .eq('id', profile.company_id)
          .single();

        if (error || !data?.phone) {
          console.error('Erro ao buscar telefone para realtime:', error);
          return;
        }

        const cleanPhone = data.phone.replace(/\D/g, '');
        const tableName = `imobipro_messages_${cleanPhone}`;
        console.log(`[Realtime] Escutando tabela dinâmica: ${tableName}`);

        const subscription = supabase
          .channel(`${tableName}_changes`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: tableName },
            handleNewMessage
          )
          .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: tableName },
            handleDeleteMessage
          )
          .subscribe();

        return subscription;
      } catch (err) {
        console.error('Erro setupSubscription:', err);
      }
    };

    let subscription: any = null;
    setupSubscription().then(sub => { subscription = sub; });

    return () => {
      if (subscription) {
        console.log('[Realtime] Desinscrevendo...');
        subscription.unsubscribe();
        supabase.removeChannel(subscription);
      }
    };
  }, [profile, handleNewMessage, handleDeleteMessage]);
}
