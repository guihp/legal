import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { validatePermissionChange, getManagedRoles, canAccessPermissionsModule } from '@/lib/permissions/rules';

export interface RolePermission {
  id: string;
  role: 'corretor' | 'gestor' | 'admin';
  permission_key: string;
  permission_name: string;
  category: string;
  description?: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function usePermissions() {
  const { profile, isAdmin } = useUserProfile();
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache das permissões do usuário para consulta rápida
  const userPermissions = useMemo(() => {
    if (!profile) return {};
    
    const userPerms = permissions.filter(p => p.role === profile.role);
    const permsMap: Record<string, boolean> = {};
    userPerms.forEach(perm => {
      permsMap[perm.permission_key] = perm.is_enabled;
    });
    return permsMap;
  }, [permissions, profile]);

  // Carregar apenas permissões necessárias baseado na nova hierarquia
  const loadPermissions = useCallback(async () => {
    try {
      if (!profile) {
        console.log('🔐 DEBUG LOAD: Profile não disponível, abortando carregamento');
        return;
      }

      console.log(`🔐 DEBUG LOAD: Iniciando carregamento para profile:`, profile);

      let query = supabase.from('role_permissions').select('*');

      // Verificar se pode acessar módulo de permissões
      const canAccess = canAccessPermissionsModule(profile.role);
      console.log(`🔐 DEBUG LOAD: canAccessPermissionsModule(${profile.role}) = ${canAccess}`);
      
      if (!canAccess) {
        // Se não pode acessar módulo, carregar apenas suas permissões
        console.log(`🔐 DEBUG LOAD: Carregando apenas permissões para role: ${profile.role}`);
        query = query.eq('role', profile.role);
      } else {
        // Se pode acessar módulo, carregar permissões do próprio role + roles que pode gerenciar
        const managedRoles = getManagedRoles(profile.role);
        console.log(`🔐 DEBUG LOAD: Roles gerenciados por ${profile.role}:`, managedRoles);
        
        // Sempre incluir o próprio role + roles gerenciados
        const allRoles = [profile.role, ...managedRoles];
        console.log(`🔐 DEBUG LOAD: Carregando permissões para todos os roles:`, allRoles);
        query = query.in('role', allRoles);
      }

      const { data, error } = await query
        .order('role', { ascending: true })
        .order('category', { ascending: true })
        .order('permission_name', { ascending: true });

      if (error) throw error;
      console.log(`🔐 DEBUG LOAD PERMISSIONS: Carregadas ${data?.length || 0} permissões para role ${profile.role}:`, data);
      console.log(`🔐 DEBUG LOAD PERMISSIONS: Roles carregados:`, [...new Set(data?.map(p => p.role) || [])]);
      setPermissions(data || []);

    } catch (error: any) {
      console.error('Erro ao carregar permissões:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // Verificar permissão com cache
  const hasPermission = useCallback((permissionKey: string): boolean => {
    console.log(`🔐 DEBUG PERMISSION: ${permissionKey} - Role: ${profile?.role}, UserPermissions:`, userPermissions);
    if (profile?.role === 'admin') return true;
    const hasAccess = userPermissions[permissionKey] || false;
    console.log(`🔐 DEBUG RESULT: ${permissionKey} = ${hasAccess}`);
    return hasAccess;
  }, [profile, userPermissions]);

  // Atualizar permissão com validação
  const updatePermission = useCallback(async (id: string, isEnabled: boolean) => {
    try {
      if (!profile || !canAccessPermissionsModule(profile.role)) {
        throw new Error('Sem permissão para alterar configurações');
      }

      // Buscar dados da permissão para validação
      const permission = permissions.find(p => p.id === id);
      if (!permission) {
        throw new Error('Permissão não encontrada');
      }

      // Validar regras de negócio
      const validation = validatePermissionChange(
        profile.role,
        permission.role,
        permission.permission_key,
        isEnabled
      );

      if (!validation.valid) {
        throw new Error(validation.message);
      }

      const { data, error } = await supabase
        .from('role_permissions')
        .update({ 
          is_enabled: isEnabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Atualizar estado local otimizado
      setPermissions(prev => 
        prev.map(perm => 
          perm.id === id ? { ...perm, is_enabled: isEnabled } : perm
        )
      );

      return data;

    } catch (error: any) {
      console.error('Erro ao atualizar permissão:', error);
      throw error;
    }
  }, [profile, permissions]);

  // Obter permissões por role (memoizado)
  const getPermissionsByRole = useCallback((role: 'corretor' | 'gestor' | 'admin') => {
    return permissions.filter(perm => perm.role === role);
  }, [permissions]);

  // Obter permissões por categoria (memoizado)
  const getPermissionsByCategory = useCallback((category: string) => {
    return permissions.filter(perm => perm.category === category);
  }, [permissions]);

  useEffect(() => {
    if (profile) {
      loadPermissions();
    }
  }, [profile, loadPermissions]);

  // Subscription para mudanças em tempo real (todos os usuários precisam receber updates)
  useEffect(() => {
    if (!profile) return;

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // Subscription principal para mudanças no role específico do usuário
    const userRoleSubscription = supabase
      .channel(`permissions_user_role-${profile.role}-${uniqueSuffix}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'role_permissions',
          filter: `role=eq.${profile.role}` // Filtrar apenas mudanças relevantes para o role do usuário
        },
        (payload) => {
          console.log(`🔐 REALTIME USER: Permissão alterada para role ${profile.role}:`, payload);
          loadPermissions(); // Recarregar quando houver mudanças relevantes
        }
      )
      .subscribe();

    console.log(`🔐 REALTIME: Subscription ativa para role ${profile.role}`);

    // Subscription adicional para gestores/admins que podem ver mudanças em outros roles
    let managerSubscription: any = null;
    if (canAccessPermissionsModule(profile.role)) {
      const managedRoles = getManagedRoles(profile.role);
      if (managedRoles.length > 0) {
        managerSubscription = supabase
          .channel(`permissions_managed_roles-${profile.role}-${uniqueSuffix}`)
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'role_permissions'
              // Sem filtro específico para que gestores vejam mudanças em todos os roles que gerenciam
            },
            (payload) => {
              console.log(`🔐 REALTIME MANAGER: Permissão alterada (gestão):`, payload);
              loadPermissions(); // Recarregar para atualizar visão de gestão
            }
          )
          .subscribe();
        
        console.log(`🔐 REALTIME: Subscription de gestão ativa para roles: ${managedRoles.join(', ')}`);
      }
    }

    return () => {
      console.log(`🔐 REALTIME: Removendo subscriptions para role ${profile.role}`);
      userRoleSubscription.unsubscribe();
      if (managerSubscription) {
        managerSubscription.unsubscribe();
      }
    };
  }, [profile, loadPermissions]);

  // Função para forçar refresh completo das permissões (útil após mudanças no sistema)
  const forceRefreshPermissions = useCallback(async () => {
    console.log('🔄 FORCE REFRESH: Forçando recarregamento completo das permissões...');
    setLoading(true);
    setError(null);
    await loadPermissions();
  }, [loadPermissions]);

  return {
    permissions,
    userPermissions,
    loading,
    error,
    hasPermission,
    updatePermission,
    getPermissionsByRole,
    getPermissionsByCategory,
    refreshPermissions: loadPermissions,
    forceRefreshPermissions
  };
}