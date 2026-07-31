import { cn } from '@/lib/utils';
import {
  formatAgendaShortDate,
  formatAgendaTime,
  getAgentDotClass,
  type AgendaEventLike,
} from './helpers';

type Props = {
  events: AgendaEventLike[];
  sortedAgentNames: string[];
};

export function AgendaUpcomingList({ events, sortedAgentNames }: Props) {
  if (!events.length) return null;

  return (
    <div className="pt-4 mt-4 border-t border-border">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
        Próximos compromissos
      </h3>
      <div className="space-y-2">
        {events.map((event) => {
          const agent = event.corretor || 'Corretor';
          return (
            <div
              key={String(event.id)}
              className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2.5"
            >
              <span
                className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', getAgentDotClass(agent, sortedAgentNames))}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground tabular-nums shrink-0">
                    {formatAgendaShortDate(event.date)} · {formatAgendaTime(event.date)}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">{agent}</span>
                </div>
                <p className="text-sm font-medium text-foreground truncate">
                  {event.property}
                  <span className="font-normal text-muted-foreground"> · {event.client}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
