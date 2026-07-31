import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function ClientsCrmTopBar({ onRefresh, refreshing }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <nav
        aria-label="Breadcrumb"
        className="flex text-sm text-muted-foreground whitespace-nowrap min-w-0"
      >
        <span className="hidden sm:inline">Comercial</span>
        <span className="hidden sm:inline mx-1.5 opacity-60">/</span>
        <span className="font-semibold text-foreground truncate">CRM de Clientes</span>
      </nav>

      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          title="Atualizar"
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
