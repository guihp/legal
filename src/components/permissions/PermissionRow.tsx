import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { COLUMN_ROLES, MATRIX_GRID, type ColumnRole } from './constants';
import { canToggleRole, type MatrixRow } from './helpers';

type Props = {
  row: MatrixRow;
  currentUserRole?: string;
  managedRoles: string[];
  updatingId: string | null;
  onToggle: (permissionId: string, permissionKey: string, role: ColumnRole, next: boolean) => void;
};

export function PermissionRow({
  row,
  currentUserRole,
  managedRoles,
  updatingId,
  onToggle,
}: Props) {
  return (
    <div className={cn(MATRIX_GRID, 'px-4 sm:px-5 py-3.5 border-b border-border/60')}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{row.title}</p>
          {row.escrita ? (
            <span className="inline-flex items-center rounded-md bg-orange-100/90 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              ESCRITA
            </span>
          ) : null}
          {row.sensitive ? (
            <span className="inline-flex items-center rounded-md bg-rose-100/90 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              SENSÍVEL
            </span>
          ) : null}
        </div>
        {row.description ? (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{row.description}</p>
        ) : null}
      </div>

      {COLUMN_ROLES.map((role) => {
        const perm = row.byRole[role];
        const editable =
          !!perm && canToggleRole(currentUserRole, role, managedRoles, row.permissionKey);
        const busy = !!perm && updatingId === perm.id;

        return (
          <div key={role} className="flex justify-center">
            {perm ? (
              <Switch
                checked={perm.is_enabled}
                disabled={!editable || busy}
                onCheckedChange={(checked) => onToggle(perm.id, row.permissionKey, role, checked)}
                className={cn(
                  'data-[state=checked]:bg-emerald-800 dark:data-[state=checked]:bg-emerald-600',
                  !editable && 'opacity-60',
                )}
                aria-label={`${row.title} — ${role}`}
              />
            ) : (
              <span
                className="h-6 w-11 rounded-full bg-muted/50 border border-border/50"
                aria-hidden
                title="Não aplicável a este perfil"
              />
            )}
          </div>
        );
      })}

      <div className="flex justify-center">
        <span className="inline-flex items-center rounded-md bg-muted/70 dark:bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
          sempre
        </span>
      </div>
    </div>
  );
}
