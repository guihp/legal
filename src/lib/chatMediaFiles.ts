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

  // MOV e MP4 compartilham o container ISO-BMFF, então rotular como MP4 basta
  // para a API aceitar (só `video/mp4`) sem recodificar no browser.
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
 * Valida e normaliza itens antes do upload.
 * Vídeo sempre sai com nome `.mp4` e MIME `video/mp4` — a API rejeita
 * qualquer outro formato (`Invalid file format: 'video/quicktime'`).
 */
export async function prepareChatItemsForSend(
  items: Array<{ file: File; type: ChatMediaItemType; caption: string }>,
): Promise<Array<{ file: File; type: ChatMediaItemType; caption: string }>> {
  return items.map((item) => {
    if (item.type === "video") {
      assertChatVideoAllowed(item.file);
      return { file: ensureMp4FileMeta(item.file), type: "video" as const, caption: item.caption };
    }
    return { file: item.file, type: item.type, caption: item.caption };
  });
}
