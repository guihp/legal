import { convertImageFileToPng } from "@/lib/chatImage";
import {
  ChatVideoPrepareError,
  ChatVideoSizeLimitError,
  compressVideoForChat,
  type CompressVideoProgress,
} from "@/lib/compressChatVideo";
import {
  inferChatMediaKindFromFileMeta,
  type ChatMediaItemType,
} from "@/lib/chatMediaKind";
import { normalizeAudioFileForInstagram } from "@/lib/voiceAudioInstagram";
import { normalizeAudioFileForWhatsapp } from "@/lib/voiceAudioWhatsapp";

export type { ChatMediaItemType } from "@/lib/chatMediaKind";
export type ChatSurface = "whatsapp" | "instagram";

export type ChatPreviewItem = {
  file: File;
  previewUrl: string;
  type: ChatMediaItemType;
  caption: string;
};

/** Aceita MP4 + MOV/WebM comuns; MIME vazio ainda é coberto por extensão no normalize. */
export const CHAT_FILE_ACCEPT: Record<ChatSurface, string> = {
  whatsapp:
    "image/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,audio/ogg,audio/webm,application/pdf",
  instagram:
    "image/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,audio/mp4,audio/x-m4a,.m4a,application/pdf",
};

export async function normalizeAttachmentForChat(
  file: File,
  surface: ChatSurface,
  options?: { onVideoCompressProgress?: (p: CompressVideoProgress) => void },
): Promise<{ file: File; type: ChatMediaItemType }> {
  const kind = inferChatMediaKindFromFileMeta(file);
  if (!kind) {
    throw new Error("Arquivo deve ser imagem, áudio, vídeo (MP4/MOV/WebM) ou PDF");
  }

  if (kind === "imagem") {
    try {
      return { file: await convertImageFileToPng(file), type: "imagem" };
    } catch {
      throw new Error(`Nao foi possivel converter a imagem "${file.name}" para PNG`);
    }
  }

  if (kind === "audio") {
    const normalized =
      surface === "instagram"
        ? await normalizeAudioFileForInstagram(file)
        : await normalizeAudioFileForWhatsapp(file);
    return { file: normalized, type: "audio" };
  }

  if (kind === "video") {
    try {
      const compressed = await compressVideoForChat(file, {
        onProgress: options?.onVideoCompressProgress,
      });
      return { file: compressed, type: "video" };
    } catch (err) {
      if (err instanceof ChatVideoSizeLimitError) throw err;
      if (err instanceof ChatVideoPrepareError) throw err;
      const detail = err instanceof Error ? err.message : "erro desconhecido";
      throw new ChatVideoPrepareError(
        `Não foi possível preparar o vídeo "${file.name}" para envio. ${detail}`,
        { cause: err },
      );
    }
  }

  // pdf
  return { file, type: "pdf" };
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
