/** Largura máxima de mídia na bolha (evita w-fit esticar com conteúdo largo). */
export const CHAT_VIDEO_BUBBLE_MAX_WIDTH_PX = 280;
export const CHAT_DOCUMENT_BUBBLE_MAX_WIDTH_PX = 300;

export function chatVideoBubbleWidthClass(): string {
  return `w-[min(100%,${CHAT_VIDEO_BUBBLE_MAX_WIDTH_PX}px)]`;
}

export function chatDocumentBubbleWidthClass(): string {
  return `w-[min(100%,${CHAT_DOCUMENT_BUBBLE_MAX_WIDTH_PX}px)]`;
}

/** Nome amigável para PDF (URLs do storage costumam ter UUID). */
export function chatDocumentDisplayName(url: string, fallback = "Documento.pdf"): string {
  try {
    const base = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    if (!base.toLowerCase().endsWith(".pdf")) return fallback;
    const stem = base.replace(/\.pdf$/i, "");
    if (/^[a-f0-9-]{20,}$/i.test(stem) || /^\d{10,}-[a-f0-9-]+$/i.test(stem)) {
      return "Documento.pdf";
    }
    if (stem.length > 42) return `${stem.slice(0, 38)}….pdf`;
    return base;
  } catch {
    return fallback;
  }
}
