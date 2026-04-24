import React, { useState, useEffect } from 'react';
import { MessageCircle, Instagram } from 'lucide-react';
import { ConversasViewPremium } from './ConversasViewPremium';
import { ConversasViewInstagram } from './ConversasViewInstagram';

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

  useEffect(() => {
    try {
      localStorage.setItem(CHANNEL_STORAGE_KEY, channel);
    } catch {
      // localStorage pode estar desabilitado — ignorar
    }
  }, [channel]);

  return (
    <div className="flex flex-col h-full">
      {/* CHANNEL TABS */}
      <div
        role="tablist"
        aria-label="Canais de conversa"
        className="flex items-center gap-1 p-1 mb-3 rounded-2xl bg-[var(--cv-panel-muted,rgba(0,0,0,0.04))] w-fit self-start shadow-sm border border-[var(--cv-border,rgba(0,0,0,0.08))]"
      >
        <button
          role="tab"
          aria-selected={channel === 'whatsapp'}
          type="button"
          onClick={() => setChannel('whatsapp')}
          className={[
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
            channel === 'whatsapp'
              ? 'bg-[#25D366] text-white shadow-md'
              : 'text-[var(--cv-text-muted,#6b7280)] hover:bg-[var(--cv-hover,rgba(0,0,0,0.04))] hover:text-[var(--cv-text,#111827)]',
          ].join(' ')}
          title="Conversas do WhatsApp"
        >
          <MessageCircle className="w-4 h-4" />
          <span>WhatsApp</span>
        </button>

        <button
          role="tab"
          aria-selected={channel === 'instagram'}
          type="button"
          onClick={() => setChannel('instagram')}
          className={[
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
            channel === 'instagram'
              ? 'text-white shadow-md'
              : 'text-[var(--cv-text-muted,#6b7280)] hover:bg-[var(--cv-hover,rgba(0,0,0,0.04))] hover:text-[var(--cv-text,#111827)]',
          ].join(' ')}
          style={
            channel === 'instagram'
              ? { background: 'linear-gradient(135deg,#feda75 0%,#fa7e1e 20%,#d62976 45%,#962fbf 75%,#4f5bd5 100%)' }
              : undefined
          }
          title="Conversas do Instagram Direct"
        >
          <Instagram className="w-4 h-4" />
          <span>Instagram</span>
        </button>
      </div>

      {/* CONTENT */}
      <div className="flex-1 min-h-0">
        {channel === 'whatsapp' ? <ConversasViewPremium /> : <ConversasViewInstagram />}
      </div>
    </div>
  );
}

export default ConversasPage;
