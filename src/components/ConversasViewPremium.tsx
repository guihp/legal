import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import {
  MessageSquare,
  Search,
  Send,
  Paperclip,
  ArrowLeft,
  MoreVertical,
  Phone,
  Video,
  Mic,
  Image as ImageIcon,
  File as FileIcon
} from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useChatInstancesFromMessages } from '@/hooks/useChatInstancesFromMessages';
import { useConversasList } from '@/hooks/useConversasList';
import { useConversaMessages } from '@/hooks/useConversaMessages';
import { useConversasRealtime } from '@/hooks/useConversasRealtime';
import { ConversationActionsMenu } from './ConversationActionsMenu';
import { SummaryModalAnimated } from './SummaryModalAnimated';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LeadDetailsModal } from './LeadDetailsModal';

if ((import.meta as any).env?.DEV) { (window as any).supabase = supabase; }

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
      <div key={i} className="h-16 rounded-2xl bg-zinc-800/50 animate-pulse" />
    ))}
  </div>
);

// Empty State para conversas
const EmptyConversas = () => (
  <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-zinc-700/60 text-zinc-400">
    Selecione uma instância para ver as conversas
  </div>
);

// Empty State para chat
const EmptyChat = () => (
  <div className="grid h-56 place-items-center rounded-2xl border border-dashed border-zinc-700/60 text-zinc-400">
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

// Utils de conversão para mídia
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const out = String(fr.result || "");
      // remove "data:<mime>;base64,"
      const payload = out.includes(",") ? out.split(",")[1] : out;
      resolve(payload || "");
    };
    fr.readAsDataURL(file);
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

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
  caption?: string
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

  const r = await fetch("https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/enviar_mensagem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!r.ok) throw new Error(`Falha ao enviar (${r.status})`);
  try { return await r.json(); } catch { return {}; }
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

// Preview da última mensagem (prioridade para media)
function previewFromLast(last_media: any, last_message: any): string {
  const dataUrl = buildDataUrlFromMedia(last_media);
  if (dataUrl) {
    // Detectar tipo de mídia pelo MIME
    if (dataUrl.includes('image/')) return '🖼️ Imagem';
    if (dataUrl.includes('audio/')) return '🎧 Áudio';
    if (dataUrl.includes('video/')) return '🎥 Vídeo';
    return '📎 Mídia'; // fallback genérico
  }

  const raw = last_message;
  const m = typeof raw === 'string' ? ((): any => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
  const txt = m?.content || '';
  return txt.length > 80 ? txt.slice(0, 80) + '…' : txt;
}

// Renderer da mensagem (prioridade absoluta para media)
function MessageBubble({ row }: { row: any }) {
  // Parse da mensagem para determinar tipo (AI/human)
  const raw = row?.message;
  const m = typeof raw === 'string' ? ((): any => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
  const isAI = String(m?.type || '').toLowerCase() === 'ai';

  // --- LOG DIAGNÓSTICO COMPLETO ---
  console.log('🔍 MessageBubble Debug:', {
    id: row?.id,
    mediaType: typeof row?.media,
    mediaLength: (row?.media || '').length,
    mediaPreview: row?.media ? row.media.substring(0, 20) + '...' : 'null',
    messageType: typeof row?.message,
    isAI
  });

  // 1) PRIORIDADE ABSOLUTA: se existe `media`, renderiza a mídia e NÃO renderiza message.content
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
              backgroundColor: '#27272a'
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

  // Verificar se há tentativa de mídia mas base64 inválido
  if (row.media && typeof row.media === 'string' && row.media.trim() && row.media.toLowerCase() !== 'null') {
    console.log('⚠️ Mídia detectada mas base64 inválido, mostrando placeholder');
    return (
      <div className={isAI ? 'self-end' : 'self-start'}>
        <div className={isAI
          ? 'max-w-[72ch] rounded-2xl bg-blue-600/90 px-3.5 py-3 text-white shadow border border-blue-500/30'
          : 'max-w-[72ch] rounded-2xl bg-zinc-800/80 px-3.5 py-3 text-zinc-100 shadow border border-white/10'}>
          <div className="p-4 text-center text-zinc-400 border border-dashed border-zinc-600 rounded-lg">
            🖼️ Mídia corrompida
            <br />
            <small className="text-xs text-zinc-500">Base64 inválido ou incompleto</small>
          </div>
        </div>
      </div>
    );
  }

  // 2) SEM mídia → renderiza texto (message.content) normalmente
  const content = m?.content ?? '';

  console.log('📝 Renderizando texto:', { content: content.substring(0, 50) + '...', isAI });

  return (
    <div className={isAI ? 'self-end' : 'self-start'}>
      <div className={isAI
        ? 'max-w-[72ch] rounded-lg bg-[#005c4b] px-3 py-2 text-white shadow-sm rounded-tr-none'
        : 'max-w-[72ch] rounded-lg bg-[#202c33] px-3 py-2 text-zinc-100 shadow-sm rounded-tl-none'}>
        <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{content}</div>
        <div className="text-[10px] text-white/60 text-right mt-1 -mb-1">
          {/* Placeholder for time if available in row */}
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

  // Refs para mídia
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);

  // Estado para Preview de Mídia
  const [previewData, setPreviewData] = useState<{
    file: File;
    base64: string;
    type: "imagem" | "audio" | "arquivo";
    caption: string;
  } | null>(null);

  const maxAudioSec = 60;

  // Hooks de dados
  const { instances, loading: loadingInstances, error: errorInstances, refresh: refetchInstances, scopedInstance } = useChatInstancesFromMessages();
  const { conversas, loading: loadingConversas, error: errorConversas, refetch: refetchConversas, updateConversation } = useConversasList(selectedInstance || scopedInstance);
  const { messages, loading: loadingMessages, error: errorMessages, openSession, refetch: refetchMessages, setMyInstance } = useConversaMessages();

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

  // Auto scroll para o final quando novas mensagens chegam ou conversa muda
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, selectedConversation, loadingMessages, leadMessages.length]);

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

      // Filtrar apenas mensagens do tipo 'ai' e 'human' e mapear
      const filteredMessages = messagesArray
        .map((row: any) => {
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

          const messageType = String(parsedMessage?.type || '').toLowerCase();

          // Filtrar apenas 'ai' e 'human'
          if (messageType !== 'ai' && messageType !== 'human') {
            return null;
          }

          return {
            id: row.id,
            sessionId: row.session_id,
            message: {
              type: messageType as 'ai' | 'human',
              content: parsedMessage?.content || '',
            },
            data: row.data,
            media: row.media ?? null,
          };
        })
        .filter((msg: any) => msg !== null)
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
    const file = e.target.files?.[0];
    if (!file) return;

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
      const base64 = await fileToBase64(file);

      // Determinar tipo
      let tipo: "imagem" | "audio" | "arquivo" = "arquivo";
      if (file.type.startsWith("image/")) tipo = "imagem";
      else if (file.type.startsWith("audio/")) tipo = "audio";

      // Abrir preview em vez de enviar direto
      setPreviewData({
        file,
        base64,
        type: tipo,
        caption: ""
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
    setPreviewData(null);
  };

  const sendPreview = async () => {
    if (!previewData) return;

    try {
      setBusy(true);

      // Target: se tiver lead selecionado usa lead, senao conversation
      const targetSession = selectedLead?.id || selectedConversation;
      // Usar a instância selecionada globalmente ou da conversa
      const targetInstancia = selectedInstance || currentConversation?.instancia || "default";

      if (!targetSession) throw new Error("Sessão inválida");

      // Usar caption do preview se existir
      const msgToSend = previewData.caption || previewData.base64; // Se for texto, usa caption? Não, backend espera base64 no 'mensagem' para midia?
      // Pelo sendPayload original:
      // tipo='imagem' -> mensagem = base64
      // Mas se tiver caption, como manda?
      // O backend n8n parece esperar 'mensagem' como conteudo (base64 para midia) e 'caption' como legenda opcional.

      await sendPayload(
        targetSession,
        targetInstancia,
        previewData.type,
        previewData.base64,
        previewData.file.type,
        previewData.caption
      );

      toast({
        title: `${previewData.type === 'imagem' ? 'Imagem' : previewData.type === 'audio' ? 'Áudio' : 'Arquivo'} enviado(a) com sucesso`,
        variant: "default",
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

    try {
      setBusy(true);
      const targetSession = selectedLead ? selectedLead.id : selectedConversation;
      const targetInstancia = selectedInstance || currentConversation?.instancia || "default";

      if (!targetSession) throw new Error("Sessão inválida");

      await sendPayload(targetSession, targetInstancia, "texto", val);
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
    if ((e.key === "Enter" && !e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) {
      e.preventDefault();
      if (!busy) sendText();
    }
  };

  // AUDIO (MediaRecorder)
  const startRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : (MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "");
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);

      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        try {
          setBusy(true);
          const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
          const base64 = await blobToBase64(blob);

          const targetSession = selectedLead ? selectedLead.id : selectedConversation;
          const targetInstancia = selectedInstance || currentConversation?.instancia || "default";

          if (targetSession) {
            await sendPayload(targetSession, targetInstancia, "audio", base64, mr.mimeType || "audio/webm");
            toast({
              title: "Áudio enviado com sucesso",
              variant: "default",
            });
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
    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
      toast({
        title: "Permissão de microfone negada ou indisponível",
        variant: "destructive",
      });
    }
  };

  const stopRecord = () => {
    try {
      if (recRef.current?.state === "recording") {
        recRef.current.stop();
      }
    } catch (err) {
      console.error('Erro ao parar gravação:', err);
    }
  };

  const handleSendMessage = () => {
    sendText();
  };

  return (
    // Ajuste de altura para compensar o layout pai (sidebar/header) e padding (aprox 7rem / 112px)
    <div className="h-[calc(100vh-7rem)] bg-[#111b21] text-[#e9edef] overflow-hidden flex relative rounded-2xl shadow-xl ring-1 ring-[#202c33]">
      {/* SIDEBAR (Lista de Conversas) */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-[400px] flex-col border-r border-[#202c33] bg-[#111b21] z-20`}>
        {/* HEADER SIDEBAR */}
        <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden">
              <Avatar className="h-full w-full">
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </div>
            <h1 className="font-semibold text-[#e9edef] text-sm md:text-base">Conversas</h1>
          </div>
          <div className="flex gap-3 text-[#aebac1]">
            <MessageSquare className="w-5 h-5 cursor-pointer" />
            <MoreVertical className="w-5 h-5 cursor-pointer" />
          </div>
        </div>

        {/* SEARCH & FILTER */}
        <div className="p-2 border-b border-[#202c33]">
          <div className="bg-[#202c33] rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Search className="w-4 h-4 text-[#8696a0]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar ou começar uma nova..."
              className="bg-transparent border-none outline-none text-sm text-[#d1d7db] w-full placeholder-[#8696a0]"
            />
          </div>
        </div>

        {/* INSTANCES LIST (Horizontal) */}
        <div className="py-2 px-3 border-b border-[#202c33] overflow-x-auto whitespace-nowrap custom-scrollbar">
          {instances?.map((inst: any) => (
            <button
              key={inst.name}
              onClick={() => {
                setSelectedInstance(inst.name);
                setSelectedConversation(null);
                setSelectedLead(null);
              }}
              className={`inline-block px-3 py-1 text-xs rounded-full mr-2 transition-colors border ${selectedInstance === inst.name
                ? "bg-[#00a884] text-[#111b21] border-[#00a884]"
                : "bg-[#202c33] text-[#8696a0] border-transparent hover:bg-[#2a3942]"
                }`}
            >
              {inst.name}
            </button>
          ))}
        </div>

        {/* CHAT LIST */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredConversas.length === 0 && selectedInstance ? (
            <div className="p-4 text-center text-[#8696a0] text-sm">
              Nenhuma conversa encontrada.
            </div>
          ) : (
            filteredConversas.map((conv: any) => (
              <div
                key={conv.sessionId}
                onClick={() => {
                  setSelectedConversation(conv.sessionId);
                  openSession(conv.sessionId);
                  setSelectedLead(null);
                }}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-[#202c33] transition-colors border-b border-[#202c33] ${selectedConversation === conv.sessionId ? 'bg-[#2a3942]' : ''}`}
              >
                <div className="w-12 h-12 rounded-full bg-slate-600 flex-shrink-0 relative overflow-hidden">
                  <Avatar className="h-full w-full">
                    <AvatarFallback>{(conv.displayName?.charAt(0) || '?').toUpperCase()}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="text-[#e9edef] font-normal truncate max-w-[70%] text-base">{conv.displayName}</h3>
                    <span className="text-xs text-[#8696a0] whitespace-nowrap">
                      {conv.lastMessageDate ? formatHour(conv.lastMessageDate) : ''}
                    </span>
                  </div>
                  <p className="text-[#8696a0] text-sm truncate flex items-center">
                    <span className="truncate">{conv.lastMessageContent || "Toque para abrir conversa"}</span>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className={`${!showSidebar ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-[#0b141a] relative w-full h-full`}>
        {!selectedConversation && !selectedLead ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-b-[6px] border-[#00a884] bg-[#222e35]">
            <div className="max-w-[560px]">

              <h2 className="text-3xl font-light text-[#e9edef] mb-5">
                Gerencie suas conversas
              </h2>
              <p className="text-[#8696a0] text-sm leading-6">
                Selecione uma conversa para ver as mensagens.
              </p>
            </div>
            <div className="absolute bottom-10 flex items-center gap-2 text-[#8696a0] text-xs">
              <span className="opacity-80">Protegido com criptografia de ponta a ponta</span>
            </div>
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between shadow-sm shrink-0 z-10 w-full">
              <div className="flex items-center gap-3 overflow-hidden">
                <Button variant="ghost" size="icon" className="md:hidden text-[#aebac1] mr-1" onClick={() => {
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
                  <span className="text-[#e9edef] font-normal text-base truncate cursor-pointer hover:underline">
                    {currentConversation?.displayName || selectedLead?.name || selectedLead?.phone}
                  </span>
                  <p className="text-xs text-[#8696a0] truncate">
                    {currentConversation?.leadPhone || selectedLead?.phone}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 text-[#aebac1]">
                <Search className="h-5 w-5 cursor-pointer" />
                {currentConversation && (
                  <ConversationActionsMenu conversation={currentConversation} onGenerateSummary={handleGenerateSummary} onFollowUp={handleFollowUp} />
                )}
              </div>
            </div>

            {/* MESSAGES */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#0b141a] bg-opacity-95"
              style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundBlendMode: 'overlay' }}>
              <div className="space-y-2 pb-2">
                {/* LEAD MESSAGES */}
                {selectedLead && leadMessages.map((msg: any) => {
                  // Adapt lead msg to row format if needed, assuming match
                  return (
                    <motion.div key={msg.id} variants={bubble} layout initial="hidden" animate="visible">
                      <MessageBubble row={msg} />
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

                  return (
                    <motion.div
                      key={row.id}
                      variants={bubble}
                      layout
                      initial="hidden"
                      animate="visible"
                      // Se for AI/Agent (isMe), justify-end (Direita). Se for Lead (User), justify-start (Esquerda).
                      className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* Passar isMe/isAI explicitamente se MessageBubble precisar, mas o flex container já posiciona */}
                      <MessageBubble row={row} />
                    </motion.div>
                  );
                })}
                <div ref={endOfMessagesRef} />
              </div>
            </div>

            {/* INPUT AREA */}
            <div className="min-h-[62px] bg-[#202c33] px-4 py-2 flex items-end gap-2 shrink-0 z-10 w-full">
              <Button variant="ghost" size="icon" className="text-[#8696a0] hover:bg-transparent rounded-full mb-1">
                <span className="text-xl">😊</span>
              </Button>
              <Button variant="ghost" size="icon" className="text-[#8696a0] hover:bg-transparent rounded-full mb-1" onClick={() => imgInputRef.current?.click()}>
                <Paperclip className="h-5 w-5" />
              </Button>
              <input
                ref={imgInputRef}
                type="file"
                className="hidden"
                onChange={onPickFile}
                multiple={false}
              />

              <div className="flex-1 bg-[#2a3942] rounded-lg min-h-[42px] mb-1 flex items-center px-3 py-1">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={onTextareaKeyDown}
                  placeholder="Mensagem"
                  className="w-full bg-transparent border-none outline-none text-[#d1d7db] placeholder-[#8696a0] text-sm resize-none custom-scrollbar max-h-[100px]"
                  rows={1}
                  style={{ minHeight: '24px' }}
                />
              </div>

              {messageInput.trim() ? (
                <Button
                  onClick={sendText}
                  className="bg-[#00a884] hover:bg-[#008f6f] text-[#111b21] rounded-full h-10 w-10 p-0 mb-1 flex items-center justify-center shadow-md transition-transform active:scale-95"
                >
                  <Send className="h-5 w-5 ml-0.5" />
                </Button>
              ) : (
                <Button
                  onClick={recording ? stopRecord : startRecord}
                  className={`rounded-full h-10 w-10 p-0 mb-1 flex items-center justify-center shadow-md transition-all ${recording ? "bg-red-500 animate-pulse text-white" : "bg-[#202c33] hover:bg-[#37404a] text-[#8696a0]"}`}
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
        {previewData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0b141a] bg-opacity-95 flex flex-col"
          >
            {/* Header Preview */}
            <div className="h-16 flex items-center justify-between px-4 w-full text-[#aebac1]">
              <Button variant="ghost" size="icon" onClick={cancelPreview} className="hover:bg-[#3b4a54] rounded-full">
                <ArrowLeft className="w-6 h-6" />
              </Button>
              <h2 className="font-medium text-white">Visualizar {previewData.type === 'arquivo' ? 'Arquivo' : previewData.type === 'imagem' ? 'Imagem' : 'Mídia'}</h2>
              <div className="w-10"></div> {/* Spacer */}
            </div>

            {/* Content Preview */}
            <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
              {previewData.type === 'imagem' ? (
                <img src={previewData.base64} alt="Preview" className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
              ) : previewData.type === 'arquivo' ? (
                <div className="flex flex-col items-center gap-4 text-zinc-300 p-10 bg-[#202c33] rounded-xl border border-zinc-700">
                  <div className="w-20 h-20 bg-zinc-600 rounded-full flex items-center justify-center">
                    <Paperclip className="w-10 h-10 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-lg max-w-xs truncate" title={previewData.file.name}>{previewData.file.name}</p>
                    <p className="text-sm text-zinc-400">{(previewData.file.size / 1024).toFixed(1)} KB • {previewData.file.type || 'Desconhecido'}</p>
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

            {/* Caption Input */}
            <div className="bg-[#202c33] p-3 flex items-center gap-2 justify-center w-full max-w-3xl mx-auto mb-4 rounded-full shadow-lg">
              <input
                autoFocus
                value={previewData.caption}
                onChange={(e) => setPreviewData({ ...previewData, caption: e.target.value })}
                placeholder="Adicione uma legenda..."
                className="bg-transparent text-[#d1d7db] placeholder-[#8696a0] w-full outline-none px-4"
                onKeyDown={(e) => e.key === 'Enter' && sendPreview()}
              />
            </div>

            {/* Send Button FAB */}
            <div className="flex justify-end px-6 pb-6 w-full max-w-5xl mx-auto">
              <button
                onClick={sendPreview}
                className="bg-[#00a884] hover:bg-[#008f6f] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90"
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
    </div >
  );
}
