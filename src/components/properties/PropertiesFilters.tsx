import type { ReactNode } from 'react';
import { Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { PropertiesFilterTab, PropertiesSortKey } from './helpers';

type Props = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchSuggestions?: string[];
  onPickSuggestion?: (value: string) => void;
  selectedTab: PropertiesFilterTab;
  onTabChange: (tab: PropertiesFilterTab) => void;
  counts: Record<PropertiesFilterTab, number>;
  sortKey: PropertiesSortKey;
  onSortChange: (key: PropertiesSortKey) => void;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  advancedPanel?: ReactNode;
};

const TABS: { value: PropertiesFilterTab; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'disponiveis', label: 'Disponíveis' },
  { value: 'venda', label: 'Venda' },
  { value: 'aluguel', label: 'Aluguel' },
];

const SORTS: { value: PropertiesSortKey; label: string }[] = [
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'valor', label: 'Valor' },
  { value: 'area', label: 'Área' },
];

export function PropertiesFilters({
  searchTerm,
  onSearchChange,
  searchSuggestions = [],
  onPickSuggestion,
  selectedTab,
  onTabChange,
  counts,
  sortKey,
  onSortChange,
  advancedOpen,
  onToggleAdvanced,
  advancedPanel,
}: Props) {
  return (
    <div className="rounded-xl sm:rounded-2xl border border-border bg-card p-2.5 sm:p-3 md:p-4 shadow-sm space-y-2 sm:space-y-3">
      <div className="flex flex-col gap-2 sm:gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Pesquisar por código, rua, bairro ou empreendimento..."
            className="pl-9 h-9 sm:h-10 rounded-lg sm:rounded-xl bg-background border-border shadow-sm text-sm"
          />
          {searchSuggestions.length > 0 ? (
            <div className="absolute z-40 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl max-h-56 overflow-auto">
              {searchSuggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60"
                  onMouseDown={() => onPickSuggestion?.(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5 shrink-0">
          {TABS.map((tab) => {
            const active = selectedTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => onTabChange(tab.value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium shadow-sm transition-colors',
                  active
                    ? 'btn-on-emerald border-emerald-800 bg-emerald-800 text-white dark:bg-emerald-700 dark:border-emerald-700'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
                <span className="ml-1 sm:ml-1.5 tabular-nums opacity-80">{counts[tab.value]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 sm:gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground mr-0.5 sm:mr-1">
            Ordenar
          </span>
          {SORTS.map((s) => {
            const active = sortKey === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => onSortChange(s.value)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-medium shadow-sm transition-colors',
                  active
                    ? 'btn-on-emerald border-emerald-800 bg-emerald-800 text-white dark:bg-emerald-700 dark:border-emerald-700'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggleAdvanced}
          className="rounded-lg sm:rounded-xl h-8 sm:h-9 border-border bg-background shadow-sm text-xs sm:text-sm"
        >
          <Filter className="h-3.5 w-3.5 mr-1.5" />
          <span className="sm:hidden">{advancedOpen ? 'Ocultar' : 'Filtros'}</span>
          <span className="hidden sm:inline">{advancedOpen ? 'Ocultar filtros' : 'Filtros avançados'}</span>
        </Button>
      </div>

      {advancedOpen && advancedPanel ? (
        <div className="pt-2 border-t border-border/70">{advancedPanel}</div>
      ) : null}
    </div>
  );
}
