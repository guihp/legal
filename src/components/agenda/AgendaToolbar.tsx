import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AgendaViewMode } from './helpers';

type Props = {
  isConnected: boolean;
  connectedEmail?: string | null;
  lastSync?: Date | null;
  loading?: boolean;
  viewMode: AgendaViewMode;
  onViewModeChange: (mode: AgendaViewMode) => void;
  onSync: () => void;
  onNewEvent: () => void;
  syncing?: boolean;
};

const VIEW_MODES: { value: AgendaViewMode; label: string }[] = [
  { value: 'month', label: 'Mês' },
  { value: 'week', label: 'Semana' },
  { value: 'list', label: 'Lista' },
];

export function AgendaToolbar({
  isConnected,
  connectedEmail,
  lastSync,
  loading,
  viewMode,
  onViewModeChange,
  onSync,
  onNewEvent,
  syncing,
}: Props) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
          Agenda
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                'h-2 w-2 rounded-full shrink-0',
                isConnected ? 'bg-emerald-600' : 'bg-amber-400',
              )}
              aria-hidden
            />
            <span>
              {isConnected ? 'Google Calendar conectado' : 'Google Calendar desconectado'}
            </span>
          </span>
          {isConnected && connectedEmail ? (
            <>
              <span className="hidden sm:inline opacity-50">·</span>
              <span className="break-all sm:break-normal">{connectedEmail}</span>
            </>
          ) : null}
          {lastSync ? (
            <>
              <span className="hidden sm:inline opacity-50">·</span>
              <span>sincronizado às {lastSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </>
          ) : null}
          {loading ? (
            <>
              <span className="hidden sm:inline opacity-50">·</span>
              <span className="text-emerald-700 dark:text-emerald-400">atualizando…</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap shrink-0">
        <div className="inline-flex rounded-xl border border-border bg-background p-0.5 shadow-sm">
          {VIEW_MODES.map((mode) => {
            const active = viewMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => onViewModeChange(mode.value)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'btn-on-emerald bg-emerald-800 text-white shadow-sm dark:bg-emerald-700'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                )}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          onClick={onSync}
          disabled={syncing}
          className="rounded-xl h-9 border-border bg-card shadow-sm"
        >
          <RefreshCw className={cn('mr-1.5 h-4 w-4', syncing && 'animate-spin')} />
          Sincronizar
        </Button>

        <Button
          onClick={onNewEvent}
          className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
          style={{ color: '#ffffff' }}
        >
          <Plus className="mr-1.5 h-4 w-4" style={{ color: '#ffffff' }} />
          Novo evento
        </Button>
      </div>
    </div>
  );
}
