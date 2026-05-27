import { extractMediaImages, type ConversaMessage } from '@/hooks/useConversaMessages';

export type ChatDisplayItem =
  | { kind: 'message'; row: ConversaMessage }
  | {
      kind: 'image_album';
      id: string;
      rows: ConversaMessage[];
      images: string[];
      caption: string;
      data: string;
      isAI: boolean;
    };

/** Mensagens de imagem do mesmo remetente dentro deste intervalo viram um álbum. */
const MAX_ALBUM_GAP_MS = 3 * 60 * 1000;

export function getMessageImageUrls(row: ConversaMessage): string[] {
  const fromMedia = extractMediaImages(row.media ?? null);
  if (fromMedia.length > 0) return fromMedia;
  if (row.mediaImages?.length) return row.mediaImages;
  return [];
}

function isImageOnlyMessage(row: ConversaMessage, dataUrlImage?: string | null): boolean {
  const urls = getMessageImageUrls(row);
  if (urls.length > 0) return true;
  return Boolean(dataUrlImage);
}

function sameSender(a: ConversaMessage, b: ConversaMessage): boolean {
  return a.message?.type === b.message?.type;
}

/**
 * Agrupa mensagens consecutivas só com imagem (mesmo remetente) num único bloco visual.
 */
export function groupChatMessagesForDisplay(
  messages: ConversaMessage[],
  resolveDataUrlImage?: (row: ConversaMessage) => string | null,
): ChatDisplayItem[] {
  const out: ChatDisplayItem[] = [];
  let i = 0;

  while (i < messages.length) {
    const row = messages[i];
    const dataUrl = resolveDataUrlImage?.(row) ?? null;
    const urls = getMessageImageUrls(row);
    const imageUrls = urls.length > 0 ? urls : dataUrl ? [dataUrl] : [];

    if (!isImageOnlyMessage(row, dataUrl)) {
      out.push({ kind: 'message', row });
      i += 1;
      continue;
    }

    const groupRows: ConversaMessage[] = [row];
    const allImages: string[] = [...imageUrls];
    let j = i + 1;

    while (j < messages.length) {
      const next = messages[j];
      if (!sameSender(row, next)) break;

      const nextDataUrl = resolveDataUrlImage?.(next) ?? null;
      const nextUrls = getMessageImageUrls(next);
      const nextImages = nextUrls.length > 0 ? nextUrls : nextDataUrl ? [nextDataUrl] : [];
      if (!nextImages.length) break;

      const prevMs = new Date(messages[j - 1].data).getTime();
      const nextMs = new Date(next.data).getTime();
      if (nextMs - prevMs > MAX_ALBUM_GAP_MS) break;

      groupRows.push(next);
      allImages.push(...nextImages);
      j += 1;
    }

    const sender = row.message?.type;
    const isAI = sender === 'ai' || sender === 'assistant';

    if (groupRows.length > 1) {
      const captions = groupRows
        .map((r) => String(r.message?.content ?? '').trim())
        .filter(Boolean);
      out.push({
        kind: 'image_album',
        id: groupRows.map((r) => r.id).join('_'),
        rows: groupRows,
        images: allImages,
        caption: captions[captions.length - 1] ?? '',
        data: groupRows[groupRows.length - 1].data,
        isAI,
      });
    } else {
      out.push({ kind: 'message', row });
    }

    i = j;
  }

  return out;
}
