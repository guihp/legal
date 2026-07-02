import type { ChatMediaItemType } from '@/lib/chatMediaFiles';
import { webhookTipoFromChatType } from '@/lib/chatMediaStorage';
import type { ChatTemplate } from '@/hooks/useChatTemplates';

export type ChatTemplateMediaFields = {
  media_url: string | null;
  media_type: ChatMediaItemType | null;
  media_mime_type: string | null;
  media_name: string | null;
};

export function chatTemplateHasMedia(
  t: Pick<ChatTemplate, 'media_url' | 'media_type'> | null | undefined,
): boolean {
  return Boolean(t?.media_url && t?.media_type);
}

export function webhookTipoFromTemplateMedia(
  mediaType: string | null | undefined,
): 'texto' | 'imagem' | 'audio' | 'video' | 'arquivo' {
  if (!mediaType) return 'texto';
  if (mediaType === 'imagem' || mediaType === 'audio' || mediaType === 'video' || mediaType === 'pdf') {
    return webhookTipoFromChatType(mediaType);
  }
  return 'arquivo';
}

export function templateMediaLabel(type: string | null | undefined): string {
  switch (type) {
    case 'imagem':
      return 'Imagem';
    case 'video':
      return 'Vídeo';
    case 'audio':
      return 'Áudio';
    case 'pdf':
      return 'PDF / Arquivo';
    default:
      return 'Arquivo';
  }
}

export const TEMPLATE_MEDIA_ACCEPT =
  'image/*,video/mp4,audio/*,application/pdf,.pdf';
