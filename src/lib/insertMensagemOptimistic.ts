import { supabase } from '@/integrations/supabase/client';
import {
  normInstagramSessionId,
  PLATAFORMA_INSTAGRAM,
  PLATAFORMA_WHATSAPP,
} from '@/lib/mensagensRow';
import { normalizePhoneDigits } from '@/lib/normalizePhone';

export type ChatInsertPlatform = 'whatsapp' | 'instagram';

/**
 * Insere mensagem enviada pelo painel (type IA) para aparecer na thread sem esperar o n8n.
 */
export async function insertMensagemOptimistic(params: {
  companyId: string;
  sessionId: string;
  instancia: string;
  platform: ChatInsertPlatform;
  mediaUrl: string;
  messageType: 'audio' | 'image' | 'video' | 'document';
  content?: string;
  userId?: string | null;
}): Promise<{ id: string | number } | null> {
  const plataforma =
    params.platform === 'instagram' ? PLATAFORMA_INSTAGRAM : PLATAFORMA_WHATSAPP;
  const phone =
    params.platform === 'instagram'
      ? normInstagramSessionId(params.sessionId)
      : normalizePhoneDigits(params.sessionId) ||
        String(params.sessionId || '').replace(/\D/g, '');

  if (!phone) {
    console.warn('[insertMensagemOptimistic] session id inválido', params.platform);
    return null;
  }

  try {
    const { data, error } = await (supabase as any)
      .from('mensagens')
      .insert({
        phone,
        company_id: params.companyId,
        instancia: params.instancia,
        type: 'IA',
        user_id: params.userId || null,
        mensage_type: params.messageType,
        text: params.content ?? '',
        conteudo_media: params.mediaUrl,
        plataforma,
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[insertMensagemOptimistic] insert falhou:', error);
      return null;
    }
    return { id: data?.id };
  } catch (err) {
    console.warn('[insertMensagemOptimistic] excecao inesperada:', err);
    return null;
  }
}
