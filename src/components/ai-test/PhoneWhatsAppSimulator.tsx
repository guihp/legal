import { useEffect, useRef } from 'react';
import { Bot, ChevronLeft, SendHorizontal, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IPhone17ProMaxFrame, IOSStatusBar } from '@/components/ai-test/IPhone17ProMaxFrame';

export type SimulatorMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
};

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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <IPhone17ProMaxFrame>
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

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-end gap-1.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#25d366]/15 text-[#25d366]">
                  <Bot className="h-3 w-3" />
                </div>
              )}

              <div
                className={`relative max-w-[82%] rounded-lg px-2.5 py-1.5 text-[14px] leading-[1.35] shadow-sm md:px-3 md:py-2 md:text-[15px] ${
                  message.role === 'user'
                    ? 'rounded-tr-none bg-[#005c4b] text-[#e9edef]'
                    : 'rounded-tl-none bg-[#202c33] text-[#e9edef]'
                } ${message.pending ? 'opacity-70' : ''}`}
              >
                {message.content}
              </div>

              {message.role === 'user' && (
                <div className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2a3942] text-[#8696a0]">
                  <User className="h-3 w-3" />
                </div>
              )}
            </div>
          ))}

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

          <div ref={scrollRef} />
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
    </IPhone17ProMaxFrame>
  );
}
