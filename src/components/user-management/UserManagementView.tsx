import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Loader2, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUserProfile, type UserProfile } from '@/hooks/useUserProfile';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdge } from '@/integrations/supabase/invoke';
import { logAudit } from '@/lib/audit/logger';
import { toast } from 'sonner';
import { CreateUserDialog, type CreateUserForm } from './CreateUserDialog';
import { EditUserDialog, type EditUserForm } from './EditUserDialog';
import type { CompanyUser, UserRole } from './helpers';
import { UserFilterToolbar } from './UserFilterToolbar';
import { UserList } from './UserList';
import { UserManagementHeader } from './UserManagementHeader';
import { UserMetricsCards } from './UserMetricsCards';
import { UserSettingsDialog } from './UserSettingsDialog';

type RoleFilter = 'all' | 'admin' | 'gestor' | 'corretor';

export function UserManagementView() {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const DEFAULT_TEMP_PASSWORD =
    (import.meta as any).env?.VITE_DEFAULT_NEW_USER_PASSWORD || 'Imobi@1234';

  const fetchUsers = async (search: string, roleFilter: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('list_company_users', {
        target_company_id: null,
        search: search || null,
        roles: roleFilter === 'all' ? null : [roleFilter],
        limit_count: 50,
        offset_count: 0,
      });
      if (error) throw error;
      setUsers((data as CompanyUser[]) || []);
    } catch (err) {
      console.error('Erro ao listar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  useEffect(() => {
    fetchUsers(searchTerm, roleFilter);
  }, [searchTerm, roleFilter]);

  const {
    isManager,
    isAdmin,
    loading: profileLoading,
    deactivateUser,
    activateUser,
    deleteUser,
    createNewUser,
  } = useUserProfile();
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | CompanyUser | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState<{ chat_instance: string } | null>(null);
  const [instances, setInstances] = useState<{ label: string; key: string }[]>([]);
  const { instances: waInstances } = useWhatsAppInstances();

  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: '',
    password: DEFAULT_TEMP_PASSWORD,
    full_name: '',
    role: 'corretor',
    department: '',
    phone: '',
  });

  if (profileLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-3 text-sm">Carregando perfil...</span>
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="p-4 sm:p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Você não tem permissão para acessar o gerenciamento de usuários.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const filteredUsers = users.filter((user) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      user.full_name.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      user.phone?.toLowerCase().includes(q);

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const canViewUser = isAdmin || user.role !== 'admin';

    return matchesSearch && matchesRole && canViewUser;
  });

  const handleSaveUserEdit = async () => {
    if (!selectedUser || !editForm) return;

    const loadingToast = toast.loading('Salvando alterações do usuário...');

    try {
      const updates: Record<string, unknown> = {
        user_id: selectedUser.id,
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone,
      };
      if (isAdmin) {
        updates.role = editForm.role;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessão inválida para atualizar usuário');

      const { data: fnData, error: fnError } = await invokeEdge<typeof updates, any>(
        'admin-update-user',
        { body: updates },
      );

      if (fnError) {
        throw new Error(fnError.message || 'Falha ao atualizar usuário');
      }
      if ((fnData as any)?.error) {
        throw new Error((fnData as any).error);
      }

      try {
        await logAudit({
          action: 'user.profile_updated',
          resource: 'user_profile',
          resourceId: selectedUser.id,
          meta: updates,
        });
      } catch {
        /* audit best-effort */
      }

      await fetchUsers(searchTerm, roleFilter);

      toast.dismiss(loadingToast);
      toast.success('Usuário atualizado com sucesso!', {
        description: `${editForm.full_name} foi atualizado e sincronizado.`,
      });

      setShowEditModal(false);
      setSelectedUser(null);
      setEditForm(null);
      setError(null);
    } catch (e: any) {
      toast.dismiss(loadingToast);
      toast.error('Erro ao atualizar usuário', {
        description: e.message || 'Erro ao salvar alterações',
      });
      setError(e.message || 'Erro ao salvar alterações');
    }
  };

  const loadChatInstances = async () => {
    try {
      const options = (waInstances || []).map((inst: any) => ({
        label: (inst.name || inst.instance_name || inst.profile_name || '').toString(),
        key: String(inst.instance_name || inst.name || '')
          .trim()
          .toLowerCase(),
      }));
      setInstances(options);
    } catch (e) {
      console.error('Erro ao carregar instâncias de chat:', e);
      setInstances([]);
    }
  };

  const openSettings = async (user: CompanyUser) => {
    setSelectedUser(user as UserProfile);
    await loadChatInstances();
    const opts = (waInstances || []).map((inst: any) => ({
      label: (inst.name || inst.instance_name || inst.profile_name || '').toString(),
      key: String(inst.instance_name || inst.name || '')
        .trim()
        .toLowerCase(),
    }));
    const raw = (user.chat_instance || '').toString();
    const normalized = raw.trim().toLowerCase();
    const match = opts.find(
      (i) => i.key === normalized || i.label.trim().toLowerCase() === normalized,
    );
    setSettingsForm({ chat_instance: match ? match.key : '' });
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    if (!selectedUser || !settingsForm) return;
    const loadingToast = toast.loading('Salvando definições...');
    try {
      const normalizedInstance =
        (settingsForm.chat_instance || '').toString().trim().toLowerCase() || null;
      const updatePayload = { chat_instance: normalizedInstance } as any;

      const candidateIds = [
        selectedUser.id,
        (selectedUser as any)?.user_id,
        (selectedUser as any)?.profile_id,
        (selectedUser as any)?.auth_user_id,
      ]
        .map((v) => (v ? String(v) : ''))
        .filter((v, idx, arr) => !!v && arr.indexOf(v) === idx);

      if (candidateIds.length === 0) {
        throw new Error('Perfil de usuário não encontrado para atualização (id).');
      }

      let updated = false;
      let lastErr: any = null;
      for (const uid of candidateIds) {
        const { data, error: updateError } = await supabase
          .from('user_profiles')
          .update(updatePayload)
          .eq('id', uid)
          .select('id');
        if (updateError) {
          lastErr = updateError;
          continue;
        }
        if (data && data.length > 0) {
          updated = true;
          break;
        }
      }

      if (!updated) {
        if (lastErr) throw lastErr;
        throw new Error('Perfil de usuário não encontrado para atualização (id).');
      }

      try {
        await logAudit({
          action: 'user.settings_updated',
          resource: 'user_profile',
          resourceId: selectedUser.id,
          meta: { chat_instance: settingsForm.chat_instance },
        });
      } catch {
        /* audit best-effort */
      }
      await fetchUsers(searchTerm, roleFilter);
      toast.dismiss(loadingToast);
      toast.success('Definições salvas!', {
        description: 'Instância de chat atribuída com sucesso.',
      });
      setShowSettingsModal(false);
    } catch (e: any) {
      toast.dismiss(loadingToast);
      toast.error('Erro ao salvar definições', {
        description: e.message || 'Falha ao salvar',
      });
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (!window.confirm('Tem certeza que deseja desativar este usuário?')) return;
    const loadingToast = toast.loading('Desativando usuário...');

    try {
      await deactivateUser(userId);
      try {
        await logAudit({
          action: 'user.deactivated',
          resource: 'user_profile',
          resourceId: userId,
          meta: null,
        });
      } catch {
        /* audit best-effort */
      }
      await fetchUsers(searchTerm, roleFilter);

      toast.dismiss(loadingToast);
      toast.success('Usuário desativado com sucesso!', {
        description: 'O usuário foi desativado e não poderá mais acessar o sistema.',
      });
      setError(null);
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error('Erro ao desativar usuário', {
        description: err.message || 'Falha na operação',
      });
      setError(err.message);
    }
  };

  const handleActivateUser = async (userId: string) => {
    if (!window.confirm('Deseja reativar este usuário?')) return;
    const loadingToast = toast.loading('Reativando usuário...');

    try {
      await activateUser(userId);
      try {
        await logAudit({
          action: 'user.activated',
          resource: 'user_profile',
          resourceId: userId,
          meta: null,
        });
      } catch {
        /* audit best-effort */
      }
      await fetchUsers(searchTerm, roleFilter);

      toast.dismiss(loadingToast);
      toast.success('Usuário reativado com sucesso!', {
        description: 'O usuário foi reativado e pode acessar o sistema novamente.',
      });
      setError(null);
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error('Erro ao reativar usuário', {
        description: err.message || 'Falha na operação',
      });
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmMessage = `ATENÇÃO: Esta ação é irreversível!\n\nVocê está prestes a DELETAR PERMANENTEMENTE o usuário "${userName}".\n\n✓ O usuário será removido de ambas as tabelas (user_profiles e auth.users)\n✓ Todos os leads vinculados a ele serão desvinculados\n✓ Esta operação NÃO pode ser desfeita\n\nTem certeza que deseja prosseguir?`;

    if (!window.confirm(confirmMessage)) return;
    const loadingToast = toast.loading('Deletando usuário permanentemente...');

    try {
      await deleteUser(userId);
      try {
        await logAudit({
          action: 'user.deleted',
          resource: 'user_profile',
          resourceId: userId,
          meta: { deleted_user: userName, leads_unlinked: true },
        });
      } catch {
        /* audit best-effort */
      }

      await fetchUsers(searchTerm, roleFilter);

      toast.dismiss(loadingToast);
      toast.success('Usuário deletado permanentemente!', {
        description: `${userName} foi removido do sistema e leads foram desvinculados.`,
        duration: 6000,
      });
      setError(null);
    } catch (err: any) {
      toast.dismiss(loadingToast);
      const raw = err?.message || '';
      const friendly =
        /foreign key|violates foreign key|audit_logs_actor_id|user_profiles/i.test(raw)
          ? 'Não foi possível excluir o usuário porque ainda existem registros vinculados a ele. Desative e tente novamente, ou contate o suporte.'
          : raw || 'Falha na operação de exclusão';
      toast.error('Erro ao deletar usuário', { description: friendly });
      setError(friendly);
    }
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();

    if (!createForm.email.trim() || !createForm.full_name.trim()) {
      toast.error('Campos obrigatórios', {
        description: 'Email e nome são obrigatórios',
      });
      setError('Email e nome são obrigatórios');
      return;
    }

    if (createForm.password.length < 6) {
      toast.error('Senha muito curta', {
        description: 'Senha deve ter pelo menos 6 caracteres',
      });
      setError('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    setCreateLoading(true);
    const loadingToast = toast.loading('Criando novo usuário...');

    try {
      await createNewUser(createForm);
      try {
        await logAudit({
          action: 'user.created',
          resource: 'user_profile',
          resourceId: undefined,
          meta: { email: createForm.email, role: createForm.role },
        });
      } catch {
        /* audit best-effort */
      }
      await fetchUsers(searchTerm, roleFilter);

      toast.dismiss(loadingToast);
      toast.success('Usuário criado com sucesso!', {
        description: `${createForm.full_name} foi criado e pode fazer login.`,
        duration: 5000,
      });

      setShowCreateModal(false);
      setCreateForm({
        email: '',
        password: DEFAULT_TEMP_PASSWORD,
        full_name: '',
        role: 'corretor',
        department: '',
        phone: '',
      });
      setError(null);
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error('Erro ao criar usuário', {
        description: err.message || 'Falha na criação do usuário',
      });
      setError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const updateCreateForm = (field: keyof CreateUserForm, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreateForm({
      email: '',
      password: DEFAULT_TEMP_PASSWORD,
      full_name: '',
      role: 'corretor',
      department: '',
      phone: '',
    });
    setError(null);
  };

  const openEdit = (user: CompanyUser) => {
    setSelectedUser(user as UserProfile);
    setEditForm({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: (user.role || 'corretor') as UserRole,
    });
    setShowEditModal(true);
  };

  const visibleUsers = users.filter((u) => isAdmin || u.role !== 'admin');

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-1 pb-6 sm:px-0">
      <UserManagementHeader
        canCreate={isAdmin || isManager}
        loading={loading}
        onCreate={() => setShowCreateModal(true)}
        onRefresh={() => fetchUsers(searchTerm, roleFilter)}
      />

      <UserMetricsCards users={visibleUsers} isAdmin={isAdmin} />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <UserFilterToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          users={visibleUsers}
          isAdmin={isAdmin}
        />

        <UserList
          users={visibleUsers}
          filteredUsers={filteredUsers}
          loading={loading}
          actions={{
            canManage: isAdmin || isManager,
            onSettings: openSettings,
            onEdit: openEdit,
            onDeactivate: handleDeactivateUser,
            onActivate: handleActivateUser,
            onDelete: handleDeleteUser,
          }}
        />
      </div>

      <EditUserDialog
        open={showEditModal}
        onOpenChange={setShowEditModal}
        userName={selectedUser?.full_name}
        form={editForm}
        onFormChange={setEditForm}
        isAdmin={isAdmin}
        error={error}
        onSave={handleSaveUserEdit}
      />

      <CreateUserDialog
        open={showCreateModal}
        onClose={handleCloseCreateModal}
        form={createForm}
        onFieldChange={updateCreateForm}
        isAdmin={isAdmin}
        isManager={isManager}
        loading={createLoading}
        error={error}
        onSubmit={handleCreateUser}
      />

      <UserSettingsDialog
        open={showSettingsModal}
        onOpenChange={setShowSettingsModal}
        instances={instances}
        chatInstance={settingsForm?.chat_instance || ''}
        onChatInstanceChange={(v) =>
          setSettingsForm((prev) => (prev ? { ...prev, chat_instance: v } : prev))
        }
        onSave={handleSaveSettings}
      />
    </div>
  );
}
