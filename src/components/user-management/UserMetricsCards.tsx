import type { CompanyUser } from './helpers';
import { countByRole } from './helpers';
import { cn } from '@/lib/utils';

type Props = {
  users: CompanyUser[];
  isAdmin: boolean;
};

type Metric = {
  key: string;
  label: string;
  value: number;
  hint: string;
  accent: string;
  bar: string;
};

export function UserMetricsCards({ users, isAdmin }: Props) {
  const total = users.length;
  const active = users.filter((u) => u.is_active).length;
  const inactive = users.filter((u) => !u.is_active).length;
  const gestores = countByRole(users, 'gestor');
  const admins = countByRole(users, 'admin');
  const activePct = total > 0 ? Math.round((active / total) * 100) : 0;

  const metrics: Metric[] = [
    {
      key: 'total',
      label: 'Total de membros',
      value: total,
      hint: total === 1 ? '1 cadastrado' : `${total} cadastrados`,
      accent: 'text-emerald-700 dark:text-emerald-400',
      bar: 'bg-emerald-600',
    },
    {
      key: 'active',
      label: 'Acessos ativos',
      value: active,
      hint: total > 0 ? `${activePct}% da equipe` : 'Sem membros',
      accent: 'text-sky-700 dark:text-sky-400',
      bar: 'bg-sky-500',
    },
    {
      key: 'inactive',
      label: 'Contas inativas',
      value: inactive,
      hint: inactive > 0 ? 'revisar acesso' : 'tudo ok',
      accent: 'text-red-700 dark:text-red-400',
      bar: 'bg-red-500',
    },
    isAdmin
      ? {
          key: 'admin',
          label: 'Administradores',
          value: admins,
          hint: admins === 1 ? '1 admin' : `${admins} admins`,
          accent: 'text-amber-700 dark:text-amber-400',
          bar: 'bg-amber-500',
        }
      : {
          key: 'gestor',
          label: 'Gestores',
          value: gestores,
          hint: gestores === 1 ? '1 gestor' : `${gestores} gestores`,
          accent: 'text-violet-700 dark:text-violet-400',
          bar: 'bg-violet-500',
        },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((m) => (
        <div
          key={m.key}
          className="relative overflow-hidden rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {m.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{m.value}</p>
          <p className={cn('mt-0.5 text-xs', m.accent)}>{m.hint}</p>
          <div className={cn('absolute inset-x-0 bottom-0 h-1', m.bar)} />
        </div>
      ))}
    </div>
  );
}
