import type { ChatMediaItemType } from "@/lib/chatMediaFiles";

/** Subpasta no Storage (`chat-media/{canal}/{subdir}/`). */
export function chatMediaStorageSubdir(type: ChatMediaItemType): string {
  switch (type) {
    case "imagem":
      return "image";
    case "audio":
      return "audio";
    case "video":
      return "video";
    case "pdf":
      return "document";
  }
}

/**
 * Valor gravado em `mensagens.conteudo_media` para o front extrair mídia na thread.
 */
export function formatConteudoMediaForDb(type: ChatMediaItemType, url: string): string {
  const u = url.trim();
  switch (type) {
    case "video":
      return JSON.stringify({ video: u, video_url: u });
    case "pdf":
      return JSON.stringify({ document: u, pdf: u, file_url: u });
    case "audio":
      return JSON.stringify({ audio: u, audio_url: u });
    case "imagem":
    default:
      return u;
  }
}

export function dbMensageTypeFromChatType(type: ChatMediaItemType): "image" | "audio" | "video" | "document" {
  switch (type) {
    case "imagem":
      return "image";
    case "audio":
      return "audio";
    case "video":
      return "video";
    case "pdf":
      return "document";
  }
}

export type WebhookOutgoingMediaTipo = "imagem" | "audio" | "video" | "arquivo";

export function webhookTipoFromChatType(type: ChatMediaItemType): WebhookOutgoingMediaTipo {
  switch (type) {
    case "imagem":
      return "imagem";
    case "audio":
      return "audio";
    case "video":
      return "video";
    case "pdf":
      return "arquivo";
  }
}
