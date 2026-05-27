import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { resolveConversationListPreview, type ConversationPreviewKind } from '@/lib/conversaMedia';
import { conversationLabelStatusToDisplay } from '@/lib/conversationContactLabels';
import { filterConversasByLeadAssignment } from '@/lib/conversaLeadScope';
import { mensagemPreviewType, PLATAFORMA_INSTAGRAM } from '@/lib/mensagensRow';

function instagramListaFallbackLabel(sessionId: string): string {
  const id = String(sessionId || '').trim();
  if (id.length >= 8) return `Cliente · ${id.slice(0, 8)}…`;
  return 'Cliente';
}

export interface InstagramConversa {
  sessionId: string;
  instancia: string;
  displayName: string;
  leadId?: string | null;
  /** @ do cliente em `leads.arroba_instagram_cliente` (quando session_id = leads.id). */
  arrobaInstagramCliente?: string | null;
  profilePicUrlInstagram?: string | null;
  lastProfileSyncInstagram?: string | null;
  instagramIdCliente?: string | null;
  leadPhone?: string | null;   // reservado (IG não usa telefone)
  leadStage?: string | null; // etiqueta do contato (Humano | Humano solicitado | AI ATIVA)
  crmStage?: string | null;
  hasCrmLead?: boolean;
  lastMessageDate: string;
  messageCount: number;
  lastMessageContent: string;
  lastMessagePreviewKind?: ConversationPreviewKind | null;
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

      const instanciaRpc = effectiveInstance || null;

      const { data: rows, error: fetchError } = await (supabase.rpc as any)(
        'list_mensagens_conversations',
        {
          p_company_id: profile.company_id,
          p_plataforma: PLATAFORMA_INSTAGRAM,
          p_instancia: instanciaRpc,
        },
      );

      if (fetchError) throw fetchError;

      const list: InstagramConversa[] = ((rows as Record<string, unknown>[]) || []).map((r) => {
        const sid = String(r.contact_norm ?? r.phone ?? '')
          .trim()
          .toLowerCase();
        const lastText = String(r.last_text ?? '').trim();
        const preview = resolveConversationListPreview({
          text: lastText,
          media: r.last_media,
          mensageType: r.last_mensage_type,
        });
        const lastContent = preview.text;
        const lastType = mensagemPreviewType(r.last_sender_type);
        const leadName = String(r.lead_name ?? '').trim();
        const leadId = r.lead_id != null ? String(r.lead_id) : null;
        const crmStage =
          r.lead_stage != null && String(r.lead_stage).trim() !== ''
            ? String(r.lead_stage).trim()
            : null;

        return {
          sessionId: sid,
          instancia: String(r.instancia ?? effectiveInstance ?? ''),
          displayName: leadName || instagramListaFallbackLabel(sid),
          leadId,
          arrobaInstagramCliente: null,
          profilePicUrlInstagram: null,
          lastProfileSyncInstagram: null,
          instagramIdCliente: sid || null,
          leadPhone: null,
          leadStage: null,
          crmStage,
          hasCrmLead: Boolean(leadId),
          lastMessageDate: String(r.last_message_at ?? ''),
          messageCount: 1,
          lastMessageContent: lastContent,
          lastMessagePreviewKind: preview.kind,
          lastMessageType: lastType,
        };
      });

