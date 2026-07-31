import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';

export type NotificationType =
  | 'lead_stage_changed'
  | 'appointment'
  | 'connection_request'
  | 'connection_approved'
  | 'connection_rejected'
  | 'general';

export interface Notification {
  id: string;
  user_id: string;
  company_id: string;
  type: NotificationType;
  title: string;
  /** Prefer body; message kept for legacy callers */
  body: string;
  message: string;
  meta: Record<string, unknown>;
  data: Record<string, unknown>;
  read_at: string | null;
  is_read: boolean;
  created_at: string;
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

type DbNotification = {
  id: string;
  user_id: string;
  company_id: string;
  type: string;
  title: string;
  body: string;
  meta: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

function mapNotification(row: DbNotification): Notification {
  const body = row.body ?? '';
  const meta = (row.meta ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    user_id: row.user_id,
    company_id: row.company_id,
    type: row.type as NotificationType,
    title: row.title,
    body,
    message: body,
    meta,
    data: meta,
    read_at: row.read_at,
    is_read: row.read_at != null,
    created_at: row.created_at,
  };
}

export function useNotifications() {
  const { profile, isManager } = useUserProfile();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    try {
      if (!profile?.id) return;

      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const mapped = ((data || []) as DbNotification[]).map(mapNotification);
      setNotifications(mapped);
      setUnreadCount(mapped.filter((n) => !n.is_read).length);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const markAsRead = async (notificationId: string) => {
    try {
      const readAt = new Date().toISOString();
      const { error } = await supabase
        .from('user_notifications')
        .update({ read_at: readAt })
        .eq('id', notificationId)
        .is('read_at', null);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: readAt } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      if (!profile?.id) return;

      const readAt = new Date().toISOString();
      const { error } = await supabase
        .from('user_notifications')
        .update({ read_at: readAt })
        .eq('user_id', profile.id)
        .is('read_at', null);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at ?? readAt })),
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const createConnectionRequest = async (message?: string) => {
    try {
      if (!profile?.id || !profile?.company_id) {
        throw new Error('Perfil do usuário não encontrado');
      }

      const { data: existingRequest, error: checkError } = await supabase
        .from('connection_requests')
        .select('id, status')
        .eq('user_id', profile.id)
        .eq('status', 'pending')
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingRequest) {
        throw new Error('Você já possui uma solicitação pendente');
      }

      const { data: request, error: createError } = await supabase
        .from('connection_requests')
        .insert({
          user_id: profile.id,
          company_id: profile.company_id,
          message: message || `Solicitação de conexão WhatsApp de ${profile.full_name}`,
          status: 'pending',
        })
        .select()
        .single();

      if (createError) throw createError;

      const { data: managers, error: managersError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .eq('company_id', profile.company_id)
        .in('role', ['gestor', 'admin'])
        .eq('is_active', true);

      if (managersError) throw managersError;

      if (managers && managers.length > 0) {
        const notificationsToCreate = managers.map((manager) => ({
          user_id: manager.id,
          company_id: profile.company_id,
          type: 'connection_request' as const,
          title: 'Nova solicitação de conexão',
          body: `${profile.full_name} (${profile.role}) solicitou uma conexão WhatsApp`,
          meta: {
            request_id: request.id,
            requester_id: profile.id,
            requester_name: profile.full_name,
            requester_email: profile.email,
            requester_role: profile.role,
            route: '/connections',
          },
        }));

        const { error: notifyError } = await supabase
          .from('user_notifications')
          .insert(notificationsToCreate);

        if (notifyError) {
          console.error('Erro ao criar notificações:', notifyError);
        }
      }

      return request;
    } catch (error: unknown) {
      console.error('Erro ao criar solicitação:', error);
      throw error;
    }
  };

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

  const approveConnectionRequest = async (requestId: string) => {
    try {
      if (!isManager) throw new Error('Apenas gestores podem aprovar solicitações');

      const { data: request, error } = await supabase
        .from('connection_requests')
        .update({
          status: 'approved',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

      const { error: notifyError } = await supabase.from('user_notifications').insert({
        user_id: request.user_id,
        company_id: request.company_id,
        type: 'connection_approved',
        title: 'Solicitação aprovada',
        body: 'Sua solicitação de conexão WhatsApp foi aprovada! Um gestor irá criar sua instância em breve.',
        meta: {
          request_id: requestId,
          approved_by: profile?.id,
          approved_by_name: profile?.full_name,
          route: '/connections',
        },
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

  const rejectConnectionRequest = async (requestId: string, reason?: string) => {
    try {
      if (!isManager) throw new Error('Apenas gestores podem rejeitar solicitações');

      const { data: request, error } = await supabase
        .from('connection_requests')
        .update({
          status: 'rejected',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
          message: reason,
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

      const { error: notifyError } = await supabase.from('user_notifications').insert({
        user_id: request.user_id,
        company_id: request.company_id,
        type: 'connection_rejected',
        title: 'Solicitação rejeitada',
        body: `Sua solicitação de conexão WhatsApp foi rejeitada.${reason ? ` Motivo: ${reason}` : ''}`,
        meta: {
          request_id: requestId,
          rejected_by: profile?.id,
          rejected_by_name: profile?.full_name,
          reason,
          route: '/connections',
        },
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

  useEffect(() => {
    if (profile?.id) {
      loadNotifications();
    }
  }, [profile?.id, loadNotifications]);

  // Poll on focus / interval as fallback to realtime
  useEffect(() => {
    if (!profile?.id) return;

    const onFocus = () => {
      void loadNotifications();
    };
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 60_000);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [profile?.id, loadNotifications]);

  useEffect(() => {
    if (!profile?.id) return;

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(`user-notifications-${profile.id}-${uniqueSuffix}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const mapped = mapNotification(payload.new as DbNotification);
          setNotifications((prev) => [mapped, ...prev]);
          setUnreadCount((prev) => prev + 1);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const mapped = mapNotification(payload.new as DbNotification);
          setNotifications((prev) => {
            const next = prev.map((n) => (n.id === mapped.id ? mapped : n));
            setUnreadCount(next.filter((n) => !n.is_read).length);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const sendTestNotification = async (message?: string) => {
    if (!profile?.id || !profile?.company_id) throw new Error('Perfil não disponível');
    const { data, error } = await supabase
      .from('user_notifications')
      .insert({
        user_id: profile.id,
        company_id: profile.company_id,
        type: 'general',
        title: 'Teste Realtime',
        body: message || `Ping de teste às ${new Date().toLocaleString('pt-BR')}`,
        meta: { test: true },
      })
      .select()
      .single();
    if (error) throw error;
    return mapNotification(data as DbNotification);
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
    sendTestNotification,
  };
}
