import { cn } from '@/lib/utils';
import type { SoftChangeItem } from './helpers';

type Props = {
  items: SoftChangeItem[];
};

const TONE_DOT: Record<SoftChangeItem['tone'], string> = {
  red: 'bg-rose-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-400',
};

export function PermissionsActivityCard({ items }: Props) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm h-full">
      <h3 className="text-sm font-semibold text-foreground mb-4">Últimas alterações</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma alteração recente.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex gap-2.5">
              <span
                className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', TONE_DOT[item.tone])}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground leading-snug">{item.text}</p>
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{item.when}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
