import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Loader2, SendHorizontal, Bot, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

type Conversation = {
  id: string;
  title: string | null;
  lastMessageAt: string;
};

export function InquilinatoView() {
  const { profile, user } = useUserProfile();
  const userEmail = user?.email || profile?.email || "";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll para a última mensagem
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Carregar conversas ao abrir
  useEffect(() => {
    const loadConversations = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("inquilinato_conversations")
        .select("id, title, last_message_at")
        .eq("user_id", user.id)
        .order("last_message_at", { ascending: false });
      const convs: Conversation[] = (data || []).map((c: any) => ({
        id: c.id as string,
        title: (c.title as string) ?? null,
        lastMessageAt: c.last_message_at as string,
      }));
      setConversations(convs);
      if (convs.length > 0) {
        setActiveConversationId(convs[0].id);
      } else {
        // Cria uma conversa inicial
        const { data: created } = await supabase
          .from("inquilinato_conversations")
          .insert({ user_id: user.id, company_id: profile?.company_id ?? null, title: null })
          .select()
          .single();
        if (created?.id) {
          setConversations([{ id: created.id, title: null, lastMessageAt: new Date().toISOString() }]);
          setActiveConversationId(created.id);
        }
      }
    };
    loadConversations();
  }, [user?.id]);

  // Carregar mensagens da conversa ativa
  useEffect(() => {
    const loadMessages = async () => {
      if (!user?.id || !activeConversationId) return;
      const { data } = await supabase
        .from("inquilinato_messages")
        .select("id, role, content, created_at")
        .eq("user_id", user.id)
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });
      const mapped: ChatMessage[] = (data || []).map((m) => ({
        id: m.id as string,
        role: m.role as "user" | "assistant",
        content: m.content as string,
        createdAt: new Date(m.created_at as string).getTime(),
      }));
      if (mapped.length === 0) {
        mapped.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Olá! Eu sou o assistente da Lei do Inquilinato. Envie sua dúvida e responderei com base no endpoint integrado.",
          createdAt: Date.now(),
        });
      }
      setMessages(mapped);
    };
    loadMessages();
  }, [user?.id, activeConversationId]);

  const canSend = useMemo(
    () => !loading && input.trim().length > 0 && !!userEmail,
    [loading, input, userEmail]
  );

  const sendMessage = useCallback(async () => {
    if (!canSend) return;
    const content = input.trim();
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Garante conversa ativa
      let conversationId = activeConversationId;
      if (!conversationId && user?.id) {
        const { data: created } = await supabase
          .from("inquilinato_conversations")
          .insert({ user_id: user.id, company_id: profile?.company_id ?? null, title: null })
          .select()
          .single();
        conversationId = created?.id ?? null;
        if (conversationId) {
          setActiveConversationId(conversationId);
          setConversations((prev) => [
            { id: conversationId!, title: null, lastMessageAt: new Date().toISOString() },
            ...prev,
          ]);
        }
      }

      // Persistir mensagem do usuário
      if (user?.id) {
        await supabase.from("inquilinato_messages").insert({
          user_id: user.id,
          company_id: profile?.company_id ?? null,
          email: userEmail,
          role: "user",
          content,
          conversation_id: conversationId,
        });
        // Atualiza título (primeira mensagem) e last_message_at
        if (conversationId) {
          const truncated = content.slice(0, 60);
          await supabase
            .from("inquilinato_conversations")
            .update({ last_message_at: new Date().toISOString(), title: truncated })
            .eq("id", conversationId);
        }
      }

      const response = await fetch(
        "https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/inquilinato",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: userEmail, message: content }),
        }
      );

      if (!response.ok) {
        throw new Error(`Falha na requisição: ${response.status}`);
      }

      let assistantText = "";
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        assistantText =
          typeof data === "string"
            ? data
            : (data.message || data.result || JSON.stringify(data));
      } else {
        assistantText = await response.text();
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: assistantText || "Sem conteúdo na resposta.",
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Persistir resposta do assistente
      if (user?.id) {
        await supabase.from("inquilinato_messages").insert({
          user_id: user.id,
          company_id: profile?.company_id ?? null,
          email: userEmail,
          role: "assistant",
          content: assistantText || "Sem conteúdo na resposta.",
          conversation_id: activeConversationId || conversationId,
        });
        if (activeConversationId || conversationId) {
          await supabase
            .from("inquilinato_conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", (activeConversationId || conversationId) as string);
        }
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Ocorreu um erro ao consultar o serviço: ${
          err?.message || "erro desconhecido"
        }`,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);

      // Persistir erro como resposta do assistente (opcional)
      if (user?.id) {
        await supabase.from("inquilinato_messages").insert({
          user_id: user.id,
          company_id: profile?.company_id ?? null,
          email: userEmail,
          role: "assistant",
          content: errorMsg.content,
          conversation_id: activeConversationId,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [canSend, input, userEmail, activeConversationId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Lei do Inquilinato</h1>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Chat Assistente</CardTitle>
            <Button variant="outline" className="border-gray-700 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10" onClick={async () => {
              // Novo chat
              if (!user?.id) return;
              const { data } = await supabase
                .from("inquilinato_conversations")
                .insert({ user_id: user.id, company_id: profile?.company_id ?? null, title: null })
                .select()
                .single();
              if (data?.id) {
                const newId = data.id as string;
                setActiveConversationId(newId);
                setConversations((prev) => [
                  { id: newId, title: null, lastMessageAt: new Date().toISOString() },
                  ...prev,
                ]);
                setMessages([
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: "Nova conversa iniciada. Envie sua dúvida sobre a Lei do Inquilinato.",
                    createdAt: Date.now(),
                  },
                ]);
              }
            }}>Novo chat</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            {/* Lista de conversas */}
            <div className="w-64 shrink-0">
              <div className="h-[480px] bg-gray-950/60 border border-gray-800 rounded-lg overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-1">
                    {conversations.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setActiveConversationId(c.id)}
                        className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                          activeConversationId === c.id
                            ? "bg-blue-600/20 border border-blue-700/40 text-white"
                            : "hover:bg-gray-800/60 text-gray-200"
                        }`}
                      >
                        <div className="truncate text-sm">
                          {c.title || `Conversa ${c.id.slice(0, 6)}`}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(c.lastMessageAt).toLocaleString()}
                        </div>
                      </button>
                    ))}
                    {conversations.length === 0 && (
                      <div className="text-sm text-gray-400 p-3">Nenhuma conversa ainda.</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Área do chat da conversa ativa */}
            <div className="flex-1">
              <div className="h-[480px] bg-gray-950/60 border border-gray-800 rounded-lg p-4">
                <ScrollArea className="h-full pr-2">
                  <div className="space-y-4">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex items-start gap-3 ${
                          m.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {m.role === "assistant" && (
                          <div className="h-8 w-8 rounded-full bg-blue-600/20 text-blue-300 flex items-center justify-center">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-xl px-4 py-2 text-sm whitespace-pre-wrap ${
                            m.role === "user"
                              ? "bg-blue-600/20 text-blue-100 border border-blue-700/40"
                              : "bg-gray-800/80 text-gray-100 border border-gray-700"
                          }`}
                        >
                          {m.content}
                        </div>
                        {m.role === "user" && (
                          <div className="h-8 w-8 rounded-full bg-gray-700/40 text-gray-200 flex items-center justify-center">
                            <UserIcon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <Input
                  placeholder={
                    userEmail
                      ? "Digite sua mensagem e pressione Enter"
                      : "Faça login para enviar mensagens"
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={loading || !userEmail}
                  className="bg-gray-950 border-gray-800 text-gray-100 placeholder:text-gray-500"
                />
                <Button onClick={sendMessage} disabled={!canSend} className="gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando
                    </>
                  ) : (
                    <>
                      <SendHorizontal className="h-4 w-4" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>

              {!userEmail && (
                <p className="text-xs text-amber-400 mt-1">
                  Você precisa estar autenticado para enviar mensagens.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default InquilinatoView;


