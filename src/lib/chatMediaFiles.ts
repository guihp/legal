import { convertImageFileToPng } from "@/lib/chatImage";
import {
  ChatVideoPrepareError,
  ChatVideoSizeLimitError,
  compressVideoForChat,
  needsChatVideoTranscode,
  type CompressVideoProgress,
} from "@/lib/compressChatVideo";
import {
  ensureMp4FileMeta,
  inferChatMediaKindFromFileMeta,
  isPassThroughChatMp4,
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
  /** Vídeo ainda precisa de transcode/compressão — feito só no envio. */
  needsVideoPrepare?: boolean;
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
): Promise<{ file: File; type: ChatMediaItemType; needsVideoPrepare?: boolean }> {
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

  // Vídeo: preview usa o arquivo original; transcode acontece só no envio.
  if (kind === "video") {
    return {
      file,
      type: "video",
      needsVideoPrepare: needsChatVideoTranscode(file),
    };
  }

  // pdf
  return { file, type: "pdf" };
}

export async function buildChatPreviewItems(
  files: File[],
  surface: ChatSurface,
): Promise<ChatPreviewItem[]> {
  return Promise.all(
    files.map(async (file) => {
      const { file: normalizedFile, type, needsVideoPrepare } =
        await normalizeAttachmentForChat(file, surface);
      return {
        file: normalizedFile,
        previewUrl: URL.createObjectURL(normalizedFile),
        type,
        caption: "",
        needsVideoPrepare,
      };
    }),
  );
}

/**
 * Transcodifica/comprime os vídeos pendentes imediatamente antes do upload.
 * Chamado no envio para que o preview apareça na hora.
 */
export async function prepareChatItemsForSend(
  items: Array<{ file: File; type: ChatMediaItemType; caption: string; needsVideoPrepare?: boolean }>,
  options?: {
    onVideoProgress?: (p: CompressVideoProgress & { fileName: string }) => void;
  },
): Promise<Array<{ file: File; type: ChatMediaItemType; caption: string }>> {
  const prepared: Array<{ file: File; type: ChatMediaItemType; caption: string }> = [];

  for (const item of items) {
    if (item.type !== "video") {
      prepared.push({ file: item.file, type: item.type, caption: item.caption });
      continue;
    }

    // Dentro do limite: envia o arquivo original, sem reencode.
    if (!item.needsVideoPrepare) {
      prepared.push({
        file: isPassThroughChatMp4(item.file) ? ensureMp4FileMeta(item.file) : item.file,
        type: "video",
        caption: item.caption,
      });
      continue;
    }

    try {
      const compressed = await compressVideoForChat(item.file, {
        onProgress: (p) => options?.onVideoProgress?.({ ...p, fileName: item.file.name }),
      });
      prepared.push({ file: compressed, type: "video", caption: item.caption });
    } catch (err) {
      if (err instanceof ChatVideoSizeLimitError) throw err;
      if (err instanceof ChatVideoPrepareError) throw err;
      const detail = err instanceof Error ? err.message : "erro desconhecido";
      throw new ChatVideoPrepareError(
        `Não foi possível preparar o vídeo "${item.file.name}" para envio. ${detail}`,
        { cause: err },
      );
    }
  }

  return prepared;
}
