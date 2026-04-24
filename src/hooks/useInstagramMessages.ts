import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useUserProfile } from './useUserProfile';
import { extractMessageContent, extractMediaImages, type ConversaMessage } from './useConversaMessages';
import { instagramLegacyMessagesTableName } from '@/lib/companyInstagramTable';

/**
 * Mensagens da conversa Instagram ativa (`activeSessionId`).
 * Polling e realtime não alternam `loading` (evita piscar). Troca de sessão limpa canal e intervalo.
 */
export function useInstagramMessages(
  companyInstagramId?: string | null,
  activeSessionId?: string | null
) {
  const [messages, setMessages] = useState<ConversaMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useUserProfile();

  /** Evita aplicar resposta de fetch após o usuário já ter trocado de conversa. */
  const latestSessionRef = useRef<string | null>(null);
  latestSessionRef.current = activeSessionId?.trim() ?? null;

  const rtChannelRef = useRef<RealtimeChannel | null>(null);
  const rtDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mapRows = useCallback((data: any[]): ConversaMessage[] => {
    return (data || []).map((row: any) => {
      let parsedMessage: any;
      if (typeof row.message === 'string') {
        try { parsedMessage = JSON.parse(row.message); } catch { parsedMessage = { type: 'human', content: row.message }; }
      } else {
        parsedMessage = row.message;
      }
      const rawContent = parsedMessage?.content || '';
      const cleanContent = extractMessageContent(rawContent);
      const mediaImages = extractMediaImages(row.media);

      return {
        id: String(row.id),
        sessionId: row.session_id,
        instancia: row.instancia || '(sem instância)',
        message: {
          type: parsedMessage?.type || 'human',
          content: cleanContent,
          additional_kwargs: parsedMessage?.additional_kwargs,
          response_metadata: parsedMessage?.response_metadata,
          tool_calls: parsedMessage?.tool_calls,
          invalid_tool_calls: parsedMessage?.invalid_tool_calls,
        },
        data: row.data,
        media: row.media ?? null,
        mediaImages,
        before_handoff: Boolean(row.before_handoff),
        handoff_ts: row.handoff_ts != null ? String(row.handoff_ts) : null,
      } as ConversaMessage;
    });
  }, []);

  const fetchConversation = useCallback(
    async (sessionId: string, opts?: { background?: boolean }) => {
      if (!profile?.company_id) return;
      const background = opts?.background === true;
      try {
        if (!background) setLoading(true);
        setError(null);

        const useLegacy = Boolean(companyInstagramId?.trim());
        const { data, error: rpcErr } = useLegacy
          ? await (supabase.rpc as any)('conversation_for_session_instagram_legacy', {
              p_company_id: profile.company_id,
              p_session_id: sessionId,
              p_limit: 500,
              p_offset: 0,
            })
          : await (supabase.rpc as any)('instagram_conversation_for_session', {
              p_company_id: profile.company_id,
              p_session_id: sessionId,
              p_limit: 500,
              p_offset: 0,
            });

        if (rpcErr) throw rpcErr;

        if (latestSessionRef.current !== sessionId) return;
        setMessages(mapRows(data ?? []));
      } catch (e: any) {
        console.error('[useInstagramMessages] erro:', e);
        setError(e?.message ?? 'Erro ao carregar conversa');
      } finally {
        if (!background) setLoading(false);
      }
    },
    [mapRows, profile?.company_id, companyInstagramId]
  );

  const detachRealtime = useCallback(() => {
    if (rtDebounceRef.current) {
      clearTimeout(rtDebounceRef.current);
      rtDebounceRef.current = null;
    }
    try {
      const ch = rtChannelRef.current;
      rtChannelRef.current = null;
      if (ch) {
        (ch as any).unsubscribe?.();
        (supabase as any).removeChannel?.(ch);
      }
    } catch { /* empty */ }
  }, []);

  useEffect(() => {
    detachRealtime();

    const sid = activeSessionId?.trim();
    if (!sid || !profile?.company_id) {
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }

    let poll: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    void (async () => {
      await fetchConversation(sid, { background: false });
    })();

    const legacyTable = instagramLegacyMessagesTableName(companyInstagramId);
    const table = legacyTable || 'crm_instagram_messages';

    const channel = supabase
      .channel(`crm_ig_msgs_${sid}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `session_id=eq.${sid}`,
        } as any,
        () => {
          if (rtDebounceRef.current) clearTimeout(rtDebounceRef.current);
          rtDebounceRef.current = setTimeout(() => {
            rtDebounceRef.current = null;
            if (!cancelled) void fetchConversation(sid, { background: true });
          }, 350);
        }
      )
      .subscribe();

    rtChannelRef.current = channel as unknown as RealtimeChannel;

    poll = setInterval(() => {
      if (!cancelled) void fetchConversation(sid, { background: true });
    }, 3000);

    return () => {
      cancelled = true;
      if (poll) {
        clearInterval(poll);
        poll = null;
      }
      if (rtDebounceRef.current) {
        clearTimeout(rtDebounceRef.current);
        rtDebounceRef.current = null;
      }
      try {
        (channel as any).unsubscribe?.();
        (supabase as any).removeChannel?.(channel);
      } catch { /* empty */ }
      if (rtChannelRef.current === (channel as unknown as RealtimeChannel)) {
        rtChannelRef.current = null;
      }
    };
  }, [activeSessionId, profile?.company_id, companyInstagramId, fetchConversation, detachRealtime]);

  const refetch = useCallback(() => {
    const sid = activeSessionId?.trim();
    if (sid) void fetchConversation(sid, { background: true });
  }, [fetchConversation, activeSessionId]);

  return { messages, loading, error, refetch };
}
