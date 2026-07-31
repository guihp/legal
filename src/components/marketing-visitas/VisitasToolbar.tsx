import { Download, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  subtitle: string;
  loading?: boolean;
  canOpenSite?: boolean;
  onOpenSite: () => void;
  onRefresh: () => void;
  onExport: () => void;
  exportDisabled?: boolean;
};

export function VisitasToolbar({
  subtitle,
  loading,
  canOpenSite,
  onOpenSite,
  onRefresh,
  onExport,
  exportDisabled,
}: Props) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
          Visitas ao site
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {canOpenSite ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSite}
            className="rounded-xl border-border bg-card shadow-sm h-9"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir site
          </Button>
        ) : null}
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
          size="sm"
          onClick={onExport}
          disabled={exportDisabled}
          className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
          style={{ color: '#ffffff' }}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>
    </div>
  );
}
