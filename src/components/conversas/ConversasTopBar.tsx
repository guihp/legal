import { Instagram, MessageCircle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConversaChannel } from '@/components/ConversasPage';

export type ChannelStats = { total: number; unread: number };

type ConversasTopBarProps = {
  channel: ConversaChannel;
  onChannelChange: (channel: ConversaChannel) => void;
  whatsappStats?: ChannelStats;
  instagramStats?: ChannelStats;
  onOpenSettings?: () => void;
};

function ChannelTab({
  active,
  onClick,
  label,
  shortLabel,
  count,
  dotClass,
  softBg,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  shortLabel: string;
  count: number;
  dotClass: string;
  softBg?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3.5 py-1.5 text-sm font-medium transition-colors border shrink-0',
        active
          ? 'bg-[var(--cv-panel-muted)] border-[var(--cv-border)] text-[var(--cv-text)] shadow-sm'
          : 'bg-transparent border-transparent text-[var(--cv-text-muted)] hover:bg-[var(--cv-hover)]',
        softBg && active && softBg,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full shrink-0', dotClass)} aria-hidden />
      <span className="whitespace-nowrap">
        <span className="sm:hidden">{shortLabel}</span>
        <span className="hidden sm:inline">{label}</span>{' '}
        <span className="tabular-nums text-[var(--cv-text-muted)]">{count}</span>
      </span>
    </button>
  );
}

export function ConversasTopBar({
  channel,
  onChannelChange,
  whatsappStats = { total: 0, unread: 0 },
  instagramStats = { total: 0, unread: 0 },
  onOpenSettings,
}: ConversasTopBarProps) {
  const unread = channel === 'whatsapp' ? whatsappStats.unread : instagramStats.unread;

  return (
    <div className="flex items-center gap-2 sm:gap-3 shrink-0 pb-2 sm:pb-3 border-b border-[var(--cv-border)] mb-2 sm:mb-3 min-w-0 overflow-x-hidden">
      <nav
        aria-label="Breadcrumb"
        className="hidden md:flex text-sm text-[var(--cv-text-muted)] whitespace-nowrap shrink-0"
      >
        <span>Atendimento</span>
        <span className="mx-1.5 opacity-60">/</span>
        <span className="font-semibold text-[var(--cv-text)]">Conversas</span>
      </nav>

      <div
        role="tablist"
        aria-label="Canais de conversa"
        className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ChannelTab
          active={channel === 'whatsapp'}
          onClick={() => onChannelChange('whatsapp')}
          label="WhatsApp"
          shortLabel="WA"
          count={whatsappStats.total}
          dotClass="bg-[#25D366]"
        />
        <ChannelTab
          active={channel === 'instagram'}
          onClick={() => onChannelChange('instagram')}
          label="Instagram"
          shortLabel="IG"
          count={instagramStats.total}
          dotClass="bg-[#E1306C]"
          softBg="bg-rose-50 dark:bg-rose-950/30"
        />
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <span
          className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-[var(--cv-text-muted)] tabular-nums"
          title={`${unread} não lida${unread === 1 ? '' : 's'}`}
        >
          {channel === 'whatsapp' ? (
            <MessageCircle className="h-3.5 w-3.5 text-[#25D366] shrink-0" />
          ) : (
            <Instagram className="h-3.5 w-3.5 text-[#E1306C] shrink-0" />
          )}
          <span className="sm:hidden font-medium">{unread}</span>
          <span className="hidden sm:inline">
            {unread} não lida{unread === 1 ? '' : 's'}
          </span>
        </span>
        {onOpenSettings ? (
          <button
            type="button"
            onClick={onOpenSettings}
            className="h-8 w-8 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-xl border border-[var(--cv-border)] bg-[var(--cv-panel)] text-[var(--cv-icon)] hover:bg-[var(--cv-hover)]"
            title="Gerenciar templates"
            aria-label="Gerenciar templates"
          >
            <Settings className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
