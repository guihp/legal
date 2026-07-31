import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FILTER_PILLS, MATRIX_GRID, type PermissionFilterId } from './constants';
import type { MatrixSection } from './helpers';
import { PermissionSection } from './PermissionSection';

type Props = {
  sections: MatrixSection[];
  allSections: MatrixSection[];
  filterCounts: Record<PermissionFilterId, number>;
  filter: PermissionFilterId;
  search: string;
  displayedCount: number;
  moduleCount: number;
  currentUserRole?: string;
  managedRoles: string[];
  updatingId: string | null;
  onFilterChange: (id: PermissionFilterId) => void;
  onSearchChange: (value: string) => void;
  onToggle: (
    permissionId: string,
    permissionKey: string,
    role: 'gestor' | 'corretor',
    next: boolean,
  ) => void;
  onBulk: (sectionId: string, role: 'gestor' | 'corretor', enable: boolean) => void;
};

export function PermissionsMatrixCard({
  sections,
  allSections,
  filterCounts,
  filter,
  search,
  displayedCount,
  moduleCount,
  currentUserRole,
  managedRoles,
  updatingId,
  onFilterChange,
  onSearchChange,
  onToggle,
  onBulk,
}: Props) {
  const canBulk = managedRoles.includes('gestor') || managedRoles.includes('corretor');
  const totalAll = filterCounts.all;
  const modulesLabel = moduleCount === 1 ? '1 módulo' : `${moduleCount} módulos`;

  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Matriz de permissões</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {totalAll} permiss{totalAll === 1 ? 'ão' : 'ões'} em {modulesLabel} · administrador
            sempre com acesso total
          </p>
        </div>

        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar permissão..."
              className="h-9 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-800/20"
            />
          </div>

          <div
            className={cn(
              'flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-[#F7F5F0]/80 dark:bg-muted/30 p-1',
              '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            )}
            role="tablist"
            aria-label="Filtrar por módulo"
          >
            {FILTER_PILLS.map((pill) => {
              const count = filterCounts[pill.id] ?? 0;
              const active = filter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onFilterChange(pill.id)}
                  className={cn(
                    'shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                    active
                      ? 'bg-white dark:bg-card text-foreground shadow-sm border border-border/60'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {pill.label}{' '}
                  <span className={cn(active ? 'text-foreground' : 'text-muted-foreground/80')}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className={cn(
          MATRIX_GRID,
          'px-4 sm:px-5 py-2 border-y border-border/60 bg-[#F7F5F0]/60 dark:bg-muted/20',
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Permissão
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground text-center">
          Gestor
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground text-center">
          Corretor
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground text-center">
          Administrador
        </p>
      </div>

      {sections.length === 0 ? (
        <div className="px-4 sm:px-5 py-10 text-center text-sm text-muted-foreground">
          Nenhuma permissão encontrada
          {search.trim() ? ` para “${search.trim()}”` : ''}.
        </div>
      ) : (
        sections.map((section) => (
          <PermissionSection
            key={section.id}
            label={section.label}
            Icon={section.Icon}
            iconTone={section.iconTone}
            enabledCount={section.enabledCount}
            totalCount={
              allSections.find((s) => s.id === section.id)?.totalCount ?? section.totalCount
            }
            rows={section.rows}
            currentUserRole={currentUserRole}
            managedRoles={managedRoles}
            updatingId={updatingId}
            canBulk={canBulk}
            onToggle={onToggle}
            onBulk={(role, enable) => onBulk(section.id, role, enable)}
          />
        ))
      )}

      <div className="px-4 sm:px-5 py-3 border-t border-border/60 bg-[#F7F5F0]/50 dark:bg-muted/20">
        <p className="text-xs text-muted-foreground">
          {displayedCount} permiss{displayedCount === 1 ? 'ão' : 'ões'} exibidas · alterações valem
          no próximo login do usuário
        </p>
      </div>
    </div>
  );
}
