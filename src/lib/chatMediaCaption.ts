/** Texto que não deve aparecer como legenda (nome de arquivo, URL, placeholder do WhatsApp). */
export function isAutoMediaPlaceholderText(
  text: string,
  mediaUrl?: string | null,
): boolean {
  const t = text.trim();
  if (!t) return true;
  if (mediaUrl && t === mediaUrl.trim()) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^whatsapp\s+(video|image|audio|document|ptt)\b/i.test(t)) return true;
  if (/^[\w\s().,'+-]+\.(mp4|mov|webm|m4a|pdf|ogg|opus|png|jpe?g|webp|gif)$/i.test(t) && t.length <= 220) {
    return true;
  }
  return false;
}

/** Legenda real para exibir sob imagem/vídeo/áudio (vazio se for só nome de arquivo). */
export function resolveDisplayCaption(
  content: string,
  options?: { mediaUrl?: string | null },
): string {
  if (isAutoMediaPlaceholderText(content, options?.mediaUrl)) return "";
  return content.trim();
}

/** Corpo `mensagem` do webhook — sem URL nem nome de arquivo quando não há legenda. */
export function resolveWebhookMediaMessage(
  caption: string | undefined,
  _mediaUrl?: string,
): string {
  const cap = (caption || "").trim();
  if (cap && !isAutoMediaPlaceholderText(cap)) return cap;
  return "";
}
