import { useEffect, useMemo, useRef } from 'react';
import { Bot, ChevronLeft, SendHorizontal, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChatImageGrid } from '@/components/ChatImageGrid';
import { IPhone17ProMaxFrame, IOSStatusBar } from '@/components/ai-test/IPhone17ProMaxFrame';
import { cn } from '@/lib/utils';
import type { SimulatorMessage } from '@/components/ai-test/helpers';

export type { SimulatorMessage };

function formatMessageTime(sentAt?: string): string {
  if (!sentAt) {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  const d = new Date(sentAt);
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function isImageOnlyMessage(message: SimulatorMessage): boolean {
  return message.messageType === 'image' && Boolean(message.mediaUrl) && !message.content?.trim();
}

type SimulatorMessageBlock =
  | { kind: 'single'; message: SimulatorMessage }
  | { kind: 'image_album'; messages: SimulatorMessage[] };

/** Agrupa imagens consecutivas (sem legenda) do mesmo autor quando há mais de 2. */
function groupSimulatorMessages(messages: SimulatorMessage[]): SimulatorMessageBlock[] {
  const blocks: SimulatorMessageBlock[] = [];
  let index = 0;

  while (index < messages.length) {
    const current = messages[index];

    if (isImageOnlyMessage(current)) {
      const role = current.role;
      const group: SimulatorMessage[] = [];

      while (index < messages.length) {
        const item = messages[index];
        if (item.role !== role || !isImageOnlyMessage(item)) break;
        group.push(item);
        index += 1;
      }

      if (group.length > 2) {
        blocks.push({ kind: 'image_album', messages: group });
      } else {
        for (const message of group) {
          blocks.push({ kind: 'single', message });
        }
      }
      continue;
    }

    blocks.push({ kind: 'single', message: current });
    index += 1;
  }

  return blocks;
}

function WhatsAppImageAlbumBubble({
  role,
  messages,
  pending,
}: {
  role: 'user' | 'assistant';
  messages: SimulatorMessage[];
  pending?: boolean;
}) {
  const isUser = role === 'user';
  const urls = messages.map((m) => m.mediaUrl).filter(Boolean) as string[];
  const lastMessage = messages[messages.length - 1];
  const time = formatMessageTime(lastMessage?.sentAt);

  return (
    <div
      className={cn(
        'relative w-fit max-w-[min(100%,300px)] overflow-hidden shadow-sm',
        isUser
          ? 'rounded-lg rounded-tr-none bg-[#005c4b]'
          : 'rounded-lg rounded-tl-none bg-[#202c33]',
        pending && 'opacity-70',
      )}
    >
      <div className="relative p-[3px]">
        <ChatImageGrid images={urls} className="rounded-[5px]" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[3px] bottom-[3px] h-10 rounded-b-[5px] bg-gradient-to-t from-black/55 via-black/20 to-transparent"
        />
        <span className="absolute bottom-2 right-2.5 text-[11px] font-medium leading-none text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
          {time}
        </span>
      </div>
    </div>
  );
}

function WhatsAppImageBubble({
  role,
  mediaUrl,
  caption,
  sentAt,
  pending,
}: {
  role: 'user' | 'assistant';
  mediaUrl: string;
  caption?: string;
  sentAt?: string;
  pending?: boolean;
}) {
  const isUser = role === 'user';
  const time = formatMessageTime(sentAt);
  const hasCaption = Boolean(caption?.trim());

  return (
    <div
      className={cn(
        'relative w-fit max-w-[min(100%,300px)] overflow-hidden shadow-sm',
        isUser
          ? 'rounded-lg rounded-tr-none bg-[#005c4b]'
          : 'rounded-lg rounded-tl-none bg-[#202c33]',
        pending && 'opacity-70',
      )}
    >
      <div className="relative p-[3px]">
        <img
          src={mediaUrl}
          alt={caption || 'Imagem'}
          className="block max-h-[min(320px,50vh)] w-auto min-w-[160px] max-w-[294px] rounded-[5px] object-cover"
          loading="lazy"
        />
        {!hasCaption ? (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-[3px] bottom-[3px] h-10 rounded-b-[5px] bg-gradient-to-t from-black/55 via-black/20 to-transparent"
            />
            <span className="absolute bottom-2 right-2.5 text-[11px] font-medium leading-none text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
              {time}
            </span>
          </>
        ) : null}
      </div>
      {hasCaption ? (
        <div className="px-2 pb-1.5 pt-0.5">
          <p className="whitespace-pre-wrap break-words text-[14.5px] leading-[1.35] text-[#e9edef]">
            {caption}
          </p>
          <div className="mt-1 flex justify-end">
            <span className="text-[11px] leading-none text-[#ffffff99]">{time}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WhatsAppTextBubble({
  role,
  content,
  sentAt,
  pending,
}: {
  role: 'user' | 'assistant';
  content: string;
  sentAt?: string;
  pending?: boolean;
}) {
  const isUser = role === 'user';
  const time = formatMessageTime(sentAt);

  return (
    <div
      className={cn(
        'relative max-w-[82%] rounded-lg px-2.5 py-1.5 text-[14px] leading-[1.35] shadow-sm md:px-3 md:py-2 md:text-[15px]',
        isUser
          ? 'rounded-tr-none bg-[#005c4b] text-[#e9edef]'
          : 'rounded-tl-none bg-[#202c33] text-[#e9edef]',
        pending && 'opacity-70',
      )}
    >
      <span className="whitespace-pre-wrap break-words pr-12">{content}</span>
      <span
        className={cn(
          'absolute bottom-1.5 right-2 text-[11px] leading-none',
          isUser ? 'text-[#ffffff99]' : 'text-[#8696a0]',
        )}
      >
        {time}
      </span>
    </div>
  );
}

type PhoneWhatsAppSimulatorProps = {
  companyName: string;
  assistantName: string;
  messages: SimulatorMessage[];
  input: string;
  loading: boolean;
  disabled: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
};

export function PhoneWhatsAppSimulator({
  companyName,
  assistantName,
  messages,
  input,
  loading,
  disabled,
  onInputChange,
  onSend,
}: PhoneWhatsAppSimulatorProps) {
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messageBlocks = useMemo(() => groupSimulatorMessages(messages), [messages]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, loading]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <IPhone17ProMaxFrame>
      <div className="flex h-full min-h-0 flex-col">
      <IOSStatusBar />

      {/* WhatsApp header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-black/30 bg-[#1f2c34] px-3 py-2.5 md:px-4 md:py-3">
        <ChevronLeft className="h-5 w-5 shrink-0 text-[#00a884] md:h-6 md:w-6" strokeWidth={2.5} />
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#25d366] to-[#128c7e] text-sm font-bold text-white shadow-md md:h-10 md:w-10 md:text-base">
          {assistantName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-tight text-[#e9edef] md:text-[16px]">{assistantName}</p>
          <p className="truncate text-[12px] text-[#8696a0] md:text-[13px]">
            {loading ? 'digitando…' : 'online'}
          </p>
        </div>
      </div>

      {/* Chat */}
      <div
        ref={chatScrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 md:px-4"
        style={{
          backgroundColor: '#0b141a',
          backgroundImage: `
            radial-gradient(circle at 25% 15%, rgba(37,211,102,0.05) 0, transparent 42%),
            radial-gradient(circle at 85% 5%, rgba(0,168,132,0.04) 0, transparent 38%),
            url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.015'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")
          `,
        }}
      >
        <div className="mb-3 flex justify-center">
          <span className="max-w-[92%] truncate rounded-lg bg-[#182229]/90 px-2.5 py-1 text-[11px] text-[#8696a0] shadow-sm">
            {companyName}
          </span>
        </div>

        <div className="space-y-2.5 pb-2">
          {messages.length === 0 && !loading && (
            <div className="flex justify-center px-3 py-10 text-center">
              <p className="max-w-[280px] text-[13px] leading-relaxed text-[#8696a0] md:max-w-[320px] md:text-[14px]">
                Nenhuma mensagem ainda. Digite abaixo como se fosse um cliente interessado em um imóvel.
              </p>
            </div>
          )}

          {messageBlocks.map((block) => {
            if (block.kind === 'image_album') {
              const role = block.messages[0]?.role ?? 'assistant';
              const key = block.messages.map((m) => m.id).join('-');
              return (
                <div
                  key={key}
                  className={`flex items-end gap-1.5 ${role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {role === 'assistant' && (
                    <div className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#25d366]/15 text-[#25d366]">
                      <Bot className="h-3 w-3" />
                    </div>
                  )}
                  <WhatsAppImageAlbumBubble
                    role={role}
                    messages={block.messages}
                    pending={block.messages.some((m) => m.pending)}
                  />
                  {role === 'user' && (
                    <div className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2a3942] text-[#8696a0]">
                      <User className="h-3 w-3" />
                    </div>
                  )}
                </div>
              );
            }

            const message = block.message;
            return (
              <div
                key={message.id}
                className={`flex items-end gap-1.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#25d366]/15 text-[#25d366]">
                    <Bot className="h-3 w-3" />
                  </div>
                )}

                {message.messageType === 'image' && message.mediaUrl ? (
                  <WhatsAppImageBubble
                    role={message.role}
                    mediaUrl={message.mediaUrl}
                    caption={message.content}
                    sentAt={message.sentAt}
                    pending={message.pending}
                  />
                ) : (
                  <WhatsAppTextBubble
                    role={message.role}
                    content={message.content}
                    sentAt={message.sentAt}
                    pending={message.pending}
                  />
                )}

                {message.role === 'user' && (
                  <div className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2a3942] text-[#8696a0]">
                    <User className="h-3 w-3" />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-end gap-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#25d366]/15 text-[#25d366]">
                <Bot className="h-3 w-3" />
              </div>
              <div className="rounded-lg rounded-tl-none bg-[#202c33] px-3 py-2.5">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8696a0] [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8696a0] [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8696a0]" />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Composer */}
      <div className="flex shrink-0 items-center gap-2 border-t border-black/20 bg-[#1f2c34] px-2.5 py-2 pb-5 md:px-3 md:py-2.5 md:pb-6">
        <Input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || loading}
          placeholder="Mensagem"
          className="h-9 flex-1 rounded-full border-0 bg-[#2a3942] px-4 text-[14px] text-[#e9edef] placeholder:text-[#8696a0] focus-visible:ring-[#00a884]/40 md:h-10 md:text-[15px]"
        />
        <Button
          type="button"
          size="icon"
          onClick={onSend}
          disabled={disabled || loading || !input.trim()}
          className="h-9 w-9 shrink-0 rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-white shadow-md md:h-10 md:w-10"
        >
          <SendHorizontal className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
      </div>
      </div>
    </IPhone17ProMaxFrame>
  );
}
