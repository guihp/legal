import { cn } from '@/lib/utils';
import type { AgendaStatusFilter } from './helpers';

export type AgendaAgentChip = {
  id: string;
  label: string;
  count: number;
  dotClass: string;
};

type Props = {
  agents: AgendaAgentChip[];
  selectedAgentId: string;
  onAgentChange: (id: string) => void;
  statusFilter: AgendaStatusFilter;
  onStatusFilterChange: (filter: AgendaStatusFilter) => void;
  onGoToday: () => void;
  onGoTomorrow: () => void;
  onGoNextWeek: () => void;
  disableAgentFilter?: boolean;
};

const STATUS_OPTIONS: { value: AgendaStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos os status' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'pending', label: 'Pendentes' },
];

export function AgendaFilters({
  agents,
  selectedAgentId,
  onAgentChange,
  statusFilter,
  onStatusFilterChange,
  onGoToday,
  onGoTomorrow,
  onGoNextWeek,
  disableAgentFilter,
}: Props) {
  return (
    <div className="rounded-xl sm:rounded-2xl border border-border bg-card p-2.5 sm:p-3 md:p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {agents.map((agent) => {
            const active = selectedAgentId === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                disabled={disableAgentFilter && agent.id !== selectedAgentId}
                onClick={() => onAgentChange(agent.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium shadow-sm transition-colors',
                  active
                    ? 'border-emerald-800/30 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-700/40'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  disableAgentFilter && agent.id !== selectedAgentId && 'opacity-50 cursor-not-allowed',
                )}
              >
                <span className={cn('h-2 w-2 rounded-full shrink-0', agent.dotClass)} aria-hidden />
                <span className="truncate max-w-[8rem] sm:max-w-none">{agent.label}</span>
                <span className="tabular-nums opacity-80">{agent.count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 justify-start xl:justify-center">
          {STATUS_OPTIONS.map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onStatusFilterChange(opt.value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium shadow-sm transition-colors',
                  active
                    ? 'btn-on-emerald border-emerald-800 bg-emerald-800 text-white dark:bg-emerald-700 dark:border-emerald-700'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground mr-0.5">
            Ir para
          </span>
          <button
            type="button"
            onClick={onGoToday}
            className="rounded-full border border-border bg-background px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground shadow-sm"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={onGoTomorrow}
            className="rounded-full border border-border bg-background px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground shadow-sm"
          >
            Amanhã
          </button>
          <button
            type="button"
            onClick={onGoNextWeek}
            className="rounded-full border border-border bg-background px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground shadow-sm"
          >
            Próxima semana
          </button>
        </div>
      </div>
    </div>
  );
}
