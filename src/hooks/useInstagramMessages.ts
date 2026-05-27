import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useUserProfile } from './useUserProfile';
import { type ConversaMessage } from './useConversaMessages';
import { mapMensagemRow, PLATAFORMA_INSTAGRAM } from '@/lib/mensagensRow';

const REALTIME_TABLE = 'mensagens';

/**
 * Thread Instagram via `public.mensagens` (plataforma Instagram).
 * `activeSessionId` = `contact_norm` (instagram_id_cliente em minúsculas).
 */
export function useInstagramMessages(
  _companyInstagramId?: string | null,
  activeSessionId?: string | null,
) {
  const [messages, setMessages] = useState<ConversaMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useUserProfile();

  const latestSessionRef = useRef<string | null>(null);
  latestSessionRef.current = activeSessionId?.trim().toLowerCase() ?? null;

  const rtChannelRef = useRef<RealtimeChannel | null>(null);
  const rtDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dedupeRows = useCallback((rows: ConversaMessage[]): ConversaMessage[] => {
    const seen = new Set<string>();
    const out: ConversaMessage[] = [];
    for (const r of rows) {
      const key = `${r.message?.type ?? ''}|${r.message?.content ?? ''}|${String(r.data ?? '')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  }, []);

  const fetchConversation = useCallback(
    async (sessionId: string, opts?: { background?: boolean }) => {
      if (!profile?.company_id) return;
      const background = opts?.background === true;
      const sid = sessionId.trim().toLowerCase();
      if (!sid) return;

      try {
        if (!background) setLoading(true);
        setError(null);

        const { data, error: rpcErr } = await (supabase.rpc as any)('mensagens_thread', {
          p_company_id: profile.company_id,
          p_phone: sid,
          p_plataforma: PLATAFORMA_INSTAGRAM,
          p_limit: 500,
          p_offset: 0,
        });

        if (rpcErr) throw rpcErr;

        if (latestSessionRef.current !== sid) return;

        const mapped = (data ?? []).map((row: Record<string, unknown>) =>
          mapMensagemRow({
            ...(row as object),
            plataforma: PLATAFORMA_INSTAGRAM,
            created_at: String(row.created_at ?? ''),
          } as Parameters<typeof mapMensagemRow>[0]),
        );

        setMessages(dedupeRows(mapped));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro ao carregar conversa';
        console.error('[useInstagramMessages]', msg);
        setError(msg);
      } finally {
        if (!background) setLoading(false);
      }
    },
    [dedupeRows, profile?.company_id],
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
        (ch as { unsubscribe?: () => void }).unsubscribe?.();
        (supabase as { removeChannel?: (c: RealtimeChannel) => void }).removeChannel?.(ch);
      }
    } catch {
      /* empty */
    }
  }, []);

  useEffect(() => {
    detachRealtime();

    const sid = activeSessionId?.trim().toLowerCase();
    if (!sid || !profile?.company_id) {
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }

    let poll: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    void fetchConversation(sid, { background: false });

    const companyId = profile.company_id;
    const channel = supabase
      .channel(`mensagens_ig_${sid}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: REALTIME_TABLE,
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as Record<string, unknown> | undefined;
          if (!row) return;
          const plat = String(row.plataforma ?? '').trim().toLowerCase();
          if (plat !== 'instagram') return;
          const norm = String(row.contact_norm ?? row.phone ?? '')
            .trim()
            .toLowerCase();
          if (norm !== sid) return;

          if (rtDebounceRef.current) clearTimeout(rtDebounceRef.current);
          rtDebounceRef.current = setTimeout(() => {
            rtDebounceRef.current = null;
            if (!cancelled) void fetchConversation(sid, { background: true });
          }, 350);
        },
      )
      .subscribe();

    rtChannelRef.current = channel as unknown as RealtimeChannel;

    poll = setInterval(() => {
      if (!cancelled) void fetchConversation(sid, { background: true });
    }, 3000);

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (rtDebounceRef.current) {
        clearTimeout(rtDebounceRef.current);
        rtDebounceRef.current = null;
      }
      detachRealtime();
    };
  }, [activeSessionId, profile?.company_id, fetchConversation, detachRealtime]);

  const refetch = useCallback(() => {
    const sid = activeSessionId?.trim().toLowerCase();
    if (sid) void fetchConversation(sid, { background: true });
  }, [fetchConversation, activeSessionId]);

  return { messages, loading, error, refetch };
}
