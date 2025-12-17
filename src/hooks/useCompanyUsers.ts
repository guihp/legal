import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile, UserProfile } from './useUserProfile';

interface CompanyUser {
  id: string;
  email: string;
  fullName: string;
  role: 'corretor' | 'gestor' | 'admin';
  companyId: string;
  isActive: boolean;
  createdAt: string;
}

export function useCompanyUsers() {
  const { profile, isManager } = useUserProfile();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mapear dados do RPC para interface camelCase
  const mapUserFromRPC = (user: any): CompanyUser => ({
    id: user.id,
    email: user.email,
    fullName: user.full_name || user.fullName || user.email,
    role: user.role,
    companyId: user.company_id,
    isActive: user.is_active,
    createdAt: user.created_at
  });

  // Carregar todos os usuários da empresa
  const loadUsers = useCallback(async (
    search?: string,
    roles?: string[],
    includeInactive = false
  ) => {
    if (!profile?.company_id) {
      setError('Perfil ou empresa não encontrados');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase.rpc('list_company_users', {
        target_company_id: null, // Single-tenant
        search: search || null,
        roles: roles || null,
        limit_count: 100,
        offset_count: 0,
      });

      if (supabaseError) throw supabaseError;

      let mappedUsers = (data || []).map(mapUserFromRPC);
      
      // Filtrar inativos se necessário
      if (!includeInactive) {
        mappedUsers = mappedUsers.filter(user => user.isActive);
      }

      setUsers(mappedUsers);

    } catch (err: any) {
      console.error('Erro ao carregar usuários:', err);
      setError(err.message || 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  // Carregar apenas corretores
  const loadBrokers = useCallback(async (search?: string, includeInactive = false) => {
    return loadUsers(search, ['corretor'], includeInactive);
  }, [loadUsers]);

  // Carregar apenas gestores
  const loadManagers = useCallback(async (search?: string, includeInactive = false) => {
    return loadUsers(search, ['gestor', 'admin'], includeInactive);
  }, [loadUsers]);

  // Buscar usuários por IDs específicos
  const getUsersByIds = useCallback(async (userIds: string[]): Promise<CompanyUser[]> => {
    if (!userIds.length) return [];

    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, company_id, is_active, created_at')
        .in('id', userIds);

      if (supabaseError) throw supabaseError;

      return (data || []).map(mapUserFromRPC);

    } catch (err: any) {
      console.error('Erro ao buscar usuários por IDs:', err);
      setError(err.message || 'Erro ao buscar usuários');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar usuários quando o componente monta
  useEffect(() => {
    const fetchUsers = async () => {
      if (!profile?.company_id) {
        setError('Perfil ou empresa não encontrados');
        return;
      }

      if (!isManager) {
        setError('Sem permissão para ver usuários');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: supabaseError } = await supabase.rpc('list_company_users', {
          target_company_id: null,
          search: null,
          roles: null,
          limit_count: 100,
          offset_count: 0,
        });

        if (supabaseError) throw supabaseError;

        const mappedUsers = (data || []).map(mapUserFromRPC).filter(user => user.isActive);
        setUsers(mappedUsers);

      } catch (err: any) {
        console.error('Erro ao carregar usuários:', err);
        setError(err.message || 'Erro ao carregar usuários');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [profile?.company_id, isManager]);

  return {
    // Estado
    users,
    loading,
    error,

    // Ações
    loadUsers,
    loadBrokers,
    loadManagers,
    getUsersByIds,

    // Getters
    brokers: users.filter(u => u.role === 'corretor'),
    managers: users.filter(u => u.role === 'gestor' || u.role === 'admin'),
    activeUsers: users.filter(u => u.isActive),
    getUserById: (id: string) => users.find(u => u.id === id),
    getUsersByRole: (role: string) => users.filter(u => u.role === role)
  };
}
