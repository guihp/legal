import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Props = {
  subtitle: string;
  instanceCount: number;
  instanceLimit: number;
  atLimit: boolean;
  canCreate: boolean;
  onRefresh: () => void;
  onNewInstance: () => void;
  refreshing?: boolean;
};

export function ConnectionsToolbar({
  subtitle,
  instanceCount,
  instanceLimit,
  atLimit,
  canCreate,
  onRefresh,
  onNewInstance,
  refreshing,
}: Props) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
          Conexões
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-xl border-border bg-card shadow-sm"
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
          Atualizar
        </Button>
        {canCreate ? (
          <div className="inline-flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onNewInstance}
              disabled={atLimit}
              className={cn(
                'rounded-xl shadow-sm',
                atLimit
                  ? 'bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed'
                  : 'btn-on-emerald bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600',
              )}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova instância
            </Button>
            {atLimit ? (
              <Badge
                variant="outline"
                className="rounded-md border-amber-300 bg-amber-50 text-[10px] font-bold tracking-wide text-amber-800 uppercase dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
              >
                Limite {instanceCount}/{instanceLimit}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
