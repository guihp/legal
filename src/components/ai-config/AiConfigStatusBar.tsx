import type { ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = {
  aiEnabled: boolean;
  isManager: boolean;
  toggling?: boolean;
  updating?: boolean;
  savedAtLabel?: string;
  hasChanges: boolean;
  activationBlockers?: string[];
  onToggleAi: (checked: boolean) => void;
};

export function AiConfigStatusBar({
  aiEnabled,
  isManager,
  toggling,
  updating,
  savedAtLabel,
  hasChanges,
  activationBlockers = [],
  onToggleAi,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-border/70 bg-white dark:bg-card px-3 py-3 sm:px-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Switch
              checked={aiEnabled}
              disabled={!isManager || toggling || updating}
              onCheckedChange={onToggleAi}
              className="data-[state=checked]:bg-emerald-600 shrink-0"
              aria-label="Assistente IA ativa"
            />
            <div className="min-w-0">
              <Label className="text-sm font-semibold text-foreground mb-0">
                Assistente IA ativa
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Responde automaticamente aos clientes no WhatsApp
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {savedAtLabel ? <StatusPill>Salvo em {savedAtLabel}</StatusPill> : null}
            <span
              className={cn(
                'inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold',
                hasChanges
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
              )}
            >
              {hasChanges ? 'Alterações pendentes' : 'Tudo salvo'}
            </span>
          </div>
        </div>
      </div>

      {!aiEnabled && activationBlockers.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-3 text-sm text-amber-950 dark:text-amber-100/90">
          <p className="font-medium text-amber-900 dark:text-amber-200 mb-1.5">
            Para ativar a IA, complete:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-amber-900/80 dark:text-amber-100/80 text-sm">
            {activationBlockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/80 bg-[#F7F5F0]/80 dark:bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground tabular-nums">
      {children}
    </span>
  );
}
