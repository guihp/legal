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
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Zap,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { mediaPreviewLabel, inferMediaKind, extractMediaAudio } from '@/lib/conversaMedia';
import { CRM_KANBAN_STAGE_TITLES, crmStageBadgeClasses } from '@/lib/crmKanbanStages';
import { conversationLabelListBadgeClasses } from '@/lib/conversationContactLabels';
import type { LeadStage } from '@/types/kanban';
import { useConversasList } from '@/hooks/useConversasList';
import { useConversaMessages, mapRowToConversaMessage } from '@/hooks/useConversaMessages';
import { useConversasRealtime } from '@/hooks/useConversasRealtime';
import { ConversationActionsMenu } from './ConversationActionsMenu';
import { ChatConversationTextSearchTrigger } from '@/components/ChatConversationTextSearchTrigger';
import { SummaryModalAnimated } from './SummaryModalAnimated';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LeadDetailsModal } from './LeadDetailsModal';
import { useChatTemplates } from '@/hooks/useChatTemplates';

if ((import.meta as any).env?.DEV) { (window as any).supabase = supabase; }


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
  hidden: { opacity: 0, y: 8, filter: 'blur(2px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0)', transition: { duration: 0.18 } },
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
  tipo: "texto" | "imagem" | "audio" | "arquivo",
  mensagem: string,
  mimeType?: string,
  caption?: string,
  companyId?: string,
  mediaUrl?: string,
  mutiplos?: boolean,
  mediaUrls?: string[],
  midias?: Array<{ url: string; tipo: string; mime_type?: string; nome?: string; caption?: string }>
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

  const r = await fetch("https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/enviar_mensagem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!r.ok) throw new Error(`Falha ao enviar (${r.status})`);
  try { return await r.json(); } catch { return {}; }
}

async function uploadMediaAndGetPublicUrl(
  file: File,
  channel: "whatsapp" | "instagram",
  companyId?: string | null
): Promise<string> {
  const bucket = (import.meta as any).env?.VITE_CHAT_MEDIA_BUCKET || "company-assets";
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const safeCompany = (companyId || "sem_empresa").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!companyId) throw new Error("company_id ausente para upload da mídia");
  const path = `${safeCompany}/chat-media/${channel}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(`Falha ao subir mídia: ${error.message}`);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const url = String(data?.publicUrl || "").trim();
  if (!url) throw new Error("URL pública da mídia não foi gerada");
  return url;
}

// Insercao otimista direta na tabela imobipro_messages_{phoneSanitizado}.
// Usado pelo envio de audio para que a bolha apareca imediatamente sem
// depender da gravacao via webhook/n8n. Em caso de falha (RLS, tabela
// inexistente, etc.) retornamos null e o caller continua confiando no
// webhook como fonte de verdade.
async function insertWhatsappMessageRow(params: {
  companyId: string;
  sessionId: string;
  instancia: string;
  audioUrl: string;
  content?: string;
}): Promise<{ tableName: string; id: any } | null> {
  try {
    const { data: companyRow, error: companyErr } = await supabase
      .from("companies")
      .select("phone")
      .eq("id", params.companyId)
      .single();
    if (companyErr) {
      console.warn("[insertWhatsappMessageRow] erro ao ler companies.phone:", companyErr);
      return null;
    }
    const phoneSanitizado = String(companyRow?.phone || "").replace(/\D/g, "");
    if (!phoneSanitizado) {
      console.warn("[insertWhatsappMessageRow] companies.phone vazio/invalido");
      return null;
    }
    const tableName = `imobipro_messages_${phoneSanitizado}`;
    const messageJson = {
      // Audio enviado pelo painel sai do lado da plataforma (AI) no chat.
      type: "ai" as const,
      content: params.content ?? "",
      additional_kwargs: {},
      response_metadata: {},
      tool_calls: [],
      invalid_tool_calls: [],
    };
    const mediaJson = JSON.stringify({ audio: params.audioUrl });
    const { data, error } = await (supabase as any)
      .from(tableName)
      .insert({
        session_id: params.sessionId,
        instancia: params.instancia,
        message: messageJson,
        media: mediaJson,
      })
      .select("id")
      .single();
    if (error) {
      console.warn("[insertWhatsappMessageRow] insert falhou:", error);
      return null;
    }
    return { tableName, id: data?.id };
  } catch (err) {
    console.warn("[insertWhatsappMessageRow] excecao inesperada:", err);
    return null;
  }
}

async function convertImageFileToPng(file: File): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Falha ao carregar imagem para conversão"));
      el.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Falha ao criar contexto para conversão PNG");
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao converter imagem para PNG"))), "image/png");
    });
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.png`, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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

