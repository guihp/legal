import React, { useCallback, useLayoutEffect } from "react";
import { Mic, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHAT_FILE_ACCEPT, type ChatSurface } from "@/lib/chatMediaFiles";

/** ~6 linhas antes de rolar — próximo ao WhatsApp Web. */
const COMPOSER_TEXTAREA_MAX_HEIGHT_PX = 132;
const COMPOSER_TEXTAREA_MIN_HEIGHT_PX = 24;

export type ChatComposerProps = {
  surface: ChatSurface;
  messageInput: string;
  onMessageInputChange: (value: string) => void;
  onTextareaKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSendText: () => void;
  placeholder: string;
  textareaDisabled?: boolean;
  textareaClassName?: string;
  busy?: boolean;
  sending?: boolean;
  recording: boolean;
  recordingLevels: number[];
  recordingSec: number;
  onStartRecord: () => void;
  onStopRecord: () => void;
  imgInputRef: React.RefObject<HTMLInputElement | null>;
  messageTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onPickFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPasteMedia: (e: React.ClipboardEvent) => void;
  /** Botões extras à esquerda (ex.: templates no WhatsApp). */
  leadingActions?: React.ReactNode;
  /** Banner acima do campo (ex.: template API Oficial bloqueado). */
  composerNotice?: React.ReactNode;
  textareaReadOnly?: boolean;
  /** Permite enviar sem texto (ex.: template oficial só com mídia). */
  sendWithoutText?: boolean;
  className?: string;
  zClassName?: string;
};

export function ChatComposer({
  surface,
  messageInput,
  onMessageInputChange,
  onTextareaKeyDown,
  onSendText,
  placeholder,
  textareaDisabled,
  textareaClassName,
  busy,
  sending,
  recording,
  recordingLevels,
  recordingSec,
  onStartRecord,
  onStopRecord,
  imgInputRef,
  messageTextareaRef,
  onPickFile,
  onPasteMedia,
  leadingActions,
  composerNotice,
  textareaReadOnly,
  sendWithoutText,
  className,
  zClassName = "z-10",
}: ChatComposerProps) {
  const hasText = Boolean(messageInput.trim()) || Boolean(sendWithoutText);
  const accentSend =
    surface === "instagram"
      ? { background: "linear-gradient(135deg,#d62976 0%,#962fbf 100%)" }
      : undefined;

  const syncTextareaHeight = useCallback(() => {
    const el = messageTextareaRef.current;
    if (!el || recording) return;
    el.style.height = "auto";
    const next = Math.max(
      COMPOSER_TEXTAREA_MIN_HEIGHT_PX,
      Math.min(el.scrollHeight, COMPOSER_TEXTAREA_MAX_HEIGHT_PX),
    );
    el.style.height = `${next}px`;
    el.style.overflowY =
      el.scrollHeight > COMPOSER_TEXTAREA_MAX_HEIGHT_PX ? "auto" : "hidden";
  }, [messageTextareaRef, recording]);

  useLayoutEffect(() => {
    syncTextareaHeight();
  }, [messageInput, syncTextareaHeight]);

  const handleMessageChange = (value: string) => {
    onMessageInputChange(value);
    requestAnimationFrame(syncTextareaHeight);
  };

  return (
    <div className={cn("shrink-0 w-full", zClassName, className)}>
      {composerNotice}
      <div className="min-h-[62px] bg-[var(--cv-panel)] px-3 sm:px-4 py-2 flex items-end gap-1.5 sm:gap-2 w-full">
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="text-[var(--cv-text-muted)] hover:bg-[var(--cv-hover)] hover:text-[var(--cv-text)] rounded-full h-10 w-10 shrink-0 mb-0.5"
        title="Emoji"
      >
        <span className="text-xl leading-none">😊</span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="text-[var(--cv-text-muted)] hover:bg-[var(--cv-hover)] hover:text-[var(--cv-text)] rounded-full h-10 w-10 shrink-0 mb-0.5"
        onClick={() => imgInputRef.current?.click()}
        title="Anexar arquivo"
        disabled={recording || busy}
      >
        <Paperclip className="h-5 w-5" />
      </Button>

      {leadingActions}

      <input
        ref={imgInputRef}
        type="file"
        className="hidden"
        onChange={onPickFile}
        multiple
        accept={CHAT_FILE_ACCEPT[surface]}
      />

      <div
        className={cn(
          "flex-1 min-w-0 rounded-[22px] min-h-[42px] mb-0.5 flex items-end",
          "bg-[var(--cv-input-bg)] px-4 py-2",
          "border border-[var(--cv-border)]/70 shadow-sm",
          "transition-[box-shadow,border-color] duration-150",
          "focus-within:border-[var(--cv-accent)]/35 focus-within:shadow-[0_0_0_1px_var(--cv-accent)]/20",
        )}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) messageTextareaRef.current?.focus();
        }}
        onPaste={onPasteMedia}
      >
        {recording ? (
          <div className="w-full flex items-center gap-3 py-0.5">
            <span className="text-xs text-red-400 font-medium whitespace-nowrap">
              Gravando {String(recordingSec).padStart(2, "0")}s
            </span>
            <div className="flex items-end gap-[2px] h-8 w-full min-w-0">
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
            ref={messageTextareaRef}
            value={messageInput}
            onChange={(e) => handleMessageChange(e.target.value)}
            onKeyDown={onTextareaKeyDown}
            onPaste={onPasteMedia}
            placeholder={placeholder}
            disabled={textareaDisabled || busy}
            readOnly={textareaReadOnly}
            rows={1}
            className={cn(
              "block w-full min-w-0 bg-transparent border-none outline-none ring-0 focus:ring-0 focus-visible:ring-0",
              "text-[var(--cv-input-text)] text-[15px] leading-[1.35] resize-none",
              "placeholder:text-[var(--cv-text-muted)] placeholder:opacity-90",
              "overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              textareaReadOnly && "cursor-default opacity-95",
              textareaClassName,
            )}
            style={{
              minHeight: `${COMPOSER_TEXTAREA_MIN_HEIGHT_PX}px`,
              maxHeight: `${COMPOSER_TEXTAREA_MAX_HEIGHT_PX}px`,
            }}
          />
        )}
      </div>

      {hasText ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Enviar"
          disabled={sending || busy || recording}
          onMouseDown={(e) => {
            if (!sending && !busy && !recording) e.preventDefault();
          }}
          onClick={() => void onSendText()}
          className={cn(
            "shrink-0 text-white rounded-full h-10 w-10 p-0 mb-0.5 shadow-md transition-transform active:scale-95 disabled:opacity-50",
            surface === "whatsapp" &&
              "bg-[var(--cv-accent)] hover:bg-[var(--cv-accent-hover)] text-[var(--cv-tab-active-text)]",
          )}
          style={accentSend}
        >
          <Send className="h-5 w-5 ml-0.5" />
        </Button>
      ) : (
        <Button
          type="button"
          onClick={recording ? onStopRecord : onStartRecord}
          disabled={busy && !recording}
          className={cn(
            "rounded-full h-10 w-10 p-0 mb-0.5 shrink-0 flex items-center justify-center shadow-md transition-all",
            recording
              ? "bg-red-500 animate-pulse text-white"
              : "bg-[var(--cv-tab-inactive-bg)] hover:bg-[var(--cv-hover-strong)] text-[var(--cv-text-muted)]",
          )}
        >
          <Mic className="h-5 w-5" />
        </Button>
      )}
      </div>
    </div>
  );
}
