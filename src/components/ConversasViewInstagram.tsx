import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import {
  MessageCircle, MessageSquare, Search, ArrowLeft,
  MoreVertical, Plus, AlertCircle, Instagram, Image as ImageIcon, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { LeadInstagramAvatar } from '@/components/LeadInstagramAvatar';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useIsXlUp } from '@/hooks/useMediaQuery';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useCompanyAiLabels } from '@/hooks/useCompanyAiLabels';
import { useToast } from '@/hooks/use-toast';
import { useInstagramInstances } from '@/hooks/useInstagramInstances';
import { useInstagramConversasList } from '@/hooks/useInstagramConversasList';
import { useInstagramMessages } from '@/hooks/useInstagramMessages';
import { useInstagramSendMessage } from '@/hooks/useInstagramSendMessage';
import { useConversasUnread } from '@/hooks/useConversasUnread';
import { useMensagensNotifications } from '@/hooks/useMensagensNotifications';
import { useConversasRealtime } from '@/hooks/useConversasRealtime';
import { supabase } from '@/integrations/supabase/client';
import {
  playInstagramChatNotificationSound,
  unlockChatNotificationSound,
} from '@/lib/chatNotificationSound';
import { shouldTrackUnreadForInstagramRow } from '@/lib/conversaUnread';
import { normInstagramSessionId } from '@/lib/mensagensRow';
import { ChatConversationTextSearchTrigger } from '@/components/ChatConversationTextSearchTrigger';
import { ConversationActionsMenu } from '@/components/ConversationActionsMenu';
import { SummaryModalAnimated } from '@/components/SummaryModalAnimated';
import { LeadViewModal } from '@/components/LeadViewModal';
import { CRM_KANBAN_STAGE_TITLES } from '@/lib/crmKanbanStages';
import type { LeadStage } from '@/types/kanban';
import { ConversationListItem } from '@/components/chat/ConversationListItem';
import { ChatMessageMediaBody } from '@/components/chat/ChatMessageMediaBody';
import { hasChatRenderableMedia } from '@/lib/conversaMedia';
import { processTextWithBold } from '@/lib/formatChatMessageText';
import { groupChatMessagesForDisplay } from '@/lib/groupChatImageMessages';
import type { ConversaMessage } from '@/hooks/useConversaMessages';
import { useChatComposerMedia } from '@/hooks/useChatComposerMedia';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatMediaPreviewOverlay } from '@/components/chat/ChatMediaPreviewOverlay';
import {
  finalizeVoiceRecordingForInstagram,
  INSTAGRAM_VOICE_MIME,
  pickVoiceRecorderMimeTypeForInstagram,
} from '@/lib/voiceAudioInstagram';
import { insertMensagemOptimistic } from '@/lib/insertMensagemOptimistic';
import { resolveWebhookMediaMessage } from '@/lib/chatMediaCaption';
import { formatConteudoMediaForDb } from '@/lib/chatMediaStorage';
import { prepareChatItemsForSend } from '@/lib/chatMediaFiles';
import {
  ChatVideoPrepareError,
  ChatVideoSizeLimitError,
} from '@/lib/compressChatVideo';
import {
  insertOptimisticChatMediaRows,
  resolveBatchWebhookTipo,
  uploadAndBuildChatMediaItems,
  toWebhookMidiasPayload,
} from '@/lib/sendChatMediaItems';
import { uploadChatMediaAndGetPublicUrl } from '@/lib/uploadChatMedia';
import { formatConversationListTime } from '@/lib/formatConversationListTime';
import { useNavigate } from 'react-router-dom';
import {
  ConversasInboxFilters,
  matchesInboxFilter,
  type InboxFilterId,
} from '@/components/conversas/ConversasInboxFilters';
import { ConversasLeadPanel } from '@/components/conversas/ConversasLeadPanel';
import { ConversasChatHeaderActions } from '@/components/conversas/ConversasChatHeaderActions';
import type { ChannelStats } from '@/components/conversas/ConversasTopBar';

/* ---------- utils ---------- */

function formatHour(dateString: string) {
  return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const bubble = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
};

/* ---------- componentes auxiliares ---------- */

const InstagramBadge: React.FC = () => (
  <div
    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-sm"
    style={{
      background: 'linear-gradient(135deg,#feda75 0%,#fa7e1e 20%,#d62976 45%,#962fbf 75%,#4f5bd5 100%)',
    }}
  >
    <Instagram className="w-3 h-3" />
    Instagram
  </div>
);

const InstagramEmptyState: React.FC<{
  onRefresh: () => void;
  loading: boolean;
  /** Quando false, a empresa já tem `companies.id_instagram` — não exibir CTA de conexão duplicada. */
  showConnectCta?: boolean;
}> = ({ onRefresh, loading, showConnectCta = true }) => (
  <div className="flex flex-col items-center justify-center h-full text-center p-10">
    <div
      className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
      style={{
        background: 'linear-gradient(135deg,#feda75 0%,#fa7e1e 20%,#d62976 45%,#962fbf 75%,#4f5bd5 100%)',
      }}
    >
      <Instagram className="w-10 h-10 text-white" />
    </div>
    <h2 className="text-2xl font-semibold text-[var(--cv-text)] mb-3">
      Instagram ainda não configurado
    </h2>
    <p className="text-[var(--cv-text-muted)] text-sm max-w-md leading-6 mb-6">
      Nenhuma conta do Instagram foi conectada a esta empresa ainda. Peça para o
      gestor conectar uma conta em <strong>Conexões</strong> ou configurar a integração
      com a Instagram Graph API via n8n.
    </p>
    <div className="flex gap-2 flex-wrap justify-center">
      <Button variant="outline" onClick={onRefresh} disabled={loading}>
        {loading ? 'Atualizando…' : 'Atualizar'}
      </Button>
      {showConnectCta && (
        <Button
          onClick={() => { window.location.href = '/connections'; }}
          style={{ background: 'linear-gradient(135deg,#d62976 0%,#962fbf 100%)' }}
          className="text-white hover:opacity-90"
        >
          <Plus className="w-4 h-4 mr-1" /> Conectar Instagram
        </Button>
      )}
    </div>
  </div>
);

