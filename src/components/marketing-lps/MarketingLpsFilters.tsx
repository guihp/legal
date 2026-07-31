import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { LpSort, LpStatusFilter } from './helpers';

type Counts = {
  todas: number;
  publicada: number;
  rascunho: number;
  despublicada: number;
};

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: LpStatusFilter;
  onStatusFilterChange: (v: LpStatusFilter) => void;
  sort: LpSort;
  onSortChange: (v: LpSort) => void;
  counts: Counts;
};

const STATUS_TABS: { value: LpStatusFilter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'publicada', label: 'Publicadas' },
  { value: 'rascunho', label: 'Rascunhos' },
  { value: 'despublicada', label: 'Despublicadas' },
];

export function MarketingLpsFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sort,
  onSortChange,
  counts,
}: Props) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative min-w-0 flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filtrar por imóvel, slug ou bairro..."
          className="pl-9 h-9 rounded-xl bg-muted/40 border-border/70"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Filtro de status"
          className="inline-flex rounded-xl border border-border bg-muted/40 p-0.5 shadow-sm"
        >
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.value;
            const count =
              tab.value === 'todas'
                ? counts.todas
                : tab.value === 'publicada'
                  ? counts.publicada
                  : tab.value === 'rascunho'
                    ? counts.rascunho
                    : counts.despublicada;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onStatusFilterChange(tab.value)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-card text-foreground shadow-sm border border-border/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent',
                )}
              >
                {tab.label}{' '}
                <span className={cn('tabular-nums', active ? 'text-foreground' : 'text-muted-foreground')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground hidden sm:inline">Ordenar</span>
          <div className="inline-flex rounded-xl border border-border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => onSortChange('views')}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors border',
                sort === 'views'
                  ? 'btn-on-emerald bg-emerald-800 text-white shadow-sm border-emerald-800'
                  : 'text-muted-foreground hover:text-foreground bg-card border-border/60',
              )}
              style={sort === 'views' ? { color: '#ffffff' } : undefined}
            >
              Mais vistas
            </button>
            <button
              type="button"
              onClick={() => onSortChange('recent')}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors border',
                sort === 'recent'
                  ? 'btn-on-emerald bg-emerald-800 text-white shadow-sm border-emerald-800'
                  : 'text-muted-foreground hover:text-foreground bg-card border-border/60',
              )}
              style={sort === 'recent' ? { color: '#ffffff' } : undefined}
            >
              Mais recentes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
