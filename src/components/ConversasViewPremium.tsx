import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import {
  MessageSquare,
  MessageCircle,
  Search,
  Send,
  Paperclip,
  ArrowLeft,
  MoreVertical,
  Phone,
  Video,
  Mic,
  Image as ImageIcon,
  File as FileIcon,
  Edit2,
  Zap,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { useChatInstancesFromMessages } from '@/hooks/useChatInstancesFromMessages';
import {
  mediaPreviewLabel,
  inferMediaKind,
  extractMediaAudio,
  hasChatRenderableMedia,
  resolveConversationListPreview,
  type ConversationPreviewKind,
} from '@/lib/conversaMedia';
import { processTextWithBold } from '@/lib/formatChatMessageText';
import { ConversationListItem } from '@/components/chat/ConversationListItem';
import { ChatContactAvatar } from '@/components/chat/ChatContactAvatar';
import { CRM_KANBAN_STAGE_TITLES } from '@/lib/crmKanbanStages';
import type { LeadStage } from '@/types/kanban';
import { useConversasList } from '@/hooks/useConversasList';
import { useConversaMessages, type ConversaMessage } from '@/hooks/useConversaMessages';
import { mapMensagemWhatsappRow } from '@/lib/mensagensWhatsapp';
import { ChatAudioPlayer } from '@/components/ChatAudioPlayer';
import { ChatImageGrid } from '@/components/ChatImageGrid';
import { groupChatMessagesForDisplay } from '@/lib/groupChatImageMessages';
import {
  finalizeVoiceRecordingForWhatsapp,
  pickVoiceRecorderMimeType,
  WHATSAPP_VOICE_MIME,
} from '@/lib/voiceAudioWhatsapp';
import { useChatComposerMedia } from '@/hooks/useChatComposerMedia';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatMediaPreviewOverlay } from '@/components/chat/ChatMediaPreviewOverlay';
import { ChatMessageMediaBody } from '@/components/chat/ChatMessageMediaBody';
import { insertMensagemOptimistic } from '@/lib/insertMensagemOptimistic';
import {
  insertOptimisticChatMediaRows,
  resolveBatchWebhookTipo,
  uploadAndBuildChatMediaItems,
  toWebhookMidiasPayload,
} from '@/lib/sendChatMediaItems';
import { resolveWebhookMediaMessage } from '@/lib/chatMediaCaption';
import { formatConteudoMediaForDb } from '@/lib/chatMediaStorage';
import { uploadChatMediaAndGetPublicUrl } from '@/lib/uploadChatMedia';
import { useConversasRealtime } from '@/hooks/useConversasRealtime';
import { useConversasUnread } from '@/hooks/useConversasUnread';
import { useMensagensNotifications } from '@/hooks/useMensagensNotifications';
import {
  formatPhoneDisplayBR,
  normalizePhoneDigits,
  normalizePhoneForWhatsAppSession,
} from '@/lib/normalizePhone';
import {
  NewWhatsAppConversationDialog,
  type NewWhatsAppConversationPick,
} from '@/components/chat/NewWhatsAppConversationDialog';
import { ManageChatTemplatesModal } from '@/components/chat/ManageChatTemplatesModal';
import type { ChatTemplate } from '@/hooks/useChatTemplates';
import {
  applyOfficialApiWebhookFields,
  officialApiMetaFromTemplate,
  resolveOfficialApiTemplateForMessage,
} from '@/lib/chatOfficialApiTemplate';
import {
  chatTemplateHasMedia,
  templateMediaLabel,
  webhookTipoFromTemplateMedia,
} from '@/lib/chatTemplateMedia';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { unlockChatNotificationSound } from '@/lib/chatNotificationSound';
import { ConversationActionsMenu } from './ConversationActionsMenu';
import { ChatConversationTextSearchTrigger } from '@/components/ChatConversationTextSearchTrigger';
import { SummaryModalAnimated } from './SummaryModalAnimated';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useCompanyAiLabels } from '@/hooks/useCompanyAiLabels';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LeadViewModal } from './LeadViewModal';
import { useChatTemplates } from '@/hooks/useChatTemplates';
import { useCompanyApiMode } from '@/hooks/useCompanyApiMode';
import { resolveWhatsappSendInstancia } from '@/lib/resolveWhatsappSendInstancia';
import { formatConversationListTime, conversationDayKey, formatChatDaySeparator } from '@/lib/formatConversationListTime';

if ((import.meta as any).env?.DEV) { (window as any).supabase = supabase; }

/** Chave da conversa em Mensagens_Whatsapp (telefone só dígitos). */
function conversationPhoneKey(
  selectedLead: { phone?: string } | null,
  selectedConversation: string | null,
): string | null {
  if (selectedLead?.phone) {
    const p = String(selectedLead.phone).replace(/\D/g, '');
    if (p) return p;
  }
  if (selectedConversation) {
    const p = String(selectedConversation).replace(/\D/g, '');
    if (p) return p;
  }
  return null;
}


function CountdownTimer({ date }: { date: Date | null }) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    if (!date) {
      setTimeLeft(null);
      return;
    }

    const calculate = () => {
      const now = Date.now();
      const diff = now - date.getTime();
      const limit = 24 * 60 * 60 * 1000;
      
      if (diff >= limit) {
        setTimeLeft(null);
      } else {
        const remaining = limit - diff;
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [date]);

  if (!timeLeft) return <span className="text-[10px] text-red-500 font-semibold px-2 py-0.5 border border-red-500/20 rounded-xl bg-red-500/10 ml-2 whitespace-nowrap">Expirado</span>;

  return (
    <span className="text-[11px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-xl flex items-center gap-1 shadow-sm border border-blue-500/20 ml-2 whitespace-nowrap">
      <Clock className="w-3 h-3" /> {timeLeft}
    </span>
  );
}

// Variants de animação exatas
const list = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.03
    }
  }
};

const bubble = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
  highlight: { boxShadow: '0 0 0 2px rgba(125,211,252,.25)' }
};

// Componente de Skeleton exato
const SkeletonCards = () => (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-16 rounded-2xl bg-[var(--cv-panel-muted)]/60 animate-pulse" />
    ))}
  </div>
);

// Empty State para conversas
const EmptyConversas = () => (
  <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-[var(--cv-border)] text-[var(--cv-text-muted)]">
    Selecione uma instância para ver as conversas
  </div>
);

// Empty State para chat
const EmptyChat = () => (
  <div className="grid h-56 place-items-center rounded-2xl border border-dashed border-[var(--cv-border)] text-[var(--cv-text-muted)]">
    Selecione uma conversa para ver as mensagens
  </div>
);

// Função para formatar hora
const formatHour = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Função para formatar data/hora no fuso de Brasília
const formatDateTimeBR = (dateString: string) => {
  return new Date(dateString).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Helper para formatar data/hora no fuso de São Paulo
function formatNowSP(): string {
  const now = new Date();
  const tz = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  }).formatToParts(now);

  const get = (t: string) => tz.find(p => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

// POST helper
async function sendPayload(
  sessionId: string,
  instancia: string,
  tipo: "texto" | "imagem" | "audio" | "video" | "arquivo",
  mensagem: string,
  mimeType?: string,
  caption?: string,
  companyId?: string,
  mediaUrl?: string,
  mutiplos?: boolean,
  mediaUrls?: string[],
  midias?: Array<{ url: string; tipo: string; mime_type?: string; nome?: string; caption?: string }>,
  officialApiMeta?: ReturnType<typeof resolveOfficialApiTemplateForMessage>,
) {
  // Normalizar instância
  const normalizedInstancia = instancia.trim().toLowerCase();

  // Validar instância
  if (!normalizedInstancia) {
    throw new Error("INSTANCE_REQUIRED");
  }

  const body: any = {
    session_id: sessionId,
    instancia: normalizedInstancia,
    channel: "whatsapp",
    company_id: companyId || null,
    tipo,
    mensagem,
    data: formatNowSP()
  };

  // Adicionar mime_type se fornecido
  if (mimeType) {
    body.mime_type = mimeType;
  }

  // Adicionar caption se fornecido
  if (caption) {
    body.caption = caption;
  }
  if (mediaUrl) {
    body.media_url = mediaUrl;
    if (tipo === "imagem") body.image_url = mediaUrl;
    if (tipo === "arquivo") body.file_url = mediaUrl;
    if (tipo === "audio") body.audio_url = mediaUrl;
    if (tipo === "video") body.video_url = mediaUrl;
  }
  if (mutiplos === true) {
    body.mutiplos = true;
  }
  if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
    body.media_urls = mediaUrls;
    body.mutiplos = mediaUrls.length > 1 || body.mutiplos === true;
  }
  if (Array.isArray(midias) && midias.length > 0) {
    body.midias = midias;
    body.mutiplos = midias.length > 1 || body.mutiplos === true;
  }

  applyOfficialApiWebhookFields(body, officialApiMeta);

  const r = await fetch("https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/enviar_mensagem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!r.ok) throw new Error(`Falha ao enviar (${r.status})`);
  try { return await r.json(); } catch { return {}; }
}

async function insertWhatsappMessageRow(params: {
  companyId: string;
  sessionId: string;
  instancia: string;
  mediaUrl: string;
  messageType: "audio" | "image";
  content?: string;
  userId?: string | null;
}): Promise<{ id: string | number } | null> {
  return insertMensagemOptimistic({ ...params, platform: "whatsapp" });
}

// Safe parse helper
const safeParse = (x: any) => {
  let v = x;
  for (let i = 0; i < 2; i++) {
    if (typeof v === 'string') {
      try {
        v = JSON.parse(v);
      } catch {
        break;
      }
    }
  }
  return v;
};

// Validar se base64 está íntegro
function isValidBase64(str: string): boolean {
  try {
    // Verificar se tem caracteres válidos de base64
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) {
      console.log('❌ Base64 contém caracteres inválidos');
      return false;
    }

    // Verificar se o comprimento é múltiplo de 4 (após padding)
    if (str.length % 4 !== 0) {
      console.log('❌ Base64 tem comprimento inválido:', str.length);
      return false;
    }

    // Tentar decodificar para verificar integridade
    const decoded = atob(str);
    if (decoded.length === 0) {
      console.log('❌ Base64 decodifica para string vazia');
      return false;
    }

    console.log('✅ Base64 válido, tamanho decodificado:', decoded.length);
    return true;
  } catch (e) {
    console.log('❌ Erro ao validar base64:', e);
    return false;
  }
}

