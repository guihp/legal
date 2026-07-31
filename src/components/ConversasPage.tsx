import React, { useCallback, useEffect, useState } from 'react';
import { ConversasViewPremium } from './ConversasViewPremium';
import { ConversasViewInstagram } from './ConversasViewInstagram';
import { ConversasTopBar, type ChannelStats } from '@/components/conversas/ConversasTopBar';

export type ConversaChannel = 'whatsapp' | 'instagram';

const CHANNEL_STORAGE_KEY = 'conversas-active-channel';

/**
 * Wrapper da página /conversas com seletor de canal (WhatsApp | Instagram).
 * - Mantém o canal selecionado em localStorage entre sessões.
 * - Renderiza o componente correto; NUNCA renderiza ambos ao mesmo tempo
 *   (evita polls em paralelo e re-subscribes de realtime).
 */
export function ConversasPage() {
  const [channel, setChannel] = useState<ConversaChannel>(() => {
    try {
      const saved = localStorage.getItem(CHANNEL_STORAGE_KEY) as ConversaChannel | null;
      return saved === 'instagram' ? 'instagram' : 'whatsapp';
    } catch {
      return 'whatsapp';
    }
  });

  const [whatsappStats, setWhatsappStats] = useState<ChannelStats>({ total: 0, unread: 0 });
  const [instagramStats, setInstagramStats] = useState<ChannelStats>({ total: 0, unread: 0 });
  const [settingsRequest, setSettingsRequest] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(CHANNEL_STORAGE_KEY, channel);
    } catch {
      // localStorage pode estar desabilitado — ignorar
    }
  }, [channel]);

  const onWhatsappStats = useCallback((stats: ChannelStats) => {
    setWhatsappStats(stats);
  }, []);

  const onInstagramStats = useCallback((stats: ChannelStats) => {
    setInstagramStats(stats);
  }, []);

  return (
    <div
      className={[
        'flex flex-col min-h-0 min-w-0 overflow-x-hidden',
        // Header (~3.5–4.5rem) + main padding (tighter on conversas) + top bar margin
        'h-[calc(100dvh-5.25rem)] sm:h-[calc(100dvh-6rem)] md:h-[calc(100dvh-7rem)]',
      ].join(' ')}
    >
      <ConversasTopBar
        channel={channel}
        onChannelChange={setChannel}
        whatsappStats={whatsappStats}
        instagramStats={instagramStats}
        onOpenSettings={() => setSettingsRequest((n) => n + 1)}
      />

      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {channel === 'whatsapp' ? (
          <ConversasViewPremium
            onInboxStats={onWhatsappStats}
            openTemplatesRequest={settingsRequest}
          />
        ) : (
          <ConversasViewInstagram
            onInboxStats={onInstagramStats}
            openTemplatesRequest={settingsRequest}
          />
        )}
      </div>
    </div>
  );
}

export default ConversasPage;
