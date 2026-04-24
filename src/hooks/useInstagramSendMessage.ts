import { useCallback, useState } from 'react';

// Endpoint dedicado de Instagram (paralelo ao /enviar_mensagem do WhatsApp).
// Se a variável não estiver setada, usa o mesmo host do WhatsApp com path "_instagram".
const IG_SEND_URL =
  import.meta.env.VITE_INSTAGRAM_SEND_URL ||
  (import.meta.env.VITE_WHATSAPP_API_BASE
    ? `${import.meta.env.VITE_WHATSAPP_API_BASE}/enviar_mensagem_instagram`
    : 'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/enviar_mensagem_instagram');

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
      tipo: payload.tipo,
      mensagem: payload.mensagem,
      data: formatNowSP(),
    };
    if (payload.mime_type) body.mime_type = payload.mime_type;
    if (payload.caption) body.caption = payload.caption;
    if (payload.company_id) body.company_id = payload.company_id;

    try {
      setSending(true);
      const r = await fetch(IG_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`Falha ao enviar mensagem IG (${r.status})`);
      try { return await r.json(); } catch { return {}; }
    } finally {
      setSending(false);
    }
  }, []);

  return { sendPayload, sending };
}
