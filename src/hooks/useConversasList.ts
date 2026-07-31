import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { resolveConversationListPreview } from '@/lib/conversaMedia';
import type { ConversationPreviewKind } from '@/lib/conversaMedia';
import { resolveCompanyAiLabel, resolveContactLabelsForSession, isAttendanceLabelSlug } from '@/lib/conversationContactLabels';
import type { ContactLabelBadge } from '@/lib/conversationContactLabels';
import { filterConversasByLeadAssignment } from '@/lib/conversaLeadScope';
import { mensagemWhatsappPreviewType } from '@/lib/mensagensWhatsapp';
import { normalizePhoneDigits } from '@/lib/normalizePhone';
import { useCompanyAiLabels } from '@/hooks/useCompanyAiLabels';

function conversaFallbackLabel(phoneNorm: string): string {
  const id = String(phoneNorm || '').trim();
  if (id.length >= 8) return `Cliente · ${id.slice(-8)}`;
  if (id.length >= 4) return `Cliente · ${id}`;
  return 'Cliente';
}

export interface Conversa {
  /** Telefone normalizado (chave da conversa em Mensagens_Whatsapp). */
  sessionId: string;
  instancia: string;
  displayName: string;
  leadPhone?: string | null;
  leadId?: string | null;
  leadStage?: string | null;
  /** Cor do catálogo (`company_ai_labels.color`) para o badge. */
  labelColor?: string | null;
  /** Slug persistido em `conversation_contact_labels.status`. */
  labelSlug?: string | null;
  /** Todas as etiquetas da conversa (atendimento + tags). */
  contactLabels?: ContactLabelBadge[];
  crmStage?: string | null;
  hasCrmLead?: boolean;
  /** URL da foto de perfil WhatsApp do lead (pode expirar). */
  profilePicUrlWhatsapp?: string | null;
  lastMessageDate: string;
  messageCount: number;
  lastMessageContent: string;
  /** Tipo da última mídia (ícone na lista). */
  lastMessagePreviewKind?: ConversationPreviewKind | null;
  lastMessageType: 'human' | 'ai';
}

const PLATAFORMA_WHATSAPP = 'WhatsApp';

