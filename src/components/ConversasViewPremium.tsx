import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { 
  MessageSquare, 
  Search, 
  Send, 
  Paperclip
} from 'lucide-react';
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
  tipo: "texto"|"imagem"|"audio", 
  mensagem: string, 
  mimeType?: string
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
    // Se não detectou nada específico, tentar áudio como fallback mais provável
    'audio/webm'; // mudança: fallback para áudio em vez de imagem

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
      const [mediaType, setMediaType] = React.useState<'image' | 'audio' | 'error'>(
        isImage ? 'image' : isAudio ? 'audio' : 'image' // tentar imagem primeiro se não detectado
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
              🎧
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
                  console.log('❌ Áudio também falhou, mostrando erro');
                  setMediaType('error'); // FALLBACK FINAL: erro
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

      // Fallback final: erro
      return (
        <div className="p-4 text-center text-zinc-400 border border-dashed border-zinc-600 rounded-lg">
          ❌ Erro ao carregar mídia
          <br />
          <small className="text-xs text-zinc-500">
            Tentou imagem e áudio - Base64 pode estar corrompido
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
        ? 'max-w-[72ch] rounded-2xl bg-blue-600/90 px-3.5 py-3 text-white shadow'
        : 'max-w-[72ch] rounded-2xl bg-zinc-800/80 px-3.5 py-3 text-zinc-100 shadow'}>
        <div className="whitespace-pre-wrap break-words">{content}</div>
      </div>
    </div>
  );
}

interface ConversasViewPremiumProps {}

