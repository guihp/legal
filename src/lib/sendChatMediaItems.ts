import type { ChatMediaItemType } from "@/lib/chatMediaFiles";
import {
  dbMensageTypeFromChatType,
  formatConteudoMediaForDb,
  webhookTipoFromChatType,
  type WebhookOutgoingMediaTipo,
} from "@/lib/chatMediaStorage";
import { insertMensagemOptimistic, type ChatInsertPlatform } from "@/lib/insertMensagemOptimistic";
import { uploadChatMediaAndGetPublicUrl } from "@/lib/uploadChatMedia";

export type UploadedChatMediaItem = {
  url: string;
  tipo: ChatMediaItemType;
  mime_type: string;
  nome: string;
  caption: string;
};

export async function uploadAndBuildChatMediaItems(
  items: Array<{ file: File; type: ChatMediaItemType; caption: string }>,
  channel: "whatsapp" | "instagram",
  companyId: string | undefined,
): Promise<UploadedChatMediaItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const uploadedUrl = await uploadChatMediaAndGetPublicUrl(
        item.file,
        channel,
        item.type,
        companyId,
      );
      return {
        url: uploadedUrl,
        tipo: item.type,
        mime_type: item.file.type,
        nome: item.file.name,
        caption: item.caption || "",
      };
    }),
  );
}

/** Payload `midias` do webhook (tipo compatível com n8n). */
export function toWebhookMidiasPayload(items: UploadedChatMediaItem[]) {
  return items.map((item) => ({
    ...item,
    tipo: webhookTipoFromChatType(item.tipo),
  }));
}

export function resolveBatchWebhookTipo(items: UploadedChatMediaItem[]): WebhookOutgoingMediaTipo {
  if (!items.length) return "arquivo";
  const first = items[0]!.tipo;
  const allSame = items.every((m) => m.tipo === first);
  return allSame ? webhookTipoFromChatType(first) : "arquivo";
}

export async function insertOptimisticChatMediaRows(params: {
  companyId: string;
  sessionId: string;
  instancia: string;
  platform: ChatInsertPlatform;
  items: UploadedChatMediaItem[];
  userId?: string | null;
}): Promise<void> {
  for (const item of params.items) {
    if (item.tipo !== "imagem" && item.tipo !== "audio" && item.tipo !== "video" && item.tipo !== "pdf") {
      continue;
    }
    const inserted = await insertMensagemOptimistic({
      companyId: params.companyId,
      sessionId: params.sessionId,
      instancia: params.instancia,
      platform: params.platform,
      mediaUrl: formatConteudoMediaForDb(item.tipo, item.url),
      messageType: dbMensageTypeFromChatType(item.tipo),
      content: item.caption.trim(),
      userId: params.userId,
    });
    if (!inserted) {
      console.warn(`[${item.tipo}] insert otimista falhou; continuando via webhook`);
    }
  }
}
