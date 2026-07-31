import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Granularity, PageTypeFilter, Preset } from './helpers';

type Counts = {
  all: number;
  vitrine: number;
  landing: number;
};

type Props = {
  preset: Preset;
  onPresetChange: (v: Preset) => void;
  granularity: Granularity;
  onGranularityChange: (v: Granularity) => void;
  pageTypeFilter: PageTypeFilter;
  onPageTypeFilterChange: (v: PageTypeFilter) => void;
  counts: Counts;
  rangeLabel: string;
  fromStr: string;
  toStr: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
};

const PERIODS: { value: Preset; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'custom', label: 'Personalizado' },
];

const GROUPS: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
];

const PAGES: { value: PageTypeFilter; label: string; countKey: keyof Counts }[] = [
  { value: 'all', label: 'Todas', countKey: 'all' },
  { value: 'vitrine', label: 'Vitrine', countKey: 'vitrine' },
  { value: 'landing', label: 'Landing pages', countKey: 'landing' },
];

function SegButton({
  active,
  onClick,
  children,
  emerald,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  emerald?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap border',
        active && emerald
          ? 'btn-on-emerald bg-emerald-800 text-white shadow-sm border-emerald-800'
          : active
            ? 'bg-card text-foreground shadow-sm border-border/60'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent',
      )}
      style={active && emerald ? { color: '#ffffff' } : undefined}
    >
      {children}
    </button>
  );
}

export function VisitasFilters({
  preset,
  onPresetChange,
  granularity,
  onGranularityChange,
  pageTypeFilter,
  onPageTypeFilterChange,
  counts,
  rangeLabel,
  fromStr,
  toStr,
  onFromChange,
  onToChange,
}: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-3 sm:p-4 space-y-3.5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end min-w-0 flex-1">
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Período
            </p>
            <div
              role="tablist"
              aria-label="Período"
              className="inline-flex flex-wrap rounded-xl border border-border bg-muted/40 p-0.5 shadow-sm gap-0.5"
            >
              {PERIODS.map((p) => (
                <SegButton
                  key={p.value}
                  active={preset === p.value}
                  onClick={() => onPresetChange(p.value)}
                >
                  {p.label}
                </SegButton>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Agrupar
            </p>
            <div
              role="tablist"
              aria-label="Agrupar"
              className="inline-flex rounded-xl border border-border bg-muted/40 p-0.5 shadow-sm"
            >
              {GROUPS.map((g) => (
                <SegButton
                  key={g.value}
                  active={granularity === g.value}
                  onClick={() => onGranularityChange(g.value)}
                >
                  {g.label}
                </SegButton>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Página
            </p>
            <div
              role="tablist"
              aria-label="Tipo de página"
              className="inline-flex flex-wrap rounded-xl border border-border bg-muted/40 p-0.5 shadow-sm gap-0.5"
            >
              {PAGES.map((p) => {
                const active = pageTypeFilter === p.value;
                return (
                  <SegButton
                    key={p.value}
                    active={active}
                    onClick={() => onPageTypeFilterChange(p.value)}
                  >
                    {p.label}{' '}
                    <span className={cn('tabular-nums', active ? 'text-foreground' : 'text-muted-foreground')}>
                      {counts[p.countKey]}
                    </span>
                  </SegButton>
                );
              })}
            </div>
          </div>
        </div>

        <div className="shrink-0 xl:pt-6 xl:text-right">
          {preset === 'custom' ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={fromStr}
                onChange={(e) => onFromChange(e.target.value)}
                className="h-8 rounded-lg bg-muted/40 border-border/70 text-xs w-[9.5rem]"
              />
              <span className="text-muted-foreground text-xs">→</span>
              <Input
                type="date"
                value={toStr}
                onChange={(e) => onToChange(e.target.value)}
                className="h-8 rounded-lg bg-muted/40 border-border/70 text-xs w-[9.5rem]"
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground whitespace-nowrap">{rangeLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}
