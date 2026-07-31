import { cn } from '@/lib/utils';
import type { RoleUserBucket } from './helpers';

type Props = {
  buckets: RoleUserBucket[];
};

const TONE: Record<RoleUserBucket['tone'], string> = {
  amber: 'bg-amber-400',
  blue: 'bg-sky-500',
  green: 'bg-emerald-500',
};

export function PermissionsUsersCard({ buckets }: Props) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm h-full">
      <h3 className="text-sm font-semibold text-foreground mb-4">Usuários por perfil</h3>
      <ul className="space-y-3">
        {buckets.map((b) => (
          <li key={b.role} className="flex items-start gap-2.5 min-w-0">
            <span
              className={cn('mt-1.5 h-2.5 w-2.5 rounded-sm shrink-0', TONE[b.tone])}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">
                <span className="font-medium">{b.label}</span>
                {b.names.length > 0 ? (
                  <span className="text-muted-foreground"> · {b.names.slice(0, 4).join(', ')}</span>
                ) : (
                  <span className="text-muted-foreground"> · nenhum</span>
                )}
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-foreground shrink-0">
              {b.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
