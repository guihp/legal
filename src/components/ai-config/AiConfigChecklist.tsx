import { AlertTriangle, Check } from 'lucide-react';
import type { ChecklistItem } from './helpers';

type Props = {
  items: ChecklistItem[];
};

export function AiConfigChecklist({ items }: Props) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Checklist da configuração</h3>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={
                  item.ok
                    ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                }
              >
                {item.ok ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="text-sm text-foreground truncate">{item.label}</span>
            </div>
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {item.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
