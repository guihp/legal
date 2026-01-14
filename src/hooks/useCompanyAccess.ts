import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthManager } from './useAuthManager';

export interface CompanyAccessStatus {
  canAccess: boolean;
  status: string;
  message: string;
  daysRemaining: number | null;
  isGracePeriod: boolean;
  isSuperAdmin: boolean;
}

export interface CompanyAccessHook {
  accessStatus: CompanyAccessStatus | null;
  loading: boolean;
  error: string | null;
  checkAccess: () => Promise<CompanyAccessStatus | null>;
  isSuperAdmin: boolean;
}

const DEFAULT_ACCESS: CompanyAccessStatus = {
  canAccess: false,
  status: 'unknown',
  message: 'Verificando acesso...',
  daysRemaining: null,
  isGracePeriod: false,
  isSuperAdmin: false,
};

export function useCompanyAccess(): CompanyAccessHook {
  const { session } = useAuthManager();
  const [accessStatus, setAccessStatus] = useState<CompanyAccessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAccess = useCallback(async (): Promise<CompanyAccessStatus | null> => {
    if (!session?.user) {
      setAccessStatus(null);
      setLoading(false);
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      // Chamar função RPC para verificar acesso
      const { data, error: rpcError } = await supabase
        .rpc('check_current_user_access');

      if (rpcError) {
        console.error('Erro ao verificar acesso:', rpcError);
        throw rpcError;
      }

      if (data && data.length > 0) {
        const result = data[0];
        const status: CompanyAccessStatus = {
          canAccess: result.can_access,
          status: result.status,
          message: result.message,
          daysRemaining: result.days_remaining,
          isGracePeriod: result.is_grace_period,
          isSuperAdmin: result.is_super_admin,
        };
        setAccessStatus(status);
        return status;
      }

      // Se não retornou dados, assumir bloqueado
      const blocked: CompanyAccessStatus = {
        canAccess: false,
        status: 'error',
        message: 'Não foi possível verificar o acesso. Tente novamente.',
        daysRemaining: null,
        isGracePeriod: false,
        isSuperAdmin: false,
      };
      setAccessStatus(blocked);
      return blocked;

    } catch (err: any) {
      const errorMsg = err?.message || 'Erro ao verificar acesso';
      setError(errorMsg);
      setAccessStatus({
        canAccess: false,
        status: 'error',
        message: errorMsg,
        daysRemaining: null,
        isGracePeriod: false,
        isSuperAdmin: false,
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Verificar acesso quando sessão mudar
  useEffect(() => {
    if (session?.user) {
      checkAccess();
    } else {
      setAccessStatus(null);
      setLoading(false);
    }
  }, [session, checkAccess]);

  return {
    accessStatus,
    loading,
    error,
    checkAccess,
    isSuperAdmin: accessStatus?.isSuperAdmin || false,
  };
}

/**
 * Hook simplificado para verificar apenas se é super_admin
 */
export function useSuperAdmin(): { isSuperAdmin: boolean; loading: boolean } {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { session } = useAuthManager();

  useEffect(() => {
    const checkSuperAdmin = async () => {
      if (!session?.user) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (error) throw error;
        setIsSuperAdmin(data?.role === 'super_admin');
      } catch {
        setIsSuperAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkSuperAdmin();
  }, [session]);

  return { isSuperAdmin, loading };
}
