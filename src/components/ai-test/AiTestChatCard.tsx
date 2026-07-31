import { useEffect, useMemo, useRef } from 'react';
import { Loader2, RefreshCw, SendHorizontal, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AI_TEST_EMERALD,
  AI_TEST_SUGGESTIONS,
  averageReplySeconds,
  formatMessageTime,
  formatSecondsPt,
  formatSessionDateLabel,
  replyLatencyForAssistant,
  type SimulatorMessage,
} from './helpers';

type Props = {
  assistantName: string;
  companyName: string;
  messages: SimulatorMessage[];
  input: string;
  loading: boolean;
  disabled: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onRestart: () => void;
  restarting?: boolean;
  onSuggestion: (text: string) => void;
};

function ImageBubble({
  isAssistant,
  mediaUrl,
  caption,
}: {
  isAssistant: boolean;
  mediaUrl: string;
  caption?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border shadow-sm max-w-[min(100%,420px)]',
        isAssistant ? 'border-transparent' : 'border-border bg-white',
      )}
      style={isAssistant ? { backgroundColor: AI_TEST_EMERALD } : undefined}
    >
      <img
        src={mediaUrl}
        alt={caption || 'Imagem'}
        className="block max-h-[280px] w-full object-cover"
        loading="lazy"
      />
      {caption?.trim() ? (
        <p
          className={cn('px-3 py-2 text-sm whitespace-pre-wrap break-words', !isAssistant && 'text-foreground')}
          style={isAssistant ? { color: '#ffffff' } : undefined}
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export function AiTestChatCard({
  assistantName,
  companyName,
  messages,
  input,
  loading,
  disabled,
  onInputChange,
  onSend,
  onRestart,
  restarting,
  onSuggestion,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const avg = averageReplySeconds(messages);
  const sessionStamp = useMemo(() => {
    const first = messages.find((m) => m.sentAt)?.sentAt;
    return formatSessionDateLabel(first ? new Date(first) : new Date());
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, loading]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col min-h-[560px] lg:min-h-[640px]">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 px-4 py-3 sm:px-5 border-b border-border/70">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div
              className="h-11 w-11 rounded-full flex items-center justify-center btn-on-emerald"
              style={{ backgroundColor: AI_TEST_EMERALD, color: '#ffffff' }}
            >
              <User className="h-6 w-6" strokeWidth={1.5} aria-hidden />
            </div>
            <span
              className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-emerald-500"
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">
              {assistantName}
              <span className="font-normal text-muted-foreground">
                {' '}
                · Assistente da {companyName}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {messages.length} {messages.length === 1 ? 'mensagem' : 'mensagens'} nesta sessão
              {' · '}
              resposta média {formatSecondsPt(avg)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRestart}
            disabled={restarting}
            className="rounded-xl h-9 w-9 border-border bg-card shadow-sm"
            aria-label="Reiniciar conversa"
            title="Reiniciar conversa"
          >
            {restarting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-[280px] max-h-[min(52vh,520px)] overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 space-y-4 bg-[#FAF9F6] dark:bg-background/40"
      >
        <div className="flex justify-center">
          <span className="rounded-full bg-muted/80 px-3 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {sessionStamp}
          </span>
        </div>

        {messages.length === 0 && !loading ? (
          <div className="flex justify-center px-3 py-12 text-center">
            <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
              Nenhuma mensagem ainda. Digite abaixo como o cliente escreveria no WhatsApp, ou use um
              cenário à direita.
            </p>
          </div>
        ) : null}

        {messages.map((message, index) => {
          const isAssistant = message.role === 'assistant';
          const time = formatMessageTime(message.sentAt);
          const latency = isAssistant ? replyLatencyForAssistant(messages, index) : null;

          return (
            <div
              key={message.id}
              className={cn('flex flex-col gap-1', isAssistant ? 'items-start' : 'items-end')}
            >
              {message.messageType === 'image' && message.mediaUrl ? (
                <ImageBubble
                  isAssistant={isAssistant}
                  mediaUrl={message.mediaUrl}
                  caption={message.content?.trim() ? message.content : undefined}
                />
              ) : (
                <div
                  className={cn(
                    'max-w-[min(100%,520px)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words',
                    isAssistant
                      ? 'rounded-bl-md'
                      : 'rounded-br-md border border-border bg-white text-foreground dark:bg-card',
                    message.pending && 'opacity-70',
                  )}
                  style={
                    isAssistant
                      ? { backgroundColor: AI_TEST_EMERALD, color: '#ffffff' }
                      : undefined
                  }
                >
                  {message.content}
                </div>
              )}

              <p
                className={cn(
                  'text-[11px] text-muted-foreground px-0.5',
                  isAssistant ? 'text-left' : 'text-right',
                )}
              >
                {isAssistant ? (
                  <>
                    {assistantName} · {time}
                    {latency != null ? ` · ${formatSecondsPt(latency)}` : ''}
                  </>
                ) : (
                  <>
                    Cliente · {time}
                  </>
                )}
              </p>
            </div>
          );
        })}

        {loading ? (
          <div className="flex flex-col items-start gap-1">
            <div
              className="rounded-2xl rounded-bl-md px-4 py-3 shadow-sm"
              style={{ backgroundColor: AI_TEST_EMERALD }}
            >
              <div className="flex gap-1.5">
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]"
                  style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
                />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]"
                  style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
                />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground px-0.5">{assistantName} · digitando…</p>
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <div className="border-t border-border/70 px-4 py-3 sm:px-5 sm:py-4 space-y-3 bg-card">
        <div className="flex flex-wrap gap-2">
          {AI_TEST_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={disabled || loading}
              onClick={() => onSuggestion(suggestion)}
              className="rounded-full border border-border bg-white dark:bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-emerald-700/40 shadow-sm transition-colors disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2 rounded-2xl border border-border bg-white dark:bg-background shadow-sm p-2 pl-3">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled || loading}
            rows={1}
            placeholder="Digite como o cliente escreveria no WhatsApp..."
            className="min-h-[40px] max-h-28 flex-1 resize-none bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
          />
          <Button
            type="button"
            onClick={onSend}
            disabled={disabled || loading || !input.trim()}
            className="btn-on-emerald shrink-0 rounded-xl h-10 px-4 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
            style={{ color: '#ffffff' }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <SendHorizontal className="mr-1.5 h-4 w-4" />
                Enviar
              </>
            )}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Enter envia · as mensagens de teste ficam isoladas do CRM e não geram lead.
        </p>
      </div>
    </div>
  );
}
