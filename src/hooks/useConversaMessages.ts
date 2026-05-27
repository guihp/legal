import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useUserProfile } from './useUserProfile';
import { mapMensagemWhatsappRow } from '@/lib/mensagensWhatsapp';
import { normalizePhoneDigits } from '@/lib/normalizePhone';

/** Normaliza `message.content` quando vem string, array (LangChain/OpenAI) ou objeto `{ text }`. */
export function coerceTextContent(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    return v
      .map((part: { type?: string; text?: string } | string) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .join('');
  }
  if (typeof v === 'object' && v !== null && 'text' in (v as object) && typeof (v as { text: string }).text === 'string') {
    return (v as { text: string }).text;
  }
  return '';
}

export function extractLabeledMessageSegments(content: unknown): string[] {
  const text = coerceTextContent(content);
  if (!text) return [];

  const labeledMessageMatches = [...text.matchAll(/\[[^\]]+\]:\s*\(/g)];
  if (labeledMessageMatches.length <= 1) return [];

  return labeledMessageMatches
    .map((match, index) => {
      const bodyStart = (match.index ?? 0) + match[0].length;
      const nextMatch = labeledMessageMatches[index + 1];
      const bodyEnd = nextMatch?.index ?? text.length;
      return text.slice(bodyStart, bodyEnd).replace(/\)\s*$/, '').trim();
    })
    .filter(Boolean);
}

export function extractMessageContent(content: unknown): string {
  const text = coerceTextContent(content);
  if (!text) return '';

  const labeledMessageSegments = extractLabeledMessageSegments(text);
  if (labeledMessageSegments.length > 1) return labeledMessageSegments.join('\n');

  const match = text.match(/^\[.*?\]:\s*\(([\s\S]*)\)$/);
  if (match && match[1]) {
    return match[1].trim();
  }

  const bracket = text.match(/\[[^\]]+\]:\s*\(/);
  if (bracket && bracket.index !== undefined) {
    let inner = text.slice(bracket.index + bracket[0].length);
    inner = inner.replace(/\)\s*$/, '').trim();
    if (inner.length > 0) return inner;
  }

  return text;
}

function expandCommaSeparatedStorageUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    let s = String(raw || '').trim();
    if (!s) continue;
    s = s.replace(/\\+/g, '').replace(/^["']|["']$/g, '').trim();
    const chunks =
      s.includes(',') && /https?:\/\//i.test(s)
        ? s.split(/,(?=https?:\/\/)/i).map((x) => x.trim()).filter(Boolean)
        : [s];
    for (const c of chunks) {
      const u = c.trim();
      if (!u || !/^https?:\/\//i.test(u)) continue;
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

export function extractMediaImages(media: string | null | undefined): string[] {
  if (!media || media === 'null' || media.trim() === '') return [];

  const images: string[] = [];

  try {
    const urlPattern = /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+\.(?:jpg|jpeg|png|gif|webp)/gi;
    const urlMatches = media.match(urlPattern);

    if (urlMatches) {
      const cleanUrls = urlMatches.map((url) => url.replace(/\\+/g, '').replace(/"+$/, ''));
      const uniqueUrls = [...new Set(cleanUrls)];
      images.push(...uniqueUrls);
    }

    if (images.length === 0) {
      let parsed: unknown;
      if (media.startsWith('{') || media.startsWith('[')) {
        try {
          parsed = JSON.parse(media);
        } catch {
          const cleaned = media.replace(/\\"/g, '"').replace(/^"|"$/g, '');
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            parsed = null;
          }
        }
      }

      if (parsed && typeof parsed === 'object') {
        const p = parsed as Record<string, unknown>;
        if (p.json && typeof p.json === 'object' && (p.json as { imagem?: string }).imagem) {
          images.push((p.json as { imagem: string }).imagem);
        } else if (p.imagem && typeof p.imagem === 'string') {
          images.push(p.imagem);
        } else if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'string') {
              try {
                const itemParsed = JSON.parse(item) as { json?: { imagem?: string } };
                if (itemParsed?.json?.imagem) {
                  images.push(itemParsed.json.imagem);
                }
              } catch {
                /* ignore */
              }
            } else if (item && typeof item === 'object' && (item as { json?: { imagem?: string } }).json?.imagem) {
              images.push((item as { json: { imagem: string } }).json.imagem);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Erro ao extrair imagens do media:', error);
  }

  return expandCommaSeparatedStorageUrls(images);
}

export interface ConversaMessage {
  id: string;
  sessionId: string;
  instancia: string;
  message: {
    type: 'human' | 'ai';
    content: string;
    contentSegments?: string[];
    additional_kwargs?: unknown;
    response_metadata?: unknown;
    tool_calls?: unknown[];
    invalid_tool_calls?: unknown[];
  };
  data: string;
  media?: string | null;
  mediaImages?: string[];
  before_handoff?: boolean;
  handoff_ts?: string | null;
}

/** Linha legada (crm_whatsapp_messages_*) → formato do chat. */
export function mapRowToConversaMessage(row: Record<string, unknown>): ConversaMessage {
  let parsedMessage: { type?: string; content?: unknown };
  if (typeof row?.message === 'string') {
    try {
      parsedMessage = JSON.parse(row.message);
    } catch {
      parsedMessage = { type: 'human', content: row.message };
    }
  } else {
    parsedMessage = (row?.message as { type?: string; content?: unknown }) ?? {};
  }

  const rawContent = coerceTextContent(parsedMessage?.content);
  const cleanContent = extractMessageContent(rawContent);
  const contentSegments = extractLabeledMessageSegments(rawContent);
  const mediaImages = extractMediaImages(row?.media as string | null);

  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    instancia: row.instancia ? String(row.instancia) : '(sem instância)',
    message: {
      type: parsedMessage?.type === 'ai' ? 'ai' : 'human',
      content: cleanContent,
      contentSegments: contentSegments.length > 1 ? contentSegments : undefined,
      additional_kwargs: parsedMessage?.additional_kwargs,
      response_metadata: parsedMessage?.response_metadata,
      tool_calls: parsedMessage?.tool_calls as unknown[],
      invalid_tool_calls: parsedMessage?.invalid_tool_calls as unknown[],
    },
    data: String(row.data),
    media: (row.media as string) ?? null,
    mediaImages,
    before_handoff: Boolean(row.before_handoff),
    handoff_ts: row.handoff_ts != null ? String(row.handoff_ts) : null,
  };
}

const PLATAFORMA_WHATSAPP = 'WhatsApp';
const REALTIME_TABLE = 'mensagens';

export function useConversaMessages() {
  const [messages, setMessages] = useState<ConversaMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useUserProfile();

  const currentSessionRef = useRef<string | null>(null);
  const rtChannelRef = useRef<RealtimeChannel | null>(null);
  const companyIdRef = useRef<string | null>(null);
  const bcastRef = useRef<RealtimeChannel | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myInstanceRef = useRef<string | null>(null);
  const hydratedRef = useRef<boolean>(false);
  const pendingEventsRef = useRef<unknown[]>([]);
  const lastRefetchAtRef = useRef<number>(0);
  const refetchThrottleMs = 250;

  const normalizeId = useCallback((v: unknown) => (v == null ? v : String(v)), []);

  const upsertSorted = useCallback((rows: ConversaMessage[], row: ConversaMessage) => {
    const rowNorm = { ...row, id: normalizeId(row.id) };
    const idx = rows.findIndex((r) => String(r.id) === rowNorm.id);
    const next =
      idx === -1 ? [...rows, rowNorm] : rows.map((r) => (String(r.id) === rowNorm.id ? rowNorm : r));
    next.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
    return next;
  }, [normalizeId]);

  const fetchConversation = useCallback(
    async (sessionPhone: string) => {
      try {
        setLoading(true);
        setError(null);

        const companyId = profile?.company_id;
        if (!companyId) {
          setError('Empresa não identificada');
          setMessages([]);
          return;
        }

        const phoneNorm = normalizePhoneDigits(sessionPhone);
        if (!phoneNorm) {
          setError('Telefone da conversa inválido');
          setMessages([]);
          return;
        }

        const { data, error: rpcError } = await (supabase.rpc as any)('mensagens_whatsapp_thread', {
          p_company_id: companyId,
          p_phone: phoneNorm,
          p_plataforma: PLATAFORMA_WHATSAPP,
          p_limit: 500,
          p_offset: 0,
        });

        if (rpcError) throw rpcError;

        const mapped = (data ?? []).map((row: Record<string, unknown>) =>
          mapMensagemWhatsappRow(row as Parameters<typeof mapMensagemWhatsappRow>[0]),
        );

        setMessages(mapped);
        hydratedRef.current = true;
        if (pendingEventsRef.current.length) {
          const evts = [...pendingEventsRef.current];
          pendingEventsRef.current = [];
          evts.forEach((e) => applyRealtimeDiffRef.current(e));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro ao carregar conversa';
        console.error('[useConversaMessages]', msg);
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    // applyRealtimeDiff added below — eslint will warn; we use ref pattern in openSession
    [profile?.company_id],
  );

  const applyRealtimeDiffRef = useRef<(payload: unknown) => void>(() => {});

  const safeRefetchNow = useCallback(
    (sessionId: string) => {
      const now = Date.now();
      if (now - lastRefetchAtRef.current < refetchThrottleMs) return;
      lastRefetchAtRef.current = now;
      void fetchConversation(sessionId);
    },
    [fetchConversation],
  );

  const scheduleRefetch = useCallback(
    (sessionId: string, delay = 75) => {
      try {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      } catch {
        /* empty */
      }
      debounceRef.current = setTimeout(() => {
        void fetchConversation(sessionId);
        debounceRef.current = null;
      }, delay) as ReturnType<typeof setTimeout>;
    },
    [fetchConversation],
  );

  const applyRealtimeDiff = useCallback(
    (payload: { eventType?: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      if (!hydratedRef.current) {
        pendingEventsRef.current.push(payload);
        return;
      }

      const evt = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
      const rowNew = payload.new;
      const rowOld = payload.old;
      const sessionNorm = currentSessionRef.current;

      setMessages((prev) => {
        let next = prev;

        switch (evt) {
          case 'INSERT':
          case 'UPDATE': {
            if (!rowNew) return next;
            const msgPhone = normalizePhoneDigits(
              String(rowNew.phone_norm ?? rowNew.phone ?? ''),
            );
            if (sessionNorm && msgPhone !== sessionNorm) return next;
            const msg = mapMensagemWhatsappRow(
              rowNew as Parameters<typeof mapMensagemWhatsappRow>[0],
            );
            next = upsertSorted(next, msg);
            break;
          }
          case 'DELETE': {
            const rawOld = rowOld;
            if (!rawOld || rawOld.id == null) {
              if (sessionNorm) safeRefetchNow(sessionNorm);
              return next;
            }
            const delId = String(rawOld.id);
            next = next.filter((r) => String(r.id) !== delId);
            break;
          }
        }

        return next;
      });
    },
    [upsertSorted, safeRefetchNow],
  );

  applyRealtimeDiffRef.current = applyRealtimeDiff;

  const resubscribeSessionRealtime = useCallback(
    (sessionPhone: string) => {
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

      const companyId = profile?.company_id;
      if (!companyId) return;

      const channel = supabase
        .channel(`mensagens_wa_${sessionPhone}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: REALTIME_TABLE,
            filter: `company_id=eq.${companyId}`,
          } as never,
          (payload: { eventType?: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
            applyRealtimeDiffRef.current(payload);
          },
        )
        .subscribe();

      rtChannelRef.current = channel as unknown as RealtimeChannel;
    },
    [profile?.company_id],
  );

  const openSession = useCallback(
    async (sessionPhone: string) => {
      const norm = normalizePhoneDigits(sessionPhone) || sessionPhone.trim();
      currentSessionRef.current = norm;
      hydratedRef.current = false;
      await fetchConversation(norm);
      resubscribeSessionRealtime(norm);
    },
    [fetchConversation, resubscribeSessionRealtime],
  );

  useEffect(() => {
    return () => {
      try {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (rtChannelRef.current) {
          (rtChannelRef.current as { unsubscribe?: () => void }).unsubscribe?.();
          (supabase as { removeChannel?: (c: RealtimeChannel) => void }).removeChannel?.(
            rtChannelRef.current,
          );
        }
        if (bcastRef.current) {
          (bcastRef.current as { unsubscribe?: () => void }).unsubscribe?.();
          (supabase as { removeChannel?: (c: RealtimeChannel) => void }).removeChannel?.(bcastRef.current);
        }
      } catch {
        /* empty */
      }
    };
  }, []);

  useEffect(() => {
    if (!companyIdRef.current) return;
    if (bcastRef.current) return;

    const topic = `company_${companyIdRef.current}_chats`;
    const ch = supabase
      .channel(topic, { config: { broadcast: { self: true } } } as never)
      .on('broadcast', { event: 'chat_message' } as never, ({ payload }: { payload?: { session_id?: string } }) => {
        const sid = payload?.session_id;
        if (!sid) return;
        if (currentSessionRef.current === sid || normalizePhoneDigits(sid) === currentSessionRef.current) {
          void fetchConversation(currentSessionRef.current!);
        }
      })
      .subscribe();

    bcastRef.current = ch as unknown as RealtimeChannel;
  }, [fetchConversation]);

  useEffect(() => {
    const onFocus = () => {
      const sid = currentSessionRef.current;
      if (sid) scheduleRefetch(sid, 0);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [scheduleRefetch]);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    const sid = currentSessionRef.current;
    if (sid && hydratedRef.current) {
      pollingRef.current = setInterval(() => {
        const currentSid = currentSessionRef.current;
        if (currentSid) void fetchConversation(currentSid);
      }, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchConversation, messages.length]);

  const refetch = useCallback(() => {
    const sid = currentSessionRef.current;
    if (sid) void fetchConversation(sid);
  }, [fetchConversation]);

  const setCompanyId = useCallback((companyId: string | null) => {
    companyIdRef.current = companyId;
  }, []);

  const sendChatBroadcast = useCallback(async (sessionId: string) => {
    if (!bcastRef.current) return;
    await (bcastRef.current as { send: (m: unknown) => Promise<void> }).send({
      type: 'broadcast',
      event: 'chat_message',
      payload: { session_id: sessionId },
    });
  }, []);

  return {
    messages,
    loading,
    error,
    openSession,
    refetch,
    setCompanyId,
    sendChatBroadcast,
    setMyInstance: (instancia: string | null) => {
      myInstanceRef.current = instancia ? String(instancia).trim().toLowerCase() : null;
    },
  };
}
