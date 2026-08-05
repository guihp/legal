import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Image, Mic, Paperclip, Plus, Send, Trash2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MAX_PREVIEW_ITEMS,
  type ChatPreviewState,
  type PreviewSendProgress,
} from "@/hooks/useChatComposerMedia";
import { CHAT_FILE_ACCEPT, type ChatSurface } from "@/lib/chatMediaFiles";

export type ChatMediaPreviewOverlayProps = {
  surface: ChatSurface;
  previewData: ChatPreviewState;
  busy?: boolean;
  sending?: boolean;
  sendProgress?: PreviewSendProgress | null;
  onCancel: () => void;
  onSend: () => void;
  onUpdateCaption: (caption: string) => void;
  onSelectIndex: (index: number) => void;
  onAddFiles?: (files: File[]) => void;
  onRemoveIndex?: (index: number) => void;
};

export function ChatMediaPreviewOverlay({
  surface,
  previewData,
  busy,
  sending,
  sendProgress,
  onCancel,
  onSend,
  onUpdateCaption,
  onSelectIndex,
  onAddFiles,
  onRemoveIndex,
}: ChatMediaPreviewOverlayProps) {
  const addInputRef = useRef<HTMLInputElement | null>(null);
  const active = previewData.items[previewData.activeIndex];
  const [videoPreviewFailed, setVideoPreviewFailed] = useState(false);

  useEffect(() => {
    setVideoPreviewFailed(false);
  }, [active?.previewUrl]);

  const isWorking = Boolean(busy || sending);
  const canAddMore = Boolean(onAddFiles) && previewData.items.length < MAX_PREVIEW_ITEMS;
  const progressPercent =
    sendProgress?.phase === "compressing" && typeof sendProgress.ratio === "number"
      ? Math.round(Math.min(1, Math.max(0, sendProgress.ratio)) * 100)
      : null;
  const progressLabel = !sendProgress
    ? null
    : sendProgress.phase === "loading"
      ? "Carregando compressor de vídeo (primeira vez pode demorar)…"
      : sendProgress.phase === "compressing"
        ? `Comprimindo ${sendProgress.fileName}${progressPercent !== null ? ` · ${progressPercent}%` : ""}`
        : `Enviando ${sendProgress.fileName}…`;
  const thumbActiveBorder =
    surface === "instagram" ? "border-[#d62976]" : "border-[var(--cv-accent)]";
  const mediaLabel =
    active?.type === "imagem"
      ? "Imagem"
      : active?.type === "video"
        ? "Vídeo"
        : active?.type === "audio"
          ? "Áudio"
          : active?.type === "pdf"
            ? "PDF"
            : "Arquivo";
  const sizeLabel = active?.file.size
    ? `${(active.file.size / (1024 * 1024)).toFixed(active.file.size >= 1024 * 1024 ? 1 : 2)} MB`
    : "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Pré-visualização de mídia"
    >
      <motion.section
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18 }}
        className="flex h-[min(92dvh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-[var(--cv-panel)] text-[var(--cv-text)] shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--cv-border)] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--cv-accent)]/12 text-[var(--cv-accent)]">
              {active?.type === "video" ? (
                <Video className="h-5 w-5" />
              ) : active?.type === "imagem" ? (
                <Image className="h-5 w-5" />
              ) : (
                <Paperclip className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold sm:text-base">Pré-visualização</h2>
              <p className="truncate text-xs text-[var(--cv-text-muted)]" title={active?.file.name}>
                {active?.file.name} {sizeLabel ? `· ${sizeLabel}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full bg-[var(--cv-panel-muted)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--cv-text-muted)] sm:inline-flex">
              {mediaLabel}
              {previewData.items.length > 1 ? ` · ${previewData.activeIndex + 1}/${previewData.items.length}` : ""}
            </span>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={onCancel}
              aria-label="Fechar pré-visualização"
              className="h-9 w-9 rounded-full text-[var(--cv-icon)] hover:bg-[var(--cv-hover)]"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 bg-[#F7F5F0] p-3 dark:bg-black/35 sm:p-5">
          <div className="flex h-full items-center justify-center overflow-hidden rounded-2xl border border-black/5 bg-white/70 shadow-inner dark:border-white/10 dark:bg-black/25">
            {active?.type === "imagem" ? (
              <img
                src={active.previewUrl}
                alt={`Pré-visualização de ${active.file.name}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : active?.type === "video" ? (
              videoPreviewFailed ? (
                <div className="flex w-[min(90%,420px)] flex-col items-center gap-4 rounded-2xl border border-[var(--cv-border)] bg-[var(--cv-panel)] p-7 text-center shadow-lg">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--cv-accent)]/12 text-[var(--cv-accent)]">
                    <Video className="h-8 w-8" />
                  </span>
                  <p className="max-w-full truncate font-semibold" title={active.file.name}>
                    {active.file.name}
                  </p>
                  <p className="text-xs text-[var(--cv-text-muted)]">
                    Este navegador não reproduz o formato original. O vídeo será convertido para MP4
                    no envio.
                  </p>
                </div>
              ) : (
                <video
                  key={active.previewUrl}
                  src={active.previewUrl}
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setVideoPreviewFailed(true)}
                  className="max-h-full max-w-full bg-black object-contain"
                />
              )
            ) : active?.type === "pdf" ? (
              <div className="flex w-[min(90%,420px)] flex-col items-center gap-4 rounded-2xl border border-[var(--cv-border)] bg-[var(--cv-panel)] p-7 text-center shadow-lg">
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-red-500/12 text-red-500">
                  <FileText className="h-8 w-8" />
                </span>
                <p className="max-w-full truncate font-semibold" title={active.file.name}>{active.file.name}</p>
                <a href={active.previewUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[var(--cv-accent)] hover:underline">
                  Abrir PDF
                </a>
              </div>
            ) : active?.type === "audio" ? (
              <div className="flex w-[min(90%,460px)] flex-col items-center gap-5 rounded-2xl border border-[var(--cv-border)] bg-[var(--cv-panel)] p-7 shadow-lg">
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--cv-accent)]/12 text-[var(--cv-accent)]">
                  <Mic className="h-8 w-8" />
                </span>
                <audio src={active.previewUrl} controls className="w-full" preload="metadata" />
              </div>
            ) : (
              <div className="flex w-[min(90%,420px)] flex-col items-center gap-4 rounded-2xl border border-[var(--cv-border)] bg-[var(--cv-panel)] p-7 text-center shadow-lg">
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--cv-panel-muted)] text-[var(--cv-text-muted)]">
                  <Paperclip className="h-8 w-8" />
                </span>
                <p className="max-w-full truncate font-semibold" title={active?.file.name}>{active?.file.name}</p>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--cv-border)] px-4 py-2.5">
          <div className="conversas-scrollbar flex gap-2 overflow-x-auto py-0.5">
            {previewData.items.map((item, idx) => (
              <div
                key={`${item.file.name}-${idx}`}
                className={cn(
                  "group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-[var(--cv-panel-muted)] transition",
                  previewData.activeIndex === idx
                    ? `${thumbActiveBorder} shadow-sm`
                    : "border-transparent opacity-65 hover:opacity-100",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectIndex(idx)}
                  className="h-full w-full"
                  title={item.file.name}
                  aria-label={`Selecionar ${item.file.name}`}
                >
                  {item.type === "imagem" ? (
                    <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : item.type === "video" ? (
                    <span className="grid h-full w-full place-items-center bg-black text-white">
                      <Video className="h-5 w-5" />
                    </span>
                  ) : (
                    <span className="grid h-full w-full place-items-center text-[9px] font-bold text-[var(--cv-text-muted)]">
                      {item.type === "audio" ? "ÁUDIO" : item.type === "pdf" ? "PDF" : "ARQ"}
                    </span>
                  )}
                </button>

                {item.caption.trim() ? (
                  <span
                    className="pointer-events-none absolute bottom-0 left-0 right-0 truncate bg-slate-950/70 px-1 py-0.5 text-[9px] font-medium text-white"
                    title={item.caption}
                  >
                    {item.caption}
                  </span>
                ) : null}

                {onRemoveIndex && !isWorking ? (
                  <button
                    type="button"
                    onClick={() => onRemoveIndex(idx)}
                    aria-label={`Remover ${item.file.name}`}
                    className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-slate-950/70 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            ))}

            {canAddMore ? (
              <>
                <button
                  type="button"
                  onClick={() => addInputRef.current?.click()}
                  disabled={isWorking}
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border-2 border-dashed border-[var(--cv-border)] text-[var(--cv-text-muted)] transition hover:border-[var(--cv-accent)]/60 hover:text-[var(--cv-accent)] disabled:pointer-events-none disabled:opacity-50"
                  aria-label="Adicionar mais arquivos"
                  title="Adicionar mais arquivos"
                >
                  <Plus className="h-5 w-5" />
                </button>
                <input
                  ref={addInputRef}
                  type="file"
                  multiple
                  accept={CHAT_FILE_ACCEPT[surface]}
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length) onAddFiles?.(files);
                    if (e.target) e.target.value = "";
                  }}
                />
              </>
            ) : null}
          </div>
        </div>

        <footer className="shrink-0 border-t border-[var(--cv-border)] bg-[var(--cv-panel)] p-3 sm:p-4">
          {progressLabel ? (
            <div className="mb-2.5 rounded-xl border border-[var(--cv-accent)]/25 bg-[var(--cv-accent)]/[0.07] px-3 py-2">
              <p className="truncate text-xs font-medium text-[var(--cv-text)]">{progressLabel}</p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--cv-border)]">
                <div
                  className={cn(
                    "h-full rounded-full bg-[var(--cv-accent)] transition-[width]",
                    progressPercent === null && "w-1/3 animate-pulse",
                  )}
                  style={progressPercent !== null ? { width: `${progressPercent}%` } : undefined}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-[var(--cv-border)] bg-[var(--cv-input-bg)] px-3 focus-within:border-[var(--cv-accent)]/50 focus-within:ring-1 focus-within:ring-[var(--cv-accent)]/15">
              <input
                autoFocus
                value={active?.caption || ""}
                onChange={(e) => onUpdateCaption(e.target.value)}
                placeholder={
                  previewData.items.length > 1
                    ? `Legenda para ${active?.file.name || "este arquivo"} (opcional)`
                    : "Adicione uma legenda (opcional)"
                }
                className="h-11 w-full min-w-0 bg-transparent text-sm text-[var(--cv-input-text)] outline-none placeholder:text-[var(--cv-text-muted)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isWorking) {
                    e.preventDefault();
                    void onSend();
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => void onSend()}
              disabled={isWorking}
              aria-busy={isWorking}
              className={cn(
                "btn-on-emerald flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
                surface === "whatsapp" && "bg-[var(--cv-accent)] hover:bg-[var(--cv-accent-hover)]",
              )}
              style={surface === "instagram" ? { background: "linear-gradient(135deg,#d62976 0%,#962fbf 100%)" } : undefined}
            >
              {isWorking ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>
                {isWorking
                  ? "Enviando…"
                  : previewData.items.length > 1
                    ? `Enviar ${previewData.items.length} itens`
                    : "Enviar mídia"}
              </span>
            </button>
          </div>
        </footer>
      </motion.section>
    </motion.div>
  );
}
