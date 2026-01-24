import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useUserProfile } from './useUserProfile';

/**
 * Extrai o conteúdo limpo da mensagem.
 * Se a mensagem vier no formato "[MENSAGEM DE TEXTO ENVIADA]: (conteúdo)", 
 * extrai apenas o conteúdo entre parênteses.
 */
export function extractMessageContent(content: string): string {
  if (!content) return '';
  
  // Padrão: [QUALQUER COISA]: (conteúdo)
  // Exemplos:
  // [MENSAGEM DE TEXTO ENVIADA]: (Guilherme e queria saber o valor da casa)
  // [MENSAGEM DE ÁUDIO ENVIADA]: (transcrição do áudio)
  // O \s* permite zero ou mais espaços entre : e (
  const match = content.match(/^\[.*?\]:\s*\(([\s\S]*)\)$/);
  
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Se não encontrar o padrão, retorna o conteúdo original
  return content;
}

/**
 * Extrai URLs de imagens do campo media.
 * O campo media pode conter um JSON com várias imagens no formato:
 * "{"json":{"imagem":"https://..."},"pairedItem":{"item":0}}"
 * ou um PostgreSQL array de strings JSON
 */
export function extractMediaImages(media: string | null | undefined): string[] {
  if (!media || media === 'null' || media.trim() === '') return [];
  
  const images: string[] = [];
  
  try {
    // Estratégia 1: Extrair URLs diretamente com regex (mais robusto para formatos complexos)
    // Padrão para URLs de imagem do Supabase Storage e outros
    const urlPattern = /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+\.(?:jpg|jpeg|png|gif|webp)/gi;
    const urlMatches = media.match(urlPattern);
    
    if (urlMatches) {
      // Remover duplicatas e URLs com caracteres de escape
      const cleanUrls = urlMatches.map(url => 
        url.replace(/\\+/g, '').replace(/"+$/, '')
      );
      const uniqueUrls = [...new Set(cleanUrls)];
      images.push(...uniqueUrls);
    }
    
    // Estratégia 2: Se não encontrou URLs, tentar parsear como JSON
    if (images.length === 0) {
      let parsed: any;
      
      // Tentar parsear diretamente
      if (media.startsWith('{') || media.startsWith('[')) {
        try {
          parsed = JSON.parse(media);
        } catch {
          // Se falhar, tentar limpar aspas escapadas
          const cleaned = media.replace(/\\"/g, '"').replace(/^"|"$/g, '');
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            parsed = null;
          }
        }
      }
      
      // Processar objeto/array parseado
      if (parsed && typeof parsed === 'object') {
        if (parsed.json?.imagem) {
          images.push(parsed.json.imagem);
        } else if (parsed.imagem) {
          images.push(parsed.imagem);
        } else if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'string') {
              try {
                const itemParsed = JSON.parse(item);
                if (itemParsed?.json?.imagem) {
                  images.push(itemParsed.json.imagem);
                }
              } catch {
                // Ignorar
              }
            } else if (item?.json?.imagem) {
              images.push(item.json.imagem);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Erro ao extrair imagens do media:', error);
  }
  
  return images;
}

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
  mediaImages?: string[]; // URLs das imagens extraídas do campo media
  before_handoff?: boolean;
  handoff_ts?: string | null;
}

export function useConversaMessages() {
  const [messages, setMessages] = useState<ConversaMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useUserProfile();

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
  const companyPhoneRef = useRef<string | null>(null);
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
      
      // Extrair conteúdo limpo (remove prefixos como "[MENSAGEM DE TEXTO ENVIADA]: ()")
      const rawContent = parsedMessage?.content || '';
      const cleanContent = extractMessageContent(rawContent);
      
      // Extrair imagens do campo media
      const mediaImages = extractMediaImages(row.media);
      
      return {
        id: row.id,
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

  // Buscar whatsapp_ai_phone da empresa
  useEffect(() => {
    const fetchCompanyPhone = async () => {
      if (!profile?.company_id) {
        companyPhoneRef.current = null;
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('companies')
          .select('phone')
          .eq('id', profile.company_id)
          .single();

        if (fetchError) throw fetchError;

        if (data && data.phone) {
          companyPhoneRef.current = data.phone.replace(/\D/g, '');
        }
      } catch (err) {
        console.error('Erro ao buscar whatsapp_ai_phone da empresa:', err);
        companyPhoneRef.current = null;
      }
    };

    fetchCompanyPhone();
  }, [profile?.company_id]);

  const fetchConversation = useCallback(async (sessionId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Buscar telefone se não tiver
      if (!companyPhoneRef.current && profile?.company_id) {
        try {
          const { data: fetchData, error: fetchError } = await supabase
            .from('companies')
            .select('phone')
            .eq('id', profile.company_id)
            .single();

          if (fetchError) throw fetchError;

          if (fetchData && fetchData.phone) {
            companyPhoneRef.current = fetchData.phone.replace(/\+/g, '');
          }
        } catch (err) {
          console.error('[useConversaMessages] Erro ao buscar phone:', err);
        }
      }

      if (!companyPhoneRef.current) {
        // Se ainda não tiver telefone, não tem como saber a tabela
        console.warn('[useConversaMessages] Telefone da empresa não encontrado. Impossível determinar tabela.');
        setError('Telefone da empresa não configurado');
        setLoading(false);
        return;
      }

      const phoneToUse = companyPhoneRef.current;
      console.log('[useConversaMessages] Buscando mensagens:', { sessionId, phone: phoneToUse });

      const { data, error } = await supabase.rpc('conversation_for_user_by_phone', {
        p_session_id: sessionId,
        p_phone: phoneToUse,
        p_limit: 500,
        p_offset: 0,
      });

      if (error) {
        console.error('[useConversaMessages] Erro na função RPC:', error);
        throw error;
      }

      console.log('[useConversaMessages] Mensagens recebidas:', data?.length || 0);

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
      console.error('[useConversaMessages] Erro ao carregar conversa:', e);
      setError(e?.message ?? 'Erro ao carregar conversa');
    } finally {
      setLoading(false);
    }
  }, [mapRows, computeHandoffTs, applyHandoffFlags, normalizeId, profile?.company_id]);

  const safeRefetchNow = useCallback((sessionId: string) => {
    const now = Date.now();
    if (now - lastRefetchAtRef.current < refetchThrottleMs) return;
    lastRefetchAtRef.current = now;
    fetchConversation(sessionId);
  }, [fetchConversation]);

  const scheduleRefetch = useCallback((sessionId: string, delay = 75) => {
    try { if (debounceRef.current) clearTimeout(debounceRef.current); } catch { }
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
      const evt = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
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
    } catch { }

    // nova assinatura filtrada
    const channel = supabase
      .channel(`imobi_msgs_${sessionId}_${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: `imobipro_messages_${companyPhoneRef.current}`,
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
      } catch { }
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

  // Polling a cada 2 segundos para atualização automática
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  useEffect(() => {
    // Limpar polling anterior
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    
    // Iniciar novo polling se tiver sessão ativa
    const sid = currentSessionRef.current;
    if (sid && hydratedRef.current) {
      pollingRef.current = setInterval(() => {
        const currentSid = currentSessionRef.current;
        if (currentSid) {
          fetchConversation(currentSid);
        }
      }, 2000); // 2 segundos
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchConversation, messages.length]); // Re-executar quando mensagens mudarem para manter polling ativo

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
