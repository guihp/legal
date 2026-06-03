import { convertImageFileToPng } from "@/lib/chatImage";
import {
  CHAT_VIDEO_MAX_LABEL,
  ChatVideoSizeLimitError,
  compressVideoForChat,
  type CompressVideoProgress,
} from "@/lib/compressChatVideo";
import { normalizeAudioFileForInstagram } from "@/lib/voiceAudioInstagram";
import { normalizeAudioFileForWhatsapp } from "@/lib/voiceAudioWhatsapp";

export type ChatMediaItemType = "imagem" | "audio" | "video" | "pdf";
export type ChatSurface = "whatsapp" | "instagram";

export type ChatPreviewItem = {
  file: File;
  previewUrl: string;
  type: ChatMediaItemType;
  caption: string;
};

export const CHAT_FILE_ACCEPT: Record<ChatSurface, string> = {
  whatsapp: "image/*,video/mp4,audio/ogg,audio/webm,application/pdf",
  instagram: "image/*,video/mp4,audio/mp4,audio/x-m4a,.m4a,application/pdf",
};

export async function normalizeAttachmentForChat(
  file: File,
  surface: ChatSurface,
  options?: { onVideoCompressProgress?: (p: CompressVideoProgress) => void },
): Promise<{ file: File; type: ChatMediaItemType }> {
  if (file.type.startsWith("image/")) {
    try {
      return { file: await convertImageFileToPng(file), type: "imagem" };
    } catch {
      throw new Error(`Nao foi possivel converter a imagem "${file.name}" para PNG`);
    }
  }

  if (file.type.startsWith("audio/") || file.name.toLowerCase().endsWith(".m4a")) {
    const normalized =
      surface === "instagram"
        ? await normalizeAudioFileForInstagram(file)
        : await normalizeAudioFileForWhatsapp(file);
    return { file: normalized, type: "audio" };
  }

  if (file.type.startsWith("video/") || file.name.toLowerCase().endsWith(".mp4")) {
    try {
      const compressed = await compressVideoForChat(file, {
        onProgress: options?.onVideoCompressProgress,
      });
      return { file: compressed, type: "video" };
    } catch (err) {
      if (err instanceof ChatVideoSizeLimitError) throw err;
      throw new Error(
        `Não foi possível preparar o vídeo para envio (limite ${CHAT_VIDEO_MAX_LABEL}). Tente outro arquivo.`,
      );
    }
  }

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return { file, type: "pdf" };
  }

  throw new Error("Arquivo deve ser imagem, áudio, vídeo MP4 ou PDF");
}

export async function buildChatPreviewItems(
  files: File[],
  surface: ChatSurface,
  options?: { onVideoCompressProgress?: (p: CompressVideoProgress) => void },
): Promise<ChatPreviewItem[]> {
  return Promise.all(
    files.map(async (file) => {
      const { file: normalizedFile, type } = await normalizeAttachmentForChat(file, surface, options);
      return {
        file: normalizedFile,
        previewUrl: URL.createObjectURL(normalizedFile),
        type,
        caption: "",
      };
    }),
  );
}