// Helper para construir Data URL válido a partir da coluna media
function buildDataUrlFromMedia(raw: unknown): string | null {
  console.log('🔧 buildDataUrlFromMedia input:', {
    type: typeof raw,
    value: typeof raw === 'string' ? raw.substring(0, 50) + '...' : raw,
    stringLength: typeof raw === 'string' ? raw.length : 0
  });

  if (typeof raw !== 'string') {
    console.log('❌ Não é string, retornando null');
    return null;
  }

  let s = raw.trim();
  if (!s || s.toLowerCase() === 'null') {
    console.log('❌ String vazia ou null, retornando null');
    return null;
  }

  // já é data URL?
  if (s.startsWith('data:')) {
    console.log('✅ Já é data URL, retornando como está');
    return s;
  }

  // Validar integridade do base64 antes de usar
  if (!isValidBase64(s)) {
    console.log('❌ Base64 inválido, não criando data URL');
    return null;
  }

  // base64 cru → escolher MIME (melhorada detecção de áudio)
  const mime =
    s.startsWith('/9j/') ? 'image/jpeg' :
      s.startsWith('iVBORw0') ? 'image/png' :
        s.startsWith('SUQz') ? 'audio/mpeg' :
          s.startsWith('FF FB') ? 'audio/mpeg' :
            s.startsWith('FF F3') ? 'audio/mpeg' :
              s.startsWith('FF F2') ? 'audio/mpeg' :
                s.startsWith('OggS') ? 'audio/ogg' :
                  s.startsWith('RIFF') ? 'audio/wav' :
                    s.startsWith('GkXf') ? 'audio/webm' :
                      s.includes('webm') ? 'audio/webm;codecs=opus' :
                        s.startsWith('JVBERi0') ? 'application/pdf' :
                          s.startsWith('UEsDBBQ') ? 'application/zip' :
                            // Se não detectou nada específico, tentar áudio como fallback mais provável ou octet-stream
                            'application/octet-stream';

  const result = `data:${mime};base64,${s}`;
  console.log('🔧 Construindo data URL:', {
    mime,
    base64Preview: s.substring(0, 20) + '...',
    base64Length: s.length,
    resultLength: result.length
  });

  return result;
}

