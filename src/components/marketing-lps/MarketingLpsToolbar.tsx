import { Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SUBTITLE } from './helpers';

type Props = {
  loading?: boolean;
  onRefresh: () => void;
  onExport: () => void;
  onGoProperties: () => void;
};

export function MarketingLpsToolbar({ loading, onRefresh, onExport, onGoProperties }: Props) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
          Landing pages dos imóveis
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{SUBTITLE}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-xl border-border bg-card shadow-sm h-9"
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Atualizar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExport}
          className="rounded-xl border-border bg-card shadow-sm h-9"
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar relatório
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onGoProperties}
          className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
          style={{ color: '#ffffff' }}
        >
          Ir para Propriedades
        </Button>
      </div>
    </div>
  );
}
