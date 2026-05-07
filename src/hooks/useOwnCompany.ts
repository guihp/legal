import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { toast } from 'sonner';

export interface OwnCompanyData {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  cnpj: string | null;
  phone: string | null;
  address: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip_code: string | null;
  business_hours: string | null;
  business_hours_summary: string | null;
  ai_initial_message: string | null;
  ai_assistant_name: string | null;
  ai_unknown_info_message: string | null;
  ai_company_mission: string | null;
  ai_tone: string | null;
  ai_payment_methods: string | null;
  ai_visit_policy: string | null;
  ai_target_audience: string | null;
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
    contact_name?: string;
    email?: string;
    cnpj?: string;
    phone?: string;
    address?: string;
    address_number?: string;
    address_complement?: string;
    address_neighborhood?: string;
    address_city?: string;
    address_state?: string;
    address_zip_code?: string;
    business_hours?: string;
    ai_initial_message?: string | null;
    ai_assistant_name?: string | null;
    ai_unknown_info_message?: string | null;
    ai_company_mission?: string | null;
    ai_tone?: string | null;
    ai_payment_methods?: string | null;
    ai_visit_policy?: string | null;
    ai_target_audience?: string | null;
  }): Promise<boolean> => {
    if (!isManager) {
      toast.error('Sem permissão para editar dados da empresa');
      return false;
    }

    try {
      setUpdating(true);
      setError(null);

      const { error: rpcError } = await supabase.rpc('update_own_company', {
        p_name: data.name !== undefined ? data.name || null : null,
        p_contact_name: data.contact_name !== undefined ? data.contact_name || null : null,
        p_email: data.email !== undefined ? data.email || null : null,
        p_cnpj: data.cnpj !== undefined ? data.cnpj || null : null,
        p_phone: data.phone !== undefined ? data.phone || null : null,
        p_address: data.address !== undefined ? data.address || null : null,
        p_address_number: data.address_number !== undefined ? data.address_number || null : null,
        p_address_complement: data.address_complement !== undefined ? data.address_complement || null : null,
        p_address_neighborhood: data.address_neighborhood !== undefined ? data.address_neighborhood || null : null,
        p_address_city: data.address_city !== undefined ? data.address_city || null : null,
        p_address_state: data.address_state !== undefined ? data.address_state || null : null,
        p_address_zip_code: data.address_zip_code !== undefined ? data.address_zip_code || null : null,
        p_business_hours: data.business_hours !== undefined ? data.business_hours || null : null,
        p_ai_initial_message:
          data.ai_initial_message !== undefined ? data.ai_initial_message : null,
        p_ai_assistant_name:
          data.ai_assistant_name !== undefined ? data.ai_assistant_name : null,
        p_ai_unknown_info_message:
          data.ai_unknown_info_message !== undefined ? data.ai_unknown_info_message : null,
        p_ai_company_mission:
          data.ai_company_mission !== undefined ? data.ai_company_mission : null,
        p_ai_tone: data.ai_tone !== undefined ? data.ai_tone : null,
        p_ai_payment_methods:
          data.ai_payment_methods !== undefined ? data.ai_payment_methods : null,
        p_ai_visit_policy:
          data.ai_visit_policy !== undefined ? data.ai_visit_policy : null,
        p_ai_target_audience:
          data.ai_target_audience !== undefined ? data.ai_target_audience : null,
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
