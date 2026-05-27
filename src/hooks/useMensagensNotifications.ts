import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneDigits } from '@/lib/normalizePhone';
import {
  isIncomingChatMessage,
  isInstagramMensagemRow,
  isWhatsappMensagemRow,
  playChatNotificationSound,
  playInstagramChatNotificationSound,
} from '@/lib/chatNotificationSound';
import { isAiOutgoingMessage } from '@/lib/conversaUnread';
import { normInstagramSessionId } from '@/lib/mensagensRow';

export type MensagensNotificationHandlers = {
  onIncoming: (sessionId: string, row: Record<string, unknown>) => void;
  onOutgoing: (sessionId: string, row: Record<string, unknown>) => void;
};

export type MensagensNotificationPlatform = 'whatsapp' | 'instagram';

function sessionFromWhatsappRow(row: Record<string, unknown>): string | null {
  return (
    normalizePhoneDigits(String(row.contact_norm ?? row.phone_norm ?? row.phone ?? '')) ||
    null
  );
}

function sessionFromInstagramRow(row: Record<string, unknown>): string | null {
  const sid = normInstagramSessionId(
    String(row.contact_norm ?? row.phone ?? ''),
  );
  return sid || null;
}

/**
 * Escuta INSERT em `mensagens` para a empresa (sempre ativo na tela de conversas).
 * Filtra company_id e plataforma no cliente — mais confiável que filter no canal.
 */
export function useMensagensNotifications(
  companyId: string | undefined,
  handlers: MensagensNotificationHandlers,
  options?: { playSound?: boolean; platform?: MensagensNotificationPlatform },
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const playSound = options?.playSound !== false;
  const platform = options?.platform ?? 'whatsapp';

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`mensagens_notifications_${platform}_${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens',
        },
        (payload) => {
          const row = payload.new as Record<string, unknown> | undefined;
          if (!row) return;
          if (String(row.company_id ?? '') !== companyId) return;

          const isWhatsapp = platform === 'whatsapp';
          if (isWhatsapp ? !isWhatsappMensagemRow(row) : !isInstagramMensagemRow(row)) return;

          const sid = isWhatsapp ? sessionFromWhatsappRow(row) : sessionFromInstagramRow(row);
          if (!sid) return;

          const h = handlersRef.current;

          if (isIncomingChatMessage(row)) {
            if (playSound) {
              if (isWhatsapp) playChatNotificationSound();
              else playInstagramChatNotificationSound();
            }
            h.onIncoming(sid, row);
            return;
          }

          if (isAiOutgoingMessage(row)) {
            h.onOutgoing(sid, row);
          }
        },
      )
      .subscribe();

    return () => {
      try {
        void channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {
        /* empty */
      }
    };
  }, [companyId, playSound, platform]);
}
