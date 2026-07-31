import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  subtitle?: string;
  canAdd?: boolean;
  onAdd?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function PropertiesToolbar({
  subtitle,
  canAdd = true,
  onAdd,
  onRefresh,
  refreshing,
}: Props) {
  return (
    <div className="flex items-start justify-between gap-2 sm:gap-3 lg:items-end">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground leading-tight">
          Imóveis
        </h1>
        {subtitle ? (
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">{subtitle}</p>
        ) : (
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">Portfólio ativo</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="Atualizar imóveis"
            className={cn(
              'sm:hidden h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground shadow-sm shrink-0',
              refreshing && 'opacity-70',
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
        ) : null}

        {canAdd && onAdd ? (
          <Button
            onClick={onAdd}
            className="btn-on-emerald rounded-lg sm:rounded-xl h-8 sm:h-9 px-2.5 sm:px-4 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm text-sm"
            style={{ color: '#ffffff' }}
          >
            <Plus className="mr-1 sm:mr-1.5 h-4 w-4" style={{ color: '#ffffff' }} />
            <span className="sm:hidden">Adicionar</span>
            <span className="hidden sm:inline">Adicionar imóvel</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
