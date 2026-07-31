import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  message: string;
  lastSyncLabel?: string | null;
  onRetry: () => void;
  onDismiss: () => void;
  retrying?: boolean;
};

export function ConnectionsSyncBanner({
  message,
  lastSyncLabel,
  onRetry,
  onDismiss,
  retrying,
}: Props) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3 min-w-0">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              {message}
            </p>
            {lastSyncLabel ? (
              <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/80">
                Exibindo os dados salvos no sistema · última leitura bem-sucedida às {lastSyncLabel}
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/80">
                Exibindo os dados salvos no sistema.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 sm:pt-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={retrying}
            className="border-amber-300 bg-white/80 text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-transparent dark:text-amber-100"
          >
            {retrying ? 'Sincronizando…' : 'Tentar novamente'}
          </Button>
          <button
            type="button"
            onClick={onDismiss}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
            aria-label="Fechar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
