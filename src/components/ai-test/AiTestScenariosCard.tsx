import { cn } from '@/lib/utils';
import { AI_TEST_SCENARIOS, type AiTestScenario } from './helpers';

type Props = {
  activeId?: string | null;
  onSelect: (scenario: AiTestScenario) => void;
};

export function AiTestScenariosCard({ activeId, onSelect }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5">
      <h2 className="text-base font-semibold text-foreground mb-3">Cenários de teste</h2>
      <ul className="space-y-2">
        {AI_TEST_SCENARIOS.map((scenario) => {
          const Icon = scenario.icon;
          const active = activeId === scenario.id;
          return (
            <li key={scenario.id}>
              <button
                type="button"
                onClick={() => onSelect(scenario)}
                className={cn(
                  'w-full flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  active
                    ? 'border-emerald-700/40 bg-emerald-50/80 dark:bg-emerald-950/20'
                    : 'border-border/80 bg-white/60 dark:bg-background/40 hover:border-emerald-700/30 hover:bg-[#F7F5F0]/80 dark:hover:bg-muted/40',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    scenario.iconBg,
                  )}
                >
                  <Icon className={cn('h-4 w-4', scenario.iconClass)} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{scenario.title}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {scenario.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
