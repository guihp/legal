import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function PropertiesTopBar({ onRefresh, refreshing }: Props) {
  return (
    <div className="hidden sm:flex items-center justify-between gap-3 min-w-0">
      <nav
        aria-label="Breadcrumb"
        className="flex text-sm text-muted-foreground whitespace-nowrap min-w-0"
      >
        <span>Portfólio</span>
        <span className="mx-1.5 opacity-60">/</span>
        <span className="font-semibold text-foreground truncate">Imóveis</span>
      </nav>

      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          title="Atualizar imóveis"
          className={cn(
            'h-9 w-9 inline-flex items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground shadow-sm shrink-0',
            refreshing && 'opacity-70',
          )}
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      ) : null}
    </div>
  );
}
