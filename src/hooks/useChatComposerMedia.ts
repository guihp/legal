import { useCallback, useRef, useState } from "react";
import { getImageFilesFromClipboard } from "@/lib/clipboardImages";
import {
  buildChatPreviewItems,
  type ChatPreviewItem,
  type ChatSurface,
} from "@/lib/chatMediaFiles";
import { inferChatMediaKindFromFileMeta } from "@/lib/chatMediaKind";
import {
  ChatVideoPrepareError,
  ChatVideoSizeLimitError,
} from "@/lib/compressChatVideo";

export type ChatPreviewState = {
  items: ChatPreviewItem[];
  activeIndex: number;
};

export type PreparingAttachment = {
  name: string;
  kind: "imagem" | "video" | "audio" | "pdf" | "arquivo";
};

/** Progresso do transcode de vídeo, exibido no overlay durante o envio. */
export type PreviewSendProgress = {
  fileName: string;
  phase: "loading" | "compressing" | "uploading";
  ratio?: number;
};

export const MAX_PREVIEW_ITEMS = 10;

type ToastFn = (opts: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

export function useChatComposerMedia(options: {
  surface: ChatSurface;
  hasActiveConversation: boolean;
  toast: ToastFn;
  noConversationTitle?: string;
}) {
  const {
    surface,
    hasActiveConversation,
    toast,
    noConversationTitle = "Selecione uma conversa para enviar",
  } = options;

  const [previewData, setPreviewData] = useState<ChatPreviewState | null>(null);
  const [preparingAttachment, setPreparingAttachment] =
    useState<PreparingAttachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendProgress, setSendProgress] = useState<PreviewSendProgress | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const clearPreview = useCallback(() => {
    setSendProgress(null);
    setPreviewData((prev) => {
      (prev?.items || []).forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return null;
    });
  }, []);

  const removePreviewItem = useCallback((index: number) => {
    setPreviewData((prev) => {
      if (!prev) return prev;
      const target = prev.items[index];
      if (!target) return prev;
      if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
      const items = prev.items.filter((_, idx) => idx !== index);
      if (!items.length) return null;
      return { items, activeIndex: Math.min(prev.activeIndex, items.length - 1) };
    });
  }, []);

  const processFilesForPreview = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      if (!hasActiveConversation) {
        toast({ title: noConversationTitle, variant: "destructive" });
        return;
      }
      try {
        const firstFile = files[0];
        setPreparingAttachment({
          name: firstFile?.name || "Arquivo",
          kind: inferChatMediaKindFromFileMeta(firstFile) || "arquivo",
        });
        const items = await buildChatPreviewItems(files, surface);
        setPreviewData((prev) => {
          if (!prev) return { items, activeIndex: 0 };
          const merged = [...prev.items, ...items].slice(0, MAX_PREVIEW_ITEMS);
          if (prev.items.length + items.length > MAX_PREVIEW_ITEMS) {
            toast({
              title: `Máximo de ${MAX_PREVIEW_ITEMS} anexos`,
              description: "Os arquivos excedentes foram ignorados.",
            });
          }
          return { items: merged, activeIndex: Math.min(prev.items.length, merged.length - 1) };
        });
      } catch (err: unknown) {
        const title =
          err instanceof ChatVideoSizeLimitError
            ? "Vídeo acima do limite"
            : err instanceof ChatVideoPrepareError
              ? "Erro ao preparar vídeo"
              : "Erro ao processar arquivo";
        const message = err instanceof Error ? err.message : "Erro ao processar arquivo";
        toast({ title, description: message, variant: "destructive" });
      } finally {
        setPreparingAttachment(null);
      }
    },
    [hasActiveConversation, noConversationTitle, surface, toast],
  );

  const onPickFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      await processFilesForPreview(files);
      if (e.target) e.target.value = "";
    },
    [processFilesForPreview],
  );

  const onPasteMedia = useCallback(
    async (e: React.ClipboardEvent) => {
      const imageFiles = getImageFilesFromClipboard(e.clipboardData);
      if (!imageFiles.length) return;
      e.preventDefault();
      await processFilesForPreview(imageFiles);
    },
    [processFilesForPreview],
  );

  const updateCaption = useCallback((caption: string, index?: number) => {
    setPreviewData((prev) => {
      if (!prev) return prev;
      const target = index ?? prev.activeIndex;
      return {
        ...prev,
        items: prev.items.map((item, idx) => (idx === target ? { ...item, caption } : item)),
      };
    });
  }, []);

  const setActivePreviewIndex = useCallback((index: number) => {
    setPreviewData((prev) => (prev ? { ...prev, activeIndex: index } : prev));
  }, []);

  return {
    previewData,
    setPreviewData,
    preparingAttachment,
    busy,
    setBusy,
    sendProgress,
    setSendProgress,
    imgInputRef,
    messageTextareaRef,
    processFilesForPreview,
    onPickFile,
    onPasteMedia,
    clearPreview,
    removePreviewItem,
    updateCaption,
    setActivePreviewIndex,
  };
}
