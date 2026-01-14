import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ImpersonationSession {
  session_id: string;
  impersonated_user_id: string;
  impersonated_email: string;
  impersonated_company_id: string | null;
  started_at: string;
}

export interface UserForImpersonation {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  company_id: string | null;
  company_name: string | null;
  is_active: boolean;
  last_login: string | null;
}

export function useImpersonation() {
  const [activeSession, setActiveSession] = useState<ImpersonationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserForImpersonation[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Verificar se há sessão ativa
  const checkActiveSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_active_impersonation');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setActiveSession(data[0] as ImpersonationSession);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Erro ao verificar impersonação:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar usuários disponíveis para impersonação
  const loadUsers = useCallback(async (companyId?: string, search?: string) => {
    try {
      setLoadingUsers(true);
      
      const { data, error } = await supabase.rpc('list_users_for_impersonation', {
        p_company_id: companyId || null,
        p_search: search || null,
      });
      
      if (error) throw error;
      
      setUsers((data || []) as UserForImpersonation[]);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
      toast.error('Erro ao carregar lista de usuários');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Iniciar impersonação
  const startImpersonation = useCallback(async (userId: string, reason?: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('start_impersonation', {
        p_user_id: userId,
        p_reason: reason || null,
      });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const result = data[0];
        
        if (!result.success) {
          toast.error(result.message);
          return false;
        }
        
        toast.success(`Logado como ${result.user_name || result.user_email}`);
        
        // Atualizar sessão ativa
        await checkActiveSession();
        
        // Recarregar página para aplicar nova sessão
        window.location.href = '/dashboard';
        
        return true;
      }
      
      return false;
    } catch (err: any) {
      console.error('Erro ao iniciar impersonação:', err);
      toast.error('Erro ao iniciar sessão: ' + err.message);
      return false;
    }
  }, [checkActiveSession]);

  // Encerrar impersonação
  const endImpersonation = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('end_impersonation');
      
      if (error) throw error;
      
      if (data) {
        toast.success('Sessão de impersonação encerrada');
        setActiveSession(null);
        
        // Voltar para o painel admin
        window.location.href = '/dashboard';
        
        return true;
      }
      
      return false;
    } catch (err: any) {
      console.error('Erro ao encerrar impersonação:', err);
      toast.error('Erro ao encerrar sessão: ' + err.message);
      return false;
    }
  }, []);

  // Carregar ao montar
  useEffect(() => {
    checkActiveSession();
  }, [checkActiveSession]);

  return {
    activeSession,
    isImpersonating: !!activeSession,
    loading,
    users,
    loadingUsers,
    loadUsers,
    startImpersonation,
    endImpersonation,
    refreshSession: checkActiveSession,
  };
}
