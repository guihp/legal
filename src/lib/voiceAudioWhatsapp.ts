import { concatChunks } from "opus-accumulator";

/** MIME gravado pelo MediaRecorder, em ordem de preferência (WhatsApp = OGG Opus). */
export const VOICE_RECORDER_MIME_CANDIDATES = [
  "audio/ogg;codecs=opus",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
] as const;

export const WHATSAPP_VOICE_MIME = "audio/ogg";
export const WHATSAPP_VOICE_EXT = "ogg";

export function pickVoiceRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const candidate of VOICE_RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

function isOggContainer(mime: string): boolean {
  return mime.toLowerCase().includes("ogg");
}

function isWebmContainer(mime: string): boolean {
  return mime.toLowerCase().includes("webm");
}

async function blobToUint8(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Normaliza gravação do navegador para arquivo .ogg (Opus) enviado ao webhook/WhatsApp.
 * WebM Opus → remux sem re-encode; já OGG → mantém; MP4 (Safari/AAC) não suportado aqui.
 */
export async function finalizeVoiceRecordingForWhatsapp(
  chunks: BlobPart[],
  recordedMime: string,
): Promise<File> {
  const mime = (recordedMime || "audio/webm").trim();
  const blob = new Blob(chunks, { type: mime });
  const name = `audio-${Date.now()}.${WHATSAPP_VOICE_EXT}`;

  if (isOggContainer(mime)) {
    return new File([blob], name, { type: WHATSAPP_VOICE_MIME });
  }

  if (isWebmContainer(mime)) {
    const oggBytes = concatChunks([await blobToUint8(blob)]);
    return new File([oggBytes], name, { type: WHATSAPP_VOICE_MIME });
  }

  if (mime.includes("mp4")) {
    throw new Error(
      "Este navegador gravou áudio em MP4 (AAC). Para enviar ao WhatsApp use Chrome ou Firefox, que gravam em OGG/WebM.",
    );
  }

  try {
    const oggBytes = concatChunks([await blobToUint8(blob)]);
    return new File([oggBytes], name, { type: WHATSAPP_VOICE_MIME });
  } catch {
    throw new Error("Não foi possível converter o áudio para OGG (formato exigido pelo WhatsApp).");
  }
}

/** Converte arquivo de áudio anexado para OGG quando necessário. */
export async function normalizeAudioFileForWhatsapp(file: File): Promise<File> {
  const mime = file.type || "";
  if (mime === WHATSAPP_VOICE_MIME || mime.endsWith("/ogg") || file.name.toLowerCase().endsWith(".ogg")) {
    return file.type === WHATSAPP_VOICE_MIME
      ? file
      : new File([file], file.name.replace(/\.[^.]+$/, "") + `.${WHATSAPP_VOICE_EXT}`, {
          type: WHATSAPP_VOICE_MIME,
        });
  }
  if (isWebmContainer(mime) || file.name.toLowerCase().endsWith(".webm")) {
    const oggBytes = concatChunks([await blobToUint8(file)]);
    const base = file.name.replace(/\.[^.]+$/, "") || `audio-${Date.now()}`;
    return new File([oggBytes], `${base}.${WHATSAPP_VOICE_EXT}`, { type: WHATSAPP_VOICE_MIME });
  }
  if (mime.includes("mp4") || file.name.toLowerCase().endsWith(".mp4")) {
    throw new Error("Anexo MP4 não é aceito para WhatsApp. Envie ou grave em OGG.");
  }
  throw new Error("Formato de áudio não suportado. Use OGG ou WebM (será convertido para OGG).");
}
