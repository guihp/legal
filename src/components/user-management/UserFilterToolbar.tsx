import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { countByRole, type CompanyUser } from './helpers';

type RoleFilter = 'all' | 'admin' | 'gestor' | 'corretor';

type Props = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  roleFilter: RoleFilter;
  onRoleFilterChange: (value: RoleFilter) => void;
  users: CompanyUser[];
  isAdmin: boolean;
};

export function UserFilterToolbar({
  searchTerm,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  users,
  isAdmin,
}: Props) {
  const chips: { value: RoleFilter; label: string; count: number; show: boolean }[] = [
    { value: 'all', label: 'Todos', count: users.length, show: true },
    { value: 'gestor', label: 'Gestores', count: countByRole(users, 'gestor'), show: true },
    { value: 'corretor', label: 'Corretores', count: countByRole(users, 'corretor'), show: true },
    {
      value: 'admin',
      label: 'Admin',
      count: countByRole(users, 'admin'),
      show: isAdmin,
    },
  ];

  return (
    <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filtrar por nome, email ou telefone..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 border-border bg-background pl-10"
        />
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-thin">
        {chips
          .filter((c) => c.show)
          .map((chip) => {
            const active = roleFilter === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => onRoleFilterChange(chip.value)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'user-filter-chip-active border-emerald-800 bg-emerald-800 dark:border-emerald-700 dark:bg-emerald-700'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                style={active ? { color: '#ffffff' } : undefined}
              >
                <span style={active ? { color: '#ffffff' } : undefined}>{chip.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
                    active ? 'bg-white/20' : 'bg-muted text-muted-foreground',
                  )}
                  style={active ? { color: '#ffffff' } : undefined}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
