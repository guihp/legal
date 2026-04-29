import { useCallback, useState } from 'react';

const DEFAULT_SEND_WEBHOOK =
  'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/enviar_mensagem';

/** Usa o mesmo webhook do WhatsApp; o campo `channel` no body diferencia os canais. */
function resolveInstagramSendUrl(): string {
  const explicit = String(import.meta.env.VITE_INSTAGRAM_SEND_URL ?? '').trim();
  if (explicit && explicit !== 'undefined') return explicit.replace(/\/$/, '');
  const base = String(import.meta.env.VITE_WHATSAPP_API_BASE ?? '').trim();
  if (base && base !== 'undefined') {
    return `${base.replace(/\/$/, '')}/enviar_mensagem`;
  }
  return DEFAULT_SEND_WEBHOOK;
}

const IG_SEND_URL = resolveInstagramSendUrl();

function assertWebhookUrl(url: string) {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('protocolo inválido');
  } catch {
    throw new Error(
      `URL do webhook Instagram inválida. Ajuste VITE_INSTAGRAM_SEND_URL ou VITE_WHATSAPP_API_BASE. Valor atual: ${String(url).slice(0, 120)}`
    );
  }
}

function formatNowSP(): string {
  const now = new Date();
  const tz = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => tz.find(p => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export type InstagramMessageType = 'texto' | 'imagem' | 'audio' | 'arquivo';

export interface SendInstagramPayload {
  session_id: string;        // ID/handle do contato no Instagram
  instancia: string;         // @ da conta IG da empresa
  tipo: InstagramMessageType;
  mensagem: string;
  mime_type?: string;
  caption?: string;
  company_id?: string;
  media_url?: string;
  mutiplos?: boolean;
  media_urls?: string[];
  midias?: Array<{ url: string; tipo: string; mime_type?: string; nome?: string; caption?: string }>;
}

/**
 * Hook de envio de mensagem via webhook n8n de Instagram.
 * Mantém a mesma API de sendPayload do WhatsApp para facilitar reuso do front.
 */
export function useInstagramSendMessage() {
  const [sending, setSending] = useState(false);

  const sendPayload = useCallback(async (payload: SendInstagramPayload) => {
    const normalizedInstancia = payload.instancia.trim().toLowerCase();
    if (!normalizedInstancia) throw new Error('INSTANCE_REQUIRED');

    const body: any = {
      session_id: payload.session_id,
      instancia: normalizedInstancia,
      channel: 'instagram',
      tipo: payload.tipo,
      mensagem: payload.mensagem,
      /** Alguns fluxos n8n leem `message` em vez de `mensagem`. */
      message: payload.mensagem,
      data: formatNowSP(),
      company_id: payload.company_id ?? null,
    };
    if (payload.mime_type) body.mime_type = payload.mime_type;
    if (payload.caption) body.caption = payload.caption;
    if (payload.media_url) {
      body.media_url = payload.media_url;
      if (payload.tipo === 'imagem') body.image_url = payload.media_url;
      if (payload.tipo === 'audio') body.audio_url = payload.media_url;
      if (payload.tipo === 'arquivo') body.file_url = payload.media_url;
    }
    if (payload.mutiplos === true) {
      body.mutiplos = true;
    }
    if (Array.isArray(payload.media_urls) && payload.media_urls.length > 0) {
      body.media_urls = payload.media_urls;
      body.mutiplos = payload.media_urls.length > 1 || body.mutiplos === true;
    }
    if (Array.isArray(payload.midias) && payload.midias.length > 0) {
      body.midias = payload.midias;
      body.mutiplos = payload.midias.length > 1 || body.mutiplos === true;
    }

    assertWebhookUrl(IG_SEND_URL);

    const controller = new AbortController();
    const timeoutMs = 60_000;
    const tid = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      setSending(true);
      if (import.meta.env.DEV) {
        console.debug('[Instagram send]', IG_SEND_URL, { ...body, mensagem: body.mensagem?.slice?.(0, 80) });
      }
      const r = await fetch(IG_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!r.ok) {
        const snippet = (await r.text()).trim().slice(0, 240);
        throw new Error(
          `Falha ao enviar mensagem IG (HTTP ${r.status})${snippet ? `: ${snippet}` : ''}`
        );
      }
      try {
        return await r.json();
      } catch {
        return {};
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error(`Envio Instagram excedeu ${timeoutMs / 1000}s (timeout). Verifique rede e o n8n.`);
      }
      throw e;
    } finally {
      clearTimeout(tid);
      setSending(false);
    }
  }, []);

  return { sendPayload, sending };
}
