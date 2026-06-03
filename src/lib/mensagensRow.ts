import { extractMediaImages, type ConversaMessage } from '@/hooks/useConversaMessages';
import { normalizePhoneDigits } from '@/lib/normalizePhone';

export const PLATAFORMA_WHATSAPP = 'WhatsApp';
export const PLATAFORMA_INSTAGRAM = 'Instagram';

/** lead = cliente (esquerda); IA/ia/ai/user = lado da imobiliária (direita). */
export function mensagemSenderToChatType(raw: unknown): 'human' | 'ai' {
  const t = String(raw ?? '').trim().toLowerCase();
  if (t === 'ia' || t === 'ai' || t === 'user' || t === 'assistant') return 'ai';
  return 'human';
}

export function mensagemPreviewType(raw: unknown): 'human' | 'ai' {
  return mensagemSenderToChatType(raw);
}

/** Session id da UI Instagram (`contact_norm` em minúsculas). */
export function normInstagramSessionId(sessionId: string | null | undefined): string {
  return String(sessionId ?? '').trim().toLowerCase();
}

/** Chave da conversa: telefone normalizado (WhatsApp) ou instagram_id em minúsculas (Instagram). */
export function mensagemSessionId(row: {
  phone?: string | null;
  contact_norm?: string | null;
  plataforma?: string | null;
}): string {
  const plat = String(row.plataforma ?? PLATAFORMA_WHATSAPP).trim().toLowerCase();
  const contactNorm = String(row.contact_norm ?? '').trim();
  if (plat === 'instagram') {
    return contactNorm || String(row.phone ?? '').trim().toLowerCase();
  }
  return normalizePhoneDigits(row.phone ?? row.contact_norm) || String(row.phone ?? '').trim();
}

export function mapMensagemRow(row: {
  id: bigint | number | string;
  phone?: string | null;
  contact_norm?: string | null;
  phone_norm?: string | null;
  instancia?: string | null;
  type?: string | null;
  text?: string | null;
  conteudo_media?: string | null;
  mensage_type?: string | null;
  plataforma?: string | null;
  created_at: string;
}): ConversaMessage {
  const sessionId = mensagemSessionId({
    phone: row.phone_norm ?? row.phone,
    contact_norm: row.contact_norm,
    plataforma: row.plataforma,
  });
  const content = String(row.text ?? '').trim();
  const media = row.conteudo_media ?? null;
  const mediaImages = extractMediaImages(media);

  return {
    id: String(row.id),
    sessionId,
    instancia: row.instancia ? String(row.instancia) : '(sem instância)',
    message: {
      type: mensagemSenderToChatType(row.type),
      content,
    },
    data: row.created_at,
    media,
    mediaImages,
    mensageType: row.mensage_type ? String(row.mensage_type) : null,
    before_handoff: false,
    handoff_ts: null,
  };
}
