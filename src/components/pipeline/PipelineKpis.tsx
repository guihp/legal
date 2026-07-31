import { memo } from 'react';
import { cn } from '@/lib/utils';

export type PipelineKpi = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  hintTone?: 'positive' | 'negative' | 'neutral';
  dot: string;
};

type Props = {
  items: PipelineKpi[];
  /** Mobile: horizontal scroll of denser cards instead of 2-col grid. */
  denseScroll?: boolean;
};

export const PipelineKpis = memo(function PipelineKpis({ items, denseScroll = false }: Props) {
  if (!items.length) return null;

  return (
    <div
      className={cn(
        denseScroll
          ? 'flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-0.5 -mx-0.5 px-0.5 snap-x snap-mandatory md:mx-0 md:grid md:grid-cols-3 md:gap-2.5 md:overflow-visible md:px-0 md:pb-0 md:snap-none xl:grid-cols-5'
          : 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5',
      )}
    >
      {items.map((kpi) => (
        <div
          key={kpi.key}
          className={cn(
            'rounded-xl border border-border bg-card shadow-sm min-w-0',
            denseScroll
              ? 'p-2.5 shrink-0 snap-start min-w-[7.75rem] w-[7.75rem] md:min-w-0 md:w-auto md:shrink md:px-3.5 md:py-3'
              : 'px-3.5 py-3',
          )}
        >
          <div className="flex items-center gap-1.5 md:gap-2">
            <span className={cn('h-1.5 w-1.5 md:h-2 md:w-2 rounded-full shrink-0', kpi.dot)} aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground truncate">
              {kpi.label}
            </p>
          </div>
          <p
            className={cn(
              'mt-1 font-semibold tabular-nums text-foreground tracking-tight truncate',
              denseScroll ? 'text-lg md:text-xl md:mt-1.5' : 'mt-1.5 text-xl',
            )}
          >
            {kpi.value}
          </p>
          {kpi.hint ? (
            <p
              className={cn(
                'mt-0.5 text-xs truncate',
                denseScroll && 'hidden md:block',
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
