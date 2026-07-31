import { cn } from '@/lib/utils';

export type QuickActionChip = {
  id: string;
  label: string;
  onClick: () => void;
};

type ConversasQuickActionsProps = {
  actions: QuickActionChip[];
  className?: string;
};

/** Compact chips above the composer (templates / shortcuts). */
export function ConversasQuickActions({ actions, className }: ConversasQuickActionsProps) {
  if (!actions.length) return null;
  return (
    <div
      className={cn(
        'shrink-0 px-3 sm:px-4 pt-2 pb-1 flex gap-1.5 overflow-x-auto custom-scrollbar bg-[var(--cv-panel)]/80 border-t border-[var(--cv-border)]/50',
        className,
      )}
    >
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={a.onClick}
          className="shrink-0 rounded-full border border-[var(--cv-border)] bg-[var(--cv-shell)] px-3 py-1 text-xs font-medium text-[var(--cv-text)] hover:bg-[var(--cv-hover)] hover:border-[var(--cv-accent)]/40 transition-colors"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
