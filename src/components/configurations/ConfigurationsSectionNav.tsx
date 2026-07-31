import { cn } from '@/lib/utils';
import { SECTION_NAV } from './helpers';
import type { ConfigSectionId } from './constants';

type Props = {
  section: ConfigSectionId;
  hasChanges: boolean;
  onSectionChange: (section: ConfigSectionId) => void;
};

export function ConfigurationsSectionNav({ section, hasChanges, onSectionChange }: Props) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card px-3 py-3 sm:px-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Seção
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SECTION_NAV.map(({ id, label, Icon }) => {
              const isActive = section === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSectionChange(id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors border',
                    isActive
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 font-medium dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                      : 'border-transparent bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      isActive ? 'text-emerald-700 dark:text-emerald-400' : '',
                    )}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 self-end sm:pb-0.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
              hasChanges
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
            )}
          >
            {hasChanges ? 'Alterações pendentes' : 'Tudo salvo'}
          </span>
        </div>
      </div>
    </div>
  );
}
