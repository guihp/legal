import { useState, useRef, useEffect } from 'react';
import { useChatUI as useChatsData } from '@/hooks/useChatUI';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Users, 
  MessageSquare, 
  Send, 
  Phone, 
  Clock, 
  Search,
  AlertCircle,
  ChevronRight,
  User,
  FileText,
  Mic,
  Square
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import ptBR from 'date-fns/locale/pt-BR';

// Função auxiliar para gerar iniciais
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export function ChatsView() {
  const { profile } = useUserProfile();
  
  console.log('🎬 ChatsView renderizado. Profile:', profile);
  
  const {
    loading,
    error,
    messagesLoading,
    corretoresLoading,
    conversasLoading,
    corretores,
    selectedCorretor,
    setSelectedCorretor,
    conversas,
    selectedChat,
    setSelectedChat,
    messages,
    sendMessage,
    loadCorretores,
    loadConversas,
    loadMessages
  } = useChatsData();

  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryJson, setSummaryJson] = useState<any | null>(null);
  
  // Estado: corretor sem instância atribuída
  const isCorretorWithoutInstance = profile?.role === 'corretor' && !(profile as any)?.chat_instance;

  // Carregar instâncias (corretores) ao montar
  useEffect(() => {
    if (profile?.role === 'corretor') {
      // Corretor: carregar diretamente as conversas da instância atribuída
      loadConversas();
    } else {
      // Gestor/Admin: carregar lista de instâncias (corretores)
      loadCorretores();
    }
  }, [profile?.role]);

  // Carregar conversas ao selecionar instância
  useEffect(() => {
    if (selectedCorretor) {
      loadConversas(selectedCorretor);
    }
  }, [selectedCorretor]);

  // Reagir quando a instância do corretor ficar disponível no perfil
  useEffect(() => {
    if (profile?.role === 'corretor') {
      loadConversas();
    }
  }, [profile?.role, (profile as any)?.chat_instance]);

  // Carregar mensagens ao selecionar conversa
  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat);
    }
  }, [selectedChat]);

  // UI pura: sem efeitos de CRM/Supabase

  // Scroll para o final das mensagens
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Filtrar conversas por termo de busca
  const filteredConversas = conversas.filter(conversa =>
    conversa.lead_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conversa.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (conversa.last_message && conversa.last_message.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Enviar mensagem
  const getLeadPhone = async (sessionId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('phone')
        .eq('id', sessionId)
        .maybeSingle();
      if (error) throw error;
      const phone = (data as any)?.phone || null;
      return phone ? String(phone) : null;
    } catch {
      return null;
    }
  };

  const postEnviarMensagem = async (payload: any) => {
    try {
      await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/enviar_mensagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Falha ao enviar para webhook enviar_mensagem', err);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChat || sendingMessage) return;

    setSendingMessage(true);
    const success = await sendMessage(selectedChat, messageInput);
    // Disparo ao webhook externo com número do cliente
    try {
      const phone = await getLeadPhone(selectedChat);
      await postEnviarMensagem({
        session_id: selectedChat,
        phone: phone,
        content: messageInput.trim(),
        type: 'text'
      });
    } catch {}
    
    if (success) {
      setMessageInput('');
    }
    setSendingMessage(false);
  };

  const getBestAudioMimeType = (): string | undefined => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4'
    ];
    for (const type of candidates) {
      // @ts-expect-error - MediaRecorder may be undefined in some browsers
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) return type;
    }
    return undefined;
  };

  const startRecording = async () => {
    if (isRecording) return;
    try {
      if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        toast({
          title: 'Conexão não segura',
          description: 'A gravação de áudio requer HTTPS. Acesse por HTTPS ou localhost.'
        });
        return;
      }
      toast({ title: 'Microfone', description: 'Solicitando permissão do microfone...' });
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
        toast({
          title: 'Gravação não suportada',
          description: 'Seu navegador não suporta gravação de áudio. Use um navegador atualizado com suporte a microfone.'
        });
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options: MediaRecorderOptions = {} as any;
      const preferred = getBestAudioMimeType();
      if (preferred) (options as any).mimeType = preferred;
      const recorder = new MediaRecorder(stream, options);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onerror = (e: any) => {
        console.error('Erro do MediaRecorder', e);
        toast({ title: 'Erro na gravação', description: 'Não foi possível gravar o áudio.' });
        try { stream.getTracks().forEach(t => t.stop()); } catch {}
        setIsRecording(false);
      };
      recorder.onstart = () => {
        toast({ title: 'Gravando áudio', description: 'Toque novamente no botão para parar.' });
      };
      recorder.onstop = async () => {
        const type = preferred || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string; // data URL
          if (selectedChat) {
            // Atualiza UI rapidamente
            await sendMessage(selectedChat, '[Áudio enviado]');
            const phone = await getLeadPhone(selectedChat);
            await postEnviarMensagem({
              session_id: selectedChat,
              phone: phone,
              content: '[Audio]',
              type: 'audio',
              audio_base64: base64
            });
          }
        };
        reader.readAsDataURL(blob);
        setIsRecording(false);
        // parar tracks do stream
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = recorder;
      // Passar timeslice garante eventos de dataavailable em alguns browsers
      recorder.start(250);
      setIsRecording(true);
    } catch (err) {
      console.error('Erro ao iniciar gravação de áudio', err);
      toast({
        title: 'Erro ao acessar o microfone',
        description: 'Verifique as permissões do navegador para o microfone e tente novamente.'
      });
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && isRecording) {
      rec.stop();
    } else {
      toast({ title: 'Nada para parar', description: 'Inicie uma gravação antes de parar.' });
    }
  };

  // Gerar resumo via n8n
  const handleGenerateSummary = async () => {
    if (!selectedChat) return;
    setSummaryError(null);
    setSummaryLoading(true);
    try {
      const response = await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/resumo_conversa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: selectedChat })
      });

      const raw = await response.text();
      let summary = raw;
      let parsed: any | null = null;
      const safeParse = (text: string) => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      };
      const parseMaybeEmbeddedJson = (value: any): any => {
        if (value && typeof value === 'string') {
          const trimmed = value.trim();
          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            const again = safeParse(trimmed);
            return again ?? value;
          }
        }
        return value;
      };

      parsed = safeParse(raw);
      if (parsed && typeof parsed === 'object') {
        // Alguns endpoints retornam o conteúdo em chaves como output/data/result/payload
        const candidate = ['output', 'data', 'result', 'payload', 'OUTPUT'].reduce((acc: any, key) => {
          if (acc !== null) return acc;
          if (parsed && Object.prototype.hasOwnProperty.call(parsed, key)) return (parsed as any)[key];
          return null;
        }, null);

        if (candidate !== null) {
          const maybe = parseMaybeEmbeddedJson(candidate);
          if (maybe && typeof maybe === 'object') {
            parsed = maybe;
          } else {
            // Se for string simples
            summary = String(maybe || raw);
          }
        }
      } else if (typeof parsed === 'string') {
        const again = parseMaybeEmbeddedJson(parsed);
        if (again && typeof again === 'object') parsed = again;
      }

      if (parsed && typeof parsed === 'object') {
        const maybeText = (parsed as any).summary || (parsed as any).resumo || (parsed as any).message || (parsed as any).resumo_conversa;
        if (typeof maybeText === 'string' && maybeText.trim()) {
          summary = maybeText;
        }
      }

      if (!response.ok) {
        throw new Error(summary || 'Falha ao gerar resumo');
      }

      setSummaryJson(parsed);
      setSummaryText(summary);
      setIsSummaryOpen(true);
    } catch (err: any) {
      setSummaryError(err?.message || 'Erro ao gerar resumo');
      setSummaryText('');
      setSummaryJson(null);
      setIsSummaryOpen(true);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Renderizador amigável para JSON do resumo
  const renderJsonValue = (value: any, depth = 0): JSX.Element => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400">nulo</span>;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return <span className="text-gray-200">{String(value)}</span>;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-400">[]</span>;
      return (
        <ul className="list-disc pl-5 space-y-1">
          {value.map((item, idx) => (
            <li key={idx} className="text-gray-200">
              {typeof item === 'object' && item !== null ? (
                <div className="mt-1 ml-1 border-l border-gray-700 pl-3">
                  {renderJsonValue(item, depth + 1)}
                </div>
              ) : (
                String(item)
              )}
            </li>
          ))}
        </ul>
      );
    }
    // objeto
    const entries = Object.entries(value as Record<string, any>);
    if (entries.length === 0) return <span className="text-gray-400">{{}}</span>;
    return (
      <div className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k} className="">
            <div className="text-gray-400 text-xs uppercase tracking-wide">{k}</div>
            <div className="mt-0.5">
              {typeof v === 'object' && v !== null ? (
                <div className="border border-gray-800 bg-gray-900/40 rounded-md p-3">
                  {renderJsonValue(v, depth + 1)}
                </div>
              ) : (
                <div className="text-gray-200">{String(v)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderFormattedSummary = () => {
    if (summaryLoading) {
      return (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
        </div>
      );
    }
    if (summaryError) {
      return <div className="text-red-400">{summaryError}</div>;
    }
    if (summaryJson && typeof summaryJson === 'object') {
      const hasStructuredKeys = (
        'resumo_conversa' in summaryJson ||
        'nota_atendimento' in summaryJson ||
        'status_atendimento' in summaryJson ||
        'proximas_acoes' in summaryJson ||
        'pendencias' in summaryJson ||
        'riscos' in summaryJson ||
        'recomendacoes_processos' in summaryJson ||
        'dados_extraidos' in summaryJson ||
        'metricas' in summaryJson ||
        'qualidade' in summaryJson ||
        'flags' in summaryJson
      );

      if (hasStructuredKeys) {
        const data = summaryJson as any;

        const renderListCard = (title: string, items?: any[], emoji?: string) => {
          if (!Array.isArray(items) || items.length === 0) return null;
          return (
            <Card className="bg-gray-900/60 border-gray-700/60 hover:border-emerald-600/40 transition-colors">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <span className="opacity-90">{emoji}</span>
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-gray-200 text-sm">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="mt-0.5">•</span>
                      <span className="leading-relaxed">{String(it)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        };

        const renderKeyValueCard = (title: string, obj?: Record<string, any>, emoji?: string) => {
          if (!obj || typeof obj !== 'object') return null;
          const entries = Object.entries(obj);
          if (entries.length === 0) return null;
          return (
            <Card className="bg-gray-900/60 border-gray-700/60 hover:border-emerald-600/40 transition-colors">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <span className="opacity-90">{emoji}</span>
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {entries.map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2">
                      <span className="text-gray-400 capitalize min-w-[8rem] sm:min-w-0">{k.replaceAll('_',' ')}</span>
                      <span className="text-gray-200 break-words">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        };

        const renderFlagsCard = (title: string, obj?: Record<string, any>) => {
          if (!obj || typeof obj !== 'object') return null;
          const entries = Object.entries(obj);
          if (entries.length === 0) return null;
          return (
            <Card className="bg-gray-900/60 border-gray-700/60 hover:border-emerald-600/40 transition-colors">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">🚩 {title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {entries.map(([k, v]) => (
                    <span
                      key={k}
                      className={cn(
                        "px-2 py-1 rounded-full text-xs border",
                        v ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      )}
                    >
                      {v ? '⚠️ ' : '✅ '}<span className="capitalize">{k.replaceAll('_',' ')}</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        };

        const dadosExtraidos: any = data.dados_extraidos || {};

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nota */}
              {'nota_atendimento' in data && (
                <Card className="bg-gray-900/60 border-gray-700/60 hover:border-emerald-600/40 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-white text-sm flex items-center gap-2">⭐ Nota de Atendimento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={cn(
                        "text-3xl font-extrabold tracking-tight drop-shadow",
                        Number(data.nota_atendimento) >= 8 ? 'text-emerald-400' : Number(data.nota_atendimento) >= 6 ? 'text-amber-300' : 'text-red-400'
                      )}
                    >
                      {String(data.nota_atendimento)}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Status */}
              {'status_atendimento' in data && (
                <Card className="bg-gray-900/60 border-gray-700/60 hover:border-emerald-600/40 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-white text-sm flex items-center gap-2">📌 Status de Atendimento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const s = String(data.status_atendimento || '').toLowerCase();
                      const styles = s === 'aberto' || s === 'em_andamento'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : s === 'pendente'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-gray-500/15 text-gray-300 border-gray-500/30';
                      const icon = s === 'aberto' || s === 'em_andamento' ? '🟢' : s === 'pendente' ? '⏳' : '⚪';
                      return (
                        <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full border", styles)}>
                          <span>{icon}</span>
                          <span className="capitalize">{String(data.status_atendimento)}</span>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Resumo */}
              {'resumo_conversa' in data && (
                <Card className="md:col-span-2 bg-gray-900/60 border-gray-700/60 hover:border-emerald-600/40 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-white text-sm flex items-center gap-2">📝 Resumo da conversa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-gray-200 whitespace-pre-wrap">{String(data.resumo_conversa)}</div>
                  </CardContent>
                </Card>
              )}

              {/* Listas principais */}
              {renderListCard('Próximas ações', data.proximas_acoes, '➡️')}
              {renderListCard('Pendências', data.pendencias, '⏳')}
              {renderListCard('Riscos', data.riscos, '⚠️')}
              {renderListCard('Recomendações de processos', data.recomendacoes_processos, '🧭')}

              {/* Dados extraídos */}
              {(dadosExtraidos.cliente || dadosExtraidos.imovel || dadosExtraidos.agendamento) && (
                <Card className="md:col-span-2 bg-gray-900/60 border-gray-700/60 hover:border-emerald-600/40 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-white text-sm flex items-center gap-2">📤 Dados extraídos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {dadosExtraidos.cliente && (
                        <div>
                          <div className="text-xs text-gray-400 uppercase mb-2 flex items-center gap-2">👤 Cliente</div>
                          {renderKeyValueCard('', dadosExtraidos.cliente, '')}
                        </div>
                      )}
                      {dadosExtraidos.imovel && (
                        <div>
                          <div className="text-xs text-gray-400 uppercase mb-2 flex items-center gap-2">🏠 Imóvel</div>
                          {renderKeyValueCard('', dadosExtraidos.imovel, '')}
                        </div>
                      )}
                      {dadosExtraidos.agendamento && (
                        <div>
                          <div className="text-xs text-gray-400 uppercase mb-2 flex items-center gap-2">📅 Agendamento</div>
                          {renderKeyValueCard('', dadosExtraidos.agendamento, '')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Métricas, Qualidade, Flags */}
              {renderKeyValueCard('Métricas', data.metricas, '📊')}
              {renderKeyValueCard('Qualidade', data.qualidade, '✨')}
              {renderFlagsCard('Flags', data.flags)}
            </div>
          </div>
        );
      }

      const topText: string | null =
        typeof summaryJson.summary === 'string' ? summaryJson.summary :
        typeof summaryJson.resumo === 'string' ? summaryJson.resumo :
        typeof summaryJson.message === 'string' ? summaryJson.message :
        null;

      const rest: Record<string, any> = { ...summaryJson } as Record<string, any>;
      if ('summary' in rest) delete rest.summary;
      if ('resumo' in rest) delete rest.resumo;
      if ('message' in rest) delete rest.message;

      return (
        <div className="space-y-4">
          {topText && (
            <div className="bg-emerald-600/10 border border-emerald-600/30 text-emerald-200 rounded-md p-3 whitespace-pre-wrap">
              {topText}
            </div>
          )}
          {Object.keys(rest).length > 0 ? (
            <div className="space-y-2">
              {renderJsonValue(rest)}
            </div>
          ) : null}
          {!topText && Object.keys(rest).length === 0 && summaryText && (
            <div className="text-gray-200 whitespace-pre-wrap">{summaryText}</div>
          )}
        </div>
      );
    }
    return <div className="text-gray-200 whitespace-pre-wrap">{summaryText || 'Nenhum conteúdo retornado.'}</div>;
  };

  // Formatação de tempo
  const formatMessageTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), {
        addSuffix: true,
        locale: ptBR
      });
    } catch {
      return 'Agora há pouco';
    }
  };

  // Renderizar lista de corretores (para gestores)
  const renderCorretoresList = () => (
    <div className="w-72 border-r border-gray-700/50 bg-gradient-to-b from-gray-900 to-gray-950 flex flex-col shadow-xl">
      <div className="relative p-6 border-b border-gray-700/50 bg-gradient-to-r from-gray-900/90 to-gray-850">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5"></div>
        <div className="relative flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
            <Users className="h-5 w-5 text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Corretores</h2>
        </div>
        <div className="text-sm text-gray-400 bg-gray-800/50 px-3 py-2 rounded-lg border border-gray-700/50">
          {corretores.length} corretor(es) ativo(s)
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {corretoresLoading && corretores.length === 0 ? (
            <div className="text-center py-8">
              <div className="relative mx-auto mb-4 w-6 h-6">
                <div className="absolute inset-0 border-2 border-blue-500/30 rounded-full"></div>
                <div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="text-gray-400 text-sm">Carregando corretores...</div>
            </div>
          ) : (
            corretores.map((corretor) => (
            <Card
              key={corretor.corretor_id}
              className={cn(
                "cursor-pointer transition-all duration-300 bg-gradient-to-r from-gray-900/90 to-gray-950/90 border-gray-700/50 hover:from-gray-800/95 hover:to-gray-900/95 hover:shadow-lg hover:border-gray-600/50 backdrop-blur-sm",
                selectedCorretor === corretor.corretor_id && "from-gray-950/95 to-black/90 border-green-600/80 shadow-lg shadow-green-500/30 ring-1 ring-green-500/20"
              )}
              onClick={() => setSelectedCorretor(corretor.corretor_id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className={cn(
                        "text-white font-semibold border-2",
                        corretor.corretor_id === 'sdr-agent' 
                          ? "bg-gradient-to-br from-purple-600 to-purple-700 border-purple-500/30" 
                          : "bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500/30"
                      )}>
                        {getInitials(corretor.corretor_nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-gray-900",
                      corretor.corretor_id === 'sdr-agent' ? "bg-purple-500" : "bg-green-500"
                    )}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate flex items-center gap-2 mb-1">
                      {corretor.corretor_nome}
                      {corretor.corretor_id === 'sdr-agent' && (
                        <Badge className="bg-gradient-to-r from-purple-600 to-purple-700 text-white text-xs border border-purple-500/30">
                          SDR
                        </Badge>
                      )}
                    </div>
                    <div className={cn(
                      "text-xs flex items-center gap-2",
                      selectedCorretor === corretor.corretor_id ? "text-gray-200" : "text-gray-400"
                    )}>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{corretor.total_conversas} conversa(s)</span>
                      </div>
                      {corretor.corretor_id === 'sdr-agent' && (
                        <>
                          <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                          <span className={cn(
                            selectedCorretor === corretor.corretor_id ? "text-purple-300" : "text-purple-400"
                          )}>Sistema</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    selectedCorretor === corretor.corretor_id ? "text-green-400 transform rotate-90" : "text-gray-400"
                  )} />
                </div>
              </CardContent>
            </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Renderizar lista de conversas
  const renderConversasList = () => (
    <div className={cn(
      "border-r border-gray-700/50 bg-gradient-to-b from-gray-900 to-gray-950 flex flex-col shadow-xl min-w-0 overflow-hidden",
      profile?.role === 'corretor' ? "w-[28rem]" : "w-96"
    )}>
      <div className="relative p-6 border-b border-gray-700/50 bg-gradient-to-r from-gray-900/90 to-gray-850">
        <div className="absolute inset-0 bg-gradient-to-r from-green-600/5 to-blue-600/5"></div>
        <div className="relative flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-600/20 rounded-lg border border-green-500/30">
            <MessageSquare className="h-5 w-5 text-green-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">
            {profile?.role === 'corretor' ? 'Minhas Conversas' : 'Conversas'}
          </h2>
        </div>
        
        {/* Busca Premium */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar conversas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-gray-800/80 border-gray-600/50 text-white placeholder-gray-400 rounded-xl backdrop-blur-sm focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400 bg-gray-800/50 px-3 py-2 rounded-lg border border-gray-700/50">
            {filteredConversas.length} conversa(s)
          </div>
          {profile?.role !== 'corretor' && selectedCorretor && (
            <div className="text-xs text-blue-400 bg-blue-600/10 px-2 py-1 rounded-full border border-blue-500/30">
              {corretores.find(c => c.corretor_id === selectedCorretor)?.corretor_nome || selectedCorretor}
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 min-w-0">
        <div className="p-4 space-y-3 min-w-0">
          {conversasLoading && conversas.length === 0 ? (
            <div className="text-center py-8">
              <div className="relative mx-auto mb-4 w-6 h-6">
                <div className="absolute inset-0 border-2 border-green-500/30 rounded-full"></div>
                <div className="absolute inset-0 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="text-gray-400 text-sm">Carregando conversas...</div>
            </div>
          ) : (
            filteredConversas.map((conversa) => (
            <Card
              key={conversa.chat_id}
              className={cn(
                "cursor-pointer transition-all duration-300 bg-gradient-to-r from-gray-900/90 to-gray-950/90 border-gray-700/50 hover:from-gray-800/95 hover:to-gray-900/95 hover:shadow-lg hover:border-gray-600/50 backdrop-blur-sm h-32 min-h-32 max-h-32 w-[90%] overflow-hidden",
                selectedChat === conversa.chat_id && "from-gray-950/95 to-black/90 border-green-600/80 shadow-lg shadow-green-500/30 ring-1 ring-green-500/20"
              )}
              onClick={() => setSelectedChat(conversa.chat_id)}
            >
              <CardContent className="p-4 h-full min-w-0 w-full">
                <div className="flex items-start gap-3 h-full min-w-0">
                  {/* Avatar do Lead Premium */}
                  <div className="relative">
                    <Avatar className="w-12 h-12 border-2 border-gray-600/30">
                      <AvatarFallback className={cn(
                        "text-white font-semibold",
                        conversa.corretor_id === 'sdr-agent' 
                          ? "bg-gradient-to-br from-purple-600 to-purple-700" 
                          : "bg-gradient-to-br from-green-600 to-green-700"
                      )}>
                        {getInitials(conversa.lead_name)}
                      </AvatarFallback>
                    </Avatar>
                    {conversa.unread_count > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 rounded-full border-2 border-gray-900 flex items-center justify-center">
                        <span className="text-xs text-white font-bold">{conversa.unread_count}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                    <div>
                      {/* Nome do Lead */}
                      <div className="font-medium text-white truncate mb-2 flex items-center gap-2">
                        {conversa.lead_name}
                        {conversa.corretor_id === 'sdr-agent' && (
                          <Badge className="bg-gradient-to-r from-purple-600 to-purple-700 text-white text-xs border border-purple-500/30">
                            SDR
                          </Badge>
                        )}
                      </div>
                      
                      {/* Última mensagem */}
                      <div className={cn(
                        "text-sm leading-relaxed overflow-hidden break-words line-clamp-2 mb-2",
                        selectedChat === conversa.chat_id ? "text-gray-100" : "text-gray-300"
                      )}>
                        {conversa.last_message || (
                          <span className={cn(
                            "italic",
                            selectedChat === conversa.chat_id ? "text-gray-300" : "text-gray-500"
                          )}>Nenhuma mensagem</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Informações adicionais */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {conversa.lead_phone && (
                          <div className={cn(
                            "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md",
                            selectedChat === conversa.chat_id 
                              ? "text-gray-200 bg-gray-800/70" 
                              : "text-gray-400 bg-gray-700/50"
                          )}>
                            <Phone className="h-3 w-3 text-blue-400" />
                            <span className="truncate max-w-[8rem] font-medium">
                              {conversa.lead_phone}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {conversa.last_message_time && (
                          <div className={cn(
                            "text-xs px-2 py-1 rounded-md flex items-center gap-1",
                            selectedChat === conversa.chat_id 
                              ? "text-gray-200 bg-gray-800/70" 
                              : "text-gray-500 bg-gray-800/50"
                          )}>
                            <Clock className="h-3 w-3" />
                            {formatMessageTime(conversa.last_message_time)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            ))
          )}
          
          {filteredConversas.length === 0 && !loading && !conversasLoading && (
            <div className="text-center py-12">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-blue-600/20 rounded-full blur-xl"></div>
                <MessageSquare className="relative h-12 w-12 mx-auto opacity-50" />
              </div>
              <div className="text-gray-300 font-medium mb-2">Nenhuma conversa encontrada</div>
              {searchTerm && (
                <div className="text-sm text-gray-400">
                  Tente ajustar o termo de busca
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Renderizar área de mensagens
  const renderMessagesArea = () => {
    const selectedConversa = conversas.find(c => c.chat_id === selectedChat);
    
    if (!selectedChat || !selectedConversa) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-800 via-gray-850 to-gray-900 border-l border-gray-700/50">
          <div className="text-center text-gray-400">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-green-600/20 rounded-full blur-xl"></div>
              <MessageSquare className="relative h-16 w-16 mx-auto opacity-60" />
            </div>
            <div className="text-lg font-medium mb-2 text-gray-300">Selecione uma conversa</div>
            <div className="text-sm max-w-xs">
              {profile?.role === 'corretor' 
                ? 'Escolha uma conversa para visualizar as mensagens'
                : 'Selecione um corretor e depois uma conversa'
              }
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-gradient-to-b from-gray-800 to-gray-850 border-l border-gray-700/50 shadow-2xl">
        {/* Header da conversa - Design Premium */}
        <div className="relative p-6 border-b border-gray-700/50 bg-gradient-to-r from-gray-900/90 via-gray-850 to-gray-900/90 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-green-600/5"></div>
          <div className="relative flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-green-600 rounded-full blur-sm opacity-50"></div>
              <Avatar className="relative w-12 h-12 border-2 border-green-500/30">
                <AvatarFallback className="bg-gradient-to-br from-green-600 to-green-700 text-white font-semibold">
                  {getInitials(selectedConversa.lead_name)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900"></div>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-white text-lg mb-1">
                {selectedConversa.lead_name}
              </div>
              <div className="text-sm text-gray-300 flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-blue-400" />
                  <span className="font-medium">{selectedConversa.lead_phone}</span>
                </div>
                {profile?.role !== 'corretor' && (
                  <>
                    <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-purple-400" />
                      <span>{selectedConversa.corretor_nome}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Button
                onClick={handleGenerateSummary}
                disabled={summaryLoading}
                className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-500/30"
              >
                {summaryLoading ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Gerar resumo
              </Button>
              <div className="text-xs text-gray-400 bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-700/50">
                <Clock className="h-3 w-3 inline mr-1" />
                Online
              </div>
            </div>
          </div>
        </div>

        {/* Área de mensagens - Design Moderno */}
        <ScrollArea className="flex-1 p-6 bg-gradient-to-b from-gray-850/50 to-gray-900/50">
          <div className="space-y-6">
            {messagesLoading ? (
              <div className="text-center py-12">
                <div className="relative mx-auto mb-4 w-8 h-8">
                  <div className="absolute inset-0 border-3 border-blue-500/30 rounded-full"></div>
                  <div className="absolute inset-0 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="text-gray-300 font-medium">Carregando mensagens...</div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-full blur-xl"></div>
                  <MessageSquare className="relative h-12 w-12 mx-auto opacity-50" />
                </div>
                <div className="text-gray-300 font-medium mb-2">Nenhuma mensagem ainda</div>
                <div className="text-sm text-gray-400">
                  Seja o primeiro a enviar uma mensagem!
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-end gap-3 group",
                    message.from_me ? "justify-end" : "justify-start"
                  )}
                >
                  {!message.from_me && (
                    <Avatar className="w-8 h-8 opacity-80 group-hover:opacity-100 transition-opacity">
                      <AvatarFallback className="bg-gradient-to-br from-green-600 to-green-700 text-white text-xs">
                        {getInitials(selectedConversa.lead_name)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div
                    className={cn(
                      "relative max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-lg transition-all duration-200 group-hover:shadow-xl",
                      message.from_me
                        ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md border border-blue-500/30"
                        : "bg-gradient-to-br from-gray-700 to-gray-750 text-gray-100 rounded-bl-md border border-gray-600/50"
                    )}
                  >
                    {/* Indicador de mensagem anterior */}
                    {index > 0 && messages[index - 1].from_me !== message.from_me && (
                      <div className={cn(
                        "absolute w-3 h-3 rotate-45 border-l border-t",
                        message.from_me 
                          ? "-bottom-1.5 right-4 bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500/30"
                          : "-bottom-1.5 left-4 bg-gradient-to-br from-gray-700 to-gray-750 border-gray-600/50"
                      )}></div>
                    )}
                    
                    <div className="text-sm leading-relaxed">{message.content}</div>
                    <div className={cn(
                      "text-xs mt-2 flex items-center gap-1",
                      message.from_me ? "text-blue-100/80 justify-end" : "text-gray-400"
                    )}>
                      <Clock className="h-3 w-3 opacity-60" />
                      {formatMessageTime(message.timestamp)}
                      {message.from_me && (
                        <div className="w-1 h-1 bg-blue-300 rounded-full ml-1"></div>
                      )}
                    </div>
                  </div>
                  
                  {message.from_me && (
                    <Avatar className="w-8 h-8 opacity-80 group-hover:opacity-100 transition-opacity">
                      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xs">
                        {profile?.nome ? getInitials(profile.nome) : 'EU'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Área de envio - universal (texto e áudio) */}
        <div className="relative p-6 border-t border-gray-700/50 bg-gradient-to-r from-gray-900/90 via-gray-850 to-gray-900/90 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/3 to-purple-600/3"></div>
          <div className="relative flex gap-3">
            <div className="flex-1 relative">
              <Input
                placeholder="Digite sua mensagem..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="bg-gray-800/80 border-gray-600/50 text-white placeholder-gray-400 rounded-xl px-4 py-3 pr-12 backdrop-blur-sm shadow-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                disabled={sendingMessage}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <Button
              type="button"
              onClick={() => {
                if (isRecording) stopRecording(); else startRecording();
              }}
              className={cn(
                "px-3 py-3 rounded-xl border transition-all duration-200",
                isRecording
                  ? "bg-red-700 hover:bg-red-800 border-red-500/40"
                  : "bg-purple-700 hover:bg-purple-800 border-purple-500/40"
              )}
              title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
            >
              {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || sendingMessage}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed border border-blue-500/30"
            >
              {sendingMessage ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="text-xs text-gray-400 mt-3 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-green-500 rounded-full"></div>
              <span>Pressione Enter para enviar</span>
            </div>
            <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
            <span>Shift+Enter para quebrar linha</span>
            <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
            <span>{isRecording ? 'Gravando...' : 'Envie áudio pelo botão de microfone'}</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-850 to-gray-900">
        <div className="text-center">
          <div className="relative mx-auto mb-6 w-12 h-12">
            <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="text-gray-300 font-medium text-lg mb-2">Carregando conversas...</div>
          <div className="text-gray-400 text-sm">Aguarde enquanto buscamos suas mensagens</div>
        </div>
      </div>
    );
  }

  // Corretores sem instância atribuída: mensagem clara
  if (isCorretorWithoutInstance) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-850 to-gray-900">
        <div className="text-center max-w-md">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-full blur-xl"></div>
            <AlertCircle className="relative h-16 w-16 mx-auto text-amber-400" />
          </div>
          <div className="text-lg font-medium mb-3 text-amber-300">Nenhuma instância atribuída</div>
          <div className="text-sm text-gray-300 bg-gray-800/50 p-4 rounded-lg border border-amber-500/20">
            Peça a um gestor para atribuir uma instância ao seu usuário para visualizar as conversas.
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-850 to-gray-900">
        <div className="text-center max-w-md">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-orange-600/20 rounded-full blur-xl"></div>
            <AlertCircle className="relative h-16 w-16 mx-auto text-red-400" />
          </div>
          <div className="text-lg font-medium mb-3 text-red-300">Erro ao carregar</div>
          <div className="text-sm text-gray-400 bg-gray-800/50 p-4 rounded-lg border border-red-500/20">
            {error}
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-6 bg-gradient-to-br from-gray-900 via-gray-850 to-gray-900">
      {/* Card Principal com Bordas Verdes */}
      <Card className="h-full bg-gradient-to-br from-gray-900/90 to-gray-950/90 border-2 border-green-600/60 shadow-2xl shadow-green-500/20 overflow-hidden">
        <CardHeader className="pb-4 border-b border-green-600/30 bg-gradient-to-r from-gray-900/80 to-gray-850/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-600/20 rounded-lg border border-green-500/40">
              <MessageSquare className="h-6 w-6 text-green-400" />
            </div>
            <CardTitle className="text-xl font-bold text-white">
              Sistema de Mensagens
            </CardTitle>
            <div className="ml-auto flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-400 font-medium">Online</span>
            </div>
          </div>
        </CardHeader>
        
        {/* Banner de CRM removido (UI pura) */}
        
        <CardContent className="p-0 h-[calc(100%-5rem)] overflow-hidden">
          <div className="h-full flex bg-gradient-to-br from-gray-800/50 via-gray-850/50 to-gray-900/50 text-white relative">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.1)_1px,transparent_0)] bg-[size:20px_20px]"></div>
            </div>
            
            {/* Lista de corretores (apenas para gestores/admins) */}
            {profile?.role !== 'corretor' && renderCorretoresList()}
            
            {/* Lista de conversas */}
            {(profile?.role === 'corretor' || selectedCorretor) && renderConversasList()}
            
            {/* Área de mensagens */}
            {renderMessagesArea()}
          </div>
        </CardContent>
      </Card>

      {/* Modal de resumo da conversa */}
      <Dialog open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
        <DialogContent className="bg-gray-900 text-white border border-gray-700">
          <DialogHeader>
            <DialogTitle>Resumo da conversa</DialogTitle>
            <DialogDescription className="text-gray-400">
              {summaryLoading
                ? 'Gerando resumo...'
                : summaryError
                ? 'Ocorreu um erro ao gerar o resumo.'
                : 'Resumo gerado a partir das mensagens desta conversa.'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4 pr-2">
            <div className="text-sm leading-relaxed">
              {renderFormattedSummary()}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}