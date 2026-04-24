import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import {
  MessageCircle, MessageSquare, Search, Send, Paperclip, ArrowLeft,
  MoreVertical, Mic, Plus, AlertCircle, Instagram, Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LeadInstagramAvatar } from '@/components/LeadInstagramAvatar';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import { useInstagramInstances } from '@/hooks/useInstagramInstances';
import { useInstagramConversasList } from '@/hooks/useInstagramConversasList';
import { useInstagramMessages } from '@/hooks/useInstagramMessages';
import { useInstagramSendMessage } from '@/hooks/useInstagramSendMessage';
import { supabase } from '@/integrations/supabase/client';
import { ChatConversationTextSearchTrigger } from '@/components/ChatConversationTextSearchTrigger';
import { ConversationActionsMenu } from '@/components/ConversationActionsMenu';
import { SummaryModalAnimated } from '@/components/SummaryModalAnimated';

/* ---------- utils ---------- */

function formatHour(dateString: string) {
  return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const out = String(fr.result || '');
      const payload = out.includes(',') ? out.split(',')[1] : out;
      resolve(payload || '');
    };
    fr.readAsDataURL(file);
  });
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

function InstagramMessageBubble({ row, highlightQuery }: { row: any; highlightQuery?: string }) {
  const msgType = row.message?.type;
  const isAI = String(msgType || '').toLowerCase() === 'ai';
  const content = row.message?.content ?? '';
  const mediaImages: string[] = row?.mediaImages || [];
  const hq = highlightQuery?.trim();

  const textBody =
    content && hq ? (
      <div className="whitespace-pre-wrap text-sm break-words">
        {content.split(new RegExp(`(${escapeRegExp(hq)})`, 'gi')).map((part, i) =>
          part.toLowerCase() === hq.toLowerCase() ? (
            <mark key={i} className="rounded bg-yellow-400/35 px-0.5">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </div>
    ) : content ? (
      <div className="whitespace-pre-wrap text-sm break-words">{content}</div>
    ) : null;

  return (
    <div className={isAI ? 'self-end' : 'self-start'}>
      <div
        className={
          isAI
            ? 'max-w-[72ch] rounded-2xl px-3 py-2 shadow-sm rounded-tr-sm bg-gradient-to-br from-[#d62976]/20 to-[#962fbf]/20 text-[var(--cv-text)] border border-[#d62976]/20'
            : 'max-w-[72ch] rounded-2xl px-3 py-2 shadow-sm rounded-tl-sm bg-[var(--cv-bubble-in)] text-[var(--cv-bubble-in-text)]'
        }
      >
        {mediaImages && mediaImages.length > 0 && (
          <div className={`grid gap-1 mb-2 ${mediaImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {mediaImages.map((url, i) => (
              <img key={i} src={url} alt="Mídia IG" className="rounded-lg max-h-64 object-cover w-full" />
            ))}
          </div>
        )}
        {textBody}
        <div className="text-[10px] opacity-60 mt-1 text-right">{formatHour(row.data)}</div>
      </div>
    </div>
  );
}

/* ---------- componente principal ---------- */

export function ConversasViewInstagram() {
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const controls = useAnimation();

  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewData, setPreviewData] = useState<{
    file: File; base64: string; type: 'imagem' | 'arquivo'; caption: string;
  } | null>(null);
  const [companyTokenInstagram, setCompanyTokenInstagram] = useState<string | null>(null);
  const [summaryModal, setSummaryModal] = useState<{ isOpen: boolean; data: any }>({ isOpen: false, data: null });
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [chatSearchHighlightId, setChatSearchHighlightId] = useState<string | null>(null);

  const imgInputRef = useRef<HTMLInputElement | null>(null);
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
  const { conversas, loading: loadingConversas, refetch: refetchConversas } = useInstagramConversasList(
    selectedInstance || scopedInstance,
    companyInstagramId
  );
  const { messages, loading: loadingMessages, refetch: refetchMessages } = useInstagramMessages(
    companyInstagramId,
    selectedConversation
  );
  const { sendPayload, sending } = useInstagramSendMessage();

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
    if (!q) return conversas;
    return conversas.filter(c => {
      const name = (c.displayName || '').toLowerCase();
      const sid = (c.sessionId || '').toLowerCase();
      const arroba = (c.arrobaInstagramCliente || '').toLowerCase().replace(/^@+/, '');
      return name.includes(q) || sid.includes(q) || arroba.includes(q);
    });
  }, [conversas, searchQuery]);

  const currentConversation = useMemo(
    () => conversas.find(c => c.sessionId === selectedConversation),
    [conversas, selectedConversation]
  );

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
            user_email: profile?.email || '',
            role: profile?.role || '',
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
    [profile?.email, profile?.role, resolveIgInstancia]
  );

  const handleFollowUp = useCallback(
    async (conversation: any) => {
      const instancia = resolveIgInstancia();
      try {
        await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/follow-up-chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: conversation.sessionId,
            instancia,
            user_email: profile?.email || '',
            role: profile?.role || '',
          }),
        });
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
    [profile?.email, profile?.role, resolveIgInstancia, toast]
  );

  // Sem canal IG: nem ID na empresa (legado Imobi) nem contas em `company_instagram_accounts`
  const hasNoAccounts =
    !loadingInstances && !hasLegacyInstagramMessaging && (!instances || instances.length === 0);

  const handleSend = async () => {
    const val = messageInput.trim();
    if (!val || !selectedConversation) return;
    const targetInstancia = selectedInstance || currentConversation?.instancia || scopedInstance || '';
    if (!targetInstancia) {
      toast({ title: 'Selecione uma conta Instagram antes de enviar', variant: 'destructive' });
      return;
    }
    try {
      await sendPayload({
        session_id: selectedConversation,
        instancia: targetInstancia,
        tipo: 'texto',
        mensagem: val,
        company_id: profile?.company_id,
      });
      setMessageInput('');
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

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedConversation) {
      toast({ title: 'Selecione uma conversa primeiro', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      const base64 = await fileToBase64(file);
      const tipo: 'imagem' | 'arquivo' = file.type.startsWith('image/') ? 'imagem' : 'arquivo';
      setPreviewData({ file, base64, type: tipo, caption: '' });
    } catch (err: any) {
      toast({ title: 'Erro ao processar arquivo', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
      if (e.target) e.target.value = '';
    }
  };

  const cancelPreview = () => setPreviewData(null);

  const sendPreview = async () => {
    if (!previewData || !selectedConversation) return;
    const targetInstancia = selectedInstance || currentConversation?.instancia || scopedInstance || '';
    if (!targetInstancia) {
      toast({ title: 'Selecione uma conta Instagram antes de enviar', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      await sendPayload({
        session_id: selectedConversation,
        instancia: targetInstancia,
        tipo: previewData.type,
        mensagem: previewData.base64,
        mime_type: previewData.file.type,
        caption: previewData.caption,
        company_id: profile?.company_id,
      });
      setPreviewData(null);
      refetchMessages();
      refetchConversas();
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === 'Enter' && !e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
      e.preventDefault();
      if (!sending && !busy) handleSend();
    }
  };

  return (
    <div className="h-[calc(100vh-7rem)] bg-[var(--cv-shell)] text-[var(--cv-text)] overflow-hidden flex relative rounded-2xl shadow-xl ring-1 ring-[var(--cv-ring)]">
      {/* SIDEBAR */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-[400px] flex-col border-r border-[var(--cv-border)] bg-[var(--cv-shell)] z-20`}>
        {/* HEADER */}
        <div className="h-[60px] bg-[var(--cv-panel)] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden shadow-sm"
              style={{ background: 'linear-gradient(135deg,#feda75 0%,#fa7e1e 20%,#d62976 45%,#962fbf 75%,#4f5bd5 100%)' }}
            >
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-[var(--cv-text)] text-sm md:text-base">Conversas Instagram</h1>
              <p className="text-[11px] text-[var(--cv-text-muted)]">Direct Messages</p>
            </div>
          </div>
          <div className="flex gap-3 text-[var(--cv-icon)]">
            <MessageSquare className="w-5 h-5 cursor-pointer" onClick={refreshInstances} />
            <MoreVertical className="w-5 h-5 cursor-pointer" />
          </div>
        </div>

        {/* SEARCH */}
        <div className="p-2 border-b border-[var(--cv-border)]">
          <div className="bg-[var(--cv-search-bg)] rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Search className="w-4 h-4 text-[var(--cv-text-muted)]" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por nome ou @ do Instagram…"
              className="bg-transparent border-none outline-none text-sm text-[var(--cv-input-text)] w-full placeholder:text-[var(--cv-text-muted)]"
            />
          </div>
        </div>

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
                    ? { background: 'linear-gradient(135deg,#d62976 0%,#962fbf 100%)' }
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
          ) : filteredConversas.length === 0 ? (
            <div className="p-4 text-center text-[var(--cv-text-muted)] text-sm">
              Nenhuma conversa encontrada.
            </div>
          ) : (
            filteredConversas.map(conv => (
              <div
                key={conv.sessionId}
                onClick={() => {
                  setSelectedConversation(conv.sessionId);
                }}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--cv-hover)] transition-colors border-b border-[var(--cv-border)] ${
                  selectedConversation === conv.sessionId ? 'bg-[var(--cv-panel-muted)]' : ''
                }`}
              >
                <div
                  className="w-12 h-12 rounded-full flex-shrink-0 relative overflow-hidden p-[2px]"
                  style={{ background: 'linear-gradient(135deg,#feda75 0%,#fa7e1e 20%,#d62976 45%,#962fbf 75%,#4f5bd5 100%)' }}
                >
                  <LeadInstagramAvatar
                    className="h-full w-full bg-white"
                    leadId={conv.sessionId}
                    displayName={conv.displayName}
                    profilePicUrlInstagram={conv.profilePicUrlInstagram}
                    lastProfileSyncInstagram={conv.lastProfileSyncInstagram}
                    instagramIdCliente={conv.instagramIdCliente}
                    companyTokenInstagram={companyTokenInstagram}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="text-[var(--cv-text)] font-normal truncate max-w-[70%] text-base">
                      {conv.displayName}
                    </h3>
                    <span className="text-xs text-[var(--cv-text-muted)] whitespace-nowrap">
                      {conv.lastMessageDate ? formatHour(conv.lastMessageDate) : ''}
                    </span>
                  </div>
                  <p className="text-[var(--cv-text-muted)] text-sm truncate">
                    {conv.lastMessageContent || 'Toque para abrir conversa'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className={`${!showSidebar ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-[var(--cv-chat)] relative w-full h-full`}>
        {hasNoAccounts ? (
          <InstagramEmptyState
            onRefresh={refreshInstances}
            loading={loadingInstances}
            showConnectCta={!hasLegacyInstagramMessaging}
          />
        ) : !selectedConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-b-[6px] bg-[var(--cv-empty)]"
               style={{ borderColor: '#d62976' }}>
            <div className="max-w-[560px]">
              <div
                className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center shadow-md"
                style={{ background: 'linear-gradient(135deg,#feda75 0%,#fa7e1e 20%,#d62976 45%,#962fbf 75%,#4f5bd5 100%)' }}
              >
                <Instagram className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-light text-[var(--cv-text)] mb-5">
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
            <div className="h-[60px] bg-[var(--cv-panel)] px-4 flex items-center justify-between shadow-sm shrink-0 z-10 w-full">
              <div className="flex items-center gap-3 overflow-hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden text-[var(--cv-icon)] mr-1"
                  onClick={() => { setShowSidebar(true); setSelectedConversation(null); }}
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
                      leadId={headerConversation.sessionId}
                      displayName={headerConversation.displayName}
                      profilePicUrlInstagram={headerConversation.profilePicUrlInstagram}
                      lastProfileSyncInstagram={headerConversation.lastProfileSyncInstagram}
                      instagramIdCliente={headerConversation.instagramIdCliente}
                      companyTokenInstagram={companyTokenInstagram}
                    />
                  ) : null}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <div className="flex items-center overflow-hidden gap-2">
                    <span className="text-[var(--cv-text)] font-normal text-base truncate">
                      {currentConversation?.displayName || selectedConversation}
                    </span>
                    <InstagramBadge />
                  </div>
                  {(() => {
                    const raw = currentConversation?.arrobaInstagramCliente?.trim();
                    if (!raw) return null;
                    const label = raw.startsWith('@') ? raw : `@${raw}`;
                    return (
                      <p className="text-xs text-[var(--cv-text-muted)] truncate" title={label}>
                        {label}
                      </p>
                    );
                  })()}
                </div>
              </div>
              <div className="flex gap-1 items-center text-[var(--cv-icon)]">
                <ChatConversationTextSearchTrigger
                  messages={messages}
                  scrollRootRef={messagesScrollRef}
                  onActiveMatchChange={setChatSearchHighlightId}
                  onQueryChange={setInChatSearchQuery}
                />
                {headerConversation ? (
                  <ConversationActionsMenu
                    conversation={headerConversation}
                    onGenerateSummary={handleGenerateSummary}
                    onFollowUp={handleFollowUp}
                    triggerClassName="text-[var(--cv-icon)] hover:text-[var(--cv-text)] hover:bg-[var(--cv-hover)] h-9 w-9 p-0"
                  />
                ) : null}
              </div>
            </div>

            {/* MESSAGES */}
            <div
              ref={messagesScrollRef}
              className="conversas-chat-area flex-1 overflow-y-auto p-4 custom-scrollbar bg-[var(--cv-chat)] bg-opacity-95"
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
                  messages.map((row: any) => {
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
                        <InstagramMessageBubble row={row} highlightQuery={inChatSearchQuery} />
                      </motion.div>
                    );
                  })
                )}
                <div ref={endOfMessagesRef} />
              </div>
            </div>

            {/* INPUT AREA */}
            <div className="min-h-[62px] bg-[var(--cv-panel)] px-4 py-2 flex items-end gap-2 shrink-0 z-10 w-full">
              <Button
                variant="ghost"
                size="icon"
                className="text-[var(--cv-text-muted)] hover:bg-transparent rounded-full mb-1"
                onClick={() => imgInputRef.current?.click()}
                title="Enviar mídia"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <input
                ref={imgInputRef}
                type="file"
                className="hidden"
                onChange={onPickFile}
                multiple={false}
                accept="image/*,application/pdf"
              />

              <div className="flex-1 bg-[var(--cv-input-bg)] rounded-lg min-h-[42px] mb-1 flex items-center px-3 py-1 border border-[var(--cv-border)]">
                <textarea
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={onTextareaKeyDown}
                  placeholder="Enviar mensagem no Direct..."
                  className="w-full bg-transparent border-none outline-none text-[var(--cv-input-text)] text-sm resize-none custom-scrollbar max-h-[100px] placeholder:text-[var(--cv-text-muted)]"
                  rows={1}
                  style={{ minHeight: '24px' }}
                />
              </div>

              <Button
                onClick={handleSend}
                disabled={!messageInput.trim() || sending}
                className="text-white rounded-full h-10 w-10 p-0 mb-1 flex items-center justify-center shadow-md transition-transform active:scale-95 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#d62976 0%,#962fbf 100%)' }}
                title="Enviar"
              >
                <Send className="h-5 w-5 ml-0.5" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* MEDIA PREVIEW */}
      <AnimatePresence>
        {previewData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[var(--cv-chat)] bg-opacity-95 flex flex-col"
          >
            <div className="h-16 flex items-center justify-between px-4 w-full text-[var(--cv-icon)]">
              <Button variant="ghost" size="icon" onClick={cancelPreview} className="hover:bg-[var(--cv-preview-bar-hover)] rounded-full">
                <ArrowLeft className="w-6 h-6" />
              </Button>
              <h2 className="font-medium text-[var(--cv-text)]">
                Visualizar {previewData.type === 'arquivo' ? 'Arquivo' : 'Imagem'}
              </h2>
              <div className="w-10"></div>
            </div>

            <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
              {previewData.type === 'imagem' ? (
                <img src={`data:${previewData.file.type};base64,${previewData.base64}`} alt="Preview" className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
              ) : (
                <div className="flex flex-col items-center gap-4 text-[var(--cv-text)] p-10 bg-[var(--cv-panel)] rounded-xl border border-[var(--cv-border)]">
                  <div className="w-20 h-20 bg-zinc-600 rounded-full flex items-center justify-center">
                    <Paperclip className="w-10 h-10 text-white" />
                  </div>
                  <p className="font-semibold text-lg max-w-xs truncate" title={previewData.file.name}>
                    {previewData.file.name}
                  </p>
                  <p className="text-sm text-zinc-400">
                    {(previewData.file.size / 1024).toFixed(1)} KB • {previewData.file.type || 'Desconhecido'}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-[var(--cv-panel)] p-3 flex items-center gap-2 justify-center w-full max-w-3xl mx-auto mb-4 rounded-full shadow-lg border border-[var(--cv-border)]">
              <input
                autoFocus
                value={previewData.caption}
                onChange={e => setPreviewData({ ...previewData, caption: e.target.value })}
                placeholder="Adicione uma legenda..."
                className="bg-transparent text-[var(--cv-input-text)] placeholder:text-[var(--cv-text-muted)] w-full outline-none px-4"
                onKeyDown={e => e.key === 'Enter' && sendPreview()}
              />
            </div>

            <div className="flex justify-end px-6 pb-6 w-full max-w-5xl mx-auto">
              <button
                onClick={sendPreview}
                className="text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90"
                style={{ background: 'linear-gradient(135deg,#d62976 0%,#962fbf 100%)' }}
              >
                {busy || sending
                  ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Send className="w-6 h-6 ml-0.5" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SummaryModalAnimated
        isOpen={summaryModal.isOpen}
        onClose={() => setSummaryModal({ isOpen: false, data: null })}
        summaryData={summaryModal.data}
      />
    </div>
  );
}

export default ConversasViewInstagram;
