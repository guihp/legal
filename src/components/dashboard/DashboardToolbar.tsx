import { Download, FileBarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PERIOD_OPTIONS, type PeriodPreset } from './helpers';

type Props = {
  synced: boolean;
  rangeLabel: string;
  updatedLabel: string;
  period: PeriodPreset;
  onPeriodChange: (p: PeriodPreset) => void;
  onExport: () => void;
  onReports: () => void;
  exporting?: boolean;
};

export function DashboardToolbar({
  synced,
  rangeLabel,
  updatedLabel,
  period,
  onPeriodChange,
  onExport,
  onReports,
  exporting,
}: Props) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
          Painel
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                synced ? 'bg-emerald-500' : 'bg-amber-400',
              )}
              aria-hidden
            />
            {synced ? 'Dados sincronizados' : 'Sincronizando…'}
          </span>
          <span className="tabular-nums">{rangeLabel}</span>
          <span className="tabular-nums">{updatedLabel}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div
          role="tablist"
          aria-label="Período"
          className="inline-flex flex-wrap rounded-xl border border-border bg-muted/40 p-0.5 shadow-sm gap-0.5"
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
                    ? 'bg-foreground text-background shadow-sm border-foreground'
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
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={exporting}
          className="rounded-xl border-border bg-card shadow-sm h-9"
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={onReports}
          className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
          style={{ color: '#ffffff' }}
        >
          <FileBarChart className="mr-2 h-4 w-4" />
          Ver relatórios
        </Button>
      </div>
    </div>
  );
}