// Preview da última mensagem (prioridade para media). Sem emoji — devolve
// rótulo curto em texto puro ("[Imagem]", "[Áudio]" etc.) para que a UI
// fique uniforme com o que o WhatsApp/Instagram mostram nativamente.
function previewFromLast(last_media: any, last_message: any): string {
  const dataUrl = buildDataUrlFromMedia(last_media);
  if (dataUrl) {
    // dataUrl já tem MIME — confiável.
    if (dataUrl.includes('image/')) return mediaPreviewLabel('data:image/');
    if (dataUrl.includes('audio/')) return mediaPreviewLabel('data:audio/');
    if (dataUrl.includes('video/')) return mediaPreviewLabel('data:video/');
    return mediaPreviewLabel(null); // genérico
  }

  // Sem data URL válido: tenta classificar pelo conteúdo bruto (URL,
  // JSON stringificado, base64). Se reconhecer alguma mídia, devolve rótulo.
  if (last_media != null && String(last_media).trim() !== '' && String(last_media).toLowerCase() !== 'null') {
    const kind = inferMediaKind(last_media);
    if (kind !== 'unknown') return mediaPreviewLabel(last_media);
  }

  const raw = last_message;
  const m = typeof raw === 'string' ? ((): any => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
  const txt = m?.content || '';
  return txt.length > 80 ? txt.slice(0, 80) + '…' : txt;
}

// Função para processar texto com markdown básico (**texto** → negrito)
function processTextWithBold(text: string): React.ReactNode {
  if (!text) return text;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /\*\*(.*?)\*\*/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // Adicionar texto antes do match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    // Adicionar texto em negrito
    parts.push(
      <strong key={match.index} className="font-bold">
        {match[1]}
      </strong>
    );
    lastIndex = regex.lastIndex;
  }
  
  // Adicionar texto restante
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
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
  const content = m?.content ?? '';
  const mediaImages = row?.mediaImages as string[] | undefined;

  // 1) PRIORIDADE MÁXIMA: Se há mediaImages (URLs de imagens do Supabase), renderizar imagens + texto
  if (mediaImages && mediaImages.length > 0) {
    return (
      <div className={isAI ? 'self-end' : 'self-start'}>
        <div className={isAI
          ? 'max-w-[72ch] rounded-lg px-3 py-2 shadow-sm rounded-tr-none bg-[var(--cv-bubble-out)] text-[var(--cv-bubble-out-text)]'
          : 'max-w-[72ch] rounded-lg px-3 py-2 shadow-sm rounded-tl-none bg-[var(--cv-bubble-in)] text-[var(--cv-bubble-in-text)]'}>
          {/* Grid de imagens estilo WhatsApp */}
          <div className={`grid gap-1 mb-2 ${
            mediaImages.length === 1 ? 'grid-cols-1' :
            mediaImages.length === 2 ? 'grid-cols-2' :
            mediaImages.length === 3 ? 'grid-cols-2' :
            'grid-cols-2'
          }`}>
            {mediaImages.slice(0, 4).map((imgUrl, imgIdx) => (
              <div
                key={imgIdx} 
                className={`relative overflow-hidden rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${
                  mediaImages.length === 3 && imgIdx === 0 ? 'col-span-2' : ''
                }`}
                onClick={() => onOpenMedia?.(mediaImages, imgIdx)}
              >
                <img 
                  src={imgUrl} 
                  alt={`Imagem ${imgIdx + 1}`}
                  className="w-full h-auto max-h-48 object-cover rounded-lg"
                  loading="lazy"
                />
                {mediaImages.length > 4 && imgIdx === 3 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                    <span className="text-white text-lg font-semibold">
                      +{mediaImages.length - 4}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
           {/* Texto da mensagem */}
           {content && (
             <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
               {processTextWithBold(content)}
             </div>
           )}
          <div className={`text-[10px] text-right mt-1 -mb-1 ${isAI ? 'text-[color:var(--cv-bubble-out-meta)]' : 'text-[color:var(--cv-bubble-in-meta)]'}`}>
            {row.data ? formatHour(row.data) : ''}
          </div>
        </div>
      </div>
    );
  }

  // 2) URL publica de audio (Supabase Storage) salva via insert otimista
  // Formato esperado em row.media: {"audio":"https://.../audio-*.webm"} ou URL crua.
  const audioUrl = extractMediaAudio(row.media);
  if (audioUrl) {
    return (
      <div className={isAI ? 'self-end' : 'self-start'}>
        <div className={isAI
          ? 'max-w-[72ch] rounded-2xl bg-blue-600/90 px-3.5 py-3 text-white shadow border border-blue-500/30'
          : 'max-w-[72ch] rounded-2xl bg-zinc-800/80 px-3.5 py-3 text-zinc-100 shadow border border-white/10'}>
          <div className="flex items-center gap-3 p-2 bg-black/15 rounded-lg border border-white/10">
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500/30 to-emerald-500/30 rounded-full flex items-center justify-center">
              <span className="text-xl">🎧</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium opacity-80 mb-1">Mensagem de áudio</div>
              <audio
                src={audioUrl}
                controls
                preload="metadata"
                className="w-full max-w-xs"
                style={{ height: '32px' }}
              />
            </div>
          </div>
          {content && (
            <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed mt-2">
              {processTextWithBold(content)}
            </div>
          )}
          <div className={`text-[10px] text-right mt-1 -mb-1 ${isAI ? 'text-[color:var(--cv-bubble-out-meta)]' : 'text-[color:var(--cv-bubble-in-meta)]'}`}>
            {row.data ? formatHour(row.data) : ''}
          </div>
        </div>
      </div>
    );
  }

  // 3) Se não há audio URL, verificar se há media base64
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
          <div className="flex items-center gap-3 p-3 bg-zinc-700/50 rounded-lg border border-zinc-600/30">
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500/30 to-emerald-500/30 rounded-full flex items-center justify-center">
              <span className="text-xl">🎧</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-zinc-200 mb-1">Mensagem de áudio</div>
              <audio
                src={dataUrl}
                controls
                className="w-full max-w-xs"
                preload="metadata"
                onLoadedMetadata={(e) => {
                  console.log('✅ Áudio carregado com sucesso:', e.target);
                }}
                onError={(e) => {
                  console.log('❌ Áudio também falhou, tentando documento');
                  setMediaType('document'); // FALLBACK FINAL: erro ou doc
                }}
                style={{
                  height: '32px',
                  backgroundColor: 'transparent'
                }}
              />
            </div>
          </div>
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
      <div className={isAI ? 'self-end' : 'self-start'}>
        <div className={isAI
          ? 'max-w-[72ch] rounded-2xl bg-blue-600/90 px-3.5 py-3 text-white shadow border border-blue-500/30'
          : 'max-w-[72ch] rounded-2xl bg-zinc-800/80 px-3.5 py-3 text-zinc-100 shadow border border-white/10'}>
          <MediaComponent />
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
      <div className={isAI ? 'self-end' : 'self-start'}>
        <div className={isAI
          ? 'max-w-[72ch] rounded-2xl bg-blue-600/90 px-3.5 py-3 text-white shadow border border-blue-500/30'
          : 'max-w-[72ch] rounded-2xl bg-zinc-800/80 px-3.5 py-3 text-zinc-100 shadow border border-white/10'}>
          <div className="p-4 text-center text-zinc-400 border border-dashed border-zinc-600 rounded-lg">
            Mídia indisponível
            <br />
            <small className="text-xs text-zinc-500">Conteúdo da mensagem não pôde ser carregado</small>
          </div>
        </div>
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
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [chatSearchHighlightId, setChatSearchHighlightId] = useState<string | null>(null);

  // Hook e estados de Templates de Chat
  const { templates, fetchTemplates, addTemplate, updateTemplate, deleteTemplate } = useChatTemplates();
  const [showTemplatesMenu, setShowTemplatesMenu] = useState(false);
  const [filteredTemplates, setFilteredTemplates] = useState<any[]>([]);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [showManageTemplatesModal, setShowManageTemplatesModal] = useState(false);
  const [isOfficialApiNew, setIsOfficialApiNew] = useState(false);

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

  // Refs para mídia
  const imgInputRef = useRef<HTMLInputElement | null>(null);
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

  // Estado para Preview de Mídia
  const [previewData, setPreviewData] = useState<{
    items: Array<{
      file: File;
      previewUrl: string;
      type: "imagem" | "audio" | "arquivo";
      caption: string;
    }>;
    activeIndex: number;
  } | null>(null);
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



  // Handlers para Templates
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

  const selectTemplate = (template: any) => {
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
  const { instances, loading: loadingInstances, error: errorInstances, refresh: refetchInstances, scopedInstance } = useChatInstancesFromMessages();
  const { conversas, loading: loadingConversas, error: errorConversas, refetch: refetchConversas, updateConversation } = useConversasList(selectedInstance || scopedInstance);
  const { messages, loading: loadingMessages, error: errorMessages, openSession, refetch: refetchMessages, setMyInstance } = useConversaMessages();

  // Determinar restrição de API Oficial (24 horas)
  const isApiOficialUser = profile?.email?.toLowerCase().includes('jastelo') || profile?.email?.toLowerCase().includes('iafeoficial.com') || profile?.email?.toLowerCase().includes('iafeofocial.com');
  const activeMessages = selectedLead ? leadMessages : messages;
  const messagesForChatSearch = useMemo(
    () => (selectedLead ? leadMessages : messages) as Array<{ id: string; message?: { content?: unknown } }>,
    [selectedLead, leadMessages, messages]
  );
  const lastHumanMessage = activeMessages.slice().reverse().find((m: any) => m.message?.type === 'human');
    
  const lastHumanDate = lastHumanMessage ? new Date(lastHumanMessage.data) : null;
  const isPast24Hours = lastHumanDate ? (Date.now() - lastHumanDate.getTime()) > 24 * 60 * 60 * 1000 : false;
  const disableFreeText = Boolean(isApiOficialUser && isPast24Hours);



  // Realtime (única assinatura): novas mensagens e deleções
  useConversasRealtime({
    onInstanceUpdate: refetchInstances,
    onConversationUpdate: (sessionId) => {
      updateConversation(sessionId);
    },
    onMessageUpdate: (sessionId, message) => {
      if (sessionId === selectedConversation) {
        refetchMessages();
        controls.start('highlight');
        setTimeout(() => controls.start('visible'), 250);
      }
      // Atualizar lista (move para topo)
      updateConversation(sessionId);
    },
    onMessageDelete: (_sessionId, messageId) => {
      if (_sessionId === selectedConversation) {
        refetchMessages();
      }
      refetchConversas();
      refetchInstances();
    }
  });

  // Auto scroll apenas quando:
  // 1. Conversa é selecionada/mudada
  // 2. Usuário já estava no final da conversa (não scrollou para cima)
  useEffect(() => {
    // Se mudou de conversa, fazer scroll e resetar flag
    if (selectedConversation !== prevConversationRef.current) {
      prevConversationRef.current = selectedConversation;
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

  const setConversationLabel = useCallback(async (sessionId: string, status: 'ai_ativa' | 'humano' | 'humano_solicitado') => {
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

  /** Atualiza coluna do Kanban (`leads.stage`) quando a conversa usa o mesmo id do lead. */
  const setConversationCrmStage = useCallback(async (sessionId: string, stage: LeadStage) => {
    const { error } = await supabase.from('leads').update({ stage }).eq('id', sessionId);
    if (error) throw error;
    refetchConversas();
  }, [refetchConversas]);

  // Conversa atual
  const currentConversation = conversas.find(conv => conv.sessionId === selectedConversation);

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

      // Buscar whatsapp_ai_phone da empresa
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();

      if (companyError) {
        throw new Error('Erro ao buscar dados da empresa');
      }

      // A coluna whatsapp_ai_phone pode não estar no tipo, mas existe no banco
      const companyPhone = (companyData as any)?.whatsapp_ai_phone;
      if (!companyPhone) {
        throw new Error('Telefone da empresa não encontrado');
      }

      // Limpar o telefone do lead (remover + e caracteres não numéricos)
      const leadPhoneClean = lead.phone.replace(/[^0-9]/g, '');

      console.log('[ConversasViewPremium] Buscando mensagens do lead:', {
        leadPhone: lead.phone,
        leadId: lead.id,
        companyPhone
      });

      // Usar a função RPC para buscar mensagens (usar any para contornar tipo não registrado)
      // FIX: usar lead.id como session_id, pois é assim que está salvo no banco
      const { data: messagesData, error: messagesError } = await (supabase.rpc as any)('conversation_for_user_by_phone', {
        p_session_id: lead.id,
        p_phone: companyPhone,
        p_limit: 500,
        p_offset: 0,
      });

      if (messagesError) {
        console.error('[ConversasViewPremium] Erro ao buscar mensagens:', messagesError);
        throw messagesError;
      }

      const messagesArray = Array.isArray(messagesData) ? messagesData : [];
      console.log('[ConversasViewPremium] Mensagens encontradas:', messagesArray.length);

      // Mesmo mapeamento que fetch + realtime (inclui limpeza de rótulos n8n).
      const filteredMessages = messagesArray
        .map((row: any) => mapRowToConversaMessage(row))
        .filter((msg: any) => {
          const t = String(msg.message?.type || '').toLowerCase();
          return t === 'ai' || t === 'human';
        })
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
    if (!selectedInstance) {
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
          instancia: selectedInstance.trim().toLowerCase(),
          user_email: profile?.email || '',
          role: profile?.role || ''
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
    if (!selectedInstance) {
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
          instancia: selectedInstance.trim().toLowerCase(),
          user_email: profile?.email || '',
          role: profile?.role || ''
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

  // Handlers para mídia

  // IMAGE
  // FILE / IMAGE / AUDIO UPLOAD
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Se não tiver conversa/lead selecionado, alerta
    if (!selectedConversation && !selectedLead) {
      toast({
        title: "Selecione uma conversa para enviar",
        variant: "destructive",
      });
      return;
    }

    try {
      setBusy(true);
      const items = await Promise.all(
        files.map(async (file) => {
          let normalizedFile = file;
          let tipo: "imagem" | "audio" | "arquivo" = "arquivo";
          if (file.type.startsWith("image/")) {
            tipo = "imagem";
            try {
              normalizedFile = await convertImageFileToPng(file);
            } catch {
              throw new Error(`Nao foi possivel converter a imagem "${file.name}" para PNG`);
            }
          } else if (file.type.startsWith("audio/")) {
            tipo = "audio";
            if (file.type !== "audio/mp4") throw new Error("Audio deve estar no formato audio/mp4");
          } else if (file.type.startsWith("video/")) {
            tipo = "arquivo";
            if (file.type !== "video/mp4") throw new Error("Video deve estar no formato video/mp4");
          } else {
            tipo = "arquivo";
            if (file.type !== "application/pdf") throw new Error("Arquivo deve ser PDF (application/pdf)");
          }
          return {
            file: normalizedFile,
            previewUrl: URL.createObjectURL(normalizedFile),
            type: tipo,
            caption: "",
          };
        })
      );

      setPreviewData({
        items,
        activeIndex: 0,
      });

    } catch (err: any) {
      console.error('Erro ao processar arquivo:', err);
      toast({
        title: "Falha ao processar arquivo",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      if (e.target) e.target.value = "";
    }
  };

  const cancelPreview = () => {
    (previewData?.items || []).forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setPreviewData(null);
  };

  const sendPreview = async () => {
    if (!previewData) return;

    try {
      setBusy(true);

      // Target: se tiver lead selecionado usa lead, senao conversation
      const targetSession = selectedLead?.id || selectedConversation;
      // Usar a instância selecionada globalmente ou da conversa
      const targetInstancia = selectedInstance || currentConversation?.instancia || "";

      if (!targetSession) throw new Error("Sessão inválida");
      if (!targetInstancia) throw new Error("Selecione uma instância antes de enviar");

      const uploadedItems = await Promise.all(
        previewData.items.map(async (item) => {
          const uploadedUrl = await uploadMediaAndGetPublicUrl(item.file, "whatsapp", profile?.company_id);
          return {
            url: uploadedUrl,
            tipo: item.type,
            mime_type: item.file.type,
            nome: item.file.name,
            caption: item.caption || "",
          };
        })
      );
      const urls = uploadedItems.map((m) => m.url);
      const allSameType = uploadedItems.every((m) => m.tipo === uploadedItems[0]?.tipo);
      const requestType = allSameType ? (uploadedItems[0]?.tipo as "imagem" | "audio" | "arquivo") : "arquivo";
      const webhookMessage = (uploadedItems[0]?.caption || "").trim() || urls[0] || "";

      await sendPayload(
        targetSession,
        targetInstancia,
        requestType,
        webhookMessage,
        undefined,
        uploadedItems[0]?.caption || "",
        profile?.company_id,
        urls[0],
        uploadedItems.length > 1,
        urls,
        uploadedItems
      );

      toast({
        title: previewData.items.length > 1
          ? `${previewData.items.length} arquivos enviados com sucesso`
          : "Arquivo enviado com sucesso",
        variant: "default",
      });

      (previewData?.items || []).forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      setPreviewData(null);

      // Refresh
      // Refresh imediato + 2s conforme solicitado
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
      console.error('Erro ao enviar mídia:', err);
      toast({
        title: "Falha ao enviar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  // TEXT
  const sendText = async () => {
    const val = messageInput.trim();
    if (!val) return;
    if (!selectedConversation && !selectedLead) return;

    if (disableFreeText) {
      // Find if message matches a template marked as is_official_api
      // It must be an exact match (or practically exact)
      const usedTemplate = templates.find(t => t.is_official_api && typeof t.message === 'string' && val.includes(t.message.trim()));
      
      if (!usedTemplate) {
        toast({
          title: "Operação Bloqueada",
          description: "Sessão expirada. Apenas templates aprovados na API Oficial podem ser enviados.",
          variant: "destructive"
        });
        return;
      }
    }

    try {
      setBusy(true);
      const targetSession = selectedLead ? selectedLead.id : selectedConversation;
      const targetInstancia = selectedInstance || currentConversation?.instancia || "default";

      if (!targetSession) throw new Error("Sessão inválida");

      await sendPayload(targetSession, targetInstancia, "texto", val, undefined, undefined, profile?.company_id);
      setMessageInput("");

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
      toast({
        title: "Erro ao enviar mensagem",
        description: err?.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setBusy(false);
    }
  };

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
      const mimeCandidates = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
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
          const ext =
            resolvedMime.includes("mp4") ? "mp4" :
              resolvedMime.includes("ogg") ? "ogg" : "webm";
          const blob = new Blob(chunksRef.current, { type: resolvedMime });
          const audioFile = new File([blob], `audio-${Date.now()}.${ext}`, { type: resolvedMime });
          const audioUrl = await uploadMediaAndGetPublicUrl(audioFile, "whatsapp", profile?.company_id);

          const targetSession = selectedLead ? selectedLead.id : selectedConversation;
          const targetInstancia = selectedInstance || currentConversation?.instancia || "";

          if (targetSession) {
            if (!targetInstancia) throw new Error("Selecione uma instancia antes de enviar audio");

            // Insert otimista direto na tabela imobipro_messages_{phone}.
            // Faz a bolha aparecer imediatamente via realtime/polling
            // sem depender da resposta do n8n. Em caso de erro, o webhook
            // continua sendo a fonte de verdade.
            if (profile?.company_id) {
              const inserted = await insertWhatsappMessageRow({
                companyId: profile.company_id,
                sessionId: targetSession,
                instancia: targetInstancia,
                audioUrl,
                content: "",
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
              audioFile.type,
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
      <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-[400px] flex-col border-r border-[var(--cv-border)] bg-[var(--cv-shell)] z-20`}>
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
            <MoreVertical className="w-5 h-5 cursor-pointer" />
          </div>
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

        {/* INSTANCES LIST (Horizontal) */}
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

        {/* CHAT LIST */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredConversas.length === 0 && selectedInstance ? (
            <div className="p-4 text-center text-[var(--cv-text-muted)] text-sm">
              Nenhuma conversa encontrada.
            </div>
          ) : (
            filteredConversas.map((conv: any) => (
              <ContextMenu key={conv.sessionId}>
                <ContextMenuTrigger asChild>
                  <div
                    onClick={() => {
                      setSelectedConversation(conv.sessionId);
                      openSession(conv.sessionId);
                      setSelectedLead(null);
                    }}
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--cv-hover)] transition-colors border-b border-[var(--cv-border)] ${selectedConversation === conv.sessionId ? 'bg-[var(--cv-panel-muted)]' : ''}`}
                  >
                <div className="w-12 h-12 rounded-full bg-slate-600 flex-shrink-0 relative overflow-hidden">
                  <Avatar className="h-full w-full">
                    <AvatarFallback>{(conv.displayName?.charAt(0) || '?').toUpperCase()}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0 max-w-[78%] flex-wrap">
                      <h3 className="text-[var(--cv-text)] font-normal truncate text-base max-w-full">{conv.displayName}</h3>
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
                  <p className="text-[var(--cv-text-muted)] text-sm truncate flex items-center">
                    <span className="truncate">{conv.lastMessageContent || "Toque para abrir conversa"}</span>
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
        {!selectedConversation && !selectedLead ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-b-[6px] border-[var(--cv-accent)] bg-[var(--cv-empty)]">
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
                }}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="w-10 h-10 rounded-full bg-slate-600 flex-shrink-0 cursor-pointer overflow-hidden">
                  <Avatar className="h-full w-full">
                    <AvatarFallback>{(currentConversation?.displayName?.charAt(0) || selectedLead?.name?.charAt(0) || '?').toUpperCase()}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex flex-col overflow-hidden">
                  <div className="flex items-center overflow-hidden">
                    <span className="text-[var(--cv-text)] font-normal text-base truncate cursor-pointer hover:underline">
                      {currentConversation?.displayName || selectedLead?.name || selectedLead?.phone}
                    </span>
                    {isApiOficialUser && <CountdownTimer date={lastHumanDate} />}
                  </div>
                  <p className="text-xs text-[var(--cv-text-muted)] truncate">
                    {currentConversation?.leadPhone || selectedLead?.phone}
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
              className="conversas-chat-area flex-1 overflow-y-auto p-4 custom-scrollbar bg-[var(--cv-chat)] bg-opacity-95"
              style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundBlendMode: 'overlay' }}>
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

                {/* CONVERSATION MESSAGES */}
                {!selectedLead && messages.map((row: any) => {
                  // Ajuste de Lógica de Alinhamento:
                  // row é ConversaMessage { message: { type: 'human' | 'ai' ... } }
                  // 'ai' -> Agent/System -> Right (isMe=true)
                  // 'human' -> Lead -> Left (isMe=false)
                  const msgType = row.message?.type;
                  const isMe = msgType === 'ai' || msgType === 'assistant';

                  const isHit = chatSearchHighlightId === String(row.id);
                  return (
                    <motion.div
                      key={row.id}
                      data-chat-message-id={row.id}
                      variants={bubble}
                      layout
                      initial="hidden"
                      animate="visible"
                      className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${isHit ? 'rounded-lg ring-2 ring-yellow-400/70 ring-offset-2 ring-offset-[var(--cv-chat)]' : ''}`}
                    >
                      <MessageBubble row={row} onOpenMedia={openMediaViewer} />
                    </motion.div>
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
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs bg-[var(--cv-accent)] text-white border-none shrink-0">{t.shortcut}</Badge>
                          {t.is_official_api && <Badge variant="outline" className="text-[9px] bg-[#d8f3dc] text-[#1b4332] border-none ml-1 shrink-0 px-1 py-0 h-4">API Oficial</Badge>}
                          <span className="text-sm text-[var(--cv-text)] truncate">{t.message}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-center p-3 text-[var(--cv-text-muted)]">Nenhum template encontrado</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* INPUT AREA */}
            <div className="min-h-[62px] bg-[var(--cv-panel)] px-4 py-2 flex items-end gap-2 shrink-0 z-10 w-full">
              <Button variant="ghost" size="icon" className="text-[var(--cv-text-muted)] hover:bg-transparent rounded-full mb-1">
                <span className="text-xl">😊</span>
              </Button>
              <Button variant="ghost" size="icon" className="text-[var(--cv-text-muted)] hover:bg-transparent rounded-full mb-1" onClick={() => imgInputRef.current?.click()} title="Anexar arquivo">
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-[var(--cv-text-muted)] hover:bg-transparent rounded-full mb-1" onClick={() => setShowManageTemplatesModal(true)} title="Gerenciar Templates e Atalhos">
                <Zap className="h-5 w-5" />
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
                    <span className="text-xs text-red-400 font-medium whitespace-nowrap">Gravando {String(sec).padStart(2, '0')}s</span>
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
                    onChange={handleInputChange}
                    onKeyDown={onTextareaKeyDown}
                    placeholder={disableFreeText ? "Sessão expirada (24h). Digite '/' para templates" : "Mensagem"}
                    className={`w-full bg-transparent border-none outline-none text-[var(--cv-input-text)] text-sm resize-none custom-scrollbar max-h-[100px] ${disableFreeText ? 'placeholder:text-red-400/80' : 'placeholder:text-[var(--cv-text-muted)]'}`}
                    rows={1}
                    style={{ minHeight: '24px' }}
                  />
                )}
              </div>

              {messageInput.trim() ? (
                <Button
                  onClick={sendText}
                  className="bg-[var(--cv-accent)] hover:bg-[var(--cv-accent-hover)] text-[var(--cv-tab-active-text)] rounded-full h-10 w-10 p-0 mb-1 flex items-center justify-center shadow-md transition-transform active:scale-95"
                >
                  <Send className="h-5 w-5 ml-0.5" />
                </Button>
              ) : (
                <Button
                  onClick={recording ? stopRecord : startRecord}
                  className={`rounded-full h-10 w-10 p-0 mb-1 flex items-center justify-center shadow-md transition-all ${recording ? "bg-red-500 animate-pulse text-white" : "bg-[var(--cv-tab-inactive-bg)] hover:bg-[var(--cv-hover-strong)] text-[var(--cv-text-muted)]"}`}
                >
                  <Mic className="h-5 w-5" />
                </Button>
              )}
            </div>
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

        {previewData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[var(--cv-chat)] bg-opacity-95 flex flex-col"
          >
            {/* Header Preview */}
            <div className="h-16 flex items-center justify-between px-4 w-full text-[var(--cv-icon)]">
              <Button variant="ghost" size="icon" onClick={cancelPreview} className="hover:bg-[var(--cv-preview-bar-hover)] rounded-full">
                <ArrowLeft className="w-6 h-6" />
              </Button>
              <h2 className="font-medium text-[var(--cv-text)]">
                Visualizar arquivo{previewData.items.length > 1 ? `s (${previewData.items.length})` : ""}
              </h2>
              <div className="w-10"></div> {/* Spacer */}
            </div>

            {/* Content Preview */}
            <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
              {previewData.items[previewData.activeIndex]?.type === 'imagem' ? (
                <img
                  src={previewData.items[previewData.activeIndex]?.previewUrl}
                  alt="Preview"
                  className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                />
              ) : previewData.items[previewData.activeIndex]?.type === 'arquivo' ? (
                <div className="flex flex-col items-center gap-4 text-[var(--cv-text)] p-10 bg-[var(--cv-panel)] rounded-xl border border-[var(--cv-border)]">
                  <div className="w-20 h-20 bg-zinc-600 rounded-full flex items-center justify-center">
                    <Paperclip className="w-10 h-10 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-lg max-w-xs truncate" title={previewData.items[previewData.activeIndex]?.file.name}>
                      {previewData.items[previewData.activeIndex]?.file.name}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {((previewData.items[previewData.activeIndex]?.file.size || 0) / 1024).toFixed(1)} KB • {previewData.items[previewData.activeIndex]?.file.type || 'Desconhecido'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-zinc-300">
                  <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center animate-pulse">
                    <Mic className="w-8 h-8 text-white" />
                  </div>
                  <p>Áudio gravado</p>
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
                        previewData.activeIndex === idx ? 'border-[var(--cv-accent)]' : 'border-[var(--cv-border)]'
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

            {/* Caption Input */}
            <div className="bg-[var(--cv-panel)] p-3 flex items-center gap-2 justify-center w-full max-w-3xl mx-auto mb-4 rounded-full shadow-lg border border-[var(--cv-border)]">
              <input
                autoFocus
                value={previewData.items[previewData.activeIndex]?.caption || ""}
                onChange={(e) =>
                  setPreviewData({
                    ...previewData,
                    items: previewData.items.map((item, idx) =>
                      idx === previewData.activeIndex ? { ...item, caption: e.target.value } : item
                    ),
                  })
                }
                placeholder={`Adicione uma legenda para ${previewData.items[previewData.activeIndex]?.file.name || "a mídia"}...`}
                className="bg-transparent text-[var(--cv-input-text)] placeholder:text-[var(--cv-text-muted)] w-full outline-none px-4"
                onKeyDown={(e) => e.key === 'Enter' && sendPreview()}
              />
            </div>

            {/* Send Button FAB */}
            <div className="flex justify-end w-full max-w-3xl mx-auto pb-6">
              <button
                onClick={sendPreview}
                type="button"
                className="bg-[var(--cv-accent)] hover:bg-[var(--cv-accent-hover)] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90"
              >
                {busy ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-6 h-6 ml-0.5" />}
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

      <LeadDetailsModal
        isOpen={showLeadModal}
        onClose={() => setShowLeadModal(false)}
        leadId={selectedLead ? selectedLead.id : selectedConversation}
      />

      {/* MODAL DE GERENCIAMENTO DE TEMPLATES */}
      {showManageTemplatesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[var(--cv-panel)] w-full max-w-2xl rounded-xl shadow-2xl border border-[var(--cv-border)] flex flex-col max-h-[85vh]"
          >
            <div className="p-5 border-b border-[var(--cv-border)] flex justify-between items-center">
              <h2 className="text-lg font-semibold text-[var(--cv-text)]">Gerenciar Mensagens (Templates)</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowManageTemplatesModal(false)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto">
              <div className="mb-6 p-4 bg-[var(--cv-hover)] rounded-lg">
                <h3 className="text-sm font-medium text-[var(--cv-text)] mb-3">Adicionar Novo Template</h3>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <Input id="newShortcut" placeholder="Atalho (ex: /ola)" className="w-1/3 bg-[var(--cv-input-bg)] border-[var(--cv-border)] text-[var(--cv-input-text)]" />
                    <Input id="newMessage" placeholder="Mensagem completa..." className="flex-1 bg-[var(--cv-input-bg)] border-[var(--cv-border)] text-[var(--cv-input-text)]" />
                    <Button 
                      onClick={() => {
                        const shortcut = (document.getElementById('newShortcut') as HTMLInputElement).value;
                        const msg = (document.getElementById('newMessage') as HTMLInputElement).value;
                        if (shortcut && msg) {
                          addTemplate(shortcut, msg, isOfficialApiNew);
                          // Reset state
                          (document.getElementById('newShortcut') as HTMLInputElement).value = '';
                          (document.getElementById('newMessage') as HTMLInputElement).value = '';
                          setIsOfficialApiNew(false);
                        }
                      }}
                      className="bg-[var(--cv-accent)] text-white hover:bg-[var(--cv-accent-hover)]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-[var(--cv-text-muted)]"><AlertCircle className="w-3 h-3 inline mr-1"/> O atalho deve começar com '/'</p>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="isOfficialApi" checked={isOfficialApiNew} onCheckedChange={(checked) => setIsOfficialApiNew(checked as boolean)} />
                      <label htmlFor="isOfficialApi" className="text-xs font-medium leading-none text-[#1b4332] dark:text-[#a0c49d] bg-[#d8f3dc] dark:bg-[#2d6a4f] px-2 py-0.5 rounded cursor-pointer">
                        Validado na API Oficial
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-[var(--cv-text)] mb-2">Seus Templates ({templates.length})</h3>
                {templates.map(t => (
                  <div key={t.id} className="flex justify-between items-start gap-4 p-3 border border-[var(--cv-border)] rounded-lg hover:bg-[var(--cv-hover)] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">{t.shortcut}</Badge>
                        {t.is_official_api && <Badge variant="outline" className="text-[10px] bg-[#d8f3dc] text-[#1b4332] border-[#74c69d] dark:bg-[#1b4332] dark:text-[#d8f3dc]">API Oficial</Badge>}
                      </div>
                      <p className="text-sm text-[var(--cv-text-muted)] line-clamp-2">{t.message}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => deleteTemplate(t.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {templates.length === 0 && (
                  <div className="text-center p-6 text-[var(--cv-text-muted)] border border-dashed border-[var(--cv-border)] rounded-lg">
                    Nenhum template configurado ainda.
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-[var(--cv-border)] flex justify-end">
              <Button variant="outline" onClick={() => setShowManageTemplatesModal(false)}>
                Fechar
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div >
  );
}
