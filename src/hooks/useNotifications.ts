import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';

export interface Notification {
  id: string;
  user_id: string;
  company_id: string;
  type: 'connection_request' | 'connection_approved' | 'connection_rejected' | 'general';
  title: string;
  message: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectionRequest {
  id: string;
  user_id: string;
  company_id: string;
  status: 'pending' | 'approved' | 'rejected';
  message?: string;
  created_at: string;
  updated_at: string;
  approved_by?: string;
  approved_at?: string;
  user_profile?: {
    full_name: string;
    email: string;
    role: string;
  };
}

export function useNotifications() {
  const { profile, isManager } = useUserProfile();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Carregar notificações do usuário atual
  const loadNotifications = async () => {
    try {
      if (!profile?.id) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  // Marcar notificação como lida
  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  // Marcar todas como lidas
  const markAllAsRead = async () => {
    try {
      if (!profile?.id) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  // Criar solicitação de conexão
  const createConnectionRequest = async (message?: string) => {
    try {
      if (!profile?.id || !profile?.company_id) {
        throw new Error('Perfil do usuário não encontrado');
      }

      console.log('🔄 Criando solicitação de conexão...');

      // 1. Verificar se já existe uma solicitação pendente
      const { data: existingRequest, error: checkError } = await supabase
        .from('connection_requests')
        .select('id, status')
        .eq('user_id', profile.id)
        .eq('status', 'pending')
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
        throw checkError;
      }

      if (existingRequest) {
        throw new Error('Você já possui uma solicitação pendente');
      }

      // 2. Criar a solicitação
      const { data: request, error: createError } = await supabase
        .from('connection_requests')
        .insert({
          user_id: profile.id,
          company_id: profile.company_id,
          message: message || `Solicitação de conexão WhatsApp de ${profile.full_name}`,
          status: 'pending'
        })
        .select()
        .single();

      if (createError) throw createError;

      console.log('✅ Solicitação criada:', request);

      // 3. Buscar todos os gestores da empresa para notificar
      const { data: managers, error: managersError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .eq('company_id', profile.company_id)
        .in('role', ['gestor', 'admin'])
        .eq('is_active', true);

      if (managersError) throw managersError;

      console.log('👥 Gestores encontrados para notificar:', managers?.length);

      // 4. Criar notificações para cada gestor
      if (managers && managers.length > 0) {
        const notificationsToCreate = managers.map(manager => ({
          user_id: manager.id,
          company_id: profile.company_id,
          type: 'connection_request' as const,
          title: 'Nova Solicitação de Conexão',
          message: `${profile.full_name} (${profile.role}) solicitou uma conexão WhatsApp`,
          data: {
            request_id: request.id,
            requester_id: profile.id,
            requester_name: profile.full_name,
            requester_email: profile.email,
            requester_role: profile.role
          }
        }));

        const { error: notifyError } = await supabase
          .from('notifications')
          .insert(notificationsToCreate);

        if (notifyError) {
          console.error('Erro ao criar notificações:', notifyError);
          // Não falhar a operação, apenas logar o erro
        } else {
          console.log('📬 Notificações criadas para gestores');
        }
      }

      return request;
    } catch (error: any) {
      console.error('❌ Erro ao criar solicitação:', error);
      throw error;
    }
  };

  // Buscar solicitações pendentes (para gestores)
  const loadConnectionRequests = async (): Promise<ConnectionRequest[]> => {
    try {
      if (!isManager || !profile?.company_id) {
        return [];
      }

      const { data, error } = await supabase
        .from('connection_requests')
        .select(`
          *,
          user_profile:user_profiles(full_name, email, role)
        `)
        .eq('company_id', profile.company_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao carregar solicitações:', error);
      return [];
    }
  };

  // Aprovar solicitação de conexão (para gestores)
  const approveConnectionRequest = async (requestId: string) => {
    try {
      if (!isManager) throw new Error('Apenas gestores podem aprovar solicitações');

      const { data: request, error } = await supabase
        .from('connection_requests')
        .update({
          status: 'approved',
          approved_by: profile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

      // Criar notificação para o solicitante
      const { error: notifyError } = await supabase
        .from('notifications')
        .insert({
          user_id: request.user_id,
          company_id: request.company_id,
          type: 'connection_approved',
          title: 'Solicitação Aprovada',
          message: 'Sua solicitação de conexão WhatsApp foi aprovada! Um gestor irá criar sua instância em breve.',
          data: {
            request_id: requestId,
            approved_by: profile?.id,
            approved_by_name: profile?.full_name
          }
        });

      if (notifyError) {
        console.error('Erro ao notificar aprovação:', notifyError);
      }

      return request;
    } catch (error) {
      console.error('Erro ao aprovar solicitação:', error);
      throw error;
    }
  };

  // Rejeitar solicitação de conexão (para gestores)
  const rejectConnectionRequest = async (requestId: string, reason?: string) => {
    try {
      if (!isManager) throw new Error('Apenas gestores podem rejeitar solicitações');

      const { data: request, error } = await supabase
        .from('connection_requests')
        .update({
          status: 'rejected',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
          message: reason
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

      // Criar notificação para o solicitante
      const { error: notifyError } = await supabase
        .from('notifications')
        .insert({
          user_id: request.user_id,
          company_id: request.company_id,
          type: 'connection_rejected',
          title: 'Solicitação Rejeitada',
          message: `Sua solicitação de conexão WhatsApp foi rejeitada. ${reason ? `Motivo: ${reason}` : ''}`,
          data: {
            request_id: requestId,
            rejected_by: profile?.id,
            rejected_by_name: profile?.full_name,
            reason
          }
        });

      if (notifyError) {
        console.error('Erro ao notificar rejeição:', notifyError);
      }

      return request;
    } catch (error) {
      console.error('Erro ao rejeitar solicitação:', error);
      throw error;
    }
  };

  // Carregar notificações quando o perfil estiver disponível
  useEffect(() => {
    if (profile?.id) {
      loadNotifications();
    }
  }, [profile?.id]);

  // Escutar mudanças em tempo real nas notificações
  useEffect(() => {
    if (!profile?.id) return;

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(`notifications-changes-${profile.id}-${uniqueSuffix}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
        },
        (payload) => {
          console.log('📬 Nova notificação recebida:', payload.new);
          setNotifications(prev => [payload.new as Notification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
        },
        (payload) => {
          setNotifications(prev =>
            prev.map(n => n.id === payload.new.id ? payload.new as Notification : n)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // Enviar uma notificação de teste para o usuário atual (debug Realtime)
  const sendTestNotification = async (message?: string) => {
    if (!profile?.id || !profile?.company_id) throw new Error('Perfil não disponível');
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: profile.id,
        company_id: profile.company_id,
        type: 'general',
        title: 'Teste Realtime',
        message: message || `Ping de teste às ${new Date().toLocaleString('pt-BR')}`,
        data: { test: true }
      })
      .select()
      .single();
    if (error) throw error;
    return data as Notification;
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    createConnectionRequest,
    loadConnectionRequests,
    approveConnectionRequest,
    rejectConnectionRequest,
    refreshNotifications: loadNotifications,
    sendTestNotification
  };
}