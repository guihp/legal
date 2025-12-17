import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit, 
  Search,
  Crown,
  Shield,
  User,
  Mail,
  Phone,
  Building,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MoreVertical,
  UserX,
  RefreshCw,
  Settings
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useUserProfile, UserProfile } from '@/hooks/useUserProfile';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdge } from '@/integrations/supabase/invoke';
import { logAudit } from '@/lib/audit/logger';
import { toast } from 'sonner';

export function UserManagementView() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const DEFAULT_TEMP_PASSWORD = (import.meta as any).env?.VITE_DEFAULT_NEW_USER_PASSWORD || 'Imobi@1234';

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
      setUsers(data || []);
    } catch (err) {
      console.error('Erro ao listar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  useEffect(() => { fetchUsers(searchTerm, roleFilter); }, [searchTerm, roleFilter]);

  // TODOS OS HOOKS DEVEM VIR PRIMEIRO - NUNCA APÓS RETURNS CONDICIONAIS
  const { profile, isManager, isAdmin, loading: profileLoading, deactivateUser, activateUser, deleteUser, createNewUser } = useUserProfile();
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState<{ full_name: string; email: string; phone: string; role: 'corretor' | 'gestor' | 'admin' } | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState<{ chat_instance: string } | null>(null);
  const [instances, setInstances] = useState<{ label: string; key: string }[]>([]);
  const { instances: waInstances } = useWhatsAppInstances();
  
  // Dados do formulário de criação
  const [createForm, setCreateForm] = useState({
    email: '',
    password: DEFAULT_TEMP_PASSWORD,
    full_name: '',
    role: 'corretor' as 'corretor' | 'gestor' | 'admin',
    department: '',
    phone: ''
  });

  // Removido: loadUsers/getCompanyUsers (uso substituído por RPC)


  // Aguardar carregamento do perfil antes de verificar permissões
  if (profileLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-400">Carregando perfil...</span>
      </div>
    );
  }

  // Verificar permissões APÓS carregamento do perfil
  if (!isManager) {
    return (
      <div className="p-6">
        <Alert className="bg-red-900/30 border-red-500/60">
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-red-200">
            Você não tem permissão para acessar o gerenciamento de usuários.
            <br />
            <small className="text-gray-400 mt-2 block">
              Perfil: {profile?.email || 'N/A'} | Role: {profile?.role || 'N/A'} | IsManager: {isManager ? 'Sim' : 'Não'}
            </small>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Filtrar usuários (origem: estado `users` preenchido via RPC)
  const filteredUsers = (users as any[]).filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.phone?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    // Restrição: Gestores não podem visualizar usuários Admin
    const canViewUser = isAdmin || user.role !== 'admin';

    return matchesSearch && matchesRole && canViewUser;
  });

  // Salvar edição do usuário
  const handleSaveUserEdit = async () => {
    if (!selectedUser || !editForm) return;
    
    const loadingToast = toast.loading('Salvando alterações do usuário...');
    
    try {
      const updates: any = {
        user_id: selectedUser.id,
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone,
      };
      if (isAdmin) {
        updates.role = editForm.role;
      }

      // Usar Edge Function para sincronizar auth.users e user_profiles
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessão inválida para atualizar usuário');

      const { data: fnData, error: fnError } = await invokeEdge<typeof updates, any>('admin-update-user', { body: updates });

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
          meta: updates 
        }); 
      } catch {}
      
      await fetchUsers(searchTerm, roleFilter);
      
      toast.dismiss(loadingToast);
      toast.success('✅ Usuário atualizado com sucesso!', {
        description: `${editForm.full_name} foi atualizado e sincronizado.`
      });
      
      setShowEditModal(false);
      setSelectedUser(null);
      setEditForm(null);
      setError(null); // Limpar erro anterior
    } catch (e: any) {
      toast.dismiss(loadingToast);
      toast.error('❌ Erro ao atualizar usuário', {
        description: e.message || 'Erro ao salvar alterações'
      });
      setError(e.message || 'Erro ao salvar alterações');
    }
  };

  // Carregar instâncias de chat disponíveis usando a mesma fonte do menu Conexões
  const loadChatInstances = async () => {
    try {
      const options = (waInstances || []).map((inst: any) => ({
        label: (inst.name || inst.instance_name || inst.profile_name || '').toString(),
        key: String(inst.instance_name || inst.name || '').trim().toLowerCase(),
      }));
      setInstances(options);
    } catch (e) {
      console.error('Erro ao carregar instâncias de chat:', e);
      setInstances([]);
    }
  };

  // Abrir modal de definições
  const openSettings = async (user: any) => {
    setSelectedUser(user);
    // Normalizar valor salvo (pode ter sido rótulo). Tentar mapear para a key
    await loadChatInstances();
    const opts = (waInstances || []).map((inst: any) => ({
      label: (inst.name || inst.instance_name || inst.profile_name || '').toString(),
      key: String(inst.instance_name || inst.name || '').trim().toLowerCase(),
    }));
    const raw = (user.chat_instance || '').toString();
    const normalized = raw.trim().toLowerCase();
    const match = opts.find(i => i.key === normalized || i.label.trim().toLowerCase() === normalized);
    setSettingsForm({ chat_instance: match ? match.key : '' });
    setShowSettingsModal(true);
  };

  // Salvar definições (chat_instance)
  const handleSaveSettings = async () => {
    if (!selectedUser || !settingsForm) return;
    const loadingToast = toast.loading('Salvando definições...');
    try {
      const normalizedInstance = (settingsForm.chat_instance || '').toString().trim().toLowerCase() || null;
      const updatePayload = { chat_instance: normalizedInstance } as any;

      // Tentar identificar corretamente o ID do user_profile
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
        const { data, error } = await supabase
          .from('user_profiles')
          .update(updatePayload)
          .eq('id', uid)
          .select('id');
        if (error) {
          lastErr = error;
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

      try { await logAudit({ action: 'user.settings_updated', resource: 'user_profile', resourceId: selectedUser.id, meta: { chat_instance: settingsForm.chat_instance } }); } catch {}
      await fetchUsers(searchTerm, roleFilter);
      toast.dismiss(loadingToast);
      toast.success('✅ Definições salvas!', { description: 'Instância de chat atribuída com sucesso.' });
      setShowSettingsModal(false);
    } catch (e: any) {
      toast.dismiss(loadingToast);
      toast.error('❌ Erro ao salvar definições', { description: e.message || 'Falha ao salvar' });
    }
  };

  // Desativar usuário
  const handleDeactivateUser = async (userId: string) => {
    if (window.confirm('Tem certeza que deseja desativar este usuário?')) {
      const loadingToast = toast.loading('Desativando usuário...');
      
      try {
        await deactivateUser(userId);
        try { await logAudit({ action: 'user.deactivated', resource: 'user_profile', resourceId: userId, meta: null }); } catch {}
        await fetchUsers(searchTerm, roleFilter);
        
        toast.dismiss(loadingToast);
        toast.success('✅ Usuário desativado com sucesso!', {
          description: 'O usuário foi desativado e não poderá mais acessar o sistema.'
        });
        
        setError(null);
      } catch (error: any) {
        toast.dismiss(loadingToast);
        toast.error('❌ Erro ao desativar usuário', {
          description: error.message || 'Falha na operação'
        });
        setError(error.message);
      }
    }
  };

  // Reativar usuário
  const handleActivateUser = async (userId: string) => {
    if (window.confirm('Deseja reativar este usuário?')) {
      const loadingToast = toast.loading('Reativando usuário...');
      
      try {
        await activateUser(userId);
        try { await logAudit({ action: 'user.activated', resource: 'user_profile', resourceId: userId, meta: null }); } catch {}
        await fetchUsers(searchTerm, roleFilter);
        
        toast.dismiss(loadingToast);
        toast.success('✅ Usuário reativado com sucesso!', {
          description: 'O usuário foi reativado e pode acessar o sistema novamente.'
        });
        
        setError(null);
      } catch (error: any) {
        toast.dismiss(loadingToast);
        toast.error('❌ Erro ao reativar usuário', {
          description: error.message || 'Falha na operação'
        });
        setError(error.message);
      }
    }
  };

  // Deletar usuário completamente (apenas inativos)
  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmMessage = `⚠️ ATENÇÃO: Esta ação é irreversível!\n\nVocê está prestes a DELETAR PERMANENTEMENTE o usuário "${userName}".\n\n✓ O usuário será removido de ambas as tabelas (user_profiles e auth.users)\n✓ Todos os leads vinculados a ele serão desvinculados\n✓ Esta operação NÃO pode ser desfeita\n\nTem certeza que deseja prosseguir?`;
    
    if (window.confirm(confirmMessage)) {
      const loadingToast = toast.loading('Deletando usuário permanentemente...');
      
      try {
        const result = await deleteUser(userId);
        try { 
          await logAudit({ 
            action: 'user.deleted', 
            resource: 'user_profile', 
            resourceId: userId, 
            meta: { deleted_user: userName, leads_unlinked: true } 
          }); 
        } catch {}
        
        await fetchUsers(searchTerm, roleFilter);
        
        toast.dismiss(loadingToast);
        toast.success('✅ Usuário deletado permanentemente!', {
          description: `${userName} foi removido do sistema e leads foram desvinculados.`,
          duration: 6000
        });
        
        setError(null);
      } catch (error: any) {
        toast.dismiss(loadingToast);
        toast.error('❌ Erro ao deletar usuário', {
          description: error.message || 'Falha na operação de exclusão'
        });
        setError(error.message);
      }
    }
  };

  // Criar novo usuário
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações básicas
    if (!createForm.email.trim() || !createForm.full_name.trim()) {
      toast.error('❌ Campos obrigatórios', {
        description: 'Email e nome são obrigatórios'
      });
      setError('Email, senha e nome são obrigatórios');
      return;
    }

    if (createForm.password.length < 6) {
      toast.error('❌ Senha muito curta', {
        description: 'Senha deve ter pelo menos 6 caracteres'
      });
      setError('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    setCreateLoading(true);
    const loadingToast = toast.loading('Criando novo usuário...');
    
    try {
      await createNewUser(createForm);
      try { await logAudit({ action: 'user.created', resource: 'user_profile', resourceId: undefined, meta: { email: createForm.email, role: createForm.role } }); } catch {}
      await fetchUsers(searchTerm, roleFilter);
      
      toast.dismiss(loadingToast);
      toast.success('✅ Usuário criado com sucesso!', {
        description: `${createForm.full_name} foi criado e pode fazer login.`,
        duration: 5000
      });
      
      setShowCreateModal(false);
      
      // Resetar formulário
      setCreateForm({
        email: '',
        password: DEFAULT_TEMP_PASSWORD,
        full_name: '',
        role: 'corretor',
        department: '',
        phone: ''
      });
      
      setError(null);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error('❌ Erro ao criar usuário', {
        description: error.message || 'Falha na criação do usuário'
      });
      setError(error.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Atualizar campo do formulário de criação
  const updateCreateForm = (field: string, value: string) => {
    setCreateForm(prev => ({ ...prev, [field]: value }));
  };

  // Resetar formulário ao fechar modal
  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreateForm({
      email: '',
      password: DEFAULT_TEMP_PASSWORD,
      full_name: '',
      role: 'corretor',
      department: '',
      phone: ''
    });
    setError(null);
  };

  // Obter ícone do role
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Crown;
      case 'gestor': return Shield;
      case 'corretor': return User;
      default: return User;
    }
  };

  // Obter cor do role
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'gestor': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'corretor': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  // Traduzir role
  const translateRole = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'gestor': return 'Gestor';
      case 'corretor': return 'Corretor';
      default: return role;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Gerenciamento de Usuários</h2>
          <p className="text-gray-400 mt-1">
            Gerencie todos os usuários do sistema
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {(isAdmin || isManager) && (
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Usuário
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => fetchUsers(searchTerm, roleFilter)}
            disabled={loading}
            className="border-gray-600 text-green-400 hover:bg-gray-800 hover:text-green-300"
          >
            <Users className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{users.length}</p>
                <p className="text-sm text-gray-400">Total de Usuários</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Shield className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {users.filter(u => u.role === 'gestor').length}
                </p>
                <p className="text-sm text-gray-400">Gestores</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <User className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {users.filter(u => u.role === 'corretor').length}
                </p>
                <p className="text-sm text-gray-400">Corretores</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Crown className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {users.filter(u => u.role === 'admin').length}
                  </p>
                  <p className="text-sm text-gray-400">Administradores</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filtros */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Pesquisar usuários..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-900/50 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40 bg-gray-900/50 border-gray-600 text-white">
                <SelectValue placeholder="Hierarquia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {isAdmin && <SelectItem value="admin">Administradores</SelectItem>}
                <SelectItem value="gestor">Gestores</SelectItem>
                <SelectItem value="corretor">Corretores</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Usuários */}
      {error && (
        <Alert className="bg-red-900/30 border-red-500/60">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-red-200">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <Card className="bg-gray-800/50 border-gray-700">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700 hover:bg-gray-800/50">
                <TableHead className="text-gray-300">Usuário</TableHead>
                <TableHead className="text-gray-300">Hierarquia</TableHead>
                <TableHead className="text-gray-300">Contato</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Criado em</TableHead>
                {(isAdmin || isManager) && <TableHead className="text-gray-300">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {filteredUsers.map((user) => {
                  const RoleIcon = getRoleIcon(user.role);
                  return (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-gray-700 hover:bg-gray-800/30"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {user.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-white">{user.full_name}</p>
                            <p className="text-sm text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge className={`${getRoleColor(user.role)} border`}>
                          <RoleIcon className="h-3 w-3 mr-1" />
                          {translateRole(user.role)}
                        </Badge>
                      </TableCell>
                      
                      <TableCell className="text-gray-300">
                        {user.phone || '-'}
                      </TableCell>
                      
                      <TableCell>
                        <Badge className={user.is_active 
                          ? "bg-green-500/20 text-green-400 border-green-500/30" 
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                        }>
                          {user.is_active ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Ativo
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Inativo
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      
                      <TableCell className="text-gray-300">
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      
                      {(isAdmin || isManager) && (
                        <TableCell>
              <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4 text-white" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openSettings(user)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Definições
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setSelectedUser(user);
                    setEditForm({
                      full_name: user.full_name || '',
                      email: user.email || '',
                      phone: user.phone || '',
                      role: (user.role || 'corretor') as 'corretor' | 'gestor' | 'admin',
                    });
                    setShowEditModal(true);
                  }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                              {(isAdmin || isManager) && (
                                user.is_active ? (
                                  <DropdownMenuItem 
                                    onClick={() => handleDeactivateUser(user.id)}
                                    className="text-red-400 hover:text-red-300"
                                  >
                                    <UserX className="h-4 w-4 mr-2" />
                                    Desativar
                                  </DropdownMenuItem>
                                ) : (
                                  <>
                                    <DropdownMenuItem 
                                      onClick={() => handleActivateUser(user.id)}
                                      className="text-emerald-400 hover:text-emerald-300"
                                    >
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      Reativar
                                    </DropdownMenuItem>
                                    {(isAdmin || isManager) && (
                                      <DropdownMenuItem 
                                        onClick={() => handleDeleteUser(user.id, user.full_name)}
                                        className="text-red-600 hover:text-red-500"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Deletar Permanentemente
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Nenhum usuário encontrado</h3>
              <p className="text-gray-400">
                {users.length === 0 
                  ? 'Nenhum usuário cadastrado na empresa'
                  : 'Nenhum usuário corresponde aos filtros aplicados'
                }
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Modal para editar usuário */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Editar Usuário</DialogTitle>
            <DialogDescription className="text-gray-400">
              Atualize os dados de {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Nome Completo</Label>
              <Input
                value={editForm?.full_name || ''}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, full_name: e.target.value } : prev)}
                className="bg-gray-800/50 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Email</Label>
              <Input
                type="email"
                value={editForm?.email || ''}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, email: e.target.value } : prev)}
                className="bg-gray-800/50 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Telefone</Label>
              <Input
                value={editForm?.phone || ''}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, phone: e.target.value } : prev)}
                className="bg-gray-800/50 border-gray-600 text-white"
              />
            </div>
            {isAdmin && (
              <div>
                <Label className="text-gray-300">Hierarquia</Label>
                <Select value={editForm?.role || 'corretor'} onValueChange={(value: any) => setEditForm(prev => prev ? { ...prev, role: value } : prev)}>
                  <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corretor">Corretor</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setShowEditModal(false)}
              className="border-gray-600 text-red-500 hover:bg-gray-800 hover:text-red-400"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveUserEdit}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Edit className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para criar usuário */}
      <Dialog open={showCreateModal} onOpenChange={handleCloseCreateModal}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Criar Novo Usuário</DialogTitle>
            <DialogDescription className="text-gray-400">
              Adicione um novo usuário ao sistema
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateUser} className="space-y-4">
            {/* Nome completo */}
            <div>
              <Label htmlFor="full_name" className="text-gray-300">Nome Completo *</Label>
              <Input
                id="full_name"
                type="text"
                value={createForm.full_name}
                onChange={(e) => updateCreateForm('full_name', e.target.value)}
                placeholder="Digite o nome completo"
                className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                required
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-gray-300">Email *</Label>
              <Input
                id="email"
                type="email"
                value={createForm.email}
                onChange={(e) => updateCreateForm('email', e.target.value)}
                placeholder="usuario@exemplo.com"
                className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                required
              />
            </div>

            {/* Senha temporária (padrão configurável) */}
            <div>
              <Label htmlFor="password" className="text-gray-300">Senha Temporária</Label>
              <Input
                id="password"
                type="text"
                value={createForm.password}
                onChange={(e) => updateCreateForm('password', e.target.value)}
                placeholder="Senha padrão para novos usuários"
                className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                minLength={6}
              />
            </div>

            {/* Cargo */}
            <div>
              <Label htmlFor="role" className="text-gray-300">Cargo *</Label>
              <Select value={createForm.role} onValueChange={(value: any) => updateCreateForm('role', value)}>
                <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Gestor pode criar corretores e gestores */}
                  <SelectItem value="corretor">Corretor</SelectItem>
                  {(isManager || isAdmin) && <SelectItem value="gestor">Gestor</SelectItem>}
                  {isAdmin && <SelectItem value="admin">Administrador</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Departamento removido */}

            {/* Telefone */}
            <div>
              <Label htmlFor="phone" className="text-gray-300">Telefone</Label>
              <Input
                id="phone"
                type="tel"
                value={createForm.phone}
                onChange={(e) => updateCreateForm('phone', e.target.value)}
                placeholder="(11) 99999-9999"
                className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
              />
            </div>

            {/* Erro */}
            {error && (
              <Alert className="bg-red-900/30 border-red-500/60">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-red-200">
                  {error}
                </AlertDescription>
              </Alert>
            )}
            
            {/* Botões */}
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button"
                variant="outline" 
                onClick={handleCloseCreateModal}
                className="border-gray-600 text-red-500 hover:bg-gray-800 hover:text-red-400"
                disabled={createLoading}
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                disabled={createLoading}
              >
                {createLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Usuário
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Definições de Usuário */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Definições do Usuário</DialogTitle>
            <DialogDescription className="text-gray-400">
              Atribua instância de chat e outras integrações
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Instância de Chat</Label>
              <Select 
                value={settingsForm?.chat_instance || ''}
                onValueChange={(v) => setSettingsForm(prev => prev ? { ...prev, chat_instance: v } : prev)}
              >
                <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white mt-1">
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map(inst => (
                    <SelectItem key={inst.key} value={inst.key}>{inst.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-gray-500 border-t border-gray-700 pt-3">
              Em breve: atribuição de conexões, agendas e outras integrações.
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setShowSettingsModal(false)}
              className="border-gray-600 text-red-500 hover:bg-gray-800 hover:text-red-400"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveSettings}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 