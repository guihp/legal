import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CATEGORY_TABS, type ReportCategory } from './constants';

type Props = {
  category: 'todos' | ReportCategory;
  onCategoryChange: (c: 'todos' | ReportCategory) => void;
  counts: Record<'todos' | ReportCategory, number>;
  search: string;
  onSearchChange: (v: string) => void;
};

export function ReportsFilters({
  category,
  onCategoryChange,
  counts,
  search,
  onSearchChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div
        className={cn(
          'flex items-center gap-2 min-w-0 overflow-x-auto',
          '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shrink-0">
          Categoria
        </span>
        <div
          role="tablist"
          aria-label="Categoria"
          className="inline-flex flex-nowrap gap-1 rounded-xl border border-border bg-muted/30 p-0.5"
        >
          {CATEGORY_TABS.map((tab) => {
            const active = category === tab.id;
            const count = counts[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onCategoryChange(tab.id)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap border transition-colors',
                  active
                    ? 'bg-card text-foreground shadow-sm border-border/60'
                    : 'text-muted-foreground hover:text-foreground border-transparent',
                )}
              >
                {tab.label}
                <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative w-full lg:w-64 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar relatório..."
          className="pl-9 h-9 rounded-xl bg-background border-border shadow-sm"
        />
      </div>
    </div>
  );
}
