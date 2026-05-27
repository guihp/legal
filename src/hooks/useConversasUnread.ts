import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizePhoneDigits } from '@/lib/normalizePhone';
import {
  isHumanOnlyUnreadMode,
  shouldClearUnreadOnOutgoing,
  shouldTrackUnreadForRow,
} from '@/lib/conversaUnread';
import { playChatNotificationSound } from '@/lib/chatNotificationSound';

function normWhatsappSessionId(sessionId: string | null | undefined): string {
  return normalizePhoneDigits(String(sessionId ?? '')) || String(sessionId ?? '').trim();
}

export type UseConversasUnreadOptions = {
  normSessionId?: (sessionId: string | null | undefined) => string;
  playNotificationSound?: () => void;
  shouldTrackUnreadForRow?: (row: Record<string, unknown>) => boolean;
};

export type ConversaUnreadSnapshot = {
  sessionId: string;
  lastMessageDate: string;
  lastMessageContent: string;
  lastMessageType: 'human' | 'ai';
  leadStage?: string | null;
};

/**
 * Contador de mensagens do cliente por conversa.
 * - AI ATIVA / Humano solicitado: zera quando a IA responde.
 * - Humano: zera só ao abrir a conversa.
 */
export function useConversasUnread(
  selectedConversation: string | null,
  getLeadStage: (sessionId: string) => string | null | undefined,
  conversas: ConversaUnreadSnapshot[] = [],
  options?: UseConversasUnreadOptions,
) {
  const normSessionId = options?.normSessionId ?? normWhatsappSessionId;
  const playNotificationSound = options?.playNotificationSound ?? playChatNotificationSound;
  const trackUnreadForRow = options?.shouldTrackUnreadForRow ?? shouldTrackUnreadForRow;

  const [unreadBySession, setUnreadBySession] = useState<Record<string, number>>({});
  const getLeadStageRef = useRef(getLeadStage);
  getLeadStageRef.current = getLeadStage;

  const selectedNorm = normSessionId(selectedConversation);
  const listSnapshotRef = useRef<Record<string, { at: string; preview: string; type: string }>>({});
  const lastBumpKeyRef = useRef<Record<string, string>>({});

  const getUnreadCount = useCallback(
    (sessionId: string) => unreadBySession[normSessionId(sessionId)] ?? 0,
    [unreadBySession, normSessionId],
  );

  const clearUnread = useCallback((sessionId: string) => {
    const key = normSessionId(sessionId);
    setUnreadBySession((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [normSessionId]);

  const bumpUnreadOnce = useCallback(
    (sessionId: string, dedupeKey: string, opts?: { playSound?: boolean }) => {
      const key = normSessionId(sessionId);
      if (!key || key === selectedNorm) return;
      if (lastBumpKeyRef.current[key] === dedupeKey) return;
      lastBumpKeyRef.current[key] = dedupeKey;

      setUnreadBySession((prev) => ({
        ...prev,
        [key]: (prev[key] ?? 0) + 1,
      }));

      if (opts?.playSound) playNotificationSound();
    },
    [selectedNorm, normSessionId, playNotificationSound],
  );

  const markOpened = useCallback(
    (sessionId: string, leadStage?: string | null) => {
      if (isHumanOnlyUnreadMode(leadStage)) {
        clearUnread(sessionId);
      }
    },
    [clearUnread, normSessionId],
  );

  const handleRealtimeMessage = useCallback(
    (sessionId: string, message: Record<string, unknown>) => {
      const key = normSessionId(sessionId);
      const leadStage = getLeadStageRef.current(key);

      if (trackUnreadForRow(message)) {
        const dedupe = String(message.id ?? message.created_at ?? Date.now());
        bumpUnreadOnce(key, dedupe);
        return;
      }

      if (shouldClearUnreadOnOutgoing(message, leadStage)) {
        clearUnread(key);
      }
    },
    [bumpUnreadOnce, clearUnread, trackUnreadForRow, normSessionId],
  );

  /** Fallback quando o realtime não dispara: lista refetch ~3s. */
  useEffect(() => {
    if (!conversas.length) return;

    conversas.forEach((conv) => {
      const key = normSessionId(conv.sessionId);
      if (!key) return;

      const prev = listSnapshotRef.current[key];
      const curAt = String(conv.lastMessageDate ?? '');
      const curPreview = String(conv.lastMessageContent ?? '').trim();
      const curType = conv.lastMessageType;
      const leadStage = conv.leadStage;
      const dedupeKey = `${curAt}|${curPreview}`;

      const changed = !prev || prev.preview !== curPreview || prev.at !== curAt;

      if (changed && prev) {
        if (curType === 'human' && key !== selectedNorm) {
          bumpUnreadOnce(key, dedupeKey, { playSound: true });
        }
        if (curType === 'ai' && !isHumanOnlyUnreadMode(leadStage)) {
          clearUnread(key);
        }
      }

      listSnapshotRef.current[key] = { at: curAt, preview: curPreview, type: curType };
    });
  }, [conversas, selectedNorm, bumpUnreadOnce, clearUnread, normSessionId]);

  return {
    getUnreadCount,
    handleRealtimeMessage,
    markOpened,
    clearUnread,
  };
}
