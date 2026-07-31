import { FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PAGE_SUBTITLE_PREFIX, PERIOD_OPTIONS } from './constants';
import type { PeriodPreset } from '@/components/dashboard/helpers';

type Props = {
  periodLabel: string;
  period: PeriodPreset;
  onPeriodChange: (p: PeriodPreset) => void;
  onNewReport: () => void;
};

export function ReportsToolbar({
  periodLabel,
  period,
  onPeriodChange,
  onNewReport,
}: Props) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
          Relatórios
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
          {PAGE_SUBTITLE_PREFIX} {periodLabel}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div
          role="tablist"
          aria-label="Período"
          className={cn(
            'inline-flex flex-nowrap rounded-xl border border-border bg-muted/40 p-0.5 shadow-sm gap-0.5',
            'overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
        >
          {PERIOD_OPTIONS.map((opt) => {
            const active = period === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onPeriodChange(opt.value)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap border',
                  active
                    ? 'bg-card text-foreground shadow-sm border-border/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          size="sm"
          onClick={onNewReport}
          className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
          style={{ color: '#ffffff' }}
        >
          <FilePlus2 className="mr-2 h-4 w-4" />
          Novo relatório
        </Button>
      </div>
    </div>
  );
}