export function ConversasViewPremium({}: ConversasViewPremiumProps) {
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const controls = useAnimation();
  
  // Estados
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [summaryModal, setSummaryModal] = useState<{ isOpen: boolean; data: any }>({
    isOpen: false,
    data: null
  });

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
  }, [messages.length, selectedConversation, loadingMessages]);

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
  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation || !selectedInstance) return;
    
    try {
      setBusy(true);
      const base64 = await fileToBase64(file);
      await sendPayload(selectedConversation, selectedInstance, "imagem", base64, file.type);
      toast({
        title: "Imagem enviada com sucesso",
        variant: "default",
      });
    } catch (err: any) {
      console.error('Erro ao enviar imagem:', err);
      if (err.message === "INSTANCE_REQUIRED") {
        toast({
          title: "Selecione uma instância antes de enviar",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Falha ao enviar imagem",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(false);
      if (e.target) e.target.value = "";
    }
  };

  // TEXT
  const sendText = async () => {
    const val = messageInput.trim();
    if (!val || !selectedConversation || !selectedInstance) return;
    
    try {
      setBusy(true);
      await sendPayload(selectedConversation, selectedInstance, "texto", val);
      setMessageInput("");
      toast({
        title: "Mensagem enviada com sucesso",
        variant: "default",
      });
    } catch (err: any) {
      console.error('Erro ao enviar texto:', err);
      if (err.message === "INSTANCE_REQUIRED") {
        toast({
          title: "Selecione uma instância antes de enviar",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Falha ao enviar texto",
          variant: "destructive",
        });
      }
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
          if (selectedConversation && selectedInstance) {
            await sendPayload(selectedConversation, selectedInstance, "audio", base64, mr.mimeType || "audio/webm");
            toast({
              title: "Áudio enviado com sucesso",
              variant: "default",
            });
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
    <div className="h-full p-3 md:p-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
        {/* Coluna 1: Instâncias WhatsApp */}
        <div className="lg:col-span-3 space-y-4">
          <div className="h-full bg-zinc-900/60 border border-zinc-700/60 rounded-2xl p-4">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-400" />
                <h2 className="text-lg font-semibold text-white">Instâncias</h2>
              </div>
            </div>
            
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <div className="space-y-3">
                {loadingInstances ? (
                  <SkeletonCards />
                ) : instances.length === 0 ? (
                  <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-zinc-700/60 text-zinc-400">
                    Nenhuma instância encontrada
                  </div>
                ) : (
                  instances.map((instance) => (
                    <div
                      key={instance.name}
                      className={`
                        group relative rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-3 shadow-lg transition
                        hover:-translate-y-0.5 hover:shadow-2xl cursor-pointer
                        ${selectedInstance === instance.name 
                          ? 'ring-2 ring-sky-500/40' 
                          : ''
                        }
                      `}
                      data-active={selectedInstance === instance.name}
                      onClick={() => setSelectedInstance(instance.name)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-green-400/30 to-emerald-400/30 text-sm font-medium text-white ring-1 ring-white/10">
                          {instance.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white truncate">
                            {instance.name}
                          </h3>
                          <span className="relative inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                            <span className="relative h-2 w-2">
                              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60"></span>
                              <span className="absolute inset-0 rounded-full bg-emerald-400"></span>
                            </span>
                            Ativa
                          </span>
                        </div>
                        <span className="ml-auto rounded-full bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-200">{instance.conversationCount}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Coluna 2: Lista de Conversas */}
        <div className="lg:col-span-4 space-y-4">
          <div className="h-full bg-zinc-900/60 border border-zinc-700/60 rounded-2xl p-4">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-white">Conversas</h2>
                <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-200">
                  {filteredConversas.length}
                </span>
              </div>
              
              {/* Input de Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Buscar conversas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-800/60 border-zinc-700/60 text-white placeholder-zinc-400 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50"
                />
              </div>
            </div>
            
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-3">
                {!selectedInstance ? (
                  <EmptyConversas />
                ) : loadingConversas ? (
                  <SkeletonCards />
                ) : filteredConversas.length === 0 ? (
                  <EmptyConversas />
                ) : (
                  filteredConversas.map((conversa) => (
                    <div
                      key={conversa.sessionId}
                      className={`
                        group relative flex gap-3 rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-3 shadow
                        transition hover:-translate-y-0.5 hover:shadow-2xl cursor-pointer
                        ${selectedConversation === conversa.sessionId
                          ? 'border-sky-500/30 bg-zinc-800/70'
                          : ''
                        }
                      `}
                      data-active={selectedConversation === conversa.sessionId}
                      onClick={() => { setSelectedConversation(conversa.sessionId); openSession(conversa.sessionId); }}
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-fuchsia-400/30 to-sky-400/30 text-sm font-medium text-white ring-1 ring-white/10 group-hover:scale-[1.02] transition">
                        {conversa.displayName.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-white truncate">
                            {conversa.displayName === conversa.sessionId 
                              ? 'Aguardando nome do lead...'
                              : conversa.displayName
                            }
                          </h3>
                          <span className="text-[11px] text-zinc-500 ml-2">
                            {formatHour(conversa.lastMessageDate)}
                          </span>
                        </div>
                        
                        <p className="truncate text-xs text-zinc-400 group-hover:text-zinc-300 mb-2">
                          {conversa.lastMessageContent || 'Sem prévia de mensagem'}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {conversa.leadPhone && (
                              <span className="text-xs text-zinc-500">
                                {conversa.leadPhone.replace('@s.whatsapp.net', '')}
                              </span>
                            )}
                            
                            {conversa.leadPhone && conversa.leadStage && (
                              <span className="text-zinc-600">•</span>
                            )}
                            
                            {conversa.leadStage && (
                              <span className="rounded-full border border-white/10 bg-zinc-800/60 px-2 py-0.5 text-[11px] text-zinc-300">
                                {conversa.leadStage}
                              </span>
                            )}
                          </div>
                          
                          <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-200">
                            {conversa.messageCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Coluna 3: Chat Aberto */}
        <div className="lg:col-span-5 space-y-4">
          <div className="h-full bg-zinc-900/60 border border-zinc-700/60 rounded-2xl p-4 flex flex-col">
            {!currentConversation ? (
              <EmptyChat />
            ) : (
              <>
                {/* Header Glass */}
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 flex items-center justify-between rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-3 shadow-xl"
                >
                  {/* Esquerda: avatar + nome + linha de apoio */}
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-400/30 to-sky-400/30 text-white ring-1 ring-white/10">
                      {currentConversation.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">
                        {currentConversation.displayName === currentConversation.sessionId 
                          ? "Aguardando nome do lead…" 
                          : currentConversation.displayName
                        }
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-400">
                        {currentConversation.leadPhone && (
                          <span>{currentConversation.leadPhone.replace('@s.whatsapp.net', '')}</span>
                        )}
                        {currentConversation.leadStage && (
                          <span className="rounded-full border border-white/10 bg-zinc-800/60 px-2 py-0.5">
                            {currentConversation.leadStage}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Direita: menu ⋯ */}
                  <ConversationActionsMenu 
                    conversation={currentConversation}
                    onGenerateSummary={handleGenerateSummary}
                    onFollowUp={handleFollowUp}
                  />
                </motion.div>

                {/* Lista de mensagens com stagger real */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[calc(100vh-24rem)]">
                    {loadingMessages ? (
                      <div className="space-y-3 px-1.5 pb-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-16 rounded-2xl bg-zinc-800/50 animate-pulse" />
                        ))}
                      </div>
                    ) : errorMessages ? (
                      <EmptyChat />
                    ) : messages.length === 0 ? (
                      <EmptyChat />
                    ) : (
                      <AnimatePresence mode="popLayout">
                        <motion.div 
                          variants={list} 
                          initial="hidden" 
                          animate="visible" 
                          className="flex flex-col gap-2.5 px-1.5 pb-3"
                        >
                          {(() => {
                            const currentInst = String((selectedInstance || scopedInstance || '')).toLowerCase();
                            const idxHandoff = messages.findIndex((m: any) => m && m.before_handoff === false);
                            const hasCurrent = !!currentInst && messages.some((m: any) => String(m?.instancia || '').toLowerCase() === currentInst);
                            const idxFirstCurrent = hasCurrent ? messages.findIndex((m: any) => String(m?.instancia || '').toLowerCase() === currentInst) : -1;
                            const idxForward = idxFirstCurrent >= 0
                              ? messages.findIndex((m: any, ii: number) => ii > idxFirstCurrent && String(m?.instancia || '').toLowerCase() !== currentInst)
                              : -1;
                            return messages.map((row: any, i: number) => {
                              // Se chegou o ponto de encaminhamento (mudança de instância), não mostrar mais mensagens do SDR além dele
                              if (idxForward > 0 && i > idxForward) return null;
                              if (idxForward > 0 && i === idxForward) {
                                return (
                                  <motion.div 
                                    key={`forward-${row.id}`} 
                                    variants={bubble} 
                                    layout
                                    animate={controls}
                                  >
                                    {profile?.role === 'gestor' ? (
                                      <div
                                        className="flex items-center gap-2 my-2 cursor-pointer select-none"
                                        onClick={() => {
                                          const targetInst = messages[idxForward]?.instancia;
                                          if (targetInst) {
                                            setSelectedInstance(String(targetInst).trim().toLowerCase());
                                            if (selectedConversation) openSession(selectedConversation);
                                          }
                                        }}
                                        title="Ir para conversa na instância do corretor"
                                      >
                                        <div className="h-px flex-1 bg-emerald-600/60" />
                                        <span className="text-[11px] text-emerald-300 whitespace-nowrap">
                                          Enviado para o corretor responsável — clicar para abrir
                                        </span>
                                        <div className="h-px flex-1 bg-emerald-600/60" />
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 my-2">
                                        <div className="h-px flex-1 bg-zinc-700/60" />
                                        <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                                          Conversa encaminhada ao corretor
                                        </span>
                                        <div className="h-px flex-1 bg-zinc-700/60" />
                                      </div>
                                    )}
                                  </motion.div>
                                );
                              }

                              return (
                              <motion.div 
                                key={row.id} 
                                variants={bubble} 
                                layout
                                animate={controls}
                              >
                                {i === idxHandoff && idxHandoff > 0 && (
                                  <div className="flex items-center gap-2 my-2">
                                    <div className="h-px flex-1 bg-zinc-700/60" />
                                    <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                                      Atendido pelo SDR até aqui
                                    </span>
                                    <div className="h-px flex-1 bg-zinc-700/60" />
                                  </div>
                                )}
                                <MessageBubble row={row} />
                                
                                <div className={(() => {
                                  const rawMessage = row?.message;
                                  const m = typeof rawMessage === 'string'
                                    ? (() => { try { return JSON.parse(rawMessage); } catch { return {}; } })()
                                    : (rawMessage || {});
                                  const isAI = String(m?.type || '').toLowerCase() === 'ai';
                                  return isAI 
                                    ? "mt-1 text-right text-[11px] text-zinc-300" 
                                    : "mt-1 text-left text-[11px] text-zinc-400";
                                })()}
                                >
                                  {formatHour(row.data)}
                                </div>
                              </motion.div>
                              );
                            });
                          })()}
                          <div ref={endOfMessagesRef} />
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </ScrollArea>
                </div>

                {/* Composer evidente */}
                <div className="mt-2 rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-2 shadow-xl">
                  <div className="flex items-end gap-2">
                    {/* IMAGEM */}
                    <button
                      onClick={() => imgInputRef.current?.click()}
                      disabled={busy}
                      title="Enviar imagem"
                      className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700/60 bg-zinc-900/60 text-zinc-300 hover:text-white disabled:opacity-50"
                    >
                      🖼️
                    </button>
                    <input 
                      ref={imgInputRef} 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={onPickImage} 
                    />

                    {/* ÁUDIO */}
                    <button
                      onClick={recording ? stopRecord : startRecord}
                      disabled={busy}
                      title={recording ? "Parar e enviar" : "Gravar áudio"}
                      className={`grid h-10 w-10 place-items-center rounded-xl border border-zinc-700/60 
                                  ${recording ? "bg-rose-600 text-white animate-pulse" : "bg-zinc-900/60 text-zinc-300 hover:text-white"} 
                                  disabled:opacity-50`}
                    >
                      🎙️
                    </button>
                    {recording && (
                      <span className="mb-1 select-none text-xs text-rose-300">
                        {String(Math.floor(sec/60)).padStart(2,"0")}:{String(sec%60).padStart(2,"0")}
                      </span>
                    )}

                    {/* TEXTAREA */}
                    <textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={onTextareaKeyDown}
                      placeholder="Digite sua mensagem..."
                      disabled={busy}
                      className="min-h-[44px] max-h-[200px] w-full resize-none rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-400/30 disabled:opacity-50"
                      rows={1}
                    />

                    {/* ENVIAR TEXTO */}
                    <button
                      onClick={sendText}
                      disabled={busy || !messageInput.trim()}
                      title="Enviar"
                      className="grid h-10 w-10 place-items-center rounded-xl bg-sky-600 text-white shadow hover:brightness-110 disabled:opacity-60"
                    >
                      🛩️
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Resumo */}
      <SummaryModalAnimated
        isOpen={summaryModal.isOpen}
        onClose={() => setSummaryModal({ isOpen: false, data: null })}
        summaryData={summaryModal.data}
      />
    </div>
  );
}
