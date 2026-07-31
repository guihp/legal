import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { VisitasKpiItem } from './helpers';

type Props = {
  items: VisitasKpiItem[];
};

export const VisitasKpis = memo(function VisitasKpis({ items }: Props) {
  if (!items.length) return null;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((kpi) => (
        <div
          key={kpi.key}
          className="rounded-xl border border-border bg-card shadow-sm min-w-0 px-3.5 py-3"
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
          {typeof kpi.progress === 'number' ? (
            <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', kpi.progressClass || 'bg-emerald-600')}
                style={{ width: `${Math.min(100, Math.max(0, kpi.progress))}%` }}
              />
            </div>
          ) : null}
          {kpi.hint ? (
            <p
              className={cn(
                'mt-1.5 text-xs truncate',
                kpi.hintTone === 'positive' && 'text-emerald-700 dark:text-emerald-400',
                kpi.hintTone === 'negative' && 'text-rose-600 dark:text-rose-400',
                (!kpi.hintTone || kpi.hintTone === 'neutral') && 'text-muted-foreground',
              )}
            >
              {kpi.hint}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
});
