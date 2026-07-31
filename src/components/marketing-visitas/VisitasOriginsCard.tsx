import { Compass, Instagram, MessageCircle, Megaphone, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrafficChannel } from './helpers';

type Props = {
  channels: TrafficChannel[];
};

function ChannelIcon({ channelKey, className }: { channelKey: string; className?: string }) {
  if (channelKey === 'instagram') return <Instagram className={className} />;
  if (channelKey === 'whatsapp') return <MessageCircle className={className} />;
  if (channelKey === 'meta') return <Megaphone className={className} />;
  if (channelKey === 'referral') return <Compass className={className} />;
  return <Globe className={className} />;
}

export function VisitasOriginsCard({ channels }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5 h-full">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-base font-semibold text-foreground">Origens do tráfego</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {channels.length} {channels.length === 1 ? 'canal' : 'canais'}
        </span>
      </div>

      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período.</p>
      ) : (
        <ul className="space-y-3.5">
          {channels.map((ch) => (
            <li key={ch.key}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      'h-8 w-8 rounded-xl flex items-center justify-center shrink-0',
                      ch.iconBg,
                      ch.iconColor,
                    )}
                  >
                    <ChannelIcon channelKey={ch.key} className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground truncate">{ch.label}</span>
                </div>
                <div className="flex items-baseline gap-2 shrink-0">
                  <span className="text-sm font-bold tabular-nums text-foreground">{ch.n}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{ch.pct}%</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', ch.barClass)}
                  style={{ width: `${Math.max(ch.n > 0 ? 4 : 0, ch.pct)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
