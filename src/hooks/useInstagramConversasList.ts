import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { extractMessageContent } from './useConversaMessages';
import { mediaPreviewPrefix } from '@/lib/conversaMedia';

function instagramListaFallbackLabel(sessionId: string): string {
  const id = String(sessionId || '').trim();
  if (id.length >= 8) return `Cliente · ${id.slice(0, 8)}…`;
  return 'Cliente';
}

export interface InstagramConversa {
  sessionId: string;
  instancia: string;
  displayName: string;
  /** @ do cliente em `leads.arroba_instagram_cliente` (quando session_id = leads.id). */
  arrobaInstagramCliente?: string | null;
  profilePicUrlInstagram?: string | null;
  lastProfileSyncInstagram?: string | null;
  instagramIdCliente?: string | null;
  leadPhone?: string | null;   // reservado (IG não usa telefone)
  leadStage?: string | null;
  lastMessageDate: string;
  messageCount: number;
  lastMessageContent: string;
  lastMessageType: 'human' | 'ai';
}

/**
 * Lista as conversas de Instagram da empresa do usuário,
 * com polling de 2s para reatividade (igual ao WhatsApp).
 */
export function useInstagramConversasList(
  selectedInstance?: string | null,
  /** Quando preenchido (`companies.id_instagram`), usa tabela legada `imobipro_messages_{id}_instagram`. */
  companyInstagramId?: string | null
) {
  const [conversas, setConversas] = useState<InstagramConversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile, isManager } = useUserProfile();

  const scopedInstance = useMemo(() => {
    if (!selectedInstance) return null;
    return String(selectedInstance).trim().toLowerCase();
  }, [selectedInstance]);

  const fetchConversas = useCallback(async (opts?: { background?: boolean }) => {
    const background = opts?.background === true;
    try {
      if (!background) setLoading(true);
      setError(null);

      if (!profile?.company_id) {
        setConversas([]);
        if (!background) setLoading(false);
        return;
      }

      let effectiveInstance = scopedInstance;
      if (!isManager) {
        const inst = (profile as any)?.instagram_instance || (profile as any)?.chat_instance;
        effectiveInstance = inst ? String(inst).trim().toLowerCase() : null;
      }

      const useLegacy = Boolean(companyInstagramId?.trim());
      // Tabela legada (n8n): instancia costuma ser o token do fluxo IG, não o chat_instance do WhatsApp —
      // filtrar por chat_instance zera a lista. CRM unificado continua filtrando por instância.
      const instanciaRpc = useLegacy ? null : (effectiveInstance || null);

      const { data: rows, error: fetchError } = useLegacy
        ? await (supabase.rpc as any)('list_conversations_by_instagram_company', {
            p_company_id: profile.company_id,
            p_instancia: instanciaRpc,
          })
        : await (supabase.rpc as any)('list_instagram_conversations', {
            p_company_id: profile.company_id,
            p_instancia: instanciaRpc,
          });

      if (fetchError) throw fetchError;

      const list: InstagramConversa[] = ((rows as any[]) || []).map((r: any) => {
        const sid = String(r.session_id ?? '').trim();
        let parsedMessage: any = r.message;
        if (typeof parsedMessage === 'string') {
          try { parsedMessage = JSON.parse(parsedMessage); } catch { parsedMessage = { content: parsedMessage, type: 'human' }; }
        }
        const rawContent = String(parsedMessage?.content || '');
        const cleanContent = extractMessageContent(rawContent);
        // Sem emoji — texto curto via helper compartilhado (mesmo do WhatsApp).
        const mediaPrefix = mediaPreviewPrefix(r.media);
        const lastContent = `${mediaPrefix}${cleanContent}`.trim();
        const lastType = (parsedMessage?.type === 'ai' ? 'ai' : 'human') as 'ai' | 'human';

        const rpcName = String((r as any).lead_display_name ?? '').trim();
        const rpcPic = String((r as any).lead_profile_pic_url ?? '').trim();
        const rpcSync =
          (r as any).lead_last_profile_sync != null ? String((r as any).lead_last_profile_sync) : '';
        const rpcArroba = String((r as any).lead_arroba_instagram ?? '').trim();
        const rpcIgId = String((r as any).lead_instagram_id_cliente ?? '').trim();

        return {
          sessionId: sid,
          instancia: String(r.instancia || effectiveInstance || ''),
          displayName: rpcName || instagramListaFallbackLabel(sid),
          arrobaInstagramCliente: rpcArroba || null,
          profilePicUrlInstagram: rpcPic || null,
          lastProfileSyncInstagram: rpcSync || null,
          instagramIdCliente: rpcIgId || null,
          leadPhone: null,
          leadStage: null,
          lastMessageDate: String(r.data),
          messageCount: 1,
          lastMessageContent: lastContent,
          lastMessageType: lastType,
        };
      });

      // Complementar com leads visíveis ao usuário (RLS); RPC já traz nome/foto para corretor quando permitido
      if (list.length > 0) {
        const sids = list.map(l => l.sessionId);
        try {
          const { data: leadRows } = await supabase
            .from('leads')
            .select(
              'id, name, nome_instagram_cliente, arroba_instagram_cliente, profile_pic_url_instagram, last_profile_sync_instagram, instagram_id_cliente'
            )
            .in('id', sids as any);

          const displayNameById = new Map<string, string>();
          const arrobaById = new Map<string, string>();
          const picById = new Map<string, string>();
          const syncById = new Map<string, string>();
          const igIdById = new Map<string, string>();
          (leadRows || []).forEach((lr: any) => {
            if (!lr?.id) return;
            const id = String(lr.id);
            const nomeIg =
              lr.nome_instagram_cliente != null ? String(lr.nome_instagram_cliente).trim() : '';
            const nm = lr.name != null ? String(lr.name).trim() : '';
            const ab = lr.arroba_instagram_cliente != null ? String(lr.arroba_instagram_cliente).trim() : '';
            const label = nomeIg || nm || (ab ? (ab.startsWith('@') ? ab : `@${ab}`) : '');
            if (label) displayNameById.set(id, label);
            if (ab) arrobaById.set(id, ab);
            const pic = lr.profile_pic_url_instagram != null ? String(lr.profile_pic_url_instagram).trim() : '';
            if (pic) picById.set(id, pic);
            if (lr.last_profile_sync_instagram != null) {
              syncById.set(id, String(lr.last_profile_sync_instagram));
            }
            const igc = lr.instagram_id_cliente != null ? String(lr.instagram_id_cliente).trim() : '';
            if (igc) igIdById.set(id, igc);
          });

          list.forEach(item => {
            const resolved = displayNameById.get(item.sessionId);
            if (resolved) item.displayName = resolved;
            else if (!item.displayName?.trim()) item.displayName = instagramListaFallbackLabel(item.sessionId);

            const ab = arrobaById.get(item.sessionId);
            if (ab) item.arrobaInstagramCliente = ab;

            const pic = picById.get(item.sessionId);
            if (pic) item.profilePicUrlInstagram = pic;

            const sync = syncById.get(item.sessionId);
            if (sync) item.lastProfileSyncInstagram = sync;

            const igc = igIdById.get(item.sessionId);
            if (igc) item.instagramIdCliente = igc;
          });
        } catch {
          list.forEach(item => {
            if (!item.displayName?.trim()) item.displayName = instagramListaFallbackLabel(item.sessionId);
          });
        }
      }

      list.sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime());
      setConversas(list);
    } catch (err) {
      console.error('Erro ao buscar conversas de Instagram:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      if (!background) setLoading(false);
    }
  }, [profile?.company_id, scopedInstance, isManager, profile, companyInstagramId]);

  useEffect(() => {
    fetchConversas({ background: false });
  }, [fetchConversas]);

  const updateConversation = useCallback((sessionId: string) => {
    setConversas(prev => {
      const updated = [...prev];
      const index = updated.findIndex(c => c.sessionId === sessionId);
      if (index > 0) {
        const conv = updated.splice(index, 1)[0];
        updated.unshift(conv);
      }
      return updated;
    });
    fetchConversas({ background: true });
  }, [fetchConversas]);

  // Polling 2s sem alternar `loading` (evita piscar lista / skeleton a cada poll)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (profile?.company_id) {
      pollingRef.current = setInterval(() => {
        fetchConversas({ background: true });
      }, 2000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [profile?.company_id, fetchConversas]);

  const refetch = useCallback(() => {
    fetchConversas({ background: true });
  }, [fetchConversas]);

  return {
    conversas,
    loading,
    error,
    refetch,
    updateConversation,
  };
}
