import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { mensagemSessionId } from '@/lib/mensagensRow';

export interface RealtimeCallbacks {
  onInstanceUpdate: () => void;
  onConversationUpdate: (sessionId: string) => void;
  /** Se omitido, INSERT não é assinado aqui (use useMensagensNotifications no Premium). */
  onMessageUpdate?: (sessionId: string, message: Record<string, unknown>) => void;
  onMessageDelete?: (sessionId: string, messageId: unknown) => void;
}

const REALTIME_TABLE = 'mensagens';

function sessionFromRow(row: Record<string, unknown> | null | undefined): string | null {
  if (!row) return null;
  const sid = mensagemSessionId({
    phone: row.phone as string | null,
    contact_norm: row.contact_norm as string | null,
    plataforma: row.plataforma as string | null,
  });
  return sid || null;
}

export function useConversasRealtime(callbacks: RealtimeCallbacks) {
  const { profile } = useUserProfile();
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const listenInserts = Boolean(callbacks.onMessageUpdate);

  const rowMatchesCompany = useCallback((row: Record<string, unknown>, companyId: string) => {
    return String(row.company_id ?? '') === companyId;
  }, []);

  const passesInstanceScope = useCallback(
    (row: Record<string, unknown>) => {
      if (!profile || profile.role !== 'corretor') return true;
      const userInstance = profile.chat_instance?.toLowerCase().trim();
      const messageInstance = String(row.instancia ?? '').toLowerCase().trim();
      if (!userInstance || !messageInstance) return true;
      return userInstance === messageInstance;
    },
    [profile],
  );

  const processInsert = useCallback(
    (newMessage: Record<string, unknown>) => {
      if (!profile?.company_id) return;
      if (!rowMatchesCompany(newMessage, profile.company_id)) return;
      if (!passesInstanceScope(newMessage)) return;

      const sid = sessionFromRow(newMessage);
      if (!sid) return;

      const cb = callbacksRef.current;
      cb.onInstanceUpdate();
      cb.onConversationUpdate(sid);
      cb.onMessageUpdate?.(sid, newMessage);
    },
    [profile, rowMatchesCompany, passesInstanceScope],
  );

  const processDelete = useCallback(
    (oldMessage: Record<string, unknown>) => {
      if (!profile?.company_id) return;
      if (!rowMatchesCompany(oldMessage, profile.company_id)) return;
      if (!passesInstanceScope(oldMessage)) return;

      const sid = sessionFromRow(oldMessage);
      if (!sid) return;

      const cb = callbacksRef.current;
      cb.onInstanceUpdate();
      cb.onConversationUpdate(sid);
      cb.onMessageDelete?.(sid, oldMessage.id);
    },
    [profile, rowMatchesCompany, passesInstanceScope],
  );

  useEffect(() => {
    if (!profile?.company_id) return;

    const companyId = profile.company_id;
    const channel = supabase.channel(`mensagens_rt_${companyId}_${listenInserts ? 'full' : 'del'}`);

    if (listenInserts) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: REALTIME_TABLE },
        (payload) => {
          const row = payload.new as Record<string, unknown> | undefined;
          if (row) processInsert(row);
        },
      );
    }

    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: REALTIME_TABLE },
      (payload) => {
        const row = payload.old as Record<string, unknown> | undefined;
        if (row) processDelete(row);
      },
    );

    channel.subscribe();

    return () => {
      try {
        void channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {
        /* empty */
      }
    };
  }, [profile?.company_id, listenInserts, processInsert, processDelete]);
}