function previewFromLast(last_media: any, last_message: any): { kind: ConversationPreviewKind | null; text: string } {
  const raw = last_message;
  const m = typeof raw === 'string' ? ((): any => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
  const txt = String(m?.content ?? '').trim();
  const preview = resolveConversationListPreview({ text: txt, media: last_media });
  const text = preview.text.length > 80 ? `${preview.text.slice(0, 80)}…` : preview.text;
  return { kind: preview.kind, text };
}

// Renderer da mensagem (prioridade: URLs de imagem > base64 > texto)
function MessageBubble({
  row,
  onOpenMedia,
}: {
  row: any;
  onOpenMedia?: (images: string[], startIndex: number) => void;
}) {
  // Parse da mensagem para determinar tipo (AI/human)
  const raw = row?.message;
  const m = typeof raw === 'string' ? ((): any => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
  const isAI = String(m?.type || '').toLowerCase() === 'ai';
  const content =
    typeof m?.content === 'string'
      ? m.content
      : m?.content != null
        ? String(m.content)
        : '';
  const contentSegments = Array.isArray(m?.contentSegments)
    ? m.contentSegments.filter((segment: unknown): segment is string => typeof segment === 'string' && segment.trim().length > 0)
    : [];
  const mediaImages = row?.mediaImages as string[] | undefined;

  const conversaRow: ConversaMessage = {
    id: String(row.id ?? ''),
    sessionId: String(row.sessionId ?? ''),
    instancia: String(row.instancia ?? ''),
    message: { type: isAI ? 'ai' : 'human', content },
    data: row.data,
    media: row.media,
    mediaImages,
    mensageType: row.mensageType ?? row.mensage_type ?? null,
  };

  if (hasChatRenderableMedia(conversaRow)) {
    return (
      <ChatMessageMediaBody
        row={conversaRow}
        isAI={isAI}
        content={content}
        formatHour={formatHour}
        onOpenMedia={onOpenMedia}
      />
    );
  }

  // Base64 / legado
  const dataUrl = buildDataUrlFromMedia(row.media);
  if (dataUrl) {
    const isImage = dataUrl.includes('image/');
    const isAudio = dataUrl.includes('audio/');

    console.log('🎬 Renderizando mídia:', {
      dataUrlLength: dataUrl.length,
      dataUrlPreview: dataUrl.substring(0, 50) + '...',
      isValidDataUrl: dataUrl.startsWith('data:'),
      mediaType: isImage ? 'image' : isAudio ? 'audio' : 'unknown'
    });

    // Componente de Mídia com Fallback
    const MediaComponent = () => {
      const [mediaType, setMediaType] = React.useState<'image' | 'audio' | 'document' | 'error'>(
        isImage ? 'image' : isAudio ? 'audio' : 'document'
      );

      // Renderizar baseado no tipo atual
      if (mediaType === 'image') {
        return (
          <img
            src={dataUrl}
            alt="Imagem enviada"
            className="block max-w-xs md:max-w-sm rounded-lg border border-zinc-600/30"
            loading="lazy"
            onLoad={(e) => {
              console.log('✅ Imagem carregada com sucesso:', e.target);
            }}
            onError={(e) => {
              console.log('❌ Imagem falhou, tentando áudio como fallback');
              setMediaType('audio'); // FALLBACK: tentar áudio
            }}
            style={{
              maxWidth: '100%',
              height: 'auto',
              backgroundColor: 'var(--cv-media-placeholder)'
            }}
          />
        );
      }

      if (mediaType === 'audio') {
        return (
          <ChatAudioPlayer
            src={dataUrl}
            variant="incoming"
            bubbleTone={isAI ? 'out' : 'in'}
            className="py-0.5"
            onError={() => setMediaType('document')}
          />
        );
      }

      if (mediaType === 'document') {
        return (
          <div className="flex items-center gap-3 p-3 bg-zinc-700/50 rounded-lg border border-zinc-600/30 min-w-[200px]">
            <div className="flex-shrink-0 w-10 h-10 bg-zinc-600 rounded-full flex items-center justify-center">
              <span className="text-xl">📄</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-zinc-200 truncate">Arquivo</div>
              <a
                href={dataUrl}
                download={`arquivo-${Date.now()}`}
                className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                Baixar arquivo
              </a>
            </div>
          </div>
        );
      }

      // Fallback final: erro
      return (
        <div className="p-4 text-center text-zinc-400 border border-dashed border-zinc-600 rounded-lg">
          ❌ Erro ao carregar mídia
          <br />
          <small className="text-xs text-zinc-500">
            Arquivo corrompido ou formato não suportado
          </small>
        </div>
      );
    };

    return (
      <div className={cn('shrink-0 max-w-full', isAI ? 'self-end' : 'self-start')}>
        <div
          className={cn(
            'inline-flex flex-col w-fit max-w-[min(100%,320px)] shadow-sm rounded-2xl px-2 pt-2 pb-0.5',
            isAI
              ? 'rounded-tr-sm bg-[var(--cv-bubble-out)] text-[var(--cv-bubble-out-text)]'
              : 'rounded-tl-sm bg-[var(--cv-bubble-in)] text-[var(--cv-bubble-in-text)]',
          )}
        >
          <MediaComponent />
          {row.data ? (
            <div
              className={cn(
                'text-[10px] text-right pr-0.5 pb-0.5 pt-0.5',
                isAI ? 'text-[color:var(--cv-bubble-out-meta)]' : 'text-[color:var(--cv-bubble-in-meta)]',
              )}
            >
              {formatHour(row.data)}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Verificar se há tentativa de mídia base64 mas inválido (ignorar se já processou mediaImages)
  // Só mostrar placeholder se NÃO contiver URLs de imagens (indica que é realmente base64 corrompido)
  const hasImageUrls = row.media && typeof row.media === 'string' && 
    (row.media.includes('https://') || row.media.includes('http://'));
  
  if (row.media && typeof row.media === 'string' && row.media.trim() && 
      row.media.toLowerCase() !== 'null' && !hasImageUrls) {
    console.log('⚠️ Mídia detectada mas base64 inválido, mostrando placeholder');
    return (
      <div className={cn('shrink-0 max-w-full', isAI ? 'self-end' : 'self-start')}>
        <div
          className={cn(
            'inline-flex flex-col w-fit max-w-[min(100%,320px)] shadow-sm rounded-2xl px-2.5 py-2',
            isAI
              ? 'rounded-tr-sm bg-[var(--cv-bubble-out)] text-[var(--cv-bubble-out-text)]'
              : 'rounded-tl-sm bg-[var(--cv-bubble-in)] text-[var(--cv-bubble-in-text)]',
          )}
        >
          <div className="p-4 text-center text-[var(--cv-text-muted)] border border-dashed border-[var(--cv-border)] rounded-lg">
            Mídia indisponível
            <br />
            <small className="text-xs text-zinc-500">Conteúdo da mensagem não pôde ser carregado</small>
          </div>
        </div>
      </div>
    );
  }

  if (contentSegments.length > 1) {
    return (
      <div className={`flex flex-col gap-1 ${isAI ? 'items-end' : 'items-start'}`}>
        {contentSegments.map((segment, index) => (
          <div
            key={`${row.id ?? 'message'}-${index}`}
            className={isAI
              ? 'max-w-[72ch] rounded-lg px-3 py-2 shadow-sm rounded-tr-none bg-[var(--cv-bubble-out)] text-[var(--cv-bubble-out-text)]'
              : 'max-w-[72ch] rounded-lg px-3 py-2 shadow-sm rounded-tl-none bg-[var(--cv-bubble-in)] text-[var(--cv-bubble-in-text)]'}
          >
            <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              {processTextWithBold(segment)}
            </div>
            <div className={`text-[10px] text-right mt-1 -mb-1 ${isAI ? 'text-[color:var(--cv-bubble-out-meta)]' : 'text-[color:var(--cv-bubble-in-meta)]'}`}>
              {row.data ? formatHour(row.data) : ''}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 3) SEM mídia → renderiza apenas texto
  return (
      <div className={isAI ? 'self-end' : 'self-start'}>
      <div className={isAI
        ? 'max-w-[72ch] rounded-lg px-3 py-2 shadow-sm rounded-tr-none bg-[var(--cv-bubble-out)] text-[var(--cv-bubble-out-text)]'
        : 'max-w-[72ch] rounded-lg px-3 py-2 shadow-sm rounded-tl-none bg-[var(--cv-bubble-in)] text-[var(--cv-bubble-in-text)]'}>
        <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
          {processTextWithBold(content)}
        </div>
        <div className={`text-[10px] text-right mt-1 -mb-1 ${isAI ? 'text-[color:var(--cv-bubble-out-meta)]' : 'text-[color:var(--cv-bubble-in-meta)]'}`}>
          {row.data ? formatHour(row.data) : ''}
        </div>
      </div>
    </div>
  );
}

interface ConversasViewPremiumProps { }

export function ConversasViewPremium({ }: ConversasViewPremiumProps) {
  const { profile } = useUserProfile();
  const { labels: aiCatalogLabels } = useCompanyAiLabels();
  const { isOfficialApi } = useCompanyApiMode();
  const { toast } = useToast();
  const controls = useAnimation();
  const isMobile = useIsMobile();

  // Estados
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [summaryModal, setSummaryModal] = useState<{ isOpen: boolean; data: any }>({
    isOpen: false,
    data: null
  });
  const [leads, setLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [showLeads, setShowLeads] = useState(false);
  const [leadMessages, setLeadMessages] = useState<any[]>([]);
  const [loadingLeadMessages, setLoadingLeadMessages] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [viewContactLeadId, setViewContactLeadId] = useState<string | null>(null);
  const [resolvingContactInfo, setResolvingContactInfo] = useState(false);
  const [chatSearchHighlightId, setChatSearchHighlightId] = useState<string | null>(null);
  const [showNewConversationDialog, setShowNewConversationDialog] = useState(false);
  const [sessionOverride, setSessionOverride] = useState<NewWhatsAppConversationPick | null>(null);

  // Hook e estados de Templates de Chat
  const { templates, loading: loadingTemplates, fetchTemplates, addTemplate, updateTemplate, deleteTemplate } = useChatTemplates();
  const [showTemplatesMenu, setShowTemplatesMenu] = useState(false);
  const [filteredTemplates, setFilteredTemplates] = useState<any[]>([]);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [showManageTemplatesModal, setShowManageTemplatesModal] = useState(false);

  // Hook para controlar visualização Mobile
  useEffect(() => {
    if (isMobile) {
      if (selectedConversation || selectedLead) {
        setShowSidebar(false);
      } else {
        setShowSidebar(true);
      }
    } else {
      setShowSidebar(true);
    }
  }, [isMobile, selectedConversation, selectedLead]);

  // Estados para mídia
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sec, setSec] = useState(0);
  const [recordingLevels, setRecordingLevels] = useState<number[]>(Array.from({ length: 24 }, () => 8));

  const composerMedia = useChatComposerMedia({
    surface: "whatsapp",
    hasActiveConversation: Boolean(selectedConversation || selectedLead),
    toast,
  });

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef<boolean>(true);
  const prevConversationRef = useRef<string | null>(null);
  const [lockedOfficialTemplate, setLockedOfficialTemplate] = useState<ChatTemplate | null>(null);

  const [mediaViewer, setMediaViewer] = useState<{ isOpen: boolean; images: string[]; index: number }>({
    isOpen: false,
    images: [],
    index: 0,
  });

  const maxAudioSec = 120;

  const cleanupAudioMeter = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      sourceRef.current?.disconnect();
    } catch {}
    try {
      analyserRef.current?.disconnect();
    } catch {}
    sourceRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setRecordingLevels(Array.from({ length: 24 }, () => 8));
  }, []);



  const clearLockedOfficialTemplate = useCallback(() => {
    setLockedOfficialTemplate(null);
    setMessageInput('');
  }, []);

  // Handlers para Templates
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (lockedOfficialTemplate) return;

    const val = e.target.value;
    setMessageInput(val);
    
    // Mostra o pop-over de atalhos se digitar /
    if (val.includes('/')) {
      const parts = val.split(/(?<=\s|^)\//);
      if (parts.length > 1) {
        const query = parts[parts.length - 1].split(/\s/)[0].toLowerCase();
        
        let validTemplates = templates;
        if (disableFreeText) {
          validTemplates = templates.filter(t => t.is_official_api);
        }
        const filtered = validTemplates.filter(t => t.shortcut.toLowerCase().includes(query) || t.shortcut === '/');
        
        if (filtered.length > 0) {
          setFilteredTemplates(filtered);
          setShowTemplatesMenu(true);
          setSelectedTemplateIndex(0);
        } else {
          setShowTemplatesMenu(false);
        }
      } else {
        setShowTemplatesMenu(false);
      }
    } else {
      setShowTemplatesMenu(false);
    }
  };

  const selectTemplate = (template: ChatTemplate) => {
    if (template.is_official_api) {
      setLockedOfficialTemplate(template);
      setMessageInput(template.message.trim());
      setShowTemplatesMenu(false);
      return;
    }

    setLockedOfficialTemplate(null);
    const lastSlashIndex = messageInput.lastIndexOf('/');
    if (lastSlashIndex >= 0) {
      const prefix = messageInput.substring(0, lastSlashIndex);
      setMessageInput(prefix + template.message + " ");
    } else {
      setMessageInput(template.message + " ");
    }
    setShowTemplatesMenu(false);
  };

  // Hooks de dados
  const { instances, loading: loadingInstances, error: errorInstances, refresh: refetchInstances, scopedInstance, registryInstanceNames } = useChatInstancesFromMessages();
  const { conversas, loading: loadingConversas, error: errorConversas, refetch: refetchConversas, updateConversation } = useConversasList(null);

  const conversasRef = useRef(conversas);
  conversasRef.current = conversas;

  const { getUnreadCount, handleRealtimeMessage, markOpened } = useConversasUnread(
    selectedConversation,
    (sessionId) => conversasRef.current.find((c) => c.sessionId === sessionId)?.leadStage,
    conversas,
  );
  const { messages, loading: loadingMessages, error: errorMessages, openSession, refetch: refetchMessages, setMyInstance } = useConversaMessages();

  // Janela 24h / badge Expirado — só API Oficial (companies.APIOficial)
  const activeMessages = selectedLead ? leadMessages : messages;
  const messagesForChatSearch = useMemo(
    () => (selectedLead ? leadMessages : messages) as Array<{ id: string; message?: { content?: unknown } }>,
    [selectedLead, leadMessages, messages]
  );

  const displayChatItems = useMemo(
    () =>
      groupChatMessagesForDisplay(messages, (row) => {
        const u = buildDataUrlFromMedia(row.media);
        return u?.includes('image/') ? u : null;
      }),
    [messages],
  );

  const displayChatItemsWithDays = useMemo(() => {
    let prevDay = '';
    return displayChatItems.map((item) => {
      const raw = item.kind === 'image_album' ? item.data : item.row.data;
      const dayKey = conversationDayKey(String(raw || ''));
      const dayLabel = dayKey && dayKey !== prevDay ? formatChatDaySeparator(String(raw || '')) : null;
      if (dayKey) prevDay = dayKey;
      return { item, dayLabel };
    });
  }, [displayChatItems]);
  const lastHumanMessage = activeMessages.slice().reverse().find((m: any) => m.message?.type === 'human');
    
  const lastHumanDate = lastHumanMessage ? new Date(lastHumanMessage.data) : null;
  const isPast24Hours = lastHumanDate ? (Date.now() - lastHumanDate.getTime()) > 24 * 60 * 60 * 1000 : false;
  const disableFreeText = Boolean(isOfficialApi && isPast24Hours);



  // Libera áudio após gesto na área de conversas (autoplay dos browsers).
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
      normalizePhoneDigits(sessionId) === normalizePhoneDigits(selectedConversation ?? ''),
    [selectedConversation],
  );

  useMensagensNotifications(profile?.company_id, {
    onIncoming: (sessionId, message) => {
      handleRealtimeMessage(sessionId, message);
      updateConversation(sessionId);
      if (isActiveSession(sessionId)) {
        refetchMessages();
        controls.start('highlight');
        setTimeout(() => controls.start('visible'), 250);
      }
    },
    onOutgoing: (sessionId, message) => {
      handleRealtimeMessage(sessionId, message);
      updateConversation(sessionId);
      if (isActiveSession(sessionId)) {
        refetchMessages();
      }
    },
  });

  // Deletes na lista (INSERT → useMensagensNotifications)
  useConversasRealtime({
    onInstanceUpdate: refetchInstances,
    onConversationUpdate: (sessionId) => {
      updateConversation(sessionId);
    },
    onMessageDelete: (_sessionId) => {
      if (isActiveSession(_sessionId)) {
        refetchMessages();
      }
      refetchConversas();
      refetchInstances();
    },
  });

  // Auto scroll apenas quando:
  // 1. Conversa é selecionada/mudada
  // 2. Usuário já estava no final da conversa (não scrollou para cima)
  useEffect(() => {
    // Se mudou de conversa, fazer scroll e resetar flag
    if (selectedConversation !== prevConversationRef.current) {
      prevConversationRef.current = selectedConversation;
      setLockedOfficialTemplate(null);
      shouldAutoScrollRef.current = true;
      setTimeout(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      }, 100);
      return;
    }
    
    // Só fazer scroll automático se o usuário estava no final
    if (shouldAutoScrollRef.current) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, selectedConversation, leadMessages.length]);

  // Detectar quando o usuário scrolla manualmente
  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;
    // Se o usuário está a menos de 100px do final, permitir auto-scroll
    // Se scrollou para cima, desabilitar auto-scroll
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    shouldAutoScrollRef.current = isNearBottom;
  }, []);

  // Informar instância atual ao hook de mensagens para calcular handoff
  useEffect(() => {
    const eff = selectedInstance || scopedInstance || null;
    setMyInstance(eff ? String(eff).trim().toLowerCase() : null);
  }, [selectedInstance, scopedInstance, setMyInstance]);

  // Conversas filtradas por busca
  const filteredConversas = conversas.filter(conversa =>
    conversa.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (conversa.leadPhone && conversa.leadPhone.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const displayConversas = useMemo(() => {
    if (!sessionOverride?.sessionId) return filteredConversas;
    const norm = normalizePhoneDigits(sessionOverride.sessionId);
    const exists = filteredConversas.some(
      (c) => normalizePhoneDigits(c.sessionId) === norm,
    );
    if (exists) return filteredConversas;
    const draft = {
      sessionId: norm,
      instancia: selectedInstance || scopedInstance || '',
      displayName: sessionOverride.displayName,
      leadPhone: sessionOverride.leadPhone,
      leadId: sessionOverride.leadId ?? null,
      leadStage: 'AI ATIVA' as const,
      crmStage: null,
      hasCrmLead: Boolean(sessionOverride.leadId),
      profilePicUrlWhatsapp: null,
      lastMessageDate: new Date().toISOString(),
      messageCount: 0,
      lastMessageContent: 'Nova conversa',
      lastMessagePreviewKind: null,
      lastMessageType: 'human' as const,
    };
    return [draft, ...filteredConversas];
  }, [filteredConversas, sessionOverride, selectedInstance, scopedInstance]);

  const handleStartNewConversation = useCallback(
    (pick: NewWhatsAppConversationPick) => {
      const sessionId = normalizePhoneForWhatsAppSession(pick.sessionId);
      if (!sessionId || sessionId.length < 10) {
        toast({
          title: 'Telefone inválido',
          description: 'Informe um número com DDD válido.',
          variant: 'destructive',
        });
        return;
      }

      if (!selectedInstance && !scopedInstance && instances.length > 0) {
        setSelectedInstance(instances[0].name);
      }

      const existing = conversas.find(
        (c) => normalizePhoneDigits(c.sessionId) === normalizePhoneDigits(sessionId),
      );

      setShowNewConversationDialog(false);
      setSelectedLead(null);
      setLeadMessages([]);

      if (existing) {
        setSessionOverride(null);
        setSelectedConversation(existing.sessionId);
        void openSession(existing.sessionId);
        markOpened(existing.sessionId, existing.leadStage ?? 'AI ATIVA');
      } else {
        setSessionOverride({
          sessionId,
          displayName: pick.displayName,
          leadPhone: sessionId,
          leadId: pick.leadId ?? null,
        });
        setSelectedConversation(sessionId);
        void openSession(sessionId);
        markOpened(sessionId, 'AI ATIVA');
      }

      setSearchQuery('');
      if (isMobile) setShowSidebar(false);
    },
    [
      conversas,
      instances,
      selectedInstance,
      scopedInstance,
      toast,
      openSession,
      markOpened,
      isMobile,
    ],
  );

  const setConversationLabel = useCallback(async (sessionId: string, status: string) => {
    if (!profile?.company_id) return;
    const { error } = await supabase
      .from('conversation_contact_labels')
      .upsert(
        {
          company_id: profile.company_id,
          channel: 'whatsapp',
          session_id: sessionId,
          status,
          updated_by: profile.id || null,
        },
        { onConflict: 'company_id,channel,session_id' }
      );

    if (error) throw error;
    refetchConversas();
  }, [profile?.company_id, profile?.id, refetchConversas]);

  /** Atualiza estágio do CRM (`leads.stage`) pelo lead vinculado à conversa (telefone). */
  const setConversationCrmStage = useCallback(async (sessionId: string, stage: LeadStage) => {
    const conv = conversas.find((c) => c.sessionId === sessionId);
    if (conv?.leadId) {
      const { error } = await supabase.from('leads').update({ stage }).eq('id', conv.leadId);
      if (error) throw error;
    } else if (profile?.company_id) {
      const phoneNorm = String(sessionId).replace(/\D/g, '');
      const { data: leads } = await supabase
        .from('leads')
        .select('id, phone')
        .eq('company_id', profile.company_id);
      const match = (leads || []).find(
        (l) => l.phone && String(l.phone).replace(/\D/g, '') === phoneNorm,
      );
      if (!match?.id) throw new Error('Lead não encontrado para este telefone');
      const { error } = await supabase.from('leads').update({ stage }).eq('id', match.id);
      if (error) throw error;
    } else {
      throw new Error('Empresa não identificada');
    }
    refetchConversas();
  }, [refetchConversas, conversas, profile?.company_id]);

  // Conversa atual (lista, rascunho nova conversa ou lead legado)
  const currentConversation = useMemo(() => {
    const sessionKey = selectedLead
      ? normalizePhoneDigits(String(selectedLead.phone ?? ''))
      : normalizePhoneDigits(selectedConversation ?? '');
    if (!sessionKey) return undefined;

    const fromList = conversas.find(
      (c) => normalizePhoneDigits(c.sessionId) === sessionKey,
    );
    if (fromList) return fromList;

    if (
      sessionOverride &&
      normalizePhoneDigits(sessionOverride.sessionId) === sessionKey
    ) {
      return {
        sessionId: sessionKey,
        instancia: selectedInstance || scopedInstance || '',
        displayName: sessionOverride.displayName,
        leadPhone: sessionOverride.leadPhone,
        leadId: sessionOverride.leadId ?? null,
        leadStage: 'AI ATIVA',
        crmStage: null,
        hasCrmLead: Boolean(sessionOverride.leadId),
        profilePicUrlWhatsapp: null,
        lastMessageDate: new Date().toISOString(),
        messageCount: 0,
        lastMessageContent: 'Nova conversa',
        lastMessagePreviewKind: null,
        lastMessageType: 'human' as const,
      };
    }

    if (selectedLead) {
      return {
        sessionId: sessionKey,
        instancia: selectedInstance || scopedInstance || '',
        displayName: String(selectedLead.name ?? '').trim() || formatPhoneDisplayBR(sessionKey),
        leadPhone: sessionKey,
        leadId: selectedLead.id ?? null,
        leadStage: 'AI ATIVA',
        crmStage: null,
        hasCrmLead: Boolean(selectedLead.id),
        profilePicUrlWhatsapp: null,
        lastMessageDate: new Date().toISOString(),
        messageCount: 0,
        lastMessageContent: '',
        lastMessagePreviewKind: null,
        lastMessageType: 'human' as const,
      };
    }

    return undefined;
  }, [
    conversas,
    selectedConversation,
    selectedLead,
    sessionOverride,
    selectedInstance,
    scopedInstance,
  ]);

  const openContactInfo = useCallback(async () => {
    if (resolvingContactInfo) return;

    const directId = selectedLead?.id ?? currentConversation?.leadId;
    if (directId) {
      setViewContactLeadId(String(directId));
      return;
    }

    const phoneRaw =
      currentConversation?.leadPhone ||
      selectedLead?.phone ||
      (selectedConversation ? String(selectedConversation) : '');
    const phoneNorm = String(phoneRaw || '').replace(/\D/g, '');

    if (!phoneNorm || !profile?.company_id) {
      toast({
        title: 'Lead não encontrado no CRM',
        description: 'Este contato ainda não está vinculado a um lead.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setResolvingContactInfo(true);
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, phone')
        .eq('company_id', profile.company_id);
      if (error) throw error;

      const match = (leads || []).find(
        (l) => l.phone && String(l.phone).replace(/\D/g, '') === phoneNorm,
      );

      if (match?.id) {
        setViewContactLeadId(String(match.id));
      } else {
        toast({
          title: 'Lead não encontrado no CRM',
          description: 'Cadastre o contato em Clientes para ver o perfil completo.',
          variant: 'destructive',
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao buscar lead';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setResolvingContactInfo(false);
    }
  }, [
    resolvingContactInfo,
    selectedLead,
    currentConversation,
    selectedConversation,
    profile?.company_id,
    toast,
  ]);

  // Função para buscar mensagens do lead
  const fetchLeadMessages = async (lead: any) => {
    if (!lead?.phone || !profile?.company_id) {
      toast({
        title: "Dados insuficientes",
        description: "Telefone do lead ou empresa não encontrado",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoadingLeadMessages(true);
      setSelectedLead(lead);
      setLeadMessages([]);

      const leadPhoneClean = lead.phone.replace(/[^0-9]/g, '');
      if (!leadPhoneClean) {
        throw new Error('Telefone do lead inválido');
      }

      const { data: messagesData, error: messagesError } = await (supabase.rpc as any)(
        'mensagens_whatsapp_thread',
        {
          p_company_id: profile.company_id,
          p_phone: leadPhoneClean,
          p_plataforma: 'WhatsApp',
          p_limit: 500,
          p_offset: 0,
        },
      );

      if (messagesError) {
        console.error('[ConversasViewPremium] Erro ao buscar mensagens:', messagesError);
        throw messagesError;
      }

      const messagesArray = Array.isArray(messagesData) ? messagesData : [];
      const filteredMessages = messagesArray
        .map((row: any) => mapMensagemWhatsappRow(row))
        .sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime());

      setLeadMessages(filteredMessages);
    } catch (err: any) {
      console.error('[ConversasViewPremium] Erro ao buscar mensagens do lead:', err);
      toast({
        title: "Erro ao carregar mensagens",
        description: err?.message || "Erro desconhecido",
        variant: "destructive",
      });
      setLeadMessages([]);
    } finally {
      setLoadingLeadMessages(false);
    }
  };

  // Handlers
  const handleGenerateSummary = async (conversation: any) => {
    let targetInstancia: string;
    try {
      targetInstancia = resolveTargetInstancia();
    } catch {
      toast({
        title: "Selecione uma instância antes de gerar resumo",
        variant: "destructive",
      });
      return;
    }

    try {
      setSummaryModal({ isOpen: true, data: { loading: true } });

      const response = await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/resumo_conversa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: conversation.sessionId,
          instancia: targetInstancia,
          company_id: profile?.company_id || '',
          user_email: profile?.email || '',
          role: profile?.role || '',
          plataforma: 'WhatsApp',
          rota: 'whatsapp',
        }),
      });

      const result = await response.json();
      const item = Array.isArray(result) ? result[0] : result;
      let summaryData;

      if (item && item.output) {
        summaryData = typeof item.output === 'string' ? JSON.parse(item.output) : item.output;
      } else {
        summaryData = item || result;
      }

      setSummaryModal({ isOpen: true, data: summaryData });
    } catch (error) {
      setSummaryModal({ isOpen: true, data: { error: true } });
    }
  };

  const handleFollowUp = async (conversation: any) => {
    let targetInstancia: string;
    try {
      targetInstancia = resolveTargetInstancia();
    } catch {
      toast({
        title: "Selecione uma instância antes de fazer follow up",
        variant: "destructive",
      });
      return;
    }

    try {
      await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/follow-up-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: conversation.sessionId,
          instancia: targetInstancia,
          company_id: profile?.company_id || '',
          user_email: profile?.email || '',
          role: profile?.role || '',
          plataforma: 'WhatsApp',
          rota: 'whatsapp',
        }),
      });

      toast({
        title: "Follow up solicitado",
        description: "Follow up solicitado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao solicitar follow up.",
        variant: "destructive",
      });
    }
  };

  const resolveTargetInstancia = useCallback(() => {
    return resolveWhatsappSendInstancia({
      selectedInstance,
      conversationInstancia: currentConversation?.instancia,
      scopedInstance,
      instances,
      registryInstanceNames,
      isOfficialApi,
    });
  }, [
    selectedInstance,
    currentConversation?.instancia,
    scopedInstance,
    instances,
    registryInstanceNames,
    isOfficialApi,
  ]);

  // Seleciona automaticamente a instância conectada (empresas sem API Oficial)
  useEffect(() => {
    if (isOfficialApi || selectedInstance || instances.length === 0) return;
    const preferred =
      instances.find((i) => i.status === 'connected')?.name ||
      instances[0]?.name ||
      registryInstanceNames[0] ||
      null;
    if (preferred) setSelectedInstance(preferred);
  }, [isOfficialApi, selectedInstance, instances, registryInstanceNames]);

  const sendPreview = async () => {
    if (!composerMedia.previewData || busy) return;

    const itemsSnapshot = composerMedia.previewData.items;
    const itemCount = itemsSnapshot.length;

    try {
      setBusy(true);

      const targetSession = conversationPhoneKey(selectedLead, selectedConversation);
      const targetInstancia = resolveTargetInstancia();

      if (!targetSession) throw new Error("Sessão inválida");

      const uploadedItems = await uploadAndBuildChatMediaItems(
        itemsSnapshot.map((item) => ({
          file: item.file,
          type: item.type,
          caption: item.caption || "",
        })),
        "whatsapp",
        profile?.company_id,
      );
      const urls = uploadedItems.map((m) => m.url);
      const requestType = resolveBatchWebhookTipo(uploadedItems);
      const primary = uploadedItems[0];
      const webhookMessage = resolveWebhookMediaMessage(primary?.caption, urls[0]);

      if (profile?.company_id) {
        await insertOptimisticChatMediaRows({
          companyId: profile.company_id,
          sessionId: targetSession,
          instancia: targetInstancia,
          platform: "whatsapp",
          items: uploadedItems,
          userId: profile.id,
        });
      }

      sendPayload(
        targetSession,
        targetInstancia,
        requestType,
        webhookMessage,
        primary?.mime_type,
        primary?.caption || "",
        profile?.company_id,
        urls[0],
        uploadedItems.length > 1,
        urls,
        toWebhookMidiasPayload(uploadedItems)
      ).catch((err: any) => {
        console.error("[media] webhook falhou:", err);
        if (err?.message === "INSTANCE_REQUIRED") {
          toast({
            title: "Selecione uma instância antes de enviar",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Falha ao encaminhar ao WhatsApp",
            description: err?.message || "A mídia foi salva no chat, mas o envio externo falhou.",
            variant: "destructive",
          });
        }
      });

      toast({
        title: itemCount > 1 ? `${itemCount} arquivos enviados com sucesso` : "Arquivo enviado com sucesso",
        variant: "default",
      });

      composerMedia.clearPreview();

      if (selectedLead) {
        fetchLeadMessages(selectedLead);
        setTimeout(() => fetchLeadMessages(selectedLead), 2000);
      } else {
        refetchMessages();
        refetchConversas();
        setTimeout(() => {
          refetchMessages();
          refetchConversas();
        }, 2000);
      }
    } catch (err: any) {
      console.error("Erro ao enviar mídia:", err);
      toast({
        title: "Falha ao enviar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  // TEXT / template oficial (com ou sem mídia)
  const sendText = async () => {
    const val = messageInput.trim();
    const tpl = lockedOfficialTemplate;
    if (!val && !chatTemplateHasMedia(tpl)) return;
    if (!selectedConversation && !selectedLead) return;

    const officialApiMeta = tpl?.is_official_api
      ? officialApiMetaFromTemplate(tpl)
      : resolveOfficialApiTemplateForMessage(val, templates, tpl);

    if (disableFreeText && !officialApiMeta) {
      toast({
        title: "Operação Bloqueada",
        description: "Sessão expirada. Apenas templates aprovados na API Oficial podem ser enviados.",
        variant: "destructive",
      });
      return;
    }

    try {
      setBusy(true);
      const targetSession = conversationPhoneKey(selectedLead, selectedConversation);
      const targetInstancia = resolveTargetInstancia();

      if (!targetSession) throw new Error("Sessão inválida");

      if (tpl && chatTemplateHasMedia(tpl) && tpl.media_url && tpl.media_type) {
        const caption = val || String(tpl.message ?? '').trim();
        const webhookTipo = webhookTipoFromTemplateMedia(tpl.media_type);
        const webhookMessage = resolveWebhookMediaMessage(caption, tpl.media_url);
        await sendPayload(
          targetSession,
          targetInstancia,
          webhookTipo,
          webhookMessage,
          tpl.media_mime_type ?? undefined,
          caption && caption !== webhookMessage ? caption : undefined,
          profile?.company_id,
          tpl.media_url,
          undefined,
          undefined,
          undefined,
          officialApiMeta,
        );
      } else {
        await sendPayload(
          targetSession,
          targetInstancia,
          "texto",
          val,
          undefined,
          undefined,
          profile?.company_id,
          undefined,
          undefined,
          undefined,
          undefined,
          officialApiMeta,
        );
      }
      setMessageInput("");
      setLockedOfficialTemplate(null);

      if (selectedLead) {
        fetchLeadMessages(selectedLead);
        setTimeout(() => fetchLeadMessages(selectedLead), 2000);
      } else {
        refetchMessages();
        refetchConversas();
        setTimeout(() => {
          refetchMessages();
          refetchConversas();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Erro ao enviar texto:', err);
      if (err?.message === 'INSTANCE_REQUIRED') {
        toast({
          title: 'Selecione uma instância WhatsApp',
          description: 'Conecte o WhatsApp em Conexões ou escolha a instância no topo do chat.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: "Erro ao enviar mensagem",
          description: err?.message || "Erro desconhecido",
          variant: "destructive"
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (lockedOfficialTemplate) {
      if (e.key === 'Escape') {
        e.preventDefault();
        clearLockedOfficialTemplate();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!busy) void sendText();
        return;
      }
      if (e.key !== 'Tab') {
        e.preventDefault();
      }
      return;
    }

    if (showTemplatesMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedTemplateIndex(prev => (prev + 1) % filteredTemplates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedTemplateIndex(prev => (prev - 1 + filteredTemplates.length) % filteredTemplates.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        selectTemplate(filteredTemplates[selectedTemplateIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowTemplatesMenu(false);
        return;
      }
    }

    if ((e.key === "Enter" && !e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) {
      e.preventDefault();
      if (!busy) {
        sendText();
      }
    }
  };

  // AUDIO (MediaRecorder)
  const startRecord = async () => {
    try {
      if (recording) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Seu navegador nao suporta captura de microfone");
      }
      if (typeof MediaRecorder === "undefined") {
        throw new Error("Seu navegador nao suporta gravacao de audio");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickVoiceRecorderMimeType();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);

      // Medidor de áudio (ondas em tempo real estilo WhatsApp)
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
            setRecordingLevels((prev) => [...prev.slice(1), h]);
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        }
      } catch (meterErr) {
        console.warn("Medidor de audio indisponivel, continuando gravacao sem ondas:", meterErr);
      }

      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        try {
          setBusy(true);
          const resolvedMime = mr.mimeType || mime || "audio/webm";
          const audioFile = await finalizeVoiceRecordingForWhatsapp(chunksRef.current, resolvedMime);
          const audioUrl = await uploadChatMediaAndGetPublicUrl(
            audioFile,
            "whatsapp",
            "audio",
            profile?.company_id,
          );

          const targetSession = conversationPhoneKey(selectedLead, selectedConversation);
          let targetInstancia: string;
          try {
            targetInstancia = resolveTargetInstancia();
          } catch {
            throw new Error('INSTANCE_REQUIRED');
          }

          if (targetSession) {

            // Insert otimista direto na tabela imobipro_messages_{phone}.
            // Faz a bolha aparecer imediatamente via realtime/polling
            // sem depender da resposta do n8n. Em caso de erro, o webhook
            // continua sendo a fonte de verdade.
            if (profile?.company_id) {
              const inserted = await insertWhatsappMessageRow({
                companyId: profile.company_id,
                sessionId: targetSession,
                instancia: targetInstancia,
                mediaUrl: formatConteudoMediaForDb("audio", audioUrl),
                messageType: "audio",
                content: "",
                userId: profile.id,
              });
              if (!inserted) {
                console.warn("[audio] insert otimista falhou; continuando via webhook");
              }
            }

            // Webhook em fire-and-forget para o n8n encaminhar ao WhatsApp.
            // Nao bloqueia a UI: a bolha local ja esta aparecendo via insert.
            sendPayload(
              targetSession,
              targetInstancia,
              "audio",
              "",
              WHATSAPP_VOICE_MIME,
              undefined,
              profile?.company_id,
              audioUrl
            ).catch((err: any) => {
              console.error("[audio] webhook falhou:", err);
              if (err?.message === "INSTANCE_REQUIRED") {
                toast({
                  title: "Selecione uma instância antes de enviar",
                  variant: "destructive",
                });
              } else {
                toast({
                  title: "Falha ao encaminhar áudio",
                  description: "Áudio gravado localmente, mas o envio ao WhatsApp falhou.",
                  variant: "destructive",
                });
              }
            });

            toast({
              title: "Áudio enviado com sucesso",
              variant: "default",
            });
            // Refetch unico imediato; realtime + polling ja existentes
            // cobrem qualquer atualizacao posterior. setTimeout removido.
            if (selectedLead) {
              fetchLeadMessages(selectedLead);
            } else {
              refetchMessages();
              refetchConversas();
            }
          }
        } catch (err: any) {
          console.error('Erro ao enviar áudio:', err);
          if (err.message === "INSTANCE_REQUIRED") {
            toast({
              title: "Selecione uma instância antes de enviar",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Falha ao enviar áudio",
              variant: "destructive",
            });
          }
        } finally {
          // cleanup
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
        setSec((s) => {
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
        title: "Nao foi possivel iniciar a gravacao",
        description: err?.message || "Permissao de microfone negada ou indisponivel",
        variant: "destructive",
      });
    }
  };

  const stopRecord = () => {
    try {
      const rec = recRef.current;
      if (rec?.state === "recording") {
        // Atualiza UI imediatamente para nao parecer que o botao "nao clicou"
        // enquanto upload/insert/webhook ainda rodam no onstop.
        setRecording(false);
        setSec(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        cleanupAudioMeter();
        try { rec.requestData(); } catch { }
        rec.stop();
      }
    } catch (err) {
      console.error('Erro ao parar gravação:', err);
    }
  };

  const handleSendMessage = () => {
    sendText();
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
    // Ajuste de altura para compensar o layout pai (sidebar/header) e padding (aprox 7rem / 112px)
    <div className="h-[calc(100vh-7rem)] bg-[var(--cv-shell)] text-[var(--cv-text)] overflow-hidden flex relative rounded-2xl shadow-xl ring-1 ring-[var(--cv-ring)]">
      {/* SIDEBAR (Lista de Conversas) */}
      <div
        className={`conversas-list-panel ${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-[400px] flex-col border-r border-[var(--cv-border)] bg-[var(--cv-shell)] relative z-30 shrink-0`}
      >
        {/* HEADER SIDEBAR */}
        <div className="h-[60px] bg-[var(--cv-panel)] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-semibold text-[var(--cv-text)] text-sm md:text-base">Conversas</h1>
          </div>
          <div className="flex gap-3 text-[var(--cv-icon)]">
            <MessageSquare className="w-5 h-5 cursor-pointer" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded p-0.5 hover:text-[var(--cv-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cv-accent)]"
                  aria-label="Menu de conversas"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[var(--cv-panel)] border-[var(--cv-border)]">
                <DropdownMenuItem
                  className="cursor-pointer focus:bg-[var(--cv-hover)]"
                  onClick={() => setShowNewConversationDialog(true)}
                >
                  Nova conversa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <NewWhatsAppConversationDialog
            open={showNewConversationDialog}
            onOpenChange={setShowNewConversationDialog}
            companyId={profile?.company_id ?? null}
            userId={profile?.id ?? null}
            userRole={profile?.role}
            onStart={handleStartNewConversation}
          />
        </div>

        {/* SEARCH & FILTER */}
        <div className="p-2 border-b border-[var(--cv-border)]">
          <div className="bg-[var(--cv-search-bg)] rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Search className="w-4 h-4 text-[var(--cv-text-muted)]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar ou começar uma nova..."
              className="bg-transparent border-none outline-none text-sm text-[var(--cv-input-text)] w-full placeholder:text-[var(--cv-text-muted)]"
            />
          </div>
        </div>

        {/* INSTANCES LIST — só quando há mais de uma (envio); lista de chats é por empresa/cliente */}
        {instances.length > 1 ? (
        <div className="py-2 px-3 border-b border-[var(--cv-border)] overflow-x-auto whitespace-nowrap custom-scrollbar">
          {instances?.map((inst: any) => (
            <button
              key={inst.name}
              onClick={() => {
                setSelectedInstance(inst.name);
                setSelectedConversation(null);
                setSelectedLead(null);
              }}
              className={`inline-block px-3 py-1 text-xs rounded-full mr-2 transition-colors border ${selectedInstance === inst.name
                ? "bg-[var(--cv-tab-active-bg)] text-[var(--cv-tab-active-text)] border-[var(--cv-tab-active-bg)]"
                : "bg-[var(--cv-tab-inactive-bg)] text-[var(--cv-tab-inactive-text)] border-transparent hover:bg-[var(--cv-hover)]"
                }`}
            >
              {inst.name}
            </button>
          ))}
        </div>
        ) : null}

        {/* CHAT LIST */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loadingConversas && displayConversas.length === 0 ? (
            <div className="p-4 text-center text-[var(--cv-text-muted)] text-sm">
              Carregando conversas…
            </div>
          ) : displayConversas.length === 0 ? (
            <div className="p-4 text-center text-[var(--cv-text-muted)] text-sm">
              Nenhuma conversa encontrada.
            </div>
          ) : (
            displayConversas.map((conv: any) => (
              <ContextMenu key={conv.sessionId}>
                <ContextMenuTrigger asChild>
                  <ConversationListItem
                    selected={
                      normalizePhoneDigits(selectedConversation ?? '') ===
                      normalizePhoneDigits(conv.sessionId)
                    }
                    onClick={() => {
                      setSessionOverride(null);
                      setSelectedConversation(conv.sessionId);
                      openSession(conv.sessionId);
                      setSelectedLead(null);
                      markOpened(conv.sessionId, conv.leadStage);
                    }}
                    unreadCount={getUnreadCount(conv.sessionId)}
                    displayName={conv.displayName}
                    leadStage={conv.leadStage}
                    labelColor={conv.labelColor}
                    crmStage={conv.crmStage}
                    hasCrmLead={conv.hasCrmLead}
                    timeLabel={conv.lastMessageDate ? formatConversationListTime(conv.lastMessageDate) : undefined}
                    previewKind={conv.lastMessagePreviewKind}
                    previewText={conv.lastMessageContent}
                    avatar={
                      <ChatContactAvatar
                        displayName={conv.displayName}
                        profilePicUrl={conv.profilePicUrlWhatsapp}
                      />
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
      <div className={`conversas-chat-shell ${!showSidebar ? 'flex' : 'hidden md:flex'} flex-1 flex-col relative w-full h-full`}>
        {!selectedConversation && !selectedLead ? (
          <div className="relative z-[1] flex-1 flex flex-col items-center justify-center text-center p-8 border-b-[6px] border-[var(--cv-accent)]">
            <div className="max-w-[560px]">

              <h2 className="text-3xl font-light text-[var(--cv-text)] mb-5">
                Gerencie suas conversas
              </h2>
              <p className="text-[var(--cv-text-muted)] text-sm leading-6">
                Selecione uma conversa para ver as mensagens.
              </p>
            </div>
            <div className="absolute bottom-10 flex items-center gap-2 text-[var(--cv-text-muted)] text-xs">
              <span className="opacity-80">Protegido com criptografia de ponta a ponta</span>
            </div>
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div className="h-[60px] bg-[var(--cv-panel)] px-4 flex items-center justify-between shadow-sm shrink-0 z-10 w-full">
              <div className="flex items-center gap-3 overflow-hidden">
                <Button variant="ghost" size="icon" className="md:hidden text-[var(--cv-icon)] mr-1" onClick={() => {
                  setShowSidebar(true);
                  setSelectedConversation(null);
                  setSelectedLead(null);
                  setSessionOverride(null);
                }}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <button
                  type="button"
                  onClick={() => void openContactInfo()}
                  disabled={resolvingContactInfo}
                  className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden ring-offset-2 ring-offset-[var(--cv-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cv-accent)] disabled:opacity-60"
                  title="Ver informações do contato"
                  aria-label="Ver informações do contato"
                >
                  <ChatContactAvatar
                    displayName={
                      currentConversation?.displayName ||
                      sessionOverride?.displayName ||
                      selectedLead?.name ||
                      undefined
                    }
                    profilePicUrl={currentConversation?.profilePicUrlWhatsapp}
                    iconClassName="h-5 w-5"
                  />
                </button>
                <div className="flex flex-col overflow-hidden min-w-0">
                  <div className="flex items-center overflow-hidden gap-2">
                    <button
                      type="button"
                      onClick={() => void openContactInfo()}
                      disabled={resolvingContactInfo}
                      title="Ver informações do contato"
                      className="text-[var(--cv-text)] font-semibold text-base truncate text-left hover:text-[var(--cv-accent)] focus-visible:outline-none focus-visible:underline disabled:opacity-60 min-w-0"
                    >
                      {currentConversation?.displayName ||
                        sessionOverride?.displayName ||
                        selectedLead?.name ||
                        (selectedConversation ? formatPhoneDisplayBR(selectedConversation) : '')}
                    </button>
                    {isOfficialApi && <CountdownTimer date={lastHumanDate} />}
                  </div>
                  <p className="text-xs text-[var(--cv-text-muted)] truncate">
                    {currentConversation?.leadPhone ||
                      sessionOverride?.leadPhone ||
                      selectedLead?.phone ||
                      (selectedConversation ? formatPhoneDisplayBR(selectedConversation) : '')}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 items-center text-[var(--cv-icon)]">
                <ChatConversationTextSearchTrigger
                  messages={messagesForChatSearch}
                  scrollRootRef={messagesContainerRef}
                  onActiveMatchChange={setChatSearchHighlightId}
                  triggerButtonClassName="h-9 w-9 shrink-0 text-[var(--cv-icon)] hover:text-[var(--cv-text)] hover:bg-[var(--cv-hover)]"
                />
                {currentConversation && (
                  <ConversationActionsMenu
                    conversation={currentConversation}
                    onGenerateSummary={handleGenerateSummary}
                    onFollowUp={handleFollowUp}
                    triggerClassName="text-[var(--cv-icon)] hover:text-[var(--cv-text)] hover:bg-[var(--cv-hover)] h-9 w-9 p-0"
                  />
                )}
              </div>
            </div>

            {/* MESSAGES */}
            <div
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              className="conversas-chat-area flex-1 overflow-y-auto p-4 custom-scrollbar"
            >
              <div className="space-y-2 pb-2">
                {/* LEAD MESSAGES */}
                {selectedLead && leadMessages.map((msg: any) => {
                  const isHit = chatSearchHighlightId === String(msg.id);
                  return (
                    <motion.div
                      key={msg.id}
                      data-chat-message-id={msg.id}
                      variants={bubble}
                      layout
                      initial="hidden"
                      animate="visible"
                      className={isHit ? 'rounded-lg ring-2 ring-yellow-400/70 ring-offset-2 ring-offset-[var(--cv-chat)]' : ''}
                    >
                      <MessageBubble row={msg} onOpenMedia={openMediaViewer} />
                    </motion.div>
                  );
                })}

                {/* CONVERSATION MESSAGES (álbuns de imagem agrupados estilo WhatsApp) */}
                {!selectedLead && displayChatItemsWithDays.map(({ item, dayLabel }) => {
                  const daySep = dayLabel ? (
                    <div className="flex justify-center py-3">
                      <span className="rounded-full bg-[var(--cv-panel)] px-3.5 py-1.5 text-[12px] font-semibold capitalize tracking-wide text-[var(--cv-text)] shadow-md ring-1 ring-[var(--cv-border)]">
                        {dayLabel}
                      </span>
                    </div>
                  ) : null;

                  if (item.kind === 'image_album') {
                    const isMe = item.isAI;
                    const isHit = item.rows.some((r) => chatSearchHighlightId === String(r.id));
                    const albumRow = {
                      ...item.rows[0],
                      id: item.id,
                      mediaImages: item.images,
                      message: {
                        ...item.rows[0].message,
                        content: item.caption,
                      },
                      data: item.data,
                    };
                    return (
                      <React.Fragment key={item.id}>
                        {daySep}
                        <motion.div
                          data-chat-message-id={item.rows[0].id}
                          variants={bubble}
                          layout
                          initial="hidden"
                          animate="visible"
                          className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${isHit ? 'rounded-lg ring-2 ring-yellow-400/70 ring-offset-2 ring-offset-[var(--cv-chat)]' : ''}`}
                        >
                          <MessageBubble row={albumRow} onOpenMedia={openMediaViewer} />
                        </motion.div>
                      </React.Fragment>
                    );
                  }

                  const row = item.row;
                  const msgType = row.message?.type;
                  const isMe = msgType === 'ai' || msgType === 'assistant';
                  const isHit = chatSearchHighlightId === String(row.id);
                  return (
                    <React.Fragment key={row.id}>
                      {daySep}
                      <motion.div
                        data-chat-message-id={row.id}
                        variants={bubble}
                        layout
                        initial="hidden"
                        animate="visible"
                        className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${isHit ? 'rounded-lg ring-2 ring-yellow-400/70 ring-offset-2 ring-offset-[var(--cv-chat)]' : ''}`}
                      >
                        <MessageBubble row={row} onOpenMedia={openMediaViewer} />
                      </motion.div>
                    </React.Fragment>
                  );
                })}
                <div ref={endOfMessagesRef} />
              </div>
            </div>

            {/* TEMPLATES AUTOCOMPLETE */}
            <AnimatePresence>
              {showTemplatesMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-[72px] left-4 right-4 z-20 bg-[var(--cv-panel)] border border-[var(--cv-border)] rounded-xl shadow-2xl p-2 max-h-64 overflow-y-auto"
                >
                  <div className="flex justify-between items-center px-2 pb-2 mb-2 border-b border-[var(--cv-border)]">
                    <span className="text-xs font-semibold text-[var(--cv-text-muted)]">Templates / Atalhos Rápido</span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setShowManageTemplatesModal(true)}>Gerenciar Templates</Button>
                  </div>
                  {filteredTemplates.length > 0 ? (
                    filteredTemplates.map((t, i) => (
                      <div
                        key={t.id}
                        onClick={() => selectTemplate(t)}
                        className={`p-2 rounded-lg cursor-pointer ${i === selectedTemplateIndex ? 'bg-[var(--cv-hover-strong)]' : 'hover:bg-[var(--cv-hover)]'} transition-colors`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-xs bg-[var(--cv-accent)] text-white border-none shrink-0">{t.shortcut}</Badge>
                          {t.is_official_api ? (
                            <Badge variant="outline" className="text-[9px] border-[var(--cv-accent)]/40 bg-[var(--cv-accent)]/15 text-[var(--cv-accent)] shrink-0 px-1 py-0 h-4">
                              API Oficial
                            </Badge>
                          ) : null}
                          {t.media_type ? (
                            <Badge variant="outline" className="text-[9px] shrink-0 px-1 py-0 h-4 text-[var(--cv-text-muted)]">
                              {templateMediaLabel(t.media_type)}
                            </Badge>
                          ) : null}
                          <span className="text-sm text-[var(--cv-text)] truncate">
                            {t.message?.trim() || (t.media_url ? 'Somente mídia' : '…')}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-center p-3 text-[var(--cv-text-muted)]">Nenhum template encontrado</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <ChatComposer
              surface="whatsapp"
              messageInput={messageInput}
              onMessageInputChange={(v) => handleInputChange({ target: { value: v } } as React.ChangeEvent<HTMLTextAreaElement>)}
              onTextareaKeyDown={onTextareaKeyDown}
              onSendText={sendText}
              placeholder={
                lockedOfficialTemplate
                  ? "Template API Oficial — texto bloqueado"
                  : disableFreeText
                    ? "Sessão expirada (24h). Digite '/' para templates"
                    : "Mensagem"
              }
              textareaReadOnly={Boolean(lockedOfficialTemplate)}
              textareaClassName={disableFreeText && !lockedOfficialTemplate ? "placeholder:text-red-400/80" : undefined}
              busy={busy || composerMedia.busy}
              recording={recording}
              recordingLevels={recordingLevels}
              recordingSec={sec}
              onStartRecord={startRecord}
              onStopRecord={stopRecord}
              imgInputRef={composerMedia.imgInputRef}
              messageTextareaRef={composerMedia.messageTextareaRef}
              onPickFile={composerMedia.onPickFile}
              onPasteMedia={(e) => {
                if (lockedOfficialTemplate) {
                  e.preventDefault();
                  return;
                }
                composerMedia.onPasteMedia(e);
              }}
              sendWithoutText={chatTemplateHasMedia(lockedOfficialTemplate)}
              composerNotice={
                lockedOfficialTemplate ? (
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--cv-border)] bg-[var(--cv-accent)]/10 px-4 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {lockedOfficialTemplate.media_url &&
                      lockedOfficialTemplate.media_type === 'imagem' ? (
                        <img
                          src={lockedOfficialTemplate.media_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-[var(--cv-accent)]/30"
                        />
                      ) : null}
                      <Badge
                        variant="outline"
                        className="shrink-0 gap-1 border-[var(--cv-accent)]/40 bg-[var(--cv-accent)]/15 text-[10px] text-[var(--cv-accent)]"
                      >
                        <Zap className="h-3 w-3" />
                        API Oficial
                      </Badge>
                      <span className="truncate text-xs text-[var(--cv-text-muted)]">
                        <span className="font-mono text-[var(--cv-text)]">{lockedOfficialTemplate.shortcut}</span>
                        {chatTemplateHasMedia(lockedOfficialTemplate)
                          ? ` · ${templateMediaLabel(lockedOfficialTemplate.media_type)}`
                          : ' — não editável'}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs text-[var(--cv-text-muted)] hover:text-[var(--cv-text)]"
                      onClick={clearLockedOfficialTemplate}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Trocar
                    </Button>
                  </div>
                ) : null
              }
              leadingActions={
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="text-[var(--cv-text-muted)] hover:bg-transparent rounded-full mb-1"
                  onClick={() => setShowManageTemplatesModal(true)}
                  title="Gerenciar Templates e Atalhos"
                >
                  <Zap className="h-5 w-5" />
                </Button>
              }
            />
          </>
        )}
      </div>

      {/* MEDIA PREVIEW OVERLAY */}
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
            surface="whatsapp"
            previewData={composerMedia.previewData}
            busy={busy}
            onCancel={composerMedia.clearPreview}
            onSend={sendPreview}
            onUpdateCaption={composerMedia.updateCaption}
            onSelectIndex={composerMedia.setActivePreviewIndex}
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

      <ManageChatTemplatesModal
        open={showManageTemplatesModal}
        onOpenChange={setShowManageTemplatesModal}
        companyId={profile?.company_id ?? null}
        templates={templates}
        loading={loadingTemplates}
        onAdd={addTemplate}
        onDelete={deleteTemplate}
      />
    </div >
  );
}
