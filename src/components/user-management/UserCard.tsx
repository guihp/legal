import {
  Edit,
  MoreVertical,
  RefreshCw,
  Settings,
  Trash2,
  User,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  formatCreatedAt,
  formatPhone,
  type CompanyUser,
} from './helpers';
import { UserRoleBadge, UserStatusBadge } from './UserRoleBadge';

export type UserActions = {
  canManage: boolean;
  onSettings: (user: CompanyUser) => void;
  onEdit: (user: CompanyUser) => void;
  onDeactivate: (userId: string) => void;
  onActivate: (userId: string) => void;
  onDelete: (userId: string, userName: string) => void;
};

function UserAvatar({ user, size = 'md' }: { user: CompanyUser; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-800 text-emerald-50`}
    >
      {user.avatar_url ? (
        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <User className={`${icon} text-emerald-50`} aria-hidden />
      )}
    </div>
  );
}

export function UserActionsMenu({ user, actions }: { user: CompanyUser; actions: UserActions }) {
  if (!actions.canManage) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Ações</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => actions.onSettings(user)}>
          <Settings className="mr-2 h-4 w-4" />
          Definições
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => actions.onEdit(user)}>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        {user.is_active ? (
          <DropdownMenuItem
            onClick={() => actions.onDeactivate(user.id)}
            className="text-destructive focus:text-destructive"
          >
            <UserX className="mr-2 h-4 w-4" />
            Desativar
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onClick={() => actions.onActivate(user.id)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reativar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => actions.onDelete(user.id, user.full_name)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir permanentemente
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Desktop table row */
export function UserTableRow({ user, actions }: { user: CompanyUser; actions: UserActions }) {
  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell>
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar user={user} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{user.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <UserRoleBadge role={user.role} />
      </TableCell>
      <TableCell>
        <UserStatusBadge isActive={user.is_active} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground tabular-nums">
        {formatPhone(user.phone)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
        {formatCreatedAt(user.created_at)}
      </TableCell>
      <TableCell className="text-right">
        <UserActionsMenu user={user} actions={actions} />
      </TableCell>
    </TableRow>
  );
}

/** Mobile card */
export function UserCard({ user, actions }: { user: CompanyUser; actions: UserActions }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{user.full_name}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
            <UserActionsMenu user={user} actions={actions} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <UserRoleBadge role={user.role} />
            <UserStatusBadge isActive={user.is_active} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span>{formatPhone(user.phone)}</span>
            <span className="tabular-nums">Criado em {formatCreatedAt(user.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
