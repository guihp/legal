export type ChatMediaItemType = "imagem" | "audio" | "video" | "pdf";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif|svg)$/i;
const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;
const AUDIO_EXT = /\.(ogg|opus|mp3|m4a|wav|aac|flac)$/i;
const PDF_EXT = /\.pdf$/i;

/** Limite WhatsApp / Instagram para vídeo no envio pelo painel. */
export const CHAT_VIDEO_MAX_BYTES = 16 * 1024 * 1024;
export const CHAT_VIDEO_MAX_LABEL = "16 MB";

/**
 * Classifica anexo pelo MIME do browser e/ou extensão do nome.
 * Safari/Firefox às vezes entregam `file.type === ""` — não rejeitar nesses casos.
 */
export function inferChatMediaKindFromFileMeta(file: File): ChatMediaItemType | null {
  const mime = (file.type || "").toLowerCase().trim();
  const name = file.name || "";

  if (mime.startsWith("image/") || IMAGE_EXT.test(name)) return "imagem";
  if (mime === "application/pdf" || PDF_EXT.test(name)) return "pdf";

  // Áudio explícito (inclui audio/webm, audio/mp4) antes de vídeo genérico.
  if (mime.startsWith("audio/") || AUDIO_EXT.test(name)) return "audio";

  if (
    mime.startsWith("video/") ||
    mime === "application/mxf" ||
    VIDEO_EXT.test(name)
  ) {
    return "video";
  }

  // .webm sem MIME: costuma ser vídeo (gravação de tela); áudio já caiu acima se mime=audio/*.
  if (name.toLowerCase().endsWith(".webm")) return "video";

  return null;
}

/** MP4 H.264 “já pronto” para envio sem ffmpeg (extensão/MIME de mp4, não MOV/WebM). */
export function isPassThroughChatMp4(file: File): boolean {
  const mime = (file.type || "").toLowerCase().trim();
  const name = (file.name || "").toLowerCase();

  if (
    name.endsWith(".mov") ||
    name.endsWith(".webm") ||
    name.endsWith(".mkv") ||
    name.endsWith(".avi") ||
    name.endsWith(".m4v") ||
    mime.includes("quicktime") ||
    mime.includes("webm") ||
    mime.includes("x-matroska") ||
    mime.includes("x-msvideo")
  ) {
    return false;
  }

  return name.endsWith(".mp4") || mime === "video/mp4" || mime === "video/mpeg";
}

export function formatChatVideoSizeMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Valida vídeo antes do preview/envio.
 * Só o tamanho é bloqueado: iPhone grava sempre em .MOV, então rejeitar
 * container impediria qualquer envio de vídeo pelo iOS.
 */
export function assertChatVideoAllowed(file: File): void {
  if (file.size > CHAT_VIDEO_MAX_BYTES) {
    throw new Error(
      `"${file.name}" tem ${formatChatVideoSizeMb(file.size)} e o limite é ${CHAT_VIDEO_MAX_LABEL}. ` +
        `Envie um vídeo mais curto ou em resolução menor.`,
    );
  }
}

/**
 * Mantido para compressChatVideo legado / testes.
 * Agora true = formato ou tamanho que o painel rejeita (não comprime mais).
 */
export function needsChatVideoTranscode(file: File, maxBytes: number): boolean {
  return file.size > maxBytes || !isPassThroughChatMp4(file);
}

/** Garante File com nome .mp4 e MIME video/mp4 (sem reencode). */
export function ensureMp4FileMeta(file: File): File {
  const lower = file.name.toLowerCase();
  const name = lower.endsWith(".mp4")
    ? file.name
    : `${file.name.replace(/\.[^.]+$/, "") || "video"}-chat.mp4`;
  if (file.type === "video/mp4" && name === file.name) return file;
  return new File([file], name, { type: "video/mp4" });
}

export function contentTypeForChatUpload(
  file: File,
  mediaType: ChatMediaItemType,
): string {
  const t = (file.type || "").trim();
  if (t && t !== "application/octet-stream") return t;
  switch (mediaType) {
    case "imagem":
      return "image/png";
    case "audio": {
      const n = file.name.toLowerCase();
      return n.endsWith(".m4a") || n.endsWith(".mp4") ? "audio/mp4" : "audio/ogg";
    }
    case "video":
      return "video/mp4";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
