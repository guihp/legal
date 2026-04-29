import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import {
  MessageCircle, MessageSquare, Search, Send, Paperclip, ArrowLeft,
  MoreVertical, Mic, Plus, AlertCircle, Instagram, Image as ImageIcon, ChevronLeft, ChevronRight,
} from 'lucide-react';
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
import { CRM_KANBAN_STAGE_TITLES, crmStageBadgeClasses } from '@/lib/crmKanbanStages';
import { conversationLabelListBadgeClasses } from '@/lib/conversationContactLabels';
import type { LeadStage } from '@/types/kanban';

/* ---------- utils ---------- */

function formatHour(dateString: string) {
  return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function uploadMediaAndGetPublicUrl(file: File, companyId?: string | null): Promise<string> {
  const bucket = (import.meta as any).env?.VITE_CHAT_MEDIA_BUCKET || 'company-assets';
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const safeCompany = (companyId || 'sem_empresa').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!companyId) throw new Error('company_id ausente para upload da mídia');
  const path = `${safeCompany}/chat-media/instagram/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(`Falha ao subir mídia: ${error.message}`);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const url = String(data?.publicUrl || '').trim();
  if (!url) throw new Error('URL pública da mídia não foi gerada');
  return url;
}

async function convertImageFileToPng(file: File): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Falha ao carregar imagem para conversão'));
      el.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Falha ao criar contexto para conversão PNG');
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao converter imagem para PNG'))), 'image/png');
    });
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.png`, { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
  row: any;
  highlightQuery?: string;
  onOpenMedia?: (images: string[], startIndex: number) => void;
}) {
  const msgType = row.message?.type;
  const isAI = String(msgType || '').toLowerCase() === 'ai';
  const content = row.message?.content ?? '';
  const mediaImages: string[] = row?.mediaImages || [];
  const hq = highlightQuery?.trim();
  const hasImages = mediaImages.length > 0;
  const hasText = Boolean(content);

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
            ? `w-fit max-w-[min(82vw,34rem)] rounded-2xl shadow-sm rounded-tr-sm bg-gradient-to-br from-[#d62976]/20 to-[#962fbf]/20 text-[var(--cv-text)] border border-[#d62976]/20 ${
                hasImages ? 'p-1.5' : 'px-3 py-2'
              }`
            : `w-fit max-w-[min(82vw,34rem)] rounded-2xl shadow-sm rounded-tl-sm bg-[var(--cv-bubble-in)] text-[var(--cv-bubble-in-text)] ${
                hasImages ? 'p-1.5' : 'px-3 py-2'
              }`
        }
      >
        {hasImages && (
          <div
            className={`grid gap-1 overflow-hidden rounded-xl ${!hasText ? '' : 'mb-2'} ${
              mediaImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
            }`}
          >
            {mediaImages.slice(0, 4).map((url, i) => (
              <div
                key={i}
                className={`relative bg-black/10 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${
                  mediaImages.length === 3 && i === 0 ? 'col-span-2' : ''
                } ${mediaImages.length === 1 ? 'max-h-[420px]' : 'aspect-square'}`}
                onClick={() => onOpenMedia?.(mediaImages, i)}
              >
                <img
                  src={url}
                  alt="Mídia IG"
                  loading="lazy"
                  className={`w-full h-full ${mediaImages.length === 1 ? 'object-contain' : 'object-cover'}`}
                />
                {mediaImages.length > 4 && i === 3 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white text-lg font-semibold">+{mediaImages.length - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {textBody}
        <div className={`text-[10px] opacity-60 text-right ${hasText ? 'mt-1' : 'mt-1 pr-1 pb-0.5'}`}>
          {formatHour(row.data)}
        </div>
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
  const [recording, setRecording] = useState(false);
  const [sec, setSec] = useState(0);
  const [recordingLevels, setRecordingLevels] = useState<number[]>(Array.from({ length: 24 }, () => 8));
  const [previewData, setPreviewData] = useState<{
    items: Array<{ file: File; previewUrl: string; type: 'imagem' | 'audio' | 'arquivo'; caption: string }>;
    activeIndex: number;
  } | null>(null);
  const [companyTokenInstagram, setCompanyTokenInstagram] = useState<string | null>(null);
  const [summaryModal, setSummaryModal] = useState<{ isOpen: boolean; data: any }>({ isOpen: false, data: null });
  const [mediaViewer, setMediaViewer] = useState<{ isOpen: boolean; images: string[]; index: number }>({
    isOpen: false,
    images: [],
    index: 0,
  });
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [chatSearchHighlightId, setChatSearchHighlightId] = useState<string | null>(null);

  const imgInputRef = useRef<HTMLInputElement | null>(null);
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

  const setConversationLabel = useCallback(async (sessionId: string, status: 'ai_ativa' | 'humano' | 'humano_solicitado') => {
    if (!profile?.company_id) return;
    const { error } = await supabase
      .from('conversation_contact_labels')
      .upsert(
        {
          company_id: profile.company_id,
          channel: 'instagram',
          session_id: sessionId,
          status,
          updated_by: profile.id || null,
        },
        { onConflict: 'company_id,channel,session_id' }
      );
    if (error) throw error;
    refetchConversas();
  }, [profile?.company_id, profile?.id, refetchConversas]);

  const setConversationCrmStage = useCallback(async (sessionId: string, stage: LeadStage) => {
    const { error } = await supabase.from('leads').update({ stage }).eq('id', sessionId);
    if (error) throw error;
    refetchConversas();
  }, [refetchConversas]);

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
      const mimeCandidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
      const mime = mimeCandidates.find(m => MediaRecorder.isTypeSupported(m)) || '';
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
      const sessionId = selectedConversation;
      mr.onstop = async () => {
        try {
          setBusy(true);
          const resolvedMime = mr.mimeType || mime || 'audio/webm';
          const ext = resolvedMime.includes('mp4') ? 'mp4' : resolvedMime.includes('ogg') ? 'ogg' : 'webm';
          const blob = new Blob(chunksRef.current, { type: resolvedMime });
          const audioFile = new File([blob], `audio-${Date.now()}.${ext}`, { type: resolvedMime });
          const audioUrl = await uploadMediaAndGetPublicUrl(audioFile, companyId);

          await sendPayload({
            session_id: sessionId,
            instancia: targetInstancia,
            tipo: 'audio',
            mensagem: '',
            mime_type: audioFile.type,
            company_id: companyId,
            media_url: audioUrl,
          });

          toast({ title: 'Áudio enviado com sucesso', variant: 'default' });
          refetchMessages();
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

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (!selectedConversation) {
      toast({ title: 'Selecione uma conversa primeiro', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      const items = await Promise.all(
        files.map(async (file) => {
          let normalizedFile = file;
          const tipo: 'imagem' | 'audio' | 'arquivo' = file.type.startsWith('image/') ? 'imagem' : (file.type.startsWith('audio/') ? 'audio' : 'arquivo');
          if (tipo === 'imagem') {
            try {
              normalizedFile = await convertImageFileToPng(file);
            } catch {
              throw new Error(`Nao foi possivel converter a imagem "${file.name}" para PNG`);
            }
          } else if (tipo === 'audio') {
            if (file.type !== 'audio/mp4') throw new Error('Audio deve estar no formato audio/mp4');
          } else if (file.type.startsWith('video/')) {
            if (file.type !== 'video/mp4') throw new Error('Video deve estar no formato video/mp4');
          } else if (file.type === 'application/pdf') {
            // ok
          } else {
            throw new Error('Arquivo deve ser PDF (application/pdf) ou video/mp4');
          }

          return { file: normalizedFile, previewUrl: URL.createObjectURL(normalizedFile), type: tipo, caption: '' };
        })
      );
      setPreviewData({ items, activeIndex: 0 });
    } catch (err: any) {
      toast({ title: 'Erro ao processar arquivo', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
      if (e.target) e.target.value = '';
    }
  };

  const cancelPreview = () => {
    (previewData?.items || []).forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setPreviewData(null);
  };

  const sendPreview = async () => {
    if (!previewData || !selectedConversation) return;
    const targetInstancia = resolveIgInstancia();
    try {
      setBusy(true);
      const uploadedItems = await Promise.all(
        previewData.items.map(async (item) => {
          const uploadedUrl = await uploadMediaAndGetPublicUrl(item.file, profile?.company_id);
          return {
            url: uploadedUrl,
            tipo: item.type,
            mime_type: item.file.type,
            nome: item.file.name,
            caption: item.caption || '',
          };
        })
      );
      const urls = uploadedItems.map((m) => m.url);
      const allSameType = uploadedItems.every((m) => m.tipo === uploadedItems[0]?.tipo);
      const requestType = allSameType ? (uploadedItems[0]?.tipo as 'imagem' | 'audio' | 'arquivo') : 'arquivo';

      await sendPayload({
        session_id: selectedConversation,
        instancia: targetInstancia,
        tipo: requestType,
        mensagem: (uploadedItems[0]?.caption || '').trim() || urls[0] || '',
        caption: uploadedItems[0]?.caption || '',
        mime_type: uploadedItems[0]?.mime_type,
        company_id: profile?.company_id,
        media_url: urls[0],
        mutiplos: uploadedItems.length > 1,
        media_urls: urls,
        midias: uploadedItems,
      });
      (previewData?.items || []).forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
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
              <ContextMenu key={conv.sessionId}>
                <ContextMenuTrigger asChild>
                  <div
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
                    <div className="flex items-center gap-1.5 min-w-0 max-w-[78%] flex-wrap">
                      <h3 className="text-[var(--cv-text)] font-normal truncate text-base max-w-full">
                        {conv.displayName}
                      </h3>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${conversationLabelListBadgeClasses(conv.leadStage)}`}
                      >
                        {conv.leadStage || 'AI ATIVA'}
                      </span>
                      {conv.hasCrmLead ? (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${crmStageBadgeClasses(conv.crmStage || '')}`}
                          title="Estágio no CRM (Kanban)"
                        >
                          {conv.crmStage?.trim() || 'CRM'}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-[var(--cv-text-muted)] whitespace-nowrap">
                      {conv.lastMessageDate ? formatHour(conv.lastMessageDate) : ''}
                    </span>
                  </div>
                  <p className="text-[var(--cv-text-muted)] text-sm truncate">
                    {conv.lastMessageContent || 'Toque para abrir conversa'}
                  </p>
                </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-52">
                  <ContextMenuItem
                    onClick={async () => {
                      try {
                        await setConversationLabel(conv.sessionId, 'humano');
                        toast({ title: 'Etiqueta atualizada para Humano' });
                      } catch (e: any) {
                        toast({ title: 'Erro ao atualizar etiqueta', description: e?.message, variant: 'destructive' });
                      }
                    }}
                  >
                    Marcar como Humano
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={async () => {
                      try {
                        await setConversationLabel(conv.sessionId, 'humano_solicitado');
                        toast({ title: 'Etiqueta atualizada para Humano solicitado' });
                      } catch (e: any) {
                        toast({ title: 'Erro ao atualizar etiqueta', description: e?.message, variant: 'destructive' });
                      }
                    }}
                  >
                    Marcar como Humano solicitado
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={async () => {
                      try {
                        await setConversationLabel(conv.sessionId, 'ai_ativa');
                        toast({ title: 'Etiqueta atualizada para AI ATIVA' });
                      } catch (e: any) {
                        toast({ title: 'Erro ao atualizar etiqueta', description: e?.message, variant: 'destructive' });
                      }
                    }}
                  >
                    Marcar como AI ATIVA
                  </ContextMenuItem>
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
                              await setConversationCrmStage(conv.sessionId, title);
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

            {/* INPUT AREA (paridade com WhatsApp / ConversasViewPremium: emoji, anexo, textarea ou ondas, enviar ou microfone) */}
            <div className="relative z-30 min-h-[62px] bg-[var(--cv-panel)] px-4 py-2 flex items-end gap-2 shrink-0 w-full">
              <Button variant="ghost" size="icon" className="text-[var(--cv-text-muted)] hover:bg-transparent rounded-full mb-1" type="button" title="Emoji">
                <span className="text-xl leading-none">😊</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-[var(--cv-text-muted)] hover:bg-transparent rounded-full mb-1"
                onClick={() => imgInputRef.current?.click()}
                title="Anexar arquivo"
                type="button"
                disabled={recording || busy}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <input
                ref={imgInputRef}
                type="file"
                className="hidden"
                onChange={onPickFile}
                multiple
                accept="image/*,video/mp4,audio/mp4,application/pdf"
              />

              <div className="flex-1 bg-[var(--cv-input-bg)] rounded-lg min-h-[42px] mb-1 flex items-center px-3 py-1 border border-[var(--cv-border)]">
                {recording ? (
                  <div className="w-full flex items-center gap-3 px-1">
                    <span className="text-xs text-red-400 font-medium whitespace-nowrap">
                      Gravando {String(sec).padStart(2, '0')}s
                    </span>
                    <div className="flex items-end gap-[2px] h-8 w-full">
                      {recordingLevels.map((h, i) => (
                        <span
                          key={i}
                          className="w-1 rounded-full bg-red-400/90 transition-all duration-75"
                          style={{ height: `${h}px` }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={onTextareaKeyDown}
                    placeholder="Enviar mensagem no Direct..."
                    className="w-full bg-transparent border-none outline-none text-[var(--cv-input-text)] text-sm resize-none custom-scrollbar max-h-[100px] placeholder:text-[var(--cv-text-muted)]"
                    rows={1}
                    style={{ minHeight: '24px' }}
                    disabled={busy}
                  />
                )}
              </div>

              {messageInput.trim() ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Enviar"
                  disabled={sending || busy || recording}
                  className="shrink-0 text-white rounded-full h-10 w-10 mb-1 shadow-md transition-transform active:scale-95 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#d62976 0%,#962fbf 100%)' }}
                  onMouseDown={e => {
                    if (!sending && !busy && !recording) e.preventDefault();
                  }}
                  onClick={() => void sendText()}
                >
                  <Send className="h-5 w-5 ml-0.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={recording ? stopRecord : () => void startRecord()}
                  disabled={sending || busy}
                  className={`rounded-full h-10 w-10 p-0 mb-1 flex items-center justify-center shadow-md transition-all ${
                    recording
                      ? 'bg-red-500 animate-pulse text-white'
                      : 'bg-[var(--cv-tab-inactive-bg)] hover:bg-[var(--cv-hover-strong)] text-[var(--cv-text-muted)]'
                  } disabled:opacity-50`}
                  title={recording ? 'Parar e enviar áudio' : 'Gravar áudio'}
                >
                  <Mic className="h-5 w-5" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>

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
                Visualizar arquivo{previewData.items.length > 1 ? `s (${previewData.items.length})` : ''}
              </h2>
              <div className="w-10"></div>
            </div>

            <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
              {previewData.items[previewData.activeIndex]?.type === 'imagem' ? (
                <img src={previewData.items[previewData.activeIndex]?.previewUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
              ) : previewData.items[previewData.activeIndex]?.type === 'audio' ? (
                <div className="flex flex-col items-center gap-6 text-[var(--cv-text)] p-8 bg-[var(--cv-panel)] rounded-xl border border-[var(--cv-border)] max-w-md w-full">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#d62976]/40 to-[#962fbf]/40 rounded-full flex items-center justify-center">
                    <Mic className="w-8 h-8 text-white" />
                  </div>
                  <audio
                    src={previewData.items[previewData.activeIndex]?.previewUrl}
                    controls
                    className="w-full max-w-sm"
                    preload="metadata"
                  />
                  <p className="text-xs text-[var(--cv-text-muted)] truncate w-full text-center" title={previewData.items[previewData.activeIndex]?.file.name}>
                    {previewData.items[previewData.activeIndex]?.file.name}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-[var(--cv-text)] p-10 bg-[var(--cv-panel)] rounded-xl border border-[var(--cv-border)]">
                  <div className="w-20 h-20 bg-zinc-600 rounded-full flex items-center justify-center">
                    <Paperclip className="w-10 h-10 text-white" />
                  </div>
                  <p className="font-semibold text-lg max-w-xs truncate" title={previewData.items[previewData.activeIndex]?.file.name}>
                    {previewData.items[previewData.activeIndex]?.file.name}
                  </p>
                  <p className="text-sm text-zinc-400">
                    {((previewData.items[previewData.activeIndex]?.file.size || 0) / 1024).toFixed(1)} KB • {previewData.items[previewData.activeIndex]?.file.type || 'Desconhecido'}
                  </p>
                </div>
              )}
            </div>

            {previewData.items.length > 1 && (
              <div className="w-full max-w-3xl mx-auto px-4 pb-3">
                <div className="flex gap-2 overflow-x-auto">
                  {previewData.items.map((item, idx) => (
                    <button
                      key={`${item.file.name}-${idx}`}
                      onClick={() => setPreviewData({ ...previewData, activeIndex: idx })}
                      className={`h-14 w-14 rounded-md border overflow-hidden shrink-0 ${
                        previewData.activeIndex === idx ? 'border-[#d62976]' : 'border-[var(--cv-border)]'
                      }`}
                      title={item.file.name}
                    >
                      {item.type === 'imagem' ? (
                        <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full grid place-items-center bg-[var(--cv-panel)] text-[10px] text-[var(--cv-text-muted)]">
                          {item.type === 'audio' ? 'AUDIO' : 'ARQ'}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-[var(--cv-panel)] p-3 flex items-center gap-2 justify-center w-full max-w-3xl mx-auto mb-4 rounded-full shadow-lg border border-[var(--cv-border)]">
              <input
                autoFocus
                value={previewData.items[previewData.activeIndex]?.caption || ''}
                onChange={e =>
                  setPreviewData({
                    ...previewData,
                    items: previewData.items.map((item, idx) =>
                      idx === previewData.activeIndex ? { ...item, caption: e.target.value } : item
                    ),
                  })
                }
                placeholder={`Adicione uma legenda para ${previewData.items[previewData.activeIndex]?.file.name || 'a mídia'}...`}
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