export function useConversasList(selectedInstance?: string | null) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile, isManager } = useUserProfile();
  const { labels: aiLabels } = useCompanyAiLabels();

  const scopedInstance = useMemo(() => {
    if (!selectedInstance) return null;
    return String(selectedInstance).trim().toLowerCase();
  }, [selectedInstance]);

  const fetchConversas = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      if (!profile?.company_id) {
        setConversas([]);
        return;
      }

      let effectiveInstance = scopedInstance;
      if (!isManager) {
        const inst = (profile as { chat_instance?: string })?.chat_instance;
        effectiveInstance = inst ? String(inst).trim().toLowerCase() : null;
      }

      const { data: rows, error: fetchError } = await (supabase.rpc as any)(
        'list_mensagens_whatsapp_conversations',
        {
        p_company_id: profile.company_id,
        p_plataforma: PLATAFORMA_WHATSAPP,
          p_instancia: effectiveInstance || null,
        },
      );

      if (fetchError) throw fetchError;

      const list: Conversa[] = ((rows as Record<string, unknown>[]) || []).map((r) => {
        const phoneNorm =
          normalizePhoneDigits(String(r.phone_norm ?? r.phone ?? '')) ||
          String(r.phone ?? '').trim();
        const lastText = String(r.last_text ?? '').trim();
        const preview = resolveConversationListPreview({
          text: lastText,
          media: r.last_media,
          mensageType: r.last_mensage_type,
        });
        const lastContent = preview.text;
        const leadName = String(r.lead_name ?? '').trim();
        const leadPhone = r.lead_phone != null ? String(r.lead_phone).trim() : phoneNorm;
        const leadId = r.lead_id != null ? String(r.lead_id) : null;
        const crmStage =
          r.lead_stage != null && String(r.lead_stage).trim() !== ''
            ? String(r.lead_stage).trim()
            : null;
        const profilePic =
          r.lead_profile_pic_url_whatsapp != null
            ? String(r.lead_profile_pic_url_whatsapp).trim()
            : '';

        return {
          sessionId: phoneNorm,
          instancia: String(r.instancia ?? effectiveInstance ?? ''),
          displayName: leadName || conversaFallbackLabel(phoneNorm),
          leadPhone,
          leadId,
          leadStage: null,
          crmStage,
          hasCrmLead: Boolean(leadId),
          profilePicUrlWhatsapp: profilePic || null,
          lastMessageDate: String(r.last_message_at ?? new Date().toISOString()),
          messageCount: 1,
          lastMessageContent: lastContent || '…',
          lastMessagePreviewKind: preview.kind,
          lastMessageType: mensagemWhatsappPreviewType(r.last_sender_type),
        };
      });

      const leadRows = list
        .filter((c) => c.leadId)
        .map((c) => ({ id: c.leadId as string }));

      const scopedList = filterConversasByLeadAssignment(list, profile?.role, leadRows);

      if (scopedList.length > 0 && profile.company_id) {
        try {
          const { data: labels } = await supabase
            .from('conversation_contact_labels')
            .select('session_id, status')
            .eq('company_id', profile.company_id)
            .eq('channel', 'whatsapp')
            .in('session_id', scopedList.map((l) => l.sessionId) as string[]);

          const statusesBySession = new Map<string, string[]>();
          (labels || []).forEach((row: { session_id?: string; status?: string }) => {
            if (!row?.session_id) return;
            const sid = String(row.session_id);
            const st = String(row.status || 'ai_ativa').toLowerCase();
            const arr = statusesBySession.get(sid) || [];
            arr.push(st);
            statusesBySession.set(sid, arr);
          });

          scopedList.forEach((item) => {
            const statuses = statusesBySession.get(item.sessionId) || ['ai_ativa'];
            const badges = resolveContactLabelsForSession(statuses, aiLabels);
            item.contactLabels = badges;
            const primary =
              badges.find((b) => isAttendanceLabelSlug(b.slug)) || badges[0] ||
              resolveCompanyAiLabel('ai_ativa', aiLabels);
            item.labelSlug = primary.slug;
            item.leadStage = primary.name;
            item.labelColor = primary.color;
          });
        } catch {
          scopedList.forEach((item) => {
            const meta = resolveCompanyAiLabel('ai_ativa', aiLabels);
            item.labelSlug = meta.slug;
            item.leadStage = meta.name;
            item.labelColor = meta.color;
            item.contactLabels = [meta];
          });
        }
      } else {
        scopedList.forEach((item) => {
          const meta = resolveCompanyAiLabel('ai_ativa', aiLabels);
          item.labelSlug = meta.slug;
          item.leadStage = meta.name;
          item.labelColor = meta.color;
          item.contactLabels = [meta];
        });
      }

      scopedList.sort(
        (a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime(),
      );

      setConversas(scopedList);
    } catch (err) {
      console.error('Erro ao buscar conversas:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [profile?.company_id, profile?.role, scopedInstance, isManager, profile, aiLabels]);

  useEffect(() => {
    void fetchConversas(false);
  }, [fetchConversas]);

  const updateConversation = (sessionId: string) => {
    setConversas((prev) => {
      const updated = [...prev];
      const index = updated.findIndex((c) => c.sessionId === sessionId);
      if (index > 0) {
        const conversation = updated.splice(index, 1)[0];
        updated.unshift(conversation);
      }
      return updated;
    });
    void fetchConversas(true);
  };

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (profile?.company_id) {
      pollingRef.current = setInterval(() => {
        void fetchConversas(true);
      }, 3000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [profile?.company_id, fetchConversas]);

  return {
    conversas,
    loading,
    error,
    refetch: fetchConversas,
    updateConversation,
  };
}
