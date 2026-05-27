import {
  isIncomingChatMessage,
  isInstagramMensagemRow,
  isWhatsappMensagemRow,
} from '@/lib/chatNotificationSound';

/** Modo em que o contador só zera ao abrir a conversa (corretor no controle). */
export function isHumanOnlyUnreadMode(leadStage: string | null | undefined): boolean {
  return String(leadStage ?? '').trim() === 'Humano';
}

export function isAiOutgoingMessage(row: Record<string, unknown>): boolean {
  const t = String(row.type ?? '').trim().toLowerCase();
  return t === 'ia' || t === 'ai' || t === 'assistant';
}

export function shouldTrackUnreadForRow(row: Record<string, unknown>): boolean {
  return isWhatsappMensagemRow(row) && isIncomingChatMessage(row);
}

export function shouldTrackUnreadForInstagramRow(row: Record<string, unknown>): boolean {
  return isInstagramMensagemRow(row) && isIncomingChatMessage(row);
}

export function shouldClearUnreadOnOutgoing(
  row: Record<string, unknown>,
  leadStage: string | null | undefined,
): boolean {
  return isAiOutgoingMessage(row) && !isHumanOnlyUnreadMode(leadStage);
}
