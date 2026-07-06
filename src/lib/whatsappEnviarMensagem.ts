/** Payload do webhook n8n `enviar_mensagem` (WhatsApp / Instagram). */
export type WhatsappEnviarMensagemTipo = 'texto' | 'imagem' | 'audio' | 'video' | 'arquivo';

export const ENVIAR_MENSAGEM_WEBHOOK_URL =
  'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/enviar_mensagem';

export function formatNowSP(): string {
  const now = new Date();
  const tz = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => tz.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export function buildWhatsappEnviarMensagemBody(params: {
  sessionId: string;
  instancia: string;
  companyId?: string | null;
  tipo: WhatsappEnviarMensagemTipo;
  mensagem: string;
  mimeType?: string;
  caption?: string;
  mediaUrl?: string;
  channel?: 'whatsapp' | 'instagram';
}): Record<string, unknown> {
  const normalizedInstancia = params.instancia.trim().toLowerCase();
  if (!normalizedInstancia) {
    throw new Error('INSTANCE_REQUIRED');
  }

  const body: Record<string, unknown> = {
    session_id: params.sessionId,
    instancia: normalizedInstancia,
    channel: params.channel || 'whatsapp',
    company_id: params.companyId || null,
    tipo: params.tipo,
    mensagem: params.mensagem,
    data: formatNowSP(),
  };

  if (params.mimeType) body.mime_type = params.mimeType;
  if (params.caption) body.caption = params.caption;

  if (params.mediaUrl) {
    body.media_url = params.mediaUrl;
    if (params.tipo === 'imagem') body.image_url = params.mediaUrl;
    if (params.tipo === 'arquivo') body.file_url = params.mediaUrl;
    if (params.tipo === 'audio') body.audio_url = params.mediaUrl;
    if (params.tipo === 'video') body.video_url = params.mediaUrl;
  }

  return body;
}

export async function postWhatsappEnviarMensagem(
  webhookUrl: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(webhookUrl.replace(/\/$/, ''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  const raw = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '');

  if (!response.ok) {
    const errText =
      extractWebhookReply(raw) ||
      (typeof raw === 'object' && raw && 'error' in raw
        ? String((raw as { error: unknown }).error)
        : '') ||
      `Falha ao enviar (${response.status})`;
    throw new Error(errText);
  }

  return raw;
}

export function extractWebhookReply(payload: unknown): string {
  if (typeof payload === 'string') return payload.trim();
  if (!payload || typeof payload !== 'object') return '';

  const data = payload as Record<string, unknown>;
  const candidates = [data.reply, data.message, data.response, data.text, data.output, data.result, data.mensagem];

  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) return item.trim();
  }

  if (Array.isArray(data.messages)) {
    const last = [...data.messages].reverse().find(
      (m) => m && typeof m === 'object' && typeof (m as { content?: string }).content === 'string',
    ) as { content?: string } | undefined;
    if (last?.content?.trim()) return last.content.trim();
  }

  return '';
}