      let leadRows: Array<{ id: string }> = [];
      if (list.length > 0) {
        const igIds = [...new Set(list.map((l) => l.sessionId).filter(Boolean))];
        const leadIds = [
          ...new Set(list.map((l) => l.leadId).filter((id): id is string => Boolean(id))),
        ];
        try {
          const orParts: string[] = [];
          if (leadIds.length) orParts.push(`id.in.(${leadIds.join(',')})`);
          if (igIds.length) orParts.push(`instagram_id_cliente.in.(${igIds.join(',')})`);

          const { data: fetchedLeads } = orParts.length
            ? await supabase
                .from('leads')
                .select(
                  'id, name, stage, nome_instagram_cliente, arroba_instagram_cliente, profile_pic_url_instagram, last_profile_sync_instagram, instagram_id_cliente',
                )
                .eq('company_id', profile.company_id)
                .or(orParts.join(','))
            : { data: [] };

          leadRows = (fetchedLeads || []) as typeof leadRows;

          const leadById = new Map<string, Record<string, unknown>>();
          const leadByIg = new Map<string, Record<string, unknown>>();
          (fetchedLeads || []).forEach((lr) => {
            if (!lr?.id) return;
            leadById.set(String(lr.id), lr as Record<string, unknown>);
            const igc =
              lr.instagram_id_cliente != null ? String(lr.instagram_id_cliente).trim().toLowerCase() : '';
            if (igc) leadByIg.set(igc, lr as Record<string, unknown>);
          });

          list.forEach((item) => {
            const lr =
              (item.leadId ? leadById.get(item.leadId) : undefined) ??
              leadByIg.get(item.sessionId.toLowerCase());
            if (!lr) {
              if (!item.displayName?.trim()) {
                item.displayName = instagramListaFallbackLabel(item.sessionId);
              }
              return;
            }

            if (!item.leadId) item.leadId = String(lr.id);

            const nomeIg =
              lr.nome_instagram_cliente != null ? String(lr.nome_instagram_cliente).trim() : '';
            const nm = lr.name != null ? String(lr.name).trim() : '';
            const ab =
              lr.arroba_instagram_cliente != null ? String(lr.arroba_instagram_cliente).trim() : '';
            const label = nomeIg || nm || (ab ? (ab.startsWith('@') ? ab : `@${ab}`) : '');
            if (label) item.displayName = label;
            else if (!item.displayName?.trim()) {
              item.displayName = instagramListaFallbackLabel(item.sessionId);
            }

            if (ab) item.arrobaInstagramCliente = ab;

            const pic =
              lr.profile_pic_url_instagram != null
                ? String(lr.profile_pic_url_instagram).trim()
                : '';
            if (pic) item.profilePicUrlInstagram = pic;

            if (lr.last_profile_sync_instagram != null) {
              item.lastProfileSyncInstagram = String(lr.last_profile_sync_instagram);
            }

            const igc =
              lr.instagram_id_cliente != null ? String(lr.instagram_id_cliente).trim() : '';
            if (igc) item.instagramIdCliente = igc;

            item.hasCrmLead = true;
            if (lr.stage != null && String(lr.stage).trim() !== '') {
              item.crmStage = String(lr.stage).trim();
            }
          });
        } catch {
          list.forEach((item) => {
            if (!item.displayName?.trim()) {
              item.displayName = instagramListaFallbackLabel(item.sessionId);
            }
          });
        }
      }

      const scopedList = filterConversasByLeadAssignment(list, profile?.role, leadRows);

      if (scopedList.length > 0 && profile?.company_id) {
        try {
          const { data: labels } = await supabase
            .from('conversation_contact_labels')
            .select('session_id, status')
            .eq('company_id', profile.company_id)
            .eq('channel', 'instagram')
            .in('session_id', scopedList.map((l) => l.sessionId) as any);

          const statusBySession = new Map<string, string>();
          (labels || []).forEach((row: any) => {
            if (!row?.session_id) return;
            statusBySession.set(String(row.session_id), String(row.status || 'ai_ativa').toLowerCase());
          });

          scopedList.forEach((item) => {
            const st = statusBySession.get(item.sessionId) || 'ai_ativa';
            item.leadStage = conversationLabelStatusToDisplay(st);
          });
        } catch {
          scopedList.forEach((item) => { item.leadStage = 'AI ATIVA'; });
        }
      } else {
        scopedList.forEach((item) => { item.leadStage = 'AI ATIVA'; });
      }

      scopedList.sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime());
      setConversas(scopedList);
    } catch (err) {
      console.error('Erro ao buscar conversas de Instagram:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      if (!background) setLoading(false);
    }
  }, [profile?.company_id, scopedInstance, isManager, profile]);

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