/* ---------- bolha de mensagem (simplificada) ---------- */

function InstagramMessageBubble({
  row,
  highlightQuery,
  onOpenMedia,
}: {
  row: ConversaMessage;
  highlightQuery?: string;
  onOpenMedia?: (images: string[], startIndex: number) => void;
}) {
  const msgType = row.message?.type;
  const isAI = String(msgType || '').toLowerCase() === 'ai';
  const content = String(row.message?.content ?? '');
  const hq = highlightQuery?.trim();

  if (hasChatRenderableMedia(row)) {
    return (
      <ChatMessageMediaBody
        row={row}
        isAI={isAI}
        content={content}
        formatHour={formatHour}
        onOpenMedia={onOpenMedia}
        highlightQuery={hq}
      />
    );
  }

  const textBody =
    content && hq ? (
      <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
        {content.split(new RegExp(`(${escapeRegExp(hq)})`, 'gi')).map((part, i) =>
          part.toLowerCase() === hq.toLowerCase() ? (
            <mark key={i} className="rounded bg-yellow-400/35 px-0.5">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </div>
    ) : content ? (
      <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
        {processTextWithBold(content)}
      </div>
    ) : null;

  return (
    <div className={isAI ? 'self-end' : 'self-start'}>
      <div
        className={
          isAI
            ? 'max-w-[72ch] rounded-lg px-3 py-2 shadow-sm rounded-tr-none bg-[var(--cv-bubble-out)] text-[var(--cv-bubble-out-text)]'
            : 'max-w-[72ch] rounded-lg px-3 py-2 shadow-sm rounded-tl-none bg-[var(--cv-bubble-in)] text-[var(--cv-bubble-in-text)]'
        }
      >
        {textBody}
        <div
          className={`text-[10px] text-right mt-1 -mb-1 ${isAI ? 'text-[color:var(--cv-bubble-out-meta)]' : 'text-[color:var(--cv-bubble-in-meta)]'}`}
        >
          {formatHour(row.data)}
        </div>
      </div>
    </div>
  );
}

/* ---------- componente principal ---------- */

export function ConversasViewInstagram({
  onInboxStats,
  openTemplatesRequest = 0,
}: {
  onInboxStats?: (stats: ChannelStats) => void;
  openTemplatesRequest?: number;
} = {}) {
  const { profile } = useUserProfile();
  const { labels: aiCatalogLabels } = useCompanyAiLabels();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const isXlUp = useIsXlUp();
  const controls = useAnimation();
  const navigate = useNavigate();

  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [inboxFilter, setInboxFilter] = useState<InboxFilterId>('all');
  const [leadPanelOpen, setLeadPanelOpen] = useState(false);
  const [assuming, setAssuming] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sec, setSec] = useState(0);
  const [recordingLevels, setRecordingLevels] = useState<number[]>(Array.from({ length: 24 }, () => 8));
  const [companyTokenInstagram, setCompanyTokenInstagram] = useState<string | null>(null);
  const [summaryModal, setSummaryModal] = useState<{ isOpen: boolean; data: any }>({ isOpen: false, data: null });
  const [mediaViewer, setMediaViewer] = useState<{ isOpen: boolean; images: string[]; index: number }>({
    isOpen: false,
    images: [],
    index: 0,
  });
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [chatSearchHighlightId, setChatSearchHighlightId] = useState<string | null>(null);
  const [viewContactLeadId, setViewContactLeadId] = useState<string | null>(null);

  const composerMedia = useChatComposerMedia({
    surface: 'instagram',
    hasActiveConversation: Boolean(selectedConversation),
    toast,
    noConversationTitle: 'Selecione uma conversa primeiro',
  });

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottomAfterOpenRef = useRef(false);

  const {
    instances,
    loading: loadingInstances,
    refresh: refreshInstances,
    scopedInstance,
    companyInstagramId,
    hasLegacyInstagramMessaging,
  } = useInstagramInstances();
  const {
    conversas,
    loading: loadingConversas,
    error: conversasError,
    refetch: refetchConversas,
    updateConversation,
  } = useInstagramConversasList(selectedInstance || scopedInstance, companyInstagramId);
  const { messages, loading: loadingMessages, refetch: refetchMessages } = useInstagramMessages(
    companyInstagramId,
    selectedConversation
  );
  const { sendPayload, sending } = useInstagramSendMessage();

  const conversasRef = useRef(conversas);
  conversasRef.current = conversas;

  const { getUnreadCount, handleRealtimeMessage, markOpened } = useConversasUnread(
    selectedConversation,
    (sessionId) =>
      conversasRef.current.find((c) => c.sessionId === normInstagramSessionId(sessionId))?.leadStage,
    conversas,
    {
      normSessionId: normInstagramSessionId,
      playNotificationSound: playInstagramChatNotificationSound,
      shouldTrackUnreadForRow: shouldTrackUnreadForInstagramRow,
    },
  );

  useEffect(() => {
    const unlock = () => unlockChatNotificationSound();
    const opts = { capture: true } as const;
    document.addEventListener('pointerdown', unlock, opts);
    document.addEventListener('keydown', unlock, opts);
    return () => {
      document.removeEventListener('pointerdown', unlock, opts);
      document.removeEventListener('keydown', unlock, opts);
    };
  }, []);

  const isActiveSession = useCallback(
    (sessionId: string) =>
      normInstagramSessionId(sessionId) === normInstagramSessionId(selectedConversation),
    [selectedConversation],
  );

  useMensagensNotifications(
    profile?.company_id,
    {
      onIncoming: (sessionId, message) => {
        handleRealtimeMessage(sessionId, message);
        updateConversation(sessionId);
        if (isActiveSession(sessionId)) {
          void refetchMessages();
        }
      },
      onOutgoing: (sessionId, message) => {
        handleRealtimeMessage(sessionId, message);
        updateConversation(sessionId);
        if (isActiveSession(sessionId)) {
          void refetchMessages();
        }
      },
    },
    { platform: 'instagram' },
  );

  useConversasRealtime({
    onInstanceUpdate: refreshInstances,
    onConversationUpdate: (sessionId) => {
      updateConversation(sessionId);
    },
    onMessageDelete: (sessionId) => {
      if (isActiveSession(sessionId)) {
        void refetchMessages();
      }
      refetchConversas();
      refreshInstances();
    },
  });

  useEffect(() => {
    if (!profile?.company_id) {
      setCompanyTokenInstagram(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('companies')
        .select('token_instagram')
        .eq('id', profile.company_id)
        .single();
      if (cancelled) return;
      const t = data?.token_instagram != null ? String(data.token_instagram).trim() : '';
      setCompanyTokenInstagram(t || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.company_id]);

  // Mobile: esconder sidebar ao abrir chat
  useEffect(() => {
    if (isMobile) {
      setShowSidebar(!selectedConversation);
    } else {
      setShowSidebar(true);
    }
  }, [isMobile, selectedConversation]);

  useEffect(() => {
    scrollToBottomAfterOpenRef.current = true;
  }, [selectedConversation]);

  // Mantém o fim da conversa visível ao abrir e ao receber mensagens (se já estava no fim).
  useLayoutEffect(() => {
    if (!selectedConversation) return;
    const el = messagesScrollRef.current;
    if (!el || loadingMessages) return;
    const gap = 72;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < gap;
    if (scrollToBottomAfterOpenRef.current || nearBottom) {
      el.scrollTop = el.scrollHeight;
      scrollToBottomAfterOpenRef.current = false;
    }
  }, [selectedConversation, loadingMessages, messages]);

  const filteredConversas = useMemo(() => {
    const raw = searchQuery.trim().toLowerCase();
    const q = raw.replace(/^@+/, '');
    return conversas.filter((c) => {
      const name = (c.displayName || '').toLowerCase();
      const sid = (c.sessionId || '').toLowerCase();
      const arroba = (c.arrobaInstagramCliente || '').toLowerCase().replace(/^@+/, '');
      const matchesSearch =
        !q ||
        name.includes(q) ||
        sid.includes(q) ||
        arroba.includes(q) ||
        (c.lastMessageContent || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
      return matchesInboxFilter(inboxFilter, {
        unreadCount: getUnreadCount(c.sessionId),
        labelSlug: c.labelSlug,
        leadStage: c.leadStage,
      });
    });
  }, [conversas, searchQuery, inboxFilter, getUnreadCount]);

  const displayChatItems = useMemo(
    () => groupChatMessagesForDisplay(messages),
    [messages],
  );

  const setConversationLabel = useCallback(async (sessionId: string, status: string) => {
    if (!profile?.company_id) return;
    const { isAttendanceLabelSlug, ATTENDANCE_LABEL_SLUGS } = await import(
      '@/lib/conversationContactLabels'
    );
    if (isAttendanceLabelSlug(status)) {
      await supabase
        .from('conversation_contact_labels')
        .delete()
        .eq('company_id', profile.company_id)
        .eq('channel', 'instagram')
        .eq('session_id', sessionId)
        .in(
          'status',
          ATTENDANCE_LABEL_SLUGS.filter((s) => s !== status),
        );
    }
    const { error } = await supabase.from('conversation_contact_labels').upsert(
      {
        company_id: profile.company_id,
        channel: 'instagram',
        session_id: sessionId,
        status,
        updated_by: profile.id || null,
      },
      { onConflict: 'company_id,channel,session_id,status' },
    );
    if (error) throw error;
    refetchConversas();
  }, [profile?.company_id, profile?.id, refetchConversas]);

  useEffect(() => {
    if (!onInboxStats) return;
    const unread = conversas.reduce((acc, c) => acc + (getUnreadCount(c.sessionId) > 0 ? 1 : 0), 0);
    onInboxStats({ total: conversas.length, unread });
  }, [conversas, getUnreadCount, onInboxStats]);

  useEffect(() => {
    if (selectedConversation) {
      setLeadPanelOpen(isXlUp);
    } else {
      setLeadPanelOpen(false);
    }
  }, [isXlUp, selectedConversation]);

  void openTemplatesRequest;

  const setConversationCrmStage = useCallback(async (leadId: string | null | undefined, stage: LeadStage) => {
    const id = leadId?.trim();
    if (!id) throw new Error('Lead não vinculado ao CRM para esta conversa');
    const { error } = await supabase.from('leads').update({ stage }).eq('id', id);
    if (error) throw error;
    refetchConversas();
  }, [refetchConversas]);

  const currentConversation = useMemo(
    () => conversas.find(c => c.sessionId === selectedConversation),
    [conversas, selectedConversation]
  );

  const handleAssumeConversation = useCallback(async () => {
    if (!selectedConversation) return;
    try {
      setAssuming(true);
      await setConversationLabel(selectedConversation, 'humano');
      toast({
        title: 'Atendimento assumido',
        description: 'A conversa foi marcada como atendimento humano (corretor).',
      });
    } catch (e: any) {
      toast({
        title: 'Não foi possível assumir',
        description: e?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setAssuming(false);
    }
  }, [selectedConversation, setConversationLabel, toast]);

  const headerConversation = useMemo(() => {
    if (currentConversation) return currentConversation;
    if (!selectedConversation) return null;
    return {
      sessionId: selectedConversation,
      displayName: selectedConversation,
      instancia: '',
      arrobaInstagramCliente: null,
      profilePicUrlInstagram: null,
      lastProfileSyncInstagram: null,
      instagramIdCliente: null,
      leadPhone: null,
      leadStage: null,
      crmStage: null,
      hasCrmLead: false,
      lastMessageDate: '',
      messageCount: 0,
      lastMessageContent: '',
      lastMessageType: 'human' as const,
    };
  }, [currentConversation, selectedConversation]);

  const resolveIgInstancia = useCallback(() => {
    const v = (
      selectedInstance ||
      currentConversation?.instancia ||
      scopedInstance ||
      ''
    )
      .trim()
      .toLowerCase();
    return v || 'instagram';
  }, [selectedInstance, currentConversation?.instancia, scopedInstance]);

  const handleGenerateSummary = useCallback(
    async (conversation: any) => {
      const instancia = resolveIgInstancia();
      try {
        setSummaryModal({ isOpen: true, data: { loading: true } });
        const response = await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/resumo_conversa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: conversation.sessionId,
            instancia,
            company_id: profile?.company_id || '',
            user_email: profile?.email || '',
            role: profile?.role || '',
            plataforma: 'Instagram',
            rota: 'instagram',
          }),
        });
        const result = await response.json();
        const item = Array.isArray(result) ? result[0] : result;
        let summaryData: any;
        if (item && item.output) {
          summaryData = typeof item.output === 'string' ? JSON.parse(item.output) : item.output;
        } else {
          summaryData = item || result;
        }
        setSummaryModal({ isOpen: true, data: summaryData });
      } catch {
        setSummaryModal({ isOpen: true, data: { error: true } });
      }
    },
    [profile?.company_id, profile?.email, profile?.role, resolveIgInstancia]
  );

  const handleFollowUp = useCallback(
    async (conversation: any) => {
      const instancia = resolveIgInstancia();
      if (profile?.company_id && conversation?.sessionId) {
        const { resolveFollowUpStageGate, FOLLOW_UP_STAGE_BLOCKED_TOAST } = await import(
          '@/lib/followUp'
        );
        const gate = await resolveFollowUpStageGate({
          companyId: profile.company_id,
          channel: 'instagram',
          sessionId: conversation.sessionId,
          crmStage: conversation.crmStage,
          leadId: conversation.leadId,
        });
        if (!gate.allowed) {
          toast({
            title: FOLLOW_UP_STAGE_BLOCKED_TOAST.title,
            description: FOLLOW_UP_STAGE_BLOCKED_TOAST.description,
            variant: 'destructive',
          });
          return;
        }
      }
      try {
        await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/follow-up-chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: conversation.sessionId,
            instancia,
            company_id: profile?.company_id || '',
            user_email: profile?.email || '',
            role: profile?.role || '',
            plataforma: 'Instagram',
            rota: 'instagram',
            source: 'manual',
          }),
        });
        if (profile?.company_id && conversation.sessionId) {
          // Etiqueta follow_up fica a cargo do n8n/API — não sobrescrever ai_ativa.
          const { cancelFollowUpJobs } = await import('@/lib/followUp');
          await cancelFollowUpJobs({
            companyId: profile.company_id,
            channel: 'instagram',
            sessionId: conversation.sessionId,
          });
        }
        toast({
          title: 'Follow up solicitado',
          description: 'Follow up solicitado com sucesso.',
        });
      } catch {
        toast({
          title: 'Erro',
          description: 'Falha ao solicitar follow up.',
          variant: 'destructive',
        });
      }
    },
    [profile?.company_id, profile?.email, profile?.role, resolveIgInstancia, setConversationLabel, toast]
  );

  // Sem canal IG: nem ID na empresa (legado Imobi) nem contas em `company_instagram_accounts`
  const hasNoAccounts =
    !loadingInstances && !hasLegacyInstagramMessaging && (!instances || instances.length === 0);

  const maxAudioSec = 120;

  const cleanupAudioMeter = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      sourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      analyserRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    sourceRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setRecordingLevels(Array.from({ length: 24 }, () => 8));
  }, []);

  const sendText = async () => {
    const val = messageInput.trim();
    if (!val) {
      toast({ title: 'Digite uma mensagem', variant: 'destructive' });
      return;
    }
    if (!selectedConversation) {
      toast({ title: 'Selecione uma conversa', variant: 'destructive' });
      return;
    }
    if (!profile?.company_id) {
      toast({
        title: 'Empresa não identificada',
        description: 'company_id é obrigatório para o webhook. Verifique o login.',
        variant: 'destructive',
      });
      return;
    }
    const targetInstancia = resolveIgInstancia();
    try {
      await sendPayload({
        session_id: selectedConversation,
        instancia: targetInstancia,
        tipo: 'texto',
        mensagem: val,
        company_id: profile.company_id,
      });
      setMessageInput('');
      toast({
        title: 'Mensagem enviada',
        description: 'O histórico será atualizado em instantes.',
      });
      refetchMessages();
      refetchConversas();
      setTimeout(() => {
        refetchMessages();
        refetchConversas();
      }, 2000);
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar mensagem',
        description: err?.message || 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const stopRecord = () => {
    try {
      const rec = recRef.current;
      if (rec?.state === 'recording') {
        setRecording(false);
        setSec(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        cleanupAudioMeter();
        try {
          rec.requestData();
        } catch {
          /* ignore */
        }
        rec.stop();
      }
    } catch (err) {
      console.error('Erro ao parar gravação:', err);
    }
  };

  const startRecord = async () => {
    try {
      if (recording) return;
      if (!selectedConversation) {
        toast({ title: 'Selecione uma conversa primeiro', variant: 'destructive' });
        return;
      }
      const targetInstancia = resolveIgInstancia();
      const companyId = profile?.company_id;
      if (!companyId) {
        toast({ title: 'Empresa não identificada', variant: 'destructive' });
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Seu navegador não suporta captura de microfone');
      }
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('Seu navegador não suporta gravação de áudio');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickVoiceRecorderMimeTypeForInstagram();
      if (!mime) {
        toast({
          title: 'Gravação MP4 indisponível',
          description:
            'Seu navegador não grava áudio em MP4 (exigido pelo Instagram). Use Safari no Mac/iPhone ou anexe um arquivo .m4a/.mp4.',
          variant: 'destructive',
        });
        return;
      }
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);

      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          audioCtxRef.current = audioCtx;
          analyserRef.current = analyser;
          sourceRef.current = source;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const x = (dataArray[i] - 128) / 128;
              sum += x * x;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            const h = Math.max(6, Math.min(28, 6 + rms * 140));
            setRecordingLevels(prev => [...prev.slice(1), h]);
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        }
      } catch (meterErr) {
        console.warn('Medidor de áudio indisponível, gravando sem ondas:', meterErr);
      }

      chunksRef.current = [];
      mr.ondataavailable = e => {
        if (e.data) chunksRef.current.push(e.data);
      };
      const sessionId = normInstagramSessionId(selectedConversation);
      mr.onstop = async () => {
        try {
          setBusy(true);
          const resolvedMime = mr.mimeType || mime || 'audio/webm';
          const audioFile = await finalizeVoiceRecordingForInstagram(chunksRef.current, resolvedMime);
          const audioUrl = await uploadChatMediaAndGetPublicUrl(
            audioFile,
            'instagram',
            'audio',
            companyId,
          );

          if (companyId) {
            const inserted = await insertMensagemOptimistic({
              companyId,
              sessionId,
              instancia: targetInstancia,
              platform: 'instagram',
              mediaUrl: formatConteudoMediaForDb('audio', audioUrl),
              messageType: 'audio',
              content: '',
              userId: profile?.id,
            });
            if (!inserted) {
              console.warn('[audio] insert otimista IG falhou; continuando via webhook');
            }
          }

          refetchMessages();

          sendPayload({
            session_id: sessionId,
            instancia: targetInstancia,
            tipo: 'audio',
            mensagem: '',
            mime_type: INSTAGRAM_VOICE_MIME,
            company_id: companyId,
            media_url: audioUrl,
          }).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido';
            toast({
              title: 'Falha ao encaminhar áudio ao Instagram',
              description: msg,
              variant: 'destructive',
            });
          });

          toast({ title: 'Áudio enviado com sucesso', variant: 'default' });
          refetchConversas();
          setTimeout(() => {
            refetchMessages();
            refetchConversas();
          }, 2000);
        } catch (err: any) {
          console.error('Erro ao enviar áudio:', err);
          toast({
            title: 'Falha ao enviar áudio',
            description: err?.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        } finally {
          stream.getTracks().forEach(t => t.stop());
          cleanupAudioMeter();
          setBusy(false);
          setRecording(false);
          setSec(0);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      };

      mr.start(100);
      recRef.current = mr;
      setRecording(true);
      setSec(0);
      timerRef.current = window.setInterval(() => {
        setSec(s => {
          if (s + 1 >= maxAudioSec) {
            stopRecord();
            return maxAudioSec;
          }
          return s + 1;
        });
      }, 1000) as unknown as number;
    } catch (err: any) {
      cleanupAudioMeter();
      console.error('Erro ao acessar microfone:', err);
      toast({
        title: 'Não foi possível iniciar a gravação',
        description: err?.message || 'Permissão de microfone negada ou indisponível',
        variant: 'destructive',
      });
    }
  };

  const sendPreview = async () => {
    if (!composerMedia.previewData || !selectedConversation) return;
    const targetInstancia = resolveIgInstancia();
    try {
      setBusy(true);
      const preparedItems = await prepareChatItemsForSend(
        composerMedia.previewData.items.map((item) => ({
          file: item.file,
          type: item.type,
          caption: item.caption || '',
        })),
        {
          onVideoProgress: (progress) => {
            if (progress.phase === 'done') {
              composerMedia.setSendProgress(null);
              return;
            }
            if (progress.phase === 'loading' || progress.phase === 'converting') {
              composerMedia.setSendProgress({
                fileName: progress.fileName,
                phase: progress.phase,
                ratio: progress.ratio,
              });
            }
          },
        },
      );

      composerMedia.setSendProgress({
        fileName: preparedItems[0]?.file.name || '',
        phase: 'uploading',
      });

      const uploadedItems = await uploadAndBuildChatMediaItems(
        preparedItems,
        'instagram',
        profile?.company_id,
      );
      const urls = uploadedItems.map((m) => m.url);
      const requestType = resolveBatchWebhookTipo(uploadedItems);
      const sessionId = normInstagramSessionId(selectedConversation);
      const primary = uploadedItems[0];
      const webhookMessage = resolveWebhookMediaMessage(primary?.caption, urls[0]);

      if (profile?.company_id) {
        await insertOptimisticChatMediaRows({
          companyId: profile.company_id,
          sessionId,
          instancia: targetInstancia,
          platform: 'instagram',
          items: uploadedItems,
          userId: profile.id,
        });
      }

      refetchMessages();

      sendPayload({
        session_id: sessionId,
        instancia: targetInstancia,
        tipo: requestType,
        mensagem: webhookMessage,
        caption: primary?.caption || '',
        mime_type:
          requestType === 'audio' ? INSTAGRAM_VOICE_MIME : primary?.mime_type,
        company_id: profile?.company_id,
        media_url: urls[0],
        mutiplos: uploadedItems.length > 1,
        media_urls: urls,
        midias: toWebhookMidiasPayload(uploadedItems),
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('[media] webhook IG falhou:', err);
        toast({
          title: 'Falha ao encaminhar ao Instagram',
          description: msg,
          variant: 'destructive',
        });
      });

      toast({
        title: uploadedItems.length > 1 ? `${uploadedItems.length} arquivos enviados` : 'Arquivo enviado',
        variant: 'default',
      });

      composerMedia.clearPreview();
      refetchConversas();
      setTimeout(() => {
        refetchMessages();
        refetchConversas();
      }, 2000);
    } catch (err: any) {
      const message = err?.message || 'Erro ao enviar';
      const title =
        err instanceof ChatVideoSizeLimitError || /limite é 16 MB/i.test(message)
          ? 'Vídeo acima do limite'
          : err instanceof ChatVideoPrepareError
            ? 'Erro ao preparar vídeo'
            : 'Erro ao enviar';
      toast({ title, description: message, variant: 'destructive' });
    } finally {
      composerMedia.setSendProgress(null);
      setBusy(false);
    }
  };

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === 'Enter' && !e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
      e.preventDefault();
      if (!sending && !busy && !recording) void sendText();
    }
  };

  const openMediaViewer = useCallback((images: string[], startIndex: number) => {
    if (!images?.length) return;
    setMediaViewer({
      isOpen: true,
      images,
      index: Math.max(0, Math.min(startIndex, images.length - 1)),
    });
  }, []);

  const closeMediaViewer = useCallback(() => {
    setMediaViewer({ isOpen: false, images: [], index: 0 });
  }, []);

  const goPrevMedia = useCallback(() => {
    setMediaViewer((prev) => {
      if (!prev.images.length) return prev;
      const nextIndex = prev.index === 0 ? prev.images.length - 1 : prev.index - 1;
      return { ...prev, index: nextIndex };
    });
  }, []);

  const goNextMedia = useCallback(() => {
    setMediaViewer((prev) => {
      if (!prev.images.length) return prev;
      const nextIndex = prev.index === prev.images.length - 1 ? 0 : prev.index + 1;
      return { ...prev, index: nextIndex };
    });
  }, []);

  return (
    <div className="h-full min-h-0 min-w-0 bg-[var(--cv-shell)] text-[var(--cv-text)] overflow-hidden flex relative rounded-xl sm:rounded-2xl shadow-xl ring-1 ring-[var(--cv-ring)]">
      {/* SIDEBAR */}
      <div
        className={`conversas-list-panel ${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-[min(40%,300px)] lg:w-[320px] xl:w-[380px] flex-col border-r border-[var(--cv-border)] bg-[var(--cv-shell)] relative z-30 shrink-0 min-h-0 min-w-0`}
      >
        <ConversasInboxFilters
          title="Caixa de entrada"
          totalCount={conversas.length}
          unreadCount={conversas.reduce((acc, c) => acc + (getUnreadCount(c.sessionId) > 0 ? 1 : 0), 0)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Pesquisar por nome ou @ do Instagram…"
          activeFilter={inboxFilter}
          onFilterChange={setInboxFilter}
          headerMenu={
            <button
              type="button"
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-[var(--cv-hover)]"
              onClick={() => void refreshInstances()}
              title="Atualizar"
              aria-label="Atualizar contas Instagram"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          }
        />

        {/* INSTANCES LIST */}
        <div className="py-2 px-3 border-b border-[var(--cv-border)] overflow-x-auto whitespace-nowrap custom-scrollbar">
          {instances.length === 0 && !loadingInstances && !hasLegacyInstagramMessaging ? (
            <div className="text-xs text-[var(--cv-text-muted)] px-1 py-1">
              Nenhuma conta IG conectada.
            </div>
          ) : instances.length > 0 ? (
            instances.map(inst => (
              <button
                key={inst.id}
                onClick={() => {
                  setSelectedInstance(inst.handle);
                  setSelectedConversation(null);
                }}
                className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full mr-2 transition-colors border ${
                  selectedInstance === inst.handle
                    ? 'text-white border-transparent'
                    : 'bg-[var(--cv-tab-inactive-bg)] text-[var(--cv-tab-inactive-text)] border-transparent hover:bg-[var(--cv-hover)]'
                }`}
                style={
                  selectedInstance === inst.handle
                    ? { background: 'linear-gradient(135deg,#d62976 0%,#962fbf 100%)', color: '#fff' }
                    : undefined
                }
                title={inst.display_name || inst.handle}
              >
                <Instagram className="w-3 h-3" />
                {inst.handle}
                {inst.status === 'connected' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-1" />
                )}
              </button>
            ))
          ) : null}
        </div>

        {/* CHAT LIST */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {hasNoAccounts ? (
            <div className="p-4 text-center text-[var(--cv-text-muted)] text-sm">
              <AlertCircle className="w-5 h-5 mx-auto mb-2" />
              Conecte uma conta Instagram para ver conversas.
            </div>
          ) : loadingConversas ? (
            <div className="p-3 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-2xl bg-[var(--cv-panel-muted)]/60 animate-pulse" />
              ))}
            </div>
          ) : conversasError ? (
            <div className="p-4 text-center text-sm text-destructive">
              <AlertCircle className="w-5 h-5 mx-auto mb-2" />
              Erro ao carregar conversas. Recarregue a página.
            </div>
          ) : filteredConversas.length === 0 ? (
            <div className="p-4 text-center text-[var(--cv-text-muted)] text-sm">
              Nenhuma conversa encontrada.
            </div>
          ) : (
            filteredConversas.map(conv => (
              <ContextMenu key={conv.sessionId}>
                <ContextMenuTrigger asChild>
                  <ConversationListItem
                    variant="instagram"
                    selected={selectedConversation === conv.sessionId}
                    onClick={() => {
                      setSelectedConversation(conv.sessionId);
                      markOpened(conv.sessionId, conv.leadStage);
                    }}
                    unreadCount={getUnreadCount(conv.sessionId)}
                    displayName={conv.displayName}
                    leadStage={conv.leadStage}
                    labelColor={conv.labelColor}
                    contactLabels={conv.contactLabels}
                    crmStage={conv.crmStage}
                    hasCrmLead={conv.hasCrmLead}
                    timeLabel={conv.lastMessageDate ? formatConversationListTime(conv.lastMessageDate) : undefined}
                    previewKind={conv.lastMessagePreviewKind}
                    previewText={conv.lastMessageContent}
                    avatar={
                      <div
                        className="h-full w-full p-[2px] rounded-full"
                        style={{
                          background:
                            'linear-gradient(135deg,#feda75 0%,#fa7e1e 20%,#d62976 45%,#962fbf 75%,#4f5bd5 100%)',
                        }}
                      >
                        <LeadInstagramAvatar
                          className="h-full w-full bg-[var(--cv-panel)]"
                          leadId={conv.leadId ?? conv.sessionId}
                          displayName={conv.displayName}
                          profilePicUrlInstagram={conv.profilePicUrlInstagram}
                          lastProfileSyncInstagram={conv.lastProfileSyncInstagram}
                          instagramIdCliente={conv.instagramIdCliente}
                          companyTokenInstagram={companyTokenInstagram}
                        />
                      </div>
                    }
                  />
                </ContextMenuTrigger>
                <ContextMenuContent className="w-52">
                  {aiCatalogLabels.map((label) => (
                    <ContextMenuItem
                      key={label.id}
                      onClick={async () => {
                        try {
                          await setConversationLabel(conv.sessionId, label.slug);
                          toast({ title: `Etiqueta atualizada para ${label.name}` });
                        } catch (e: any) {
                          toast({ title: 'Erro ao atualizar etiqueta', description: e?.message, variant: 'destructive' });
                        }
                      }}
                    >
                      Marcar como {label.name}
                    </ContextMenuItem>
                  ))}
                  <ContextMenuSub>
                    <ContextMenuSubTrigger
                      disabled={!conv.hasCrmLead}
                      className={!conv.hasCrmLead ? 'opacity-50' : ''}
                    >
                      Estágio no CRM
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="max-h-64 overflow-y-auto">
                      {CRM_KANBAN_STAGE_TITLES.map((title) => (
                        <ContextMenuItem
                          key={title}
                          onClick={async () => {
                            try {
                              await setConversationCrmStage(conv.leadId, title);
                              toast({ title: 'Estágio do lead atualizado', description: title });
                            } catch (e: any) {
                              toast({
                                title: 'Não foi possível alterar o estágio',
                                description: e?.message || 'Verifique se o contato é um lead no CRM e suas permissões.',
                                variant: 'destructive',
                              });
                            }
                          }}
                        >
                          <span className="flex w-full items-center justify-between gap-2">
                            <span>{title}</span>
                            {String(conv.crmStage || '').trim() === title ? (
                              <span className="text-xs text-muted-foreground">atual</span>
                            ) : null}
                          </span>
                        </ContextMenuItem>
                      ))}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                </ContextMenuContent>
              </ContextMenu>
            ))
          )}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className={`conversas-chat-shell ${!showSidebar ? 'flex' : 'hidden md:flex'} flex-1 flex-col relative w-full h-full min-w-0 min-h-0`}>
        {hasNoAccounts ? (
          <InstagramEmptyState
            onRefresh={refreshInstances}
            loading={loadingInstances}
            showConnectCta={!hasLegacyInstagramMessaging}
          />
        ) : !selectedConversation ? (
          <div className="relative z-[1] flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-8 border-b-[6px]"
               style={{ borderColor: '#d62976' }}>
            <div className="max-w-[560px]">
              <div
                className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-5 sm:mb-6 rounded-2xl flex items-center justify-center shadow-md"
                style={{ background: 'linear-gradient(135deg,#feda75 0%,#fa7e1e 20%,#d62976 45%,#962fbf 75%,#4f5bd5 100%)' }}
              >
                <Instagram className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-light text-[var(--cv-text)] mb-4 sm:mb-5">
                Direct do Instagram
              </h2>
              <p className="text-[var(--cv-text-muted)] text-sm leading-6">
                Selecione uma conversa do Instagram para começar a responder.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div className="min-h-[56px] sm:min-h-[64px] bg-[var(--cv-panel)] px-2 sm:px-3 md:px-4 py-2 flex items-center justify-between gap-1.5 sm:gap-2 shadow-sm shrink-0 z-10 w-full border-b border-[var(--cv-border)] min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 overflow-hidden min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden text-[var(--cv-icon)] shrink-0 h-9 w-9"
                  onClick={() => {
                    setShowSidebar(true);
                    setSelectedConversation(null);
                    setLeadPanelOpen(false);
                  }}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div
                  className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden p-[2px]"
                  style={{ background: 'linear-gradient(135deg,#feda75 0%,#fa7e1e 20%,#d62976 45%,#962fbf 75%,#4f5bd5 100%)' }}
                >
                  {headerConversation ? (
                    <LeadInstagramAvatar
                      className="h-full w-full bg-white"
                      leadId={headerConversation.leadId ?? headerConversation.sessionId}
                      displayName={headerConversation.displayName}
                      profilePicUrlInstagram={headerConversation.profilePicUrlInstagram}
                      lastProfileSyncInstagram={headerConversation.lastProfileSyncInstagram}
                      instagramIdCliente={headerConversation.instagramIdCliente}
                      companyTokenInstagram={companyTokenInstagram}
                    />
                  ) : null}
                </div>
                <div className="flex flex-col overflow-hidden min-w-0">
                  <div className="flex items-center overflow-hidden gap-2 flex-wrap">
                    <span className="text-[var(--cv-text)] font-semibold text-sm sm:text-base truncate">
                      {currentConversation?.displayName || selectedConversation}
                    </span>
                    {currentConversation?.leadStage ? (
                      <span className="hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-wide rounded-md px-1.5 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        {currentConversation.leadStage}
                      </span>
                    ) : null}
                    <InstagramBadge />
                  </div>
                  {(() => {
                    const raw = currentConversation?.arrobaInstagramCliente?.trim();
                    if (!raw) return null;
                    const label = raw.startsWith('@') ? raw : `@${raw}`;
                    return (
                      <p className="text-xs text-[var(--cv-text-muted)] truncate" title={label}>
                        {label} · Instagram Direct
                      </p>
                    );
                  })()}
                </div>
              </div>
              <div className="flex gap-0.5 sm:gap-1 items-center text-[var(--cv-icon)] shrink-0 max-w-[50%] sm:max-w-none overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <ConversasChatHeaderActions
                  onAssume={() => void handleAssumeConversation()}
                  assumeDisabled={
                    String(currentConversation?.labelSlug || '').toLowerCase() === 'humano' ||
                    String(currentConversation?.leadStage || '').toLowerCase() === 'humano'
                  }
                  assumeLoading={assuming}
                  onScheduleVisit={() => navigate('/agenda')}
                  showLeadPanelToggle
                  onToggleLeadPanel={() => setLeadPanelOpen((v) => !v)}
                />
                <ChatConversationTextSearchTrigger
                  messages={messages}
                  scrollRootRef={messagesScrollRef}
                  onActiveMatchChange={setChatSearchHighlightId}
                  onQueryChange={setInChatSearchQuery}
                  triggerButtonClassName="hidden sm:inline-flex h-9 w-9 shrink-0 text-[var(--cv-icon)] hover:text-[var(--cv-text)] hover:bg-[var(--cv-hover)]"
                />
                {headerConversation ? (
                  <ConversationActionsMenu
                    conversation={headerConversation}
                    onGenerateSummary={handleGenerateSummary}
                    onFollowUp={handleFollowUp}
                    triggerClassName="text-[var(--cv-icon)] hover:text-[var(--cv-text)] hover:bg-[var(--cv-hover)] h-8 w-8 sm:h-9 sm:w-9 p-0"
                  />
                ) : null}
              </div>
            </div>

            {/* MESSAGES */}
            <div
              ref={messagesScrollRef}
              className="conversas-chat-area flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 custom-scrollbar min-h-0"
            >
              <div className="space-y-2 pb-2">
                {loadingMessages ? (
                  <div className="text-center text-[var(--cv-text-muted)] text-sm py-10">
                    Carregando mensagens…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-[var(--cv-text-muted)] text-sm py-10">
                    Sem mensagens ainda. Inicie a conversa.
                  </div>
                ) : (
                  displayChatItems.map((item) => {
                    if (item.kind === 'image_album') {
                      const isMe = item.isAI;
                      const isHit = item.rows.some((r) => chatSearchHighlightId === String(r.id));
                      const albumRow: ConversaMessage = {
                        ...item.rows[0],
                        id: item.id,
                        mediaImages: item.images,
                        message: { ...item.rows[0].message, content: item.caption },
                        data: item.data,
                      };
                      return (
                        <motion.div
                          key={item.id}
                          data-chat-message-id={item.rows[0].id}
                          variants={bubble}
                          initial="hidden"
                          animate="visible"
                          className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${isHit ? 'rounded-lg ring-2 ring-yellow-400/70 ring-offset-2 ring-offset-[var(--cv-chat)]' : ''}`}
                        >
                          <InstagramMessageBubble
                            row={albumRow}
                            highlightQuery={inChatSearchQuery}
                            onOpenMedia={openMediaViewer}
                          />
                        </motion.div>
                      );
                    }

                    const row = item.row;
                    const msgType = row.message?.type;
                    const isMe = msgType === 'ai' || msgType === 'assistant';
                    const isHit = chatSearchHighlightId === String(row.id);
                    return (
                      <motion.div
                        key={row.id}
                        data-chat-message-id={row.id}
                        variants={bubble}
                        initial="hidden"
                        animate="visible"
                        className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${isHit ? 'rounded-lg ring-2 ring-yellow-400/70 ring-offset-2 ring-offset-[var(--cv-chat)]' : ''}`}
                      >
                        <InstagramMessageBubble
                          row={row}
                          highlightQuery={inChatSearchQuery}
                          onOpenMedia={openMediaViewer}
                        />
                      </motion.div>
                    );
                  })
                )}
                <div ref={endOfMessagesRef} />
              </div>
            </div>

            <ChatComposer
              surface="instagram"
              zClassName="relative z-30"
              messageInput={messageInput}
              onMessageInputChange={setMessageInput}
              onTextareaKeyDown={onTextareaKeyDown}
              onSendText={() => void sendText()}
              placeholder="Escreva uma mensagem..."
              busy={busy || composerMedia.busy}
              preparingAttachment={composerMedia.preparingAttachment}
              sending={sending}
              recording={recording}
              recordingLevels={recordingLevels}
              recordingSec={sec}
              onStartRecord={() => void startRecord()}
              onStopRecord={stopRecord}
              imgInputRef={composerMedia.imgInputRef}
              messageTextareaRef={composerMedia.messageTextareaRef}
              onPickFile={composerMedia.onPickFile}
              onPasteMedia={composerMedia.onPasteMedia}
            />
          </>
        )}
      </div>

      {selectedConversation ? (
        <ConversasLeadPanel
          open={leadPanelOpen}
          onOpenChange={setLeadPanelOpen}
          leadId={currentConversation?.leadId || null}
          displayName={currentConversation?.displayName || selectedConversation}
          phone={currentConversation?.leadPhone}
          channelLabel="Instagram"
          channel="instagram"
          companyId={profile?.company_id || null}
          sessionId={currentConversation?.sessionId || selectedConversation || null}
          profilePicUrl={currentConversation?.profilePicUrlInstagram}
          messageCount={messages.length || currentConversation?.messageCount}
          labelStage={currentConversation?.leadStage}
          onViewFicha={
            currentConversation?.leadId
              ? () => setViewContactLeadId(String(currentConversation.leadId))
              : undefined
          }
        />
      ) : null}

      {/* MEDIA PREVIEW */}
      <AnimatePresence>
        {mediaViewer.isOpen && mediaViewer.images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={closeMediaViewer}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeMediaViewer();
              }}
              className="absolute top-4 left-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              aria-label="Fechar visualizador"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            {mediaViewer.images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goPrevMedia();
                }}
                className="absolute left-4 md:left-8 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            <img
              src={mediaViewer.images[mediaViewer.index]}
              alt={`Imagem ${mediaViewer.index + 1}`}
              className="max-h-[86vh] max-w-[92vw] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            {mediaViewer.images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goNextMedia();
                }}
                className="absolute right-4 md:right-8 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                aria-label="Próxima imagem"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            <div className="absolute bottom-4 px-3 py-1.5 rounded-full bg-black/50 text-white text-xs">
              {mediaViewer.index + 1} / {mediaViewer.images.length}
            </div>
          </motion.div>
        )}

        {composerMedia.previewData && (
          <ChatMediaPreviewOverlay
            surface="instagram"
            previewData={composerMedia.previewData}
            busy={busy}
            sending={sending}
            sendProgress={composerMedia.sendProgress}
            onCancel={composerMedia.clearPreview}
            onSend={() => void sendPreview()}
            onUpdateCaption={composerMedia.updateCaption}
            onSelectIndex={composerMedia.setActivePreviewIndex}
            onAddFiles={(files) => void composerMedia.processFilesForPreview(files)}
            onRemoveIndex={composerMedia.removePreviewItem}
          />
        )}
      </AnimatePresence>

      <SummaryModalAnimated
        isOpen={summaryModal.isOpen}
        onClose={() => setSummaryModal({ isOpen: false, data: null })}
        summaryData={summaryModal.data}
      />

      <LeadViewModal
        isOpen={!!viewContactLeadId}
        onClose={() => setViewContactLeadId(null)}
        leadId={viewContactLeadId}
      />
    </div>
  );
}

export default ConversasViewInstagram;
