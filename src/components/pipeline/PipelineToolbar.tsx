import { ChevronDown, Filter, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

type Broker = { id: string; full_name: string };

type Props = {
  subtitle?: string;
  view: 'kanban' | 'lista';
  onViewChange: (view: 'kanban' | 'lista') => void;
  availableBrokers: Broker[];
  selectedBrokers: Set<string>;
  showBrokerFilter: boolean;
  onToggleBrokerFilter: () => void;
  onBrokerToggle: (id: string) => void;
  onClearBrokers: () => void;
  onNewLead: () => void;
};

export function PipelineToolbar({
  subtitle,
  view,
  onViewChange,
  availableBrokers,
  selectedBrokers,
  showBrokerFilter,
  onToggleBrokerFilter,
  onBrokerToggle,
  onClearBrokers,
  onNewLead,
}: Props) {
  const brokerLabel =
    selectedBrokers.size === 0
      ? 'Todos os corretores'
      : selectedBrokers.size === 1 && selectedBrokers.has('unassigned')
        ? 'Sem corretor'
        : `${selectedBrokers.size} filtro${selectedBrokers.size > 1 ? 's' : ''}`;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
          Pipeline de Vendas
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Funil comercial</p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <div
          role="tablist"
          aria-label="Visualização"
          className="inline-flex items-center rounded-xl border border-border bg-muted/40 p-1 shadow-sm self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'kanban'}
            onClick={() => onViewChange('kanban')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'kanban'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Kanban
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'lista'}
            onClick={() => onViewChange('lista')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'lista'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Lista
          </button>
        </div>

        {availableBrokers.length > 0 ? (
          <div className="relative" data-broker-filter>
            <Button
              variant="outline"
              className="bg-card border-border min-w-[180px] justify-between rounded-xl h-9"
              onClick={onToggleBrokerFilter}
            >
              <span className="flex items-center gap-2 text-sm truncate">
                <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {brokerLabel}
              </span>
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 transition-transform', showBrokerFilter && 'rotate-180')}
              />
            </Button>

            {showBrokerFilter ? (
              <div className="absolute top-full mt-2 right-0 z-50 w-64 bg-popover border border-border rounded-xl shadow-xl max-h-64 overflow-y-auto">
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-sm font-medium text-foreground">Filtrar por corretor</span>
                    {selectedBrokers.size > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground h-6 px-2"
                        onClick={onClearBrokers}
                      >
                        Limpar
                      </Button>
                    ) : null}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="unassigned"
                      checked={selectedBrokers.has('unassigned')}
                      onCheckedChange={() => onBrokerToggle('unassigned')}
                    />
                    <label
                      htmlFor="unassigned"
                      className="text-sm text-muted-foreground hover:text-foreground cursor-pointer flex-1"
                    >
                      Sem corretor atribuído
                    </label>
                  </div>

                  {availableBrokers.length > 0 ? (
                    <div className="border-t border-border pt-2 mt-2">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Corretores
                      </span>
                    </div>
                  ) : null}

                  {availableBrokers.map((broker) => (
                    <div key={broker.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`broker-${broker.id}`}
                        checked={selectedBrokers.has(broker.id)}
                        onCheckedChange={() => onBrokerToggle(broker.id)}
                      />
                      <label
                        htmlFor={`broker-${broker.id}`}
                        className="text-sm text-muted-foreground hover:text-foreground cursor-pointer flex-1"
                      >
                        {broker.full_name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <Button
          onClick={onNewLead}
          className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
          style={{ color: '#ffffff' }}
        >
          <Plus className="mr-1.5 h-4 w-4" style={{ color: '#ffffff' }} />
          Novo lead
        </Button>
      </div>
    </div>
  );
}
