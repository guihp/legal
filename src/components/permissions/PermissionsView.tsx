import { useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionConfirmDialog } from '@/components/PermissionConfirmDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePermissions, type RolePermission } from '@/hooks/usePermissions';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import { useUserProfile } from '@/hooks/useUserProfile';
import { logAudit } from '@/lib/audit/logger';
import { canAccessPermissionsModule, getManagedRoles } from '@/lib/permissions/rules';
import { type ColumnRole, type PermissionFilterId } from './constants';
import {
  bucketUsersByRole,
  buildMatrix,
  buildRoleKpis,
  canToggleRole,
  countDisplayedRows,
  filterMatrix,
  moduleCount as countModules,
  sectionCounts,
} from './helpers';
import { PermissionsMatrixCard } from './PermissionsMatrixCard';
import { PermissionsRoleKpis } from './PermissionsRoleKpis';
import { PermissionsToolbar } from './PermissionsToolbar';
import { PermissionsTopBar } from './PermissionsTopBar';

export function PermissionsView() {
  const {
    permissions,
    loading,
    error,
    updatePermission,
    refreshPermissions,
  } = usePermissions();
  const { profile } = useUserProfile();
  const { users, loadUsers } = useCompanyUsers();

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<PermissionFilterId>('all');
  const [search, setSearch] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    permission: RolePermission | null;
    isEnabling: boolean;
    onConfirm: () => void;
  }>({
    open: false,
    permission: null,
    isEnabling: false,
    onConfirm: () => {},
  });

  const managedRoles = profile ? getManagedRoles(profile.role) : [];

  const sections = useMemo(() => buildMatrix(permissions), [permissions]);
  const filterCounts = useMemo(() => sectionCounts(sections), [sections]);
  const visibleSections = useMemo(
    () => filterMatrix(sections, filter, search),
    [sections, filter, search],
  );
  const displayedCount = countDisplayedRows(visibleSections);
  const modules = countModules(sections);
  const userBuckets = useMemo(() => bucketUsersByRole(users), [users]);
  const roleKpis = useMemo(
    () => buildRoleKpis(permissions, userBuckets),
    [permissions, userBuckets],
  );

  useEffect(() => {
    if (!profile?.company_id) return;
    void loadUsers(undefined, undefined, false);
  }, [profile?.company_id, loadUsers]);

  const runUpdate = async (permission: RolePermission, newValue: boolean) => {
    try {
      setUpdatingId(permission.id);
      setSaving(true);
      await updatePermission(permission.id, newValue);
      toast.success('Permissão atualizada');
      try {
        await logAudit({
          action: 'permissions.updated',
          resource: 'permission',
          resourceId: permission.id,
          meta: { enabled: newValue, key: permission.permission_key, role: permission.role },
        });
      } catch {
        /* soft */
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar';
      toast.error(message);
      throw err;
    } finally {
      setUpdatingId(null);
      setSaving(false);
    }
  };

  const handlePermissionToggle = (
    permissionId: string,
    _permissionKey: string,
    _role: ColumnRole,
    newValue: boolean,
  ) => {
    const permission = permissions.find((p) => p.id === permissionId);
    if (!permission) return;

    setConfirmDialog({
      open: true,
      permission,
      isEnabling: newValue,
      onConfirm: async () => {
        try {
          await runUpdate(permission, newValue);
        } finally {
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  };

  const handleBulk = async (sectionId: string, role: ColumnRole, enable: boolean) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section || !profile) return;

    const targets: RolePermission[] = [];
    for (const row of section.rows) {
      if (!canToggleRole(profile.role, role, managedRoles, row.permissionKey)) continue;
      const perm = row.byRole[role];
      if (!perm) continue;
      if (perm.is_enabled === enable) continue;
      targets.push(perm);
    }

    if (targets.length === 0) {
      toast.message(enable ? 'Nada para marcar' : 'Nada para desmarcar');
      return;
    }

    setSaving(true);
    try {
      for (const perm of targets) {
        setUpdatingId(perm.id);
        await updatePermission(perm.id, enable);
        try {
          await logAudit({
            action: 'permissions.updated',
            resource: 'permission',
            resourceId: perm.id,
            meta: {
              enabled: enable,
              key: perm.permission_key,
              role: perm.role,
              bulk: true,
            },
          });
        } catch {
          /* soft */
        }
      }
      toast.success(
        enable
          ? `${targets.length} permissão(ões) marcadas`
          : `${targets.length} permissão(ões) desmarcadas`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro no lote';
      toast.error(message);
    } finally {
      setUpdatingId(null);
      setSaving(false);
    }
  };

  const handleAudit = () => {
    toast.message('Auditoria de permissões em breve', {
      description: 'As alterações já são registradas em audit_logs.',
    });
  };

  const handleRestore = () => {
    toast.message('Restaurar padrão em breve', {
      description: 'Use os toggles da matriz ou “marcar/desmarcar todos” por módulo.',
    });
  };

  const handleSave = () => {
    toast.success('Permissões salvas', {
      description: 'Cada alteração já é gravada ao confirmar o toggle.',
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center bg-[#F7F5F0] dark:bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (profile && !canAccessPermissionsModule(profile.role)) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center bg-[#F7F5F0] dark:bg-background p-6">
        <Alert className="max-w-md border-border bg-card">
          <Lock className="h-4 w-4" />
          <AlertDescription className="text-muted-foreground">
            Apenas administradores e gestores podem configurar permissões de outros perfis.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center bg-[#F7F5F0] dark:bg-background p-6">
        <div className="max-w-md w-full rounded-2xl border border-destructive/30 bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-6 w-6 text-destructive" />
            <h3 className="text-lg font-semibold text-foreground">Erro ao carregar</h3>
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => void refreshPermissions()} className="w-full rounded-xl">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col min-w-0">
      <div className="border-b border-border/70">
        <div className="px-3 py-2 sm:px-5 sm:py-3 md:py-4">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm px-3 py-2 space-y-2 sm:px-4 sm:py-3 sm:space-y-3 md:px-6 md:py-4 md:space-y-4">
            <PermissionsTopBar />
            <PermissionsToolbar
              saving={saving}
              onAudit={handleAudit}
              onRestore={handleRestore}
              onSave={handleSave}
            />
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background">
        <PermissionsRoleKpis items={roleKpis} />

        <PermissionsMatrixCard
          sections={visibleSections}
          allSections={sections}
          filterCounts={filterCounts}
          filter={filter}
          search={search}
          displayedCount={displayedCount}
          moduleCount={modules}
          currentUserRole={profile?.role}
          managedRoles={managedRoles}
          updatingId={updatingId}
          onFilterChange={setFilter}
          onSearchChange={setSearch}
          onToggle={handlePermissionToggle}
          onBulk={(sectionId, role, enable) => void handleBulk(sectionId, role, enable)}
        />
      </div>

      <PermissionConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        onConfirm={confirmDialog.onConfirm}
        permission={confirmDialog.permission}
        isEnabling={confirmDialog.isEnabling}
      />
    </div>
  );
}

export default PermissionsView;
