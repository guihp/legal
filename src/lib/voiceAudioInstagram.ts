/** MIME exigido pelo fluxo Instagram (Direct / n8n). */
export const INSTAGRAM_VOICE_MIME = "audio/mp4";
export const INSTAGRAM_VOICE_EXT = "m4a";

const INSTAGRAM_RECORDER_MIME_CANDIDATES = [
  "audio/mp4",
  "audio/mp4;codecs=mp4a",
  "audio/mp4;codecs=aac",
] as const;

export function pickVoiceRecorderMimeTypeForInstagram(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const candidate of INSTAGRAM_RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

function isMp4Audio(mime: string, fileName?: string): boolean {
  const m = mime.toLowerCase();
  if (m.includes("mp4") || m === "audio/m4a" || m === "audio/x-m4a") return true;
  const n = (fileName ?? "").toLowerCase();
  return n.endsWith(".mp4") || n.endsWith(".m4a");
}

/**
 * Finaliza gravação do microfone para envio no Instagram (container MP4 / AAC).
 * Não converte WebM/OGG — o navegador precisa suportar `audio/mp4` (ex.: Safari).
 */
export async function finalizeVoiceRecordingForInstagram(
  chunks: BlobPart[],
  recordedMime: string,
): Promise<File> {
  const mime = (recordedMime || "").trim();
  const blob = new Blob(chunks, { type: mime || INSTAGRAM_VOICE_MIME });
  const name = `audio-${Date.now()}.${INSTAGRAM_VOICE_EXT}`;

  if (isMp4Audio(mime)) {
    return new File([blob], name, { type: INSTAGRAM_VOICE_MIME });
  }

  throw new Error(
    "Este navegador não grava áudio em MP4. No Instagram use Safari (Mac/iPhone) ou anexe um arquivo .m4a/.mp4.",
  );
}

/** Anexo de áudio no preview — apenas MP4/M4A. */
export async function normalizeAudioFileForInstagram(file: File): Promise<File> {
  if (isMp4Audio(file.type, file.name)) {
    const base = file.name.replace(/\.[^.]+$/, "") || `audio-${Date.now()}`;
    return file.type === INSTAGRAM_VOICE_MIME
      ? file
      : new File([file], `${base}.${INSTAGRAM_VOICE_EXT}`, { type: INSTAGRAM_VOICE_MIME });
  }
  throw new Error("Áudio para Instagram deve estar em MP4 (.mp4 ou .m4a).");
}
