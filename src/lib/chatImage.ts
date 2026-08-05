/** Converte imagem anexada/cola para PNG (envio unificado WhatsApp + Instagram). */

/**
 * iOS Safari zera o canvas acima de ~16.7 MP e fotos de celular (12–48 MP)
 * geram PNG de dezenas de MB. Reduzir antes de converter resolve os dois.
 */
const MAX_IMAGE_DIMENSION = 2048;

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

async function decodeImageFile(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      /* HEIC/formato exótico: cai para HTMLImageElement */
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Falha ao carregar imagem para conversão"));
      el.src = objectUrl;
    });
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

function scaledSize(width: number, height: number): { width: number; height: number } {
  const largest = Math.max(width, height);
  if (!largest || largest <= MAX_IMAGE_DIMENSION) {
    return { width: width || 1, height: height || 1 };
  }
  const factor = MAX_IMAGE_DIMENSION / largest;
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, type === "image/jpeg" ? 0.9 : undefined);
  });
}

export async function convertImageFileToPng(file: File): Promise<File> {
  const decoded = await decodeImageFile(file);

  try {
    const { width, height } = scaledSize(decoded.width, decoded.height);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Falha ao criar contexto para conversão PNG");
    ctx.drawImage(decoded.source, 0, 0, width, height);

    const baseName = file.name.replace(/\.[^.]+$/, "") || "imagem";

    const png = await canvasToBlob(canvas, "image/png");
    if (png) return new File([png], `${baseName}.png`, { type: "image/png" });

    // Alguns celulares recusam PNG grande, mas aceitam JPEG.
    const jpeg = await canvasToBlob(canvas, "image/jpeg");
    if (jpeg) return new File([jpeg], `${baseName}.jpg`, { type: "image/jpeg" });

    throw new Error("Falha ao converter imagem para PNG");
  } finally {
    decoded.close();
  }
}
