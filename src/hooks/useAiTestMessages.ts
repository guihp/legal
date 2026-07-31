import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { SimulatorMessage } from '@/components/ai-test/helpers';
import {
  fetchAiTestMessages,
  mapAiTestRowToSimulatorMessage,
} from '@/lib/aiTestSimulator';

type UseAiTestMessagesParams = {
  companyId: string | null | undefined;
  sessionId: string;
};

function mergeMessages(prev: SimulatorMessage[], incoming: SimulatorMessage[]): SimulatorMessage[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const msg of incoming) {
    byId.set(msg.id, msg);
  }
  return [...byId.values()];
}

export function useAiTestMessages({ companyId, sessionId }: UseAiTestMessagesParams) {
  const [messages, setMessages] = useState<SimulatorMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const loadedKeyRef = useRef('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAssistantPoll = useCallback(() => {
    if (pollRef.current != null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const appendMessage = useCallback((message: SimulatorMessage) => {
    setMessages((prev) => mergeMessages(prev, [message]));
  }, []);

  const reload = useCallback(async () => {
    if (!companyId || !sessionId) {
      setMessages([]);
      setInitialLoading(false);
      return [];
    }

    try {
      const rows = await fetchAiTestMessages(companyId, sessionId);
      setMessages(rows);
      return rows;
    } catch (err) {
      console.error('[useAiTestMessages] load failed:', err);
      return [];
    } finally {
      setInitialLoading(false);
    }
  }, [companyId, sessionId]);

  /** Realtime pode falhar silenciosamente — polling garante resposta da IA na tela. */
  const startAssistantPoll = useCallback(() => {
    stopAssistantPoll();
    pollRef.current = setInterval(() => {
      void reload();
    }, 2000);
  }, [reload, stopAssistantPoll]);

  useEffect(() => {
    return () => stopAssistantPoll();
  }, [stopAssistantPoll]);

  useEffect(() => {
    const key = `${companyId || ''}:${sessionId || ''}`;
    if (!companyId || !sessionId) {
      setMessages([]);
      setInitialLoading(false);
      loadedKeyRef.current = '';
      return;
    }

    if (loadedKeyRef.current !== key) {
      loadedKeyRef.current = key;
      setInitialLoading(true);
      setMessages([]);
      void reload();
    }
  }, [companyId, sessionId, reload]);

  useEffect(() => {
    if (!companyId || !sessionId) return;

    const channel = supabase
      .channel(`ai-test-${companyId}-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_test_messages',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            company_id: string;
            session_id: string;
            role: 'user' | 'assistant';
            message_type: 'text' | 'image';
            content: string | null;
            media_url: string | null;
            created_at?: string;
          };

          if (row.company_id !== companyId) return;
          if (String(row.session_id) !== sessionId) return;

          const mapped = mapAiTestRowToSimulatorMessage({
            id: row.id,
            role: row.role,
            message_type: row.message_type,
            content: row.content,
            media_url: row.media_url,
            created_at: row.created_at || '',
          });

          setMessages((prev) => mergeMessages(prev, [mapped]));
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[useAiTestMessages] realtime channel error — usando polling');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [companyId, sessionId]);

  return {
    messages,
    setMessages,
    appendMessage,
    initialLoading,
    reload,
    startAssistantPoll,
    stopAssistantPoll,
  };
}
