import { Loader2, Users } from 'lucide-react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserCard, UserTableRow, type UserActions } from './UserCard';
import type { CompanyUser } from './helpers';

type Props = {
  users: CompanyUser[];
  filteredUsers: CompanyUser[];
  loading: boolean;
  actions: UserActions;
};

export function UserList({ users, filteredUsers, loading, actions }: Props) {
  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (filteredUsers.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground">Nenhum usuário encontrado</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {users.length === 0
            ? 'Nenhum usuário cadastrado na empresa.'
            : 'Nenhum usuário corresponde aos filtros aplicados.'}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-2 p-3 md:hidden">
        {filteredUsers.map((user) => (
          <UserCard key={user.id} user={user} actions={actions} />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Membro
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cargo
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Telefone
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Criado em
              </TableHead>
              <TableHead className="w-12 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <UserTableRow key={user.id} user={user} actions={actions} />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-3 py-2.5 sm:px-4">
        <p className="text-xs text-muted-foreground">
          Exibindo {filteredUsers.length} de {users.length}{' '}
          {users.length === 1 ? 'membro' : 'membros'}
        </p>
      </div>
    </>
  );
}
