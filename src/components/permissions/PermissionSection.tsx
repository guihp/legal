import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COLUMN_ROLES, MATRIX_GRID, type ColumnRole } from './constants';
import { bulkActionForRole, type MatrixRow } from './helpers';
import { PermissionRow } from './PermissionRow';

type Props = {
  label: string;
  Icon: LucideIcon;
  iconTone: 'green' | 'blue' | 'violet' | 'amber';
  enabledCount: number;
  totalCount: number;
  rows: MatrixRow[];
  currentUserRole?: string;
  managedRoles: string[];
  updatingId: string | null;
  canBulk?: boolean;
  onToggle: (permissionId: string, permissionKey: string, role: ColumnRole, next: boolean) => void;
  onBulk: (role: ColumnRole, enable: boolean) => void;
};

const ICON_TONE: Record<Props['iconTone'], string> = {
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
};

export function PermissionSection({
  label,
  Icon,
  iconTone,
  enabledCount,
  totalCount,
  rows,
  currentUserRole,
  managedRoles,
  updatingId,
  canBulk = true,
  onToggle,
  onBulk,
}: Props) {
  return (
    <div>
      <div
        className={cn(
          MATRIX_GRID,
          'px-4 sm:px-5 py-2.5',
          'bg-[#E4E8DF]/90 dark:bg-muted/40 border-b border-border/50',
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
              ICON_TONE[iconTone],
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <p className="text-sm font-semibold text-foreground truncate">
            {label}{' '}
            <span className="font-medium text-muted-foreground">
              {enabledCount}/{totalCount}
            </span>
          </p>
        </div>

        {COLUMN_ROLES.map((role) => {
          const action = bulkActionForRole(rows, role);
          const roleManaged = managedRoles.includes(role);
          return (
            <div key={role} className="flex justify-center">
              <button
                type="button"
                onClick={() => onBulk(role, action.enable)}
                disabled={!canBulk || !roleManaged}
                className="text-[11px] sm:text-xs font-medium text-emerald-800 hover:text-emerald-700 disabled:opacity-40 disabled:pointer-events-none dark:text-emerald-400 text-center leading-tight"
              >
                {action.label}
              </button>
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground text-center">total</p>
      </div>

      <div>
        {rows.map((row) => (
          <PermissionRow
            key={row.permissionKey}
            row={row}
            currentUserRole={currentUserRole}
            managedRoles={managedRoles}
            updatingId={updatingId}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}
