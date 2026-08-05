import { convertImageFileToPng } from "@/lib/chatImage";
import {
  convertVideoToMp4ForChat,
  type CompressVideoProgress,
} from "@/lib/compressChatVideo";
import {
  assertChatVideoAllowed,
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
};

/**
 * Wildcards apenas: Android ignora entradas por extensão no `accept` e o picker
 * pode não listar arquivo nenhum. iOS entrega vídeo da galeria como .MOV.
 */
export const CHAT_FILE_ACCEPT: Record<ChatSurface, string> = {
  whatsapp: "image/*,video/*,audio/*,application/pdf",
  instagram: "image/*,video/*,audio/*,application/pdf",
};

export async function normalizeAttachmentForChat(
  file: File,
  surface: ChatSurface,
): Promise<{ file: File; type: ChatMediaItemType }> {
  const kind = inferChatMediaKindFromFileMeta(file);
  if (!kind) {
    throw new Error("Arquivo deve ser imagem, áudio, vídeo (até 16 MB) ou PDF");
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

  // Container original é preservado (.MOV do iOS inclusive) — sem reencode.
  if (kind === "video") {
    assertChatVideoAllowed(file);
    return { file: isPassThroughChatMp4(file) ? ensureMp4FileMeta(file) : file, type: "video" };
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
      const { file: normalizedFile, type } = await normalizeAttachmentForChat(file, surface);
      return {
        file: normalizedFile,
        previewUrl: URL.createObjectURL(normalizedFile),
        type,
        caption: "",
      };
    }),
  );
}

/**
 * Valida e normaliza itens antes do upload.
 * Todo vídeo sai como arquivo real MP4 + MIME video/mp4.
 */
export async function prepareChatItemsForSend(
  items: Array<{ file: File; type: ChatMediaItemType; caption: string }>,
  options?: {
    onVideoProgress?: (progress: CompressVideoProgress & { fileName: string }) => void;
  },
): Promise<Array<{ file: File; type: ChatMediaItemType; caption: string }>> {
  const prepared: Array<{ file: File; type: ChatMediaItemType; caption: string }> = [];

  for (const item of items) {
    if (item.type === "video") {
      assertChatVideoAllowed(item.file);
      const mp4 = await convertVideoToMp4ForChat(item.file, {
        onProgress: (progress) =>
          options?.onVideoProgress?.({ ...progress, fileName: item.file.name }),
      });
      prepared.push({
        file: mp4,
        type: "video",
        caption: item.caption,
      });
      continue;
    }
    prepared.push({ file: item.file, type: item.type, caption: item.caption });
  }

  return prepared;
}
