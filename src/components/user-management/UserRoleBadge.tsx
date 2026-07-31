import { cn } from '@/lib/utils';
import { getRoleBadgeClass, translateRole } from './helpers';

export function UserRoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        getRoleBadgeClass(role),
      )}
    >
      {translateRole(role)}
    </span>
  );
}

export function UserStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          isActive ? 'bg-emerald-500' : 'bg-red-500',
        )}
        aria-hidden
      />
      {isActive ? 'Ativo' : 'Inativo'}
    </span>
  );
}
