/**
 * Web Worker para conversão de imagens (JPEG resize) fora do main thread.
 *
 * Antes: convertToJPEG rodava em main thread → upload de 5+ fotos travava
 * UI por 3-10s (usuário sentia trava ao digitar/scrollar).
 *
 * Agora: main thread envia Blob bruto via postMessage; worker decodifica
 * com createImageBitmap (decoder nativo offscreen), redimensiona via
 * OffscreenCanvas, encoda JPEG via convertToBlob, devolve Blob.
 *
 * Compatibilidade: OffscreenCanvas + createImageBitmap são suportados em
 * Chrome 69+, Firefox 105+, Safari 16.4+. Fallback para main thread no
 * `convertToJPEG` se o worker falhar.
 *
 * Protocol:
 *   postMessage({ id, file: Blob, params: { targetMinSize, targetMaxSize, maxWidth, maxHeight } })
 *   ← postMessage({ id, ok: true,  blob: Blob })
 *   ← postMessage({ id, ok: false, error: string })
 */

interface RequestPayload {
  id: number;
  file: Blob;
  params: {
    targetMinSize: number;
    targetMaxSize: number;
    maxWidth: number;
    maxHeight: number;
  };
}

interface ResponseSuccess {
  id: number;
  ok: true;
  blob: Blob;
}

interface ResponseError {
  id: number;
  ok: false;
  error: string;
}

type Response = ResponseSuccess | ResponseError;

async function convert(
  file: Blob,
  { targetMinSize, targetMaxSize, maxWidth, maxHeight }: RequestPayload['params'],
): Promise<Blob> {
  // 1. Decodifica imagem em ImageBitmap (zero-copy quando possível)
  const bitmap = await createImageBitmap(file);

  // 2. Calcula dimensões mantendo aspect ratio
  let width = bitmap.width;
  let height = bitmap.height;
  if (width > maxWidth || height > maxHeight) {
    const aspectRatio = width / height;
    if (width > height) {
      width = Math.min(width, maxWidth);
      height = width / aspectRatio;
    } else {
      height = Math.min(height, maxHeight);
      width = height * aspectRatio;
    }
  }

  // 3. Desenha em OffscreenCanvas
  const canvas = new OffscreenCanvas(Math.round(width), Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2D context indisponível');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // 4. Encoda em JPEG ajustando qualidade até cair dentro da faixa de tamanho
  let quality = 0.95;
  for (let attempt = 0; attempt < 6; attempt++) {
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    if (
      (blob.size >= targetMinSize && blob.size <= targetMaxSize) ||
      attempt === 5
    ) {
      return blob;
    }
    if (blob.size < targetMinSize) {
      const next = Math.min(1.0, quality + 0.1);
      if (next === quality) return blob;
      quality = next;
    } else {
      quality = Math.max(0.5, quality - 0.1);
    }
  }

  // Não deveria cair aqui, mas TS pede return
  return await canvas.convertToBlob({ type: 'image/jpeg', quality });
}

self.addEventListener('message', async (e: MessageEvent<RequestPayload>) => {
  const { id, file, params } = e.data;
  try {
    const blob = await convert(file, params);
    const response: ResponseSuccess = { id, ok: true, blob };
    (self as unknown as Worker).postMessage(response);
  } catch (err: unknown) {
    const response: ResponseError = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(response);
  }
});

// Vite worker types — sem isso TSC reclama
export {};
