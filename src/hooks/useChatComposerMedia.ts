import { useCallback, useRef, useState } from "react";
import { getImageFilesFromClipboard } from "@/lib/clipboardImages";
import {
  buildChatPreviewItems,
  type ChatPreviewItem,
  type ChatSurface,
} from "@/lib/chatMediaFiles";
import { ChatVideoSizeLimitError } from "@/lib/compressChatVideo";

export type ChatPreviewState = {
  items: ChatPreviewItem[];
  activeIndex: number;
};

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
  const [busy, setBusy] = useState(false);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const clearPreview = useCallback(() => {
    setPreviewData((prev) => {
      (prev?.items || []).forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return null;
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
        setBusy(true);
        const hasVideo = files.some(
          (f) => f.type.startsWith("video/") || f.name.toLowerCase().endsWith(".mp4"),
        );
        if (hasVideo) {
          toast({
            title: "Preparando vídeo",
            description: "Comprimindo para até 16 MB, se necessário. Aguarde…",
          });
        }
        const items = await buildChatPreviewItems(files, surface, {
          onVideoCompressProgress: (p) => {
            if (p.phase === "loading") {
              toast({
                title: "Preparando vídeo",
                description: "Carregando compressor (primeira vez pode demorar)…",
              });
            }
          },
        });
        setPreviewData({ items, activeIndex: 0 });
        if (hasVideo) {
          toast({
            title: "Vídeo pronto",
            description: "Revise o preview e envie quando quiser.",
          });
        }
      } catch (err: unknown) {
        const title =
          err instanceof ChatVideoSizeLimitError ? "Vídeo acima do limite" : "Erro ao processar arquivo";
        const message = err instanceof Error ? err.message : "Erro ao processar arquivo";
        toast({ title, description: message, variant: "destructive" });
      } finally {
        setBusy(false);
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

  const updateCaption = useCallback((caption: string) => {
    setPreviewData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item, idx) =>
          idx === prev.activeIndex ? { ...item, caption } : item,
        ),
      };
    });
  }, []);

  const setActivePreviewIndex = useCallback((index: number) => {
    setPreviewData((prev) => (prev ? { ...prev, activeIndex: index } : prev));
  }, []);

  return {
    previewData,
    setPreviewData,
    busy,
    setBusy,
    imgInputRef,
    messageTextareaRef,
    processFilesForPreview,
    onPickFile,
    onPasteMedia,
    clearPreview,
    updateCaption,
    setActivePreviewIndex,
  };
}
