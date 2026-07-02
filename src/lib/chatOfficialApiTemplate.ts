import type { ChatTemplate } from '@/hooks/useChatTemplates';
import { chatTemplateHasMedia } from '@/lib/chatTemplateMedia';

export type OfficialApiWebhookMeta = {
  isOfficialApi: true;
  templateShortcut: string;
  templateId?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaMimeType?: string | null;
  mediaName?: string | null;
};

export function officialApiMetaFromTemplate(
  template: Pick<
    ChatTemplate,
    | 'id'
    | 'shortcut'
    | 'message'
    | 'is_official_api'
    | 'media_url'
    | 'media_type'
    | 'media_mime_type'
    | 'media_name'
  > | null | undefined,
): OfficialApiWebhookMeta | null {
  if (!template?.is_official_api) return null;
  return {
    isOfficialApi: true,
    templateShortcut: template.shortcut,
    templateId: template.id,
    mediaUrl: template.media_url ?? null,
    mediaType: template.media_type ?? null,
    mediaMimeType: template.media_mime_type ?? null,
    mediaName: template.media_name ?? null,
  };
}

/** Mensagem enviada corresponde a um template marcado como API Oficial. */
export function resolveOfficialApiTemplateForMessage(
  message: string,
  templates: ChatTemplate[],
  preferred?: ChatTemplate | null,
): OfficialApiWebhookMeta | null {
  if (preferred?.is_official_api) {
    const preferredBody = String(preferred.message ?? '').trim();
    const val = message.trim();
    if (!preferredBody && chatTemplateHasMedia(preferred)) {
      return officialApiMetaFromTemplate(preferred);
    }
    if (preferredBody && (val === preferredBody || val.includes(preferredBody))) {
      return officialApiMetaFromTemplate(preferred);
    }
  }

  const val = message.trim();
  if (!val) return null;

  const exact = templates.find(
    (t) =>
      t.is_official_api &&
      typeof t.message === 'string' &&
      val === t.message.trim(),
  );
  if (exact) return officialApiMetaFromTemplate(exact);

  const partial = templates.find(
    (t) =>
      t.is_official_api &&
      typeof t.message === 'string' &&
      t.message.trim().length > 0 &&
      val.includes(t.message.trim()),
  );
  if (partial) return officialApiMetaFromTemplate(partial);

  return null;
}

export function applyOfficialApiWebhookFields(
  body: Record<string, unknown>,
  meta: OfficialApiWebhookMeta | null | undefined,
): void {
  if (!meta?.isOfficialApi) return;
  body.tag = 'api_oficial';
  body.is_official_api = true;
  body.template_shortcut = meta.templateShortcut;
  if (meta.templateId) body.template_id = meta.templateId;

  if (meta.mediaUrl) {
    body.template_media_url = meta.mediaUrl;
    body.media_url = meta.mediaUrl;
    if (meta.mediaType) {
      body.template_media_type = meta.mediaType;
      body.media_type = meta.mediaType;
    }
    if (meta.mediaMimeType) {
      body.template_media_mime_type = meta.mediaMimeType;
      body.mime_type = meta.mediaMimeType;
    }
    if (meta.mediaName) {
      body.template_media_name = meta.mediaName;
      body.media_name = meta.mediaName;
    }
  }
}
