import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { DashboardKpiItem } from './helpers';

type Props = {
  items: DashboardKpiItem[];
};

function Sparkline({ values, className }: { values: number[]; className: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="mt-2 flex items-end gap-0.5 h-7">
      {values.map((v, i) => (
        <div
          key={i}
          className={cn('flex-1 rounded-sm min-w-0 transition-all', className)}
          style={{ height: `${Math.max(12, Math.round((v / max) * 100))}%`, opacity: 0.35 + (i / values.length) * 0.65 }}
        />
      ))}
    </div>
  );
}

export const DashboardKpis = memo(function DashboardKpis({ items }: Props) {
  if (!items.length) return null;

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6',
        '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
      {items.map((kpi) => (
        <div
          key={kpi.key}
          className="rounded-2xl border border-border/70 bg-white dark:bg-card shadow-sm min-w-0 px-3.5 py-3.5"
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
          <Sparkline values={kpi.spark} className={kpi.sparkClass} />
          <p
            className={cn(
              'mt-1.5 text-xs truncate',
              kpi.hintTone === 'positive' && 'text-emerald-700 dark:text-emerald-400',
              kpi.hintTone === 'negative' && 'text-rose-600 dark:text-rose-400',
              kpi.hintTone === 'amber' && 'text-amber-700 dark:text-amber-400',
              kpi.hintTone === 'blue' && 'text-sky-700 dark:text-sky-400',
              kpi.hintTone === 'purple' && 'text-violet-700 dark:text-violet-400',
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
