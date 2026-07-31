import { Diamond } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoleKpiCard } from './helpers';

type Props = {
  items: RoleKpiCard[];
};

const TONE = {
  amber: {
    iconBg: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
    bar: 'bg-orange-500',
    track: 'bg-orange-100 dark:bg-orange-950/40',
  },
  blue: {
    iconBg: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    bar: 'bg-sky-500',
    track: 'bg-sky-100 dark:bg-sky-950/40',
  },
  green: {
    iconBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    bar: 'bg-emerald-600',
    track: 'bg-muted',
  },
} as const;

function userLabel(count: number) {
  return count === 1 ? '1 usuário' : `${count} usuários`;
}

export function PermissionsRoleKpis({ items }: Props) {
  if (!items.length) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((kpi) => {
        const tone = TONE[kpi.tone];
        return (
          <div
            key={kpi.role}
            className="rounded-2xl border border-border/70 bg-white dark:bg-card shadow-sm px-4 py-3.5 min-w-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    tone.iconBg,
                  )}
                >
                  <Diamond className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{kpi.label}</p>
                  <p className="text-xs text-muted-foreground">{userLabel(kpi.userCount)}</p>
                </div>
              </div>
              <p className="text-lg font-semibold tabular-nums text-foreground shrink-0">
                {kpi.percent}%
              </p>
            </div>

            <div className={cn('mt-3 h-1.5 rounded-full overflow-hidden', tone.track)}>
              <div
                className={cn('h-full rounded-full transition-all', tone.bar)}
                style={{ width: `${Math.min(100, Math.max(0, kpi.percent))}%` }}
              />
            </div>

            <p className="mt-2 text-xs text-muted-foreground truncate">{kpi.footer}</p>
          </div>
        );
      })}
    </div>
  );
}
