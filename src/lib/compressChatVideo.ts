import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

/** Limite WhatsApp / Instagram para vídeo no envio pelo painel. */
export const CHAT_VIDEO_MAX_BYTES = 16 * 1024 * 1024;
export const CHAT_VIDEO_MAX_LABEL = "16 MB";

export class ChatVideoSizeLimitError extends Error {
  readonly originalSizeMb: number;

  constructor(originalBytes: number) {
    const mb = (originalBytes / (1024 * 1024)).toFixed(1);
    super(
      `Este vídeo não pode ser enviado: mesmo após compressão, o arquivo ficou acima de ${CHAT_VIDEO_MAX_LABEL} (seu arquivo: ~${mb} MB). ` +
        `Envie um vídeo mais curto ou grave em resolução menor.`,
    );
    this.name = "ChatVideoSizeLimitError";
    this.originalSizeMb = Number(mb);
  }
}

export type CompressVideoProgress = {
  phase: "loading" | "compressing" | "done";
  ratio?: number;
};

type FfmpegInstance = FFmpeg;

let ffmpegLoadPromise: Promise<FfmpegInstance> | null = null;

async function getFfmpeg(onProgress?: (p: CompressVideoProgress) => void): Promise<FfmpegInstance> {
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      onProgress?.({ phase: "loading" });
      const ffmpeg = new FFmpeg();
      const coreVersion = "0.12.6";
      const baseURL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${coreVersion}/dist/esm`;
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })();
  }
  return ffmpegLoadPromise;
}

function outputName(inputName: string): string {
  const base = inputName.replace(/\.[^.]+$/, "") || "video";
  return `${base}-chat.mp4`;
}

async function runCompressPass(
  ffmpeg: FfmpegInstance,
  inputBytes: Uint8Array,
  inputName: string,
  opts: { crf: number; maxWidth: number },
  onProgress?: (ratio: number) => void,
): Promise<Uint8Array> {
  const inFile = "input.bin";
  const outFile = "output.mp4";

  const onFfmpegProgress = ({ progress }: { progress: number }) => {
    if (typeof progress === "number" && progress >= 0 && progress <= 1) {
      onProgress?.(progress);
    }
  };
  ffmpeg.on("progress", onFfmpegProgress);

  await ffmpeg.writeFile(inFile, inputBytes);
  try {
  await ffmpeg.exec([
    "-i",
    inFile,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    String(opts.crf),
    "-vf",
    `scale='min(${opts.maxWidth},iw)':-2`,
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    "-y",
    outFile,
  ]);
  } finally {
    ffmpeg.off("progress", onFfmpegProgress);
  }

  const data = await ffmpeg.readFile(outFile);
  try {
    await ffmpeg.deleteFile(inFile);
    await ffmpeg.deleteFile(outFile);
  } catch {
    /* ignore */
  }

  if (data instanceof Uint8Array) return data;
  return new TextEncoder().encode(String(data));
}

/**
 * Garante MP4 <= 16 MB para envio no chat. Comprime com H.264/AAC preservando qualidade
 * o máximo possível (CRF + largura progressivos).
 */
export async function compressVideoForChat(
  file: File,
  options?: { onProgress?: (p: CompressVideoProgress) => void },
): Promise<File> {
  if (file.size <= CHAT_VIDEO_MAX_BYTES) {
    return toMp4File(file);
  }

  const onProgress = options?.onProgress;
  onProgress?.({ phase: "compressing", ratio: 0 });

  const ffmpeg = await getFfmpeg(onProgress);
  const inputBytes = new Uint8Array(await file.arrayBuffer());

  const passes: Array<{ crf: number; maxWidth: number }> = [
    { crf: 23, maxWidth: 1280 },
    { crf: 26, maxWidth: 1280 },
    { crf: 28, maxWidth: 960 },
    { crf: 30, maxWidth: 720 },
    { crf: 32, maxWidth: 640 },
    { crf: 34, maxWidth: 480 },
  ];

  for (const pass of passes) {
    const out = await runCompressPass(ffmpeg, inputBytes, file.name, pass, (ratio) => {
      onProgress?.({ phase: "compressing", ratio });
    });

    if (out.byteLength <= CHAT_VIDEO_MAX_BYTES) {
      onProgress?.({ phase: "done", ratio: 1 });
      return new File([out], outputName(file.name), { type: "video/mp4" });
    }
  }

  throw new ChatVideoSizeLimitError(file.size);
}

function toMp4File(file: File): File {
  if (file.type === "video/mp4" && file.name.toLowerCase().endsWith(".mp4")) {
    return file;
  }
  return new File([file], outputName(file.name), { type: "video/mp4" });
}
