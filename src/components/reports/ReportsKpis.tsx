import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { ReportsKpiItem } from './helpers';

type Props = {
  items: ReportsKpiItem[];
};

export const ReportsKpis = memo(function ReportsKpis({ items }: Props) {
  if (!items.length) return null;

  return (
    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
      {items.map((kpi) => (
        <div
          key={kpi.key}
          className="rounded-2xl border border-border/70 bg-white dark:bg-card shadow-sm min-w-0 px-3.5 py-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground truncate">
              {kpi.label}
            </p>
            <span className={cn('h-2 w-2 rounded-full shrink-0', kpi.dot)} aria-hidden />
          </div>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground tracking-tight truncate">
            {kpi.value}
          </p>
          <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', kpi.progressClass)}
              style={{ width: `${Math.min(100, Math.max(0, kpi.progress))}%` }}
            />
          </div>
          <p
            className={cn(
              'mt-1.5 text-xs truncate',
              kpi.hintTone === 'positive' && 'text-emerald-700 dark:text-emerald-400',
              kpi.hintTone === 'negative' && 'text-rose-600 dark:text-rose-400',
              kpi.hintTone === 'blue' && 'text-sky-700 dark:text-sky-400',
              kpi.hintTone === 'purple' && 'text-violet-700 dark:text-violet-400',
              kpi.hintTone === 'amber' && 'text-amber-700 dark:text-amber-400',
              kpi.hintTone === 'neutral' && 'text-muted-foreground',
            )}
          >
            {kpi.hint}
          </p>
        </div>
      ))}
    </div>
  );
});
