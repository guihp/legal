import React from "react";
import { Mic, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHAT_FILE_ACCEPT, type ChatSurface } from "@/lib/chatMediaFiles";

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
  className,
  zClassName = "z-10",
}: ChatComposerProps) {
  const hasText = Boolean(messageInput.trim());
  const accentSend =
    surface === "instagram"
      ? { background: "linear-gradient(135deg,#d62976 0%,#962fbf 100%)" }
      : undefined;

  return (
    <div
      className={cn(
        "min-h-[62px] bg-[var(--cv-panel)] px-4 py-2 flex items-end gap-2 shrink-0 w-full",
        zClassName,
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="text-[var(--cv-text-muted)] hover:bg-transparent rounded-full mb-1"
        title="Emoji"
      >
        <span className="text-xl leading-none">😊</span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="text-[var(--cv-text-muted)] hover:bg-transparent rounded-full mb-1"
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
        className="flex-1 bg-[var(--cv-input-bg)] rounded-lg min-h-[42px] mb-1 flex items-center px-3 py-1 border border-[var(--cv-border)]"
        onMouseDown={() => messageTextareaRef.current?.focus()}
        onPaste={onPasteMedia}
      >
        {recording ? (
          <div className="w-full flex items-center gap-3 px-1">
            <span className="text-xs text-red-400 font-medium whitespace-nowrap">
              Gravando {String(recordingSec).padStart(2, "0")}s
            </span>
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
            ref={messageTextareaRef}
            value={messageInput}
            onChange={(e) => onMessageInputChange(e.target.value)}
            onKeyDown={onTextareaKeyDown}
            onPaste={onPasteMedia}
            placeholder={placeholder}
            disabled={textareaDisabled || busy}
            className={cn(
              "w-full bg-transparent border-none outline-none text-[var(--cv-input-text)] text-sm resize-none custom-scrollbar max-h-[100px] placeholder:text-[var(--cv-text-muted)]",
              textareaClassName,
            )}
            rows={1}
            style={{ minHeight: "24px" }}
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
            "shrink-0 text-white rounded-full h-10 w-10 p-0 mb-1 shadow-md transition-transform active:scale-95 disabled:opacity-50",
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
            "rounded-full h-10 w-10 p-0 mb-1 flex items-center justify-center shadow-md transition-all",
            recording
              ? "bg-red-500 animate-pulse text-white"
              : "bg-[var(--cv-tab-inactive-bg)] hover:bg-[var(--cv-hover-strong)] text-[var(--cv-text-muted)]",
          )}
        >
          <Mic className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
