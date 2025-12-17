import React, { useState, useCallback } from 'react';
import { MessageSquare, Search, Send, Paperclip, Smile, Wifi, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useConversasInstances } from '@/hooks/useConversasInstances';
import { useConversasList } from '@/hooks/useConversasList';
import { useConversaMessages } from '@/hooks/useConversaMessages';
import { useConversasRealtime } from '@/hooks/useConversasRealtime';
import { ConversationActionsMenu } from './ConversationActionsMenu';
import { SummaryModalAnimated } from './SummaryModalAnimated';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

if ((import.meta as any).env?.DEV) { (window as any).supabase = supabase; }

// Tipos para as estruturas de dados
interface WhatsAppInstance {
  id: string;
  name: string;
  phone: string;
  status: 'connected' | 'disconnected' | 'connecting';
  avatar?: string;
}

interface Conversation {
  id: string;
  instanceId: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  avatar?: string;
}

interface Message {
  id: string;
  conversationId: string;
  content: string;
  timestamp: string;
  isFromMe: boolean;
  type: 'text' | 'image' | 'document';
}

// Tipos mantidos para compatibilidade, mas dados agora vêm do banco

export function ConversasView() {
  const { instances, loading: loadingInstances, error: errorInstances, refetch: refetchInstances } = useConversasInstances();
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [summaryModal, setSummaryModal] = useState<{
    isOpen: boolean;
    data: any;
  }>({ isOpen: false, data: null });
  
  const { conversas, loading: loadingConversas, error: errorConversas, updateConversation } = useConversasList(selectedInstance);
  const { messages, loading: loadingMessages, error: errorMessages, openSession, refetch, setMyInstance } = useConversaMessages();
  const endOfMessagesRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, selectedConversation, loadingMessages]);

  // Definir instância ativa para computar o handoff (SDR → Instância atual)
  React.useEffect(() => {
    setMyInstance(selectedInstance ? String(selectedInstance).trim().toLowerCase() : null);
  }, [selectedInstance, setMyInstance]);
  const { profile } = useUserProfile();
  const { toast } = useToast();

  // Encontrar conversa selecionada
  const currentConversation = conversas.find(
    conv => conv.sessionId === selectedConversation
  );

  // Função para parse robusto do retorno
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

  // Handlers para ações da conversa
  const handleGenerateSummary = useCallback(async (conversation: any) => {
    try {
      // Abrir modal em estado de loading
      setSummaryModal({
        isOpen: true,
        data: { loading: true }
      });

      const response = await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/resumo_conversa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: conversation.sessionId,
          instancia: conversation.instancia,
          user_email: profile?.email || '',
          role: profile?.role || ''
        }),
      });

      const result = await response.json();
      
      // Parse robusto do retorno
      let summaryData;
      try {
        // Se for array, pegar o primeiro item
        const item = Array.isArray(result) ? result[0] : result;
        
        // Pegar item.output e fazer parse seguro
        if (item && item.output) {
          summaryData = safeParse(item.output);
        } else {
          summaryData = item || result;
        }
      } catch (error) {
        console.error('Erro no parse do resumo:', error);
        summaryData = { error: true };
      }

      // Atualizar modal com dados parseados
      setSummaryModal({
        isOpen: true,
        data: summaryData
      });
    } catch (error) {
      console.error('Erro ao gerar resumo:', error);
      setSummaryModal({
        isOpen: true,
        data: { error: true }
      });
    }
  }, [profile, safeParse]);

  const handleFollowUp = useCallback(async (conversation: any) => {
    try {
      const response = await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/follow-up-chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: conversation.sessionId,
          instancia: conversation.instancia,
          user_email: profile?.email || '',
          role: profile?.role || ''
        }),
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Follow up solicitado com sucesso.",
        });
      } else {
        throw new Error('Falha na requisição');
      }
    } catch (error) {
      console.error('Erro ao fazer follow up:', error);
      toast({
        title: "Erro",
        description: "Falha ao solicitar follow up.",
        variant: "destructive",
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleFollowUp(conversation)}
          >
            Tentar novamente
          </Button>
        ),
      });
    }
  }, [profile, toast]);

  // Configurar Realtime
  useConversasRealtime({
    onInstanceUpdate: () => {
      refetchInstances();
    },
    onConversationUpdate: (sessionId: string) => {
      updateConversation(sessionId);
    },
    onMessageUpdate: (sessionId: string, message: any) => {
      // Se a conversa aberta é a mesma da nova mensagem, adicionar à timeline
      if (selectedConversation === sessionId) {
        refetch();
      }
    }
  });

  const getStatusColor = (status: WhatsAppInstance['status']) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: WhatsAppInstance['status']) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando';
      case 'disconnected': return 'Desconectado';
      default: return 'Desconhecido';
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Coluna Esquerda - Lista de Instâncias */}
      <Card className="w-80 bg-gray-900 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Instâncias WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <div className="space-y-2 p-4">
              {loadingInstances ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
                    <div className="text-gray-300">Carregando instâncias...</div>
                  </div>
                </div>
              ) : errorInstances ? (
                <div className="text-center p-4">
                  <div className="text-red-400 mb-2">Erro ao carregar</div>
                  <div className="text-gray-400 text-sm">{errorInstances}</div>
                </div>
              ) : instances.length === 0 ? (
                <div className="text-center p-4">
                  <WifiOff className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                  <div className="text-gray-400 mb-2">Nenhuma instância encontrada</div>
                  <div className="text-gray-500 text-sm">
                    Não há instâncias WhatsApp disponíveis para você.
                  </div>
                </div>
              ) : (
                instances.map((instance) => (
                  <div
                    key={instance.instancia || 'empty'}
                    onClick={() => setSelectedInstance(instance.instancia)}
                    className={`
                      p-3 rounded-lg cursor-pointer transition-all duration-200
                      ${selectedInstance === instance.instancia 
                        ? 'bg-blue-600/20 border border-blue-500/30' 
                        : 'bg-gray-800/50 hover:bg-gray-800'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-gray-700 text-white">
                            {instance.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-gray-900 bg-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">
                          {instance.displayName}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {instance.conversationCount} conversas
                        </p>
                        <Badge 
                          variant="outline" 
                          className="text-xs mt-1 border-green-500/30 text-green-300"
                        >
                          <Wifi className="h-3 w-3 mr-1" />
                          Ativa
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Coluna Central - Lista de Conversas */}
      <Card className="w-96 bg-gray-900 border-gray-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Conversas</CardTitle>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar conversas..."
              className="pl-10 bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="space-y-1">
              {loadingConversas ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
                    <div className="text-gray-300">Carregando conversas...</div>
                  </div>
                </div>
              ) : errorConversas ? (
                <div className="text-center p-4">
                  <div className="text-red-400 mb-2">Erro ao carregar conversas</div>
                  <div className="text-gray-400 text-sm">{errorConversas}</div>
                </div>
              ) : !selectedInstance ? (
                <div className="text-center p-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                  <div className="text-gray-400 mb-2">Selecione uma instância</div>
                  <div className="text-gray-500 text-sm">
                    Escolha uma instância WhatsApp para ver as conversas
                  </div>
                </div>
              ) : conversas.length === 0 ? (
                <div className="text-center p-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                  <div className="text-gray-400 mb-2">Nenhuma conversa encontrada</div>
                  <div className="text-gray-500 text-sm">
                    Não há conversas para esta instância
                  </div>
                </div>
              ) : (
                conversas.map((conversa) => (
                  <div
                    key={conversa.sessionId}
                    onClick={() => { setSelectedConversation(conversa.sessionId); openSession(conversa.sessionId); }}
                    className={`
                      p-4 cursor-pointer transition-all duration-200 border-b border-gray-800/50
                      ${selectedConversation === conversa.sessionId 
                        ? 'bg-blue-600/20 border-l-2 border-l-blue-500' 
                        : 'hover:bg-gray-800/50'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 flex-shrink-0">
                        <AvatarFallback className={`text-white ${
                          conversa.displayName !== conversa.sessionId ? 'bg-purple-600' : 'bg-gray-700'
                        }`}>
                          {conversa.displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-white font-medium truncate">
                            {conversa.displayName !== conversa.sessionId ? (
                              conversa.displayName
                            ) : (
                              <span className="text-gray-400 animate-pulse">
                                aguardando nome do lead...
                              </span>
                            )}
                          </p>
                          <span className="text-gray-400 text-xs flex-shrink-0">
                            {new Date(conversa.lastMessageDate).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        
                        {/* Mostrar telefone do lead se disponível */}
                        {conversa.leadPhone && (
                          <p className="text-blue-300 text-xs mb-1 truncate">
                            📞 {conversa.leadPhone.replace('@s.whatsapp.net', '')}
                          </p>
                        )}
                        
                        {/* Se não há nome do lead, mostrar session_id como subtítulo */}

                        
                        <p className="text-gray-400 text-sm truncate mb-2">
                          {conversa.lastMessageContent}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {conversa.leadStage && (
                              <Badge 
                                variant="outline" 
                                className="text-xs border-purple-500/30 text-purple-300"
                              >
                                {conversa.leadStage}
                              </Badge>
                            )}
                          </div>
                          <Badge className="bg-gray-600 text-white text-xs">
                            💬 {conversa.messageCount}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Coluna Direita - Janela da Conversa */}
      <Card className="flex-1 bg-gray-900 border-gray-700 flex flex-col">
        {currentConversation ? (
          <>
            {/* Header da Conversa */}
            <CardHeader className="pb-4 border-b border-gray-700 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={`text-white ${
                      currentConversation.displayName !== currentConversation.sessionId ? 'bg-purple-600' : 'bg-gray-700'
                    }`}>
                      {currentConversation.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    {/* Título principal */}
                    <h3 className="text-base md:text-lg font-semibold text-white">
                      {currentConversation.displayName === currentConversation.sessionId 
                        ? 'Aguardando nome do lead...' 
                        : currentConversation.displayName
                      }
                    </h3>
                    
                    {/* Subtítulo com telefone e badge de estágio */}
                    {(currentConversation.leadPhone || currentConversation.leadStage) && (
                      <div className="flex items-center gap-2 mt-1">
                        {currentConversation.leadPhone && (
                          <span className="text-xs md:text-sm text-zinc-400">
                            {currentConversation.leadPhone.replace('@s.whatsapp.net', '')}
                          </span>
                        )}
                        
                        {currentConversation.leadPhone && currentConversation.leadStage && (
                          <span className="text-zinc-500">•</span>
                        )}
                        
                        {currentConversation.leadStage && (
                          <span className="inline-flex items-center rounded-full border border-white/10 px-2 py-0.5 text-xs text-purple-300 border-purple-500/30">
                            {currentConversation.leadStage}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ConversationActionsMenu 
                    conversation={currentConversation}
                    onGenerateSummary={handleGenerateSummary}
                    onFollowUp={handleFollowUp}
                  />
                </div>
              </div>
            </CardHeader>

            {/* Área de Mensagens */}
            <CardContent className="flex-1 p-4 overflow-hidden">
              <ScrollArea className="h-[calc(100vh-24rem)] pr-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
                      <div className="text-gray-300">Carregando mensagens...</div>
                    </div>
                  </div>
                ) : errorMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-red-400 mb-2">Erro ao carregar mensagens</div>
                      <div className="text-gray-400 text-sm">{errorMessages}</div>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                      <div className="text-gray-400 mb-2">Nenhuma mensagem</div>
                      <div className="text-gray-500 text-sm">
                        Esta conversa não possui mensagens
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      const currentInst = String((selectedInstance || '')).toLowerCase();
                      const idxHandoff = messages.findIndex((m: any) => m && m.before_handoff === false);
                      const hasCurrent = !!currentInst && messages.some((m: any) => String(m?.instancia || '').toLowerCase() === currentInst);
                      const idxFirstCurrent = hasCurrent ? messages.findIndex((m: any) => String(m?.instancia || '').toLowerCase() === currentInst) : -1;
                      const idxForward = idxFirstCurrent >= 0
                        ? messages.findIndex((m: any, ii: number) => ii > idxFirstCurrent && String(m?.instancia || '').toLowerCase() !== currentInst)
                        : -1;
                      return messages.map((message: any, i: number) => {
                        if (idxForward > 0 && i > idxForward) return null;
                        return (
                      <div
                        key={message.id}
                        className={`flex ${message.message.type === 'ai' ? 'justify-end' : 'justify-start'}`}
                      >
                        {i === idxHandoff && idxHandoff > 0 && (
                          <div className="flex items-center gap-2 my-2 w-full">
                            <div className="h-px flex-1 bg-gray-700/60" />
                            <span className="text-[11px] text-gray-400 whitespace-nowrap">
                              Atendido pelo SDR até aqui
                            </span>
                            <div className="h-px flex-1 bg-gray-700/60" />
                          </div>
                        )}
                        {profile?.role === 'gestor' && idxForward > 0 && i === idxForward && (
                          <div
                            className="flex items-center gap-2 my-2 w-full cursor-pointer select-none"
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
                        )}
                        <div
                          className={`
                            max-w-xs lg:max-w-md px-4 py-3 rounded-lg
                            ${message.message.type === 'ai' 
                              ? 'bg-blue-600 text-white rounded-br-sm' 
                              : 'bg-gray-700 text-white rounded-bl-sm'
                            }
                          `}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                message.message.type === 'ai' 
                                  ? 'border-blue-200/30 text-blue-100' 
                                  : 'border-gray-400/30 text-gray-300'
                              }`}
                            >
                              {message.message.type === 'ai' ? 'IA' : 'Cliente'}
                            </Badge>
                            <span className={`text-xs ${
                              message.message.type === 'ai' ? 'text-blue-100' : 'text-gray-400'
                            }`}>
                              {message.instancia}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.message.content}
                          </p>
                          <p className={`text-xs mt-2 ${
                            message.message.type === 'ai' ? 'text-blue-100' : 'text-gray-400'
                          }`}>
                            {new Date(message.data).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              timeZone: 'America/Sao_Paulo'
                            })}
                          </p>
                        </div>
                      </div>
                        );
                    });
                    })()}
                    <div ref={endOfMessagesRef} />
                  </div>
                )}
              </ScrollArea>
            </CardContent>

            {/* Input de Mensagem */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <div className="flex-1 relative">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 pr-10"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        // Aqui seria implementado o envio da mensagem
                        console.log('Enviar mensagem:', messageInput);
                        setMessageInput('');
                      }
                    }}
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>
                <Button 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    // Aqui seria implementado o envio da mensagem
                    console.log('Enviar mensagem:', messageInput);
                    setMessageInput('');
                  }}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Selecione uma conversa</p>
              <p className="text-sm">Escolha uma conversa para começar a visualizar as mensagens</p>
            </div>
          </div>
        )}
      </Card>


      {/* Modal de Resumo */}
              <SummaryModalAnimated
          isOpen={summaryModal.isOpen}
          onClose={() => setSummaryModal({ isOpen: false, data: null })}
          summaryData={summaryModal.data}
        />
    </div>
  );
}
