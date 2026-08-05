import { convertImageFileToPng } from "@/lib/chatImage";
import {
  assertChatVideoAllowed,
  ensureMp4FileMeta,
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

/** Só MP4 para vídeo — .MOV/WebM são rejeitados com aviso (sem compressão no browser). */
export const CHAT_FILE_ACCEPT: Record<ChatSurface, string> = {
  whatsapp: "image/*,video/mp4,.mp4,audio/ogg,audio/webm,application/pdf",
  instagram: "image/*,video/mp4,.mp4,audio/mp4,audio/x-m4a,.m4a,application/pdf",
};

export async function normalizeAttachmentForChat(
  file: File,
  surface: ChatSurface,
): Promise<{ file: File; type: ChatMediaItemType }> {
  const kind = inferChatMediaKindFromFileMeta(file);
  if (!kind) {
    throw new Error("Arquivo deve ser imagem, áudio, vídeo MP4 (até 16 MB) ou PDF");
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
    assertChatVideoAllowed(file);
    return { file: ensureMp4FileMeta(file), type: "video" };
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
 * Valida itens imediatamente antes do upload (sem ffmpeg).
 * Vídeos inválidos já devem ter sido barrados no preview; revalida por segurança.
 */
export async function prepareChatItemsForSend(
  items: Array<{ file: File; type: ChatMediaItemType; caption: string }>,
): Promise<Array<{ file: File; type: ChatMediaItemType; caption: string }>> {
  return items.map((item) => {
    if (item.type === "video") {
      assertChatVideoAllowed(item.file);
      return {
        file: ensureMp4FileMeta(item.file),
        type: "video",
        caption: item.caption,
      };
    }
    return { file: item.file, type: item.type, caption: item.caption };
  });
}
