import { RefreshCw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function PipelineTopBar({ searchTerm, onSearchChange, onRefresh, refreshing }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0">
      <nav
        aria-label="Breadcrumb"
        className="hidden md:flex text-sm text-muted-foreground whitespace-nowrap shrink-0"
      >
        <span>Comercial</span>
        <span className="mx-1.5 opacity-60">/</span>
        <span className="font-semibold text-foreground">Pipeline de Vendas</span>
      </nav>

      <div className="relative flex-1 min-w-0 max-w-xl mx-auto w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar lead, telefone ou interesse..."
          className="pl-9 h-9 rounded-xl bg-card border-border shadow-sm"
        />
      </div>

      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="Atualizar pipeline"
            className={cn(
              'h-9 w-9 inline-flex items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground shadow-sm',
              refreshing && 'opacity-70',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
