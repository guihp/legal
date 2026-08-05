import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import {
  ensureMp4FileMeta,
  isPassThroughChatMp4,
  needsChatVideoTranscode as needsTranscodeWithLimit,
  CHAT_VIDEO_MAX_BYTES,
  CHAT_VIDEO_MAX_LABEL,
} from "@/lib/chatMediaKind";

export {
  CHAT_VIDEO_MAX_BYTES,
  CHAT_VIDEO_MAX_LABEL,
  ensureMp4FileMeta,
} from "@/lib/chatMediaKind";

export function needsChatVideoTranscode(file: File): boolean {
  return needsTranscodeWithLimit(file, CHAT_VIDEO_MAX_BYTES);
}

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

export class ChatVideoPrepareError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "ChatVideoPrepareError";
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export type CompressVideoProgress = {
  phase: "loading" | "compressing" | "done";
  ratio?: number;
};

type FfmpegInstance = FFmpeg;

let ffmpegLoadPromise: Promise<FfmpegInstance> | null = null;

const FFMPEG_CORE_VERSION = "0.12.6";
const FFMPEG_PKG_VERSION = "0.12.15";
const FFMPEG_LOAD_TIMEOUT_MS = 90_000;

type FfmpegCdn = { core: string; worker: string };

const FFMPEG_CDN_BASES: readonly FfmpegCdn[] = [
  {
    core: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`,
    worker: `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_PKG_VERSION}/dist/esm/worker.js`,
  },
  {
    core: `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`,
    worker: `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_PKG_VERSION}/dist/esm/worker.js`,
  },
] as const;

function outputName(inputName: string): string {
  const base = inputName.replace(/\.[^.]+$/, "") || "video";
  return `${base}-chat.mp4`;
}

async function loadFfmpegFromBase(cdn: FfmpegCdn): Promise<FfmpegInstance> {
  const ffmpeg = new FFmpeg();

  // `classWorkerURL` é obrigatório sob Vite/ESM: sem ele o worker não sobe e
  // `load()` fica pendente para sempre.
  const [coreURL, wasmURL, classWorkerURL] = await Promise.all([
    toBlobURL(`${cdn.core}/ffmpeg-core.js`, "text/javascript"),
    toBlobURL(`${cdn.core}/ffmpeg-core.wasm`, "application/wasm"),
    toBlobURL(cdn.worker, "text/javascript"),
  ]);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      ffmpeg.load({ coreURL, wasmURL, classWorkerURL }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("timeout ao carregar o compressor de vídeo")),
          FFMPEG_LOAD_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (err) {
    try {
      ffmpeg.terminate();
    } catch {
      /* instância pode não ter iniciado */
    }
    throw err;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }

  return ffmpeg;
}

async function getFfmpeg(onProgress?: (p: CompressVideoProgress) => void): Promise<FfmpegInstance> {
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      onProgress?.({ phase: "loading" });
      let lastErr: unknown;
      for (const cdn of FFMPEG_CDN_BASES) {
        try {
          return await loadFfmpegFromBase(cdn);
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr instanceof Error
        ? lastErr
        : new Error("Falha ao carregar compressor de vídeo (ffmpeg)");
    })().catch((err) => {
      // Permite nova tentativa na próxima anexação (CDN flake / rede).
      ffmpegLoadPromise = null;
      throw err;
    });
  }
  return ffmpegLoadPromise;
}

/** Expõe reset para testes / recuperação após falha grave no exec. */
export function resetChatVideoFfmpegCache(): void {
  ffmpegLoadPromise = null;
}

async function runCompressPass(
  ffmpeg: FfmpegInstance,
  inputBytes: Uint8Array,
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
      "veryfast",
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
 * Reduz o vídeo para ≤ 16 MB, limite da API de envio.
 * - Dentro do limite: passa direto, qualquer container (MOV/WebM inclusive).
 * - Acima do limite: transcodifica com ffmpeg.wasm (retry de CDN se load falhar).
 */
export async function compressVideoForChat(
  file: File,
  options?: { onProgress?: (p: CompressVideoProgress) => void },
): Promise<File> {
  const onProgress = options?.onProgress;
  const canPassThrough = !needsChatVideoTranscode(file);

  if (canPassThrough) {
    onProgress?.({ phase: "done", ratio: 1 });
    return isPassThroughChatMp4(file) ? ensureMp4FileMeta(file) : file;
  }

  onProgress?.({ phase: "compressing", ratio: 0 });

  try {
    const ffmpeg = await getFfmpeg(onProgress);
    const inputBytes = new Uint8Array(await file.arrayBuffer());

    const allPasses: Array<{ crf: number; maxWidth: number }> = [
      { crf: 23, maxWidth: 1280 },
      { crf: 26, maxWidth: 1280 },
      { crf: 28, maxWidth: 960 },
      { crf: 30, maxWidth: 720 },
      { crf: 32, maxWidth: 640 },
      { crf: 34, maxWidth: 480 },
    ];

    // Arquivos muito acima do limite nunca passam nos primeiros níveis:
    // começar mais agressivo evita passes inteiros de ffmpeg descartados.
    const ratioOverLimit = file.size / CHAT_VIDEO_MAX_BYTES;
    const startIndex = ratioOverLimit > 8 ? 3 : ratioOverLimit > 4 ? 2 : ratioOverLimit > 2 ? 1 : 0;
    const passes = allPasses.slice(startIndex);

    for (const pass of passes) {
      const out = await runCompressPass(ffmpeg, inputBytes, pass, (ratio) => {
        onProgress?.({ phase: "compressing", ratio });
      });

      if (out.byteLength <= CHAT_VIDEO_MAX_BYTES) {
        onProgress?.({ phase: "done", ratio: 1 });
        return new File([out], outputName(file.name), { type: "video/mp4" });
      }
    }

    throw new ChatVideoSizeLimitError(file.size);
  } catch (err) {
    // Instância pode ter ficado inconsistente após exec falho.
    resetChatVideoFfmpegCache();

    if (err instanceof ChatVideoSizeLimitError) throw err;

    const mb = (file.size / (1024 * 1024)).toFixed(1);
    const detail = err instanceof Error ? err.message : String(err);
    throw new ChatVideoPrepareError(
      `Este vídeo tem ~${mb} MB e o limite de envio é ${CHAT_VIDEO_MAX_LABEL}. ` +
        `A compressão automática falhou, então envie um vídeo mais curto ou em resolução menor. ` +
        `Detalhe: ${detail}`,
      { cause: err },
    );
  }
}
