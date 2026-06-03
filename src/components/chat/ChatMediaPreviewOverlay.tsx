import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Mic, Paperclip, Send, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatPreviewState } from "@/hooks/useChatComposerMedia";
import type { ChatSurface } from "@/lib/chatMediaFiles";

export type ChatMediaPreviewOverlayProps = {
  surface: ChatSurface;
  previewData: ChatPreviewState;
  busy?: boolean;
  sending?: boolean;
  onCancel: () => void;
  onSend: () => void;
  onUpdateCaption: (caption: string) => void;
  onSelectIndex: (index: number) => void;
};

export function ChatMediaPreviewOverlay({
  surface,
  previewData,
  busy,
  sending,
  onCancel,
  onSend,
  onUpdateCaption,
  onSelectIndex,
}: ChatMediaPreviewOverlayProps) {
  const active = previewData.items[previewData.activeIndex];
  const thumbActiveBorder =
    surface === "instagram" ? "border-[#d62976]" : "border-[var(--cv-accent)]";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[var(--cv-chat)] bg-opacity-95 flex flex-col"
    >
      <div className="h-16 flex items-center justify-between px-4 w-full text-[var(--cv-icon)]">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={onCancel}
          className="hover:bg-[var(--cv-preview-bar-hover)] rounded-full"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h2 className="font-medium text-[var(--cv-text)]">
          Visualizar arquivo
          {previewData.items.length > 1 ? `s (${previewData.items.length})` : ""}
        </h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
        {active?.type === "imagem" ? (
          <img
            src={active.previewUrl}
            alt="Preview"
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          />
        ) : active?.type === "video" ? (
          <video
            src={active.previewUrl}
            controls
            playsInline
            preload="metadata"
            className="max-h-full max-w-full rounded-lg shadow-2xl bg-black"
          />
        ) : active?.type === "pdf" ? (
          <div className="flex flex-col items-center gap-6 text-[var(--cv-text)] p-8 bg-[var(--cv-panel)] rounded-xl border border-[var(--cv-border)] max-w-md w-full">
            <div className="w-16 h-16 rounded-full bg-red-600/80 flex items-center justify-center">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <p className="font-semibold text-center max-w-xs truncate" title={active.file.name}>
              {active.file.name}
            </p>
            <p className="text-xs text-[var(--cv-text-muted)]">
              {((active.file.size || 0) / 1024).toFixed(1)} KB • PDF
            </p>
            <a
              href={active.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--cv-accent)] hover:underline"
            >
              Abrir preview no navegador
            </a>
          </div>
        ) : active?.type === "audio" ? (
          <div className="flex flex-col items-center gap-6 text-[var(--cv-text)] p-8 bg-[var(--cv-panel)] rounded-xl border border-[var(--cv-border)] max-w-md w-full">
            <div
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center",
                surface === "instagram"
                  ? "bg-gradient-to-br from-[#d62976]/40 to-[#962fbf]/40"
                  : "bg-purple-600/80",
              )}
            >
              <Mic className="w-8 h-8 text-white" />
            </div>
            <audio src={active.previewUrl} controls className="w-full max-w-sm" preload="metadata" />
            <p
              className="text-xs text-[var(--cv-text-muted)] truncate w-full text-center"
              title={active.file.name}
            >
              {active.file.name}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-[var(--cv-text)] p-10 bg-[var(--cv-panel)] rounded-xl border border-[var(--cv-border)]">
            <div className="w-20 h-20 bg-zinc-600 rounded-full flex items-center justify-center">
              <Paperclip className="w-10 h-10 text-white" />
            </div>
            <p className="font-semibold text-lg max-w-xs truncate" title={active?.file.name}>
              {active?.file.name}
            </p>
            <p className="text-sm text-zinc-400">
              {((active?.file.size || 0) / 1024).toFixed(1)} KB • {active?.file.type || "Desconhecido"}
            </p>
          </div>
        )}
      </div>

      {previewData.items.length > 1 && (
        <div className="w-full max-w-3xl mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto">
            {previewData.items.map((item, idx) => (
              <button
                key={`${item.file.name}-${idx}`}
                type="button"
                onClick={() => onSelectIndex(idx)}
                className={cn(
                  "h-14 w-14 rounded-md border overflow-hidden shrink-0",
                  previewData.activeIndex === idx ? thumbActiveBorder : "border-[var(--cv-border)]",
                )}
                title={item.file.name}
              >
                {item.type === "imagem" ? (
                  <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
                ) : item.type === "video" ? (
                  <div className="h-full w-full grid place-items-center bg-black/80 text-white">
                    <Video className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="h-full w-full grid place-items-center bg-[var(--cv-panel)] text-[10px] text-[var(--cv-text-muted)]">
                    {item.type === "audio"
                      ? "AUDIO"
                      : item.type === "video"
                        ? "VIDEO"
                        : item.type === "pdf"
                          ? "PDF"
                          : "ARQ"}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[var(--cv-panel)] p-3 flex items-center gap-2 justify-center w-full max-w-3xl mx-auto mb-4 rounded-full shadow-lg border border-[var(--cv-border)]">
        <input
          autoFocus
          value={active?.caption || ""}
          onChange={(e) => onUpdateCaption(e.target.value)}
          placeholder={`Adicione uma legenda para ${active?.file.name || "a mídia"}...`}
          className="bg-transparent text-[var(--cv-input-text)] placeholder:text-[var(--cv-text-muted)] w-full outline-none px-4"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !busy) {
              e.preventDefault();
              void onSend();
            }
          }}
        />
      </div>

      <div className="flex justify-end w-full max-w-3xl mx-auto pb-6 px-4">
        <button
          type="button"
          onClick={() => void onSend()}
          disabled={busy || sending}
          aria-busy={busy || sending}
          className={cn(
            "text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 disabled:opacity-60 disabled:pointer-events-none",
            surface === "whatsapp" && "bg-[var(--cv-accent)] hover:bg-[var(--cv-accent-hover)]",
          )}
          style={
            surface === "instagram"
              ? { background: "linear-gradient(135deg,#d62976 0%,#962fbf 100%)" }
              : undefined
          }
        >
          {busy || sending ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-6 h-6 ml-0.5" />
          )}
        </button>
      </div>
    </motion.div>
  );
}
