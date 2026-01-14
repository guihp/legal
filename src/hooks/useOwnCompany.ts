import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { toast } from 'sonner';

export interface OwnCompanyData {
  id: string;
  name: string;
  email: string | null;
  cnpj: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  plan: string;
  max_users: number;
  is_active: boolean;
  subscription_status: string;
  subscription_expires_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
}

export function useOwnCompany() {
  const { profile, isManager } = useUserProfile();
  const [company, setCompany] = useState<OwnCompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados da empresa
  const loadCompany = useCallback(async () => {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_own_company');

      if (rpcError) throw rpcError;

      if (data && data.length > 0) {
        setCompany(data[0] as OwnCompanyData);
      }
    } catch (err: any) {
      console.error('Erro ao carregar empresa:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  // Atualizar dados da empresa
  const updateCompany = useCallback(async (data: {
    name?: string;
    email?: string;
    cnpj?: string;
    phone?: string;
    address?: string;
  }): Promise<boolean> => {
    if (!isManager) {
      toast.error('Sem permissão para editar dados da empresa');
      return false;
    }

    try {
      setUpdating(true);
      setError(null);

      const { error: rpcError } = await supabase.rpc('update_own_company', {
        p_name: data.name || null,
        p_email: data.email || null,
        p_cnpj: data.cnpj || null,
        p_phone: data.phone || null,
        p_address: data.address || null,
      });

      if (rpcError) throw rpcError;

      // Recarregar dados
      await loadCompany();
      toast.success('Dados da empresa atualizados!');
      return true;
    } catch (err: any) {
      console.error('Erro ao atualizar empresa:', err);
      setError(err.message);
      toast.error('Erro ao atualizar: ' + err.message);
      return false;
    } finally {
      setUpdating(false);
    }
  }, [isManager, loadCompany]);

  // Carregar ao montar
  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  // Calcular dias restantes
  const getDaysRemaining = useCallback((): number | null => {
    if (!company) return null;

    const now = new Date();
    let targetDate: Date | null = null;

    if (company.subscription_status === 'trial' && company.trial_ends_at) {
      targetDate = new Date(company.trial_ends_at);
    } else if (company.subscription_expires_at) {
      targetDate = new Date(company.subscription_expires_at);
    }

    if (!targetDate) return null;

    const diff = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [company]);

  return {
    company,
    loading,
    updating,
    error,
    isManager,
    updateCompany,
    refreshCompany: loadCompany,
    daysRemaining: getDaysRemaining(),
  };
}
