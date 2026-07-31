import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type PlantaoTab = 'calendarios' | 'escala';

type Props = {
  subtitle: string;
  activeTab: PlantaoTab;
  onTabChange: (tab: PlantaoTab) => void;
  isManager: boolean;
  loading?: boolean;
  canAddAgenda?: boolean;
  onRefresh: () => void;
  onAddAgenda?: () => void;
};

const TABS: { value: PlantaoTab; label: string; managerOnly?: boolean }[] = [
  { value: 'calendarios', label: 'Calendários', managerOnly: true },
  { value: 'escala', label: 'Escala do plantão' },
];

export function PlantaoToolbar({
  subtitle,
  activeTab,
  onTabChange,
  isManager,
  loading,
  canAddAgenda,
  onRefresh,
  onAddAgenda,
}: Props) {
  const visibleTabs = TABS.filter((t) => !t.managerOnly || isManager);

  return (
    <div className="space-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
          Plantão
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Abas do plantão"
          className="inline-flex rounded-xl border border-border bg-muted/40 p-0.5 shadow-sm self-start"
        >
          {visibleTabs.map((tab) => {
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(tab.value)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-card text-foreground shadow-sm border border-border/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent',
                )}
              >
                {tab.label}
              </button>
            );
          })}
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

          {canAddAgenda && onAddAgenda ? (
            <Button
              type="button"
              size="sm"
              onClick={onAddAgenda}
              disabled={loading}
              className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
              style={{ color: '#ffffff' }}
            >
              <Plus className="mr-2 h-4 w-4" style={{ color: '#ffffff' }} />
              Adicionar agenda
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
