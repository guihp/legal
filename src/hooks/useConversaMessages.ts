import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ConversaMessage {
  id: string;
  sessionId: string;
  instancia: string;
  message: {
    type: 'human' | 'ai';
    content: string;
    additional_kwargs?: any;
    response_metadata?: any;
    tool_calls?: any[];
    invalid_tool_calls?: any[];
  };
  data: string;
  media?: string | null;
  before_handoff?: boolean;
  handoff_ts?: string | null;
}

export function useConversaMessages() {
  const [messages, setMessages] = useState<ConversaMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSessionRef = useRef<string | null>(null);
  const rtChannelRef = useRef<RealtimeChannel | null>(null);
  // Broadcast opcional por empresa
  const companyIdRef = useRef<string | null>(null);
  const bcastRef = useRef<RealtimeChannel | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myInstanceRef = useRef<string | null>(null);
  const handoffTsRef = useRef<string | null>(null);
  const hydratedRef = useRef<boolean>(false);
  const pendingEventsRef = useRef<any[]>([]);
  const lastRefetchAtRef = useRef<number>(0);
  const refetchThrottleMs = 250;

  const mapRows = useCallback((data: any[]): ConversaMessage[] => {
    return (data || []).map((row: any) => {
      let parsedMessage: any;
      if (typeof row.message === 'string') {
        try {
          parsedMessage = JSON.parse(row.message);
        } catch {
          parsedMessage = { type: 'human', content: row.message };
        }
      } else {
        parsedMessage = row.message;
      }
      return {
        id: row.id,
        sessionId: row.session_id,
        instancia: row.instancia || '(sem instância)',
        message: {
          type: parsedMessage?.type || 'human',
          content: parsedMessage?.content || '',
          additional_kwargs: parsedMessage?.additional_kwargs,
          response_metadata: parsedMessage?.response_metadata,
          tool_calls: parsedMessage?.tool_calls,
          invalid_tool_calls: parsedMessage?.invalid_tool_calls,
        },
        data: row.data,
        media: row.media ?? null,
        before_handoff: (row as any).before_handoff ?? false,
        handoff_ts: (row as any).handoff_ts ?? null,
      } as ConversaMessage;
    });
  }, []);

  // Helpers de handoff
  const computeHandoffTs = useCallback((rows: any[]): string | null => {
    const mi = myInstanceRef.current;
    if (!mi) return null;
    const first = [...rows]
      .filter(r => String(r.instancia || '').toLowerCase() === String(mi).toLowerCase())
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())[0];
    return first ? first.data : null;
  }, []);

  const applyHandoffFlags = useCallback((rows: any[], handoffTs: string | null) => {
    if (!handoffTs) return rows.map(r => ({ ...r, before_handoff: false, handoff_ts: null }));
    const hts = new Date(handoffTs).getTime();
    return rows.map(r => ({ ...r, before_handoff: new Date(r.data).getTime() < hts, handoff_ts: handoffTs }));
  }, []);

  const normalizeId = useCallback((v: any) => (v == null ? v : String(v)), []);

  const upsertSorted = useCallback((rows: any[], row: any) => {
    const rowNorm = { ...row, id: normalizeId(row.id) };
    const idx = rows.findIndex(r => String(r.id) === rowNorm.id);
    let next = idx === -1 ? [...rows, rowNorm] : rows.map(r => (String(r.id) === rowNorm.id ? rowNorm : r));
    next.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
    return next;
  }, [normalizeId]);

  const fetchConversation = useCallback(async (sessionId: string) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.rpc('conversation_for_user', {
        p_session_id: sessionId,
        p_limit: 500,
        p_offset: 0,
      });
      if (error) throw error;
      const mapped = mapRows(data ?? []);
      const hts = computeHandoffTs(mapped);
      handoffTsRef.current = hts;
      const withFlags = applyHandoffFlags((mapped as any[]).map(d => ({ ...d, id: normalizeId((d as any).id) })), hts);
      setMessages(withFlags);
      hydratedRef.current = true;
      if (pendingEventsRef.current.length) {
        const evts = [...pendingEventsRef.current];
        pendingEventsRef.current = [];
        evts.forEach(e => applyRealtimeDiff(e));
      }
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar conversa');
    } finally {
      setLoading(false);
    }
  }, [mapRows, computeHandoffTs, applyHandoffFlags, normalizeId]);

  const safeRefetchNow = useCallback((sessionId: string) => {
    const now = Date.now();
    if (now - lastRefetchAtRef.current < refetchThrottleMs) return;
    lastRefetchAtRef.current = now;
    fetchConversation(sessionId);
  }, [fetchConversation]);

  const scheduleRefetch = useCallback((sessionId: string, delay = 75) => {
    try { if (debounceRef.current) clearTimeout(debounceRef.current); } catch {}
    debounceRef.current = setTimeout(() => {
      fetchConversation(sessionId);
      debounceRef.current = null;
    }, delay) as unknown as ReturnType<typeof setTimeout>;
  }, [fetchConversation]);

  const applyRealtimeDiff = useCallback((payload: any) => {
    if (!hydratedRef.current) { pendingEventsRef.current.push(payload); return; }
    const mi = myInstanceRef.current;
    setMessages(prev => {
      let next = prev;
      const evt = payload.eventType as 'INSERT'|'UPDATE'|'DELETE';
      const rowNew = payload.new;
      const rowOld = payload.old;

      const recomputeHandoff = () => {
        const newHts = computeHandoffTs(next);
        handoffTsRef.current = newHts;
        next = applyHandoffFlags(next, newHts);
      };

      switch (evt) {
        case 'INSERT': {
          const msg = rowNew;
          next = upsertSorted(next, msg);
          if (mi && msg?.instancia && String(msg.instancia).toLowerCase() === String(mi).toLowerCase()) {
            const hts = handoffTsRef.current ? new Date(handoffTsRef.current).getTime() : Infinity;
            if (!handoffTsRef.current || new Date(msg.data).getTime() < hts) {
              recomputeHandoff();
            } else {
              next = applyHandoffFlags(next, handoffTsRef.current);
            }
          } else {
            next = applyHandoffFlags(next, handoffTsRef.current);
          }
          break;
        }
        case 'UPDATE': {
          const msg = rowNew;
          next = upsertSorted(next, msg);
          recomputeHandoff();
          break;
        }
        case 'DELETE': {
          const rawOld = (payload as any)?.old ?? (payload as any)?.old_record ?? (payload as any)?.record ?? null;

          if (!rawOld || rawOld.id == null) {
            if ((import.meta as any).env?.DEV) console.info('[chat RT] DELETE sem old.id — refetch fallback');
            const sid = currentSessionRef.current;
            if (sid) safeRefetchNow(sid);
            return next;
          }

          const delId = String(rawOld.id);
          next = next.filter(r => String(r.id) !== delId);

          const newHts = computeHandoffTs(next);
          handoffTsRef.current = newHts;
          next = applyHandoffFlags(next, newHts);
          break;
        }
      }

      return next;
    });
  }, [applyHandoffFlags, computeHandoffTs, upsertSorted]);

  const resubscribeSessionRealtime = useCallback((sessionId: string) => {
    // cleanup anterior
    try {
      const ch = rtChannelRef.current;
      rtChannelRef.current = null;
      if (ch) { (ch as any).unsubscribe?.(); (supabase as any).removeChannel?.(ch); }
    } catch {}

    // nova assinatura filtrada
    const channel = supabase
      .channel(`imobi_msgs_${sessionId}_${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'imobipro_messages',
        filter: `session_id=eq.${sessionId}`
      } as any, (payload: any) => {
        if ((import.meta as any).env?.DEV) console.info('[chat RT]', payload.eventType, payload.new?.id || payload.old?.id);
        applyRealtimeDiff(payload);
      })
      .subscribe((status: any) => {
        if ((import.meta as any).env?.DEV) console.info('[chat RT status]', status);
      });

    rtChannelRef.current = channel as unknown as RealtimeChannel;
  }, [applyRealtimeDiff]);

  const openSession = useCallback(async (sessionId: string) => {
    currentSessionRef.current = sessionId;
    hydratedRef.current = false;
    await fetchConversation(sessionId);
    resubscribeSessionRealtime(sessionId);
  }, [fetchConversation, resubscribeSessionRealtime]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      try {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (rtChannelRef.current) {
          (rtChannelRef.current as any).unsubscribe?.();
          (supabase as any).removeChannel?.(rtChannelRef.current);
        }
        if (bcastRef.current) {
          (bcastRef.current as any).unsubscribe?.();
          (supabase as any).removeChannel?.(bcastRef.current);
        }
      } catch {}
    };
  }, []);

  // Broadcast opcional por empresa
  useEffect(() => {
    if (!companyIdRef.current) return;
    if (bcastRef.current) return;

    const topic = `company_${companyIdRef.current}_chats`;
    const ch = supabase
      .channel(topic, { config: { broadcast: { self: true } } } as any)
      .on('broadcast', { event: 'chat_message' } as any, ({ payload }: any) => {
        const sid = payload?.session_id;
        if (!sid) return;
        if ((import.meta as any).env?.DEV) console.info('[bcast chat_message]', sid);
        if (currentSessionRef.current === sid) {
          fetchConversation(sid);
        } else {
          // opcional: marcar "novo" na lista externa
        }
      })
      .subscribe((s: any) => (import.meta as any).env?.DEV && console.info('[bcast chats status]', s));

    bcastRef.current = ch as unknown as RealtimeChannel;
  }, [fetchConversation, scheduleRefetch]);

  // Refetch quando a janela ganhar foco (qualidade de vida)
  useEffect(() => {
    const onFocus = () => {
      const sid = currentSessionRef.current;
      if (sid) scheduleRefetch(sid, 0);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [scheduleRefetch]);

  const refetch = useCallback(() => {
    const sid = currentSessionRef.current;
    if (sid) fetchConversation(sid);
  }, [fetchConversation]);

  const setCompanyId = useCallback((companyId: string | null) => {
    companyIdRef.current = companyId;
  }, []);

  const sendChatBroadcast = useCallback(async (sessionId: string) => {
    if (!bcastRef.current) return;
    await (bcastRef.current as any).send({ type: 'broadcast', event: 'chat_message', payload: { session_id: sessionId } });
  }, []);

  return {
    messages,
    loading,
    error,
    openSession,
    refetch,
    setCompanyId, // opcional
    sendChatBroadcast, // opcional
    setMyInstance: (instancia: string | null) => { myInstanceRef.current = instancia ? String(instancia).trim().toLowerCase() : null; },
  };
}
