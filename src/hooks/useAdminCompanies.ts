import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from './useCompanyAccess';
import { invokeEdge } from '@/integrations/supabase/invoke';

export interface AdminCompany {
  id: string;
  name: string;
  email: string | null;
  cnpj: string | null;
  phone: string | null;
  whatsapp_ai_phone: string | null;
  plan: string;
  is_active: boolean;
  subscription_status: string;
  subscription_expires_at: string | null;
  trial_ends_at: string | null;
  blocked_at: string | null;
  block_reason: string | null;
  max_users: number;
  user_count: number;
  property_count: number;
  lead_count: number;
  created_at: string;
  last_activity_at: string | null;
}

export interface AdminCompanyDetails extends AdminCompany {
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  grace_period_days: number;
  billing_email: string | null;
  admin_notes: string | null;
  updated_at: string;
  active_user_count: number;
  leads_count: number;
  properties_count: number;
}

export interface AdminMetrics {
  total_companies: number;
  active_companies: number;
  trial_companies: number;
  blocked_companies: number;
  expired_companies: number;
  grace_companies: number;
  total_users: number;
  active_users: number;
  total_properties: number;
  total_leads: number;
}

export interface CompanyAccessLog {
  id: string;
  company_id: string;
  company_name: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  reason: string | null;
  performed_by: string | null;
  performed_by_name: string | null;
  meta: Record<string, any>;
  created_at: string;
}

export function useAdminCompanies() {
  const { isSuperAdmin, loading: adminLoading } = useSuperAdmin();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listar empresas
  const listCompanies = useCallback(async (
    status?: string,
    search?: string
  ) => {
    if (!isSuperAdmin) return [];

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('list_all_companies', {
        p_status: status || null,
        p_search: search || null,
        p_limit: 50,
        p_offset: 0,
      });

      if (rpcError) {
        console.error('Erro na função list_all_companies:', rpcError);
        throw rpcError;
      }

      console.log('Empresas retornadas pela função SQL:', data);
      
      const companiesList = (data || []) as AdminCompany[];
      console.log('Empresas processadas:', companiesList);
      setCompanies(companiesList);
      return companiesList;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  // Carregar métricas
  const loadMetrics = useCallback(async () => {
    if (!isSuperAdmin) return null;

    try {
      const { data, error: rpcError } = await supabase.rpc('get_admin_metrics');

      if (rpcError) throw rpcError;

      if (data && data.length > 0) {
        setMetrics(data[0] as AdminMetrics);
        return data[0] as AdminMetrics;
      }
      return null;
    } catch (err: any) {
      console.error('Erro ao carregar métricas:', err);
      return null;
    }
  }, [isSuperAdmin]);

  // Obter detalhes de uma empresa
  const getCompanyDetails = useCallback(async (companyId: string): Promise<AdminCompanyDetails | null> => {
    if (!isSuperAdmin) return null;

    try {
      const { data, error: rpcError } = await supabase.rpc('get_company_details', {
        p_company_id: companyId,
      });

      if (rpcError) throw rpcError;

      if (data && data.length > 0) {
        return data[0] as AdminCompanyDetails;
      }
      return null;
    } catch (err: any) {
      console.error('Erro ao obter detalhes da empresa:', err);
      return null;
    }
  }, [isSuperAdmin]);

  // Bloquear empresa
  const blockCompany = useCallback(async (companyId: string, reason?: string): Promise<boolean> => {
    if (!isSuperAdmin) return false;

    try {
      const { data, error: rpcError } = await supabase.rpc('block_company', {
        p_company_id: companyId,
        p_reason: reason || null,
      });

      if (rpcError) throw rpcError;

      // Recarregar lista
      await listCompanies();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [isSuperAdmin, listCompanies]);

  // Desbloquear empresa
  const unblockCompany = useCallback(async (
    companyId: string,
    newStatus = 'active',
    reason?: string
  ): Promise<boolean> => {
    if (!isSuperAdmin) return false;

    try {
      const { data, error: rpcError } = await supabase.rpc('unblock_company', {
        p_company_id: companyId,
        p_new_status: newStatus,
        p_reason: reason || null,
      });

      if (rpcError) throw rpcError;

      // Recarregar lista
      await listCompanies();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [isSuperAdmin, listCompanies]);

  // Renovar assinatura
  const renewSubscription = useCallback(async (
    companyId: string,
    days: number,
    notes?: string
  ): Promise<boolean> => {
    if (!isSuperAdmin) return false;

    try {
      const { data, error: rpcError } = await supabase.rpc('renew_subscription', {
        p_company_id: companyId,
        p_days: days,
        p_notes: notes || null,
      });

      if (rpcError) throw rpcError;

      // Recarregar lista
      await listCompanies();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [isSuperAdmin, listCompanies]);

  // Criar empresa
  const createCompany = useCallback(async (data: {
    name: string;
    whatsapp_ai_phone: string;
    login_email: string; // Obrigatório: email para login do gestor
    email?: string;
    cnpj?: string;
    phone?: string;
    address?: string;
    plan?: string;
    trial_days?: number;
    max_users?: number;
  }): Promise<{ companyId: string; email: string; password: string } | null> => {
    if (!isSuperAdmin) return null;

    try {
      // Usar Edge Function em vez de RPC direto
      console.log('📤 Dados sendo enviados para Edge Function:', {
        name: data.name,
        whatsapp_ai_phone: data.whatsapp_ai_phone,
        login_email: data.login_email,
        email: data.email || null,
        cnpj: data.cnpj || null,
        phone: data.phone || null,
        address: data.address || null,
        plan: data.plan || 'basic',
        trial_days: data.trial_days || 14,
        max_users: data.max_users || 10,
      });

      const { data: result, error: fnError } = await invokeEdge<any, any>('create-company-with-user', {
        body: {
          name: data.name,
          whatsapp_ai_phone: data.whatsapp_ai_phone,
          login_email: data.login_email,
          email: data.email || null,
          cnpj: data.cnpj || null,
          phone: data.phone || null,
          address: data.address || null,
          plan: data.plan || 'basic',
          trial_days: data.trial_days || 14,
          max_users: data.max_users || 10,
        }
      });

      console.log('📥 Resposta da Edge Function:', { result, fnError });

      if (fnError) {
        console.error('❌ Erro na Edge Function:', fnError);
        // Tentar extrair mensagem de erro do contexto
        const errorMessage = fnError.message || 
                           (fnError as any)?.context?.message ||
                           (fnError as any)?.error ||
                           'Erro ao criar empresa';
        throw new Error(errorMessage);
      }

      if (!result) {
        console.error('❌ Resultado vazio da Edge Function');
        throw new Error('Resposta inválida do servidor');
      }

      if (!result.success) {
        console.error('❌ Edge Function retornou erro:', result.error);
        throw new Error(result.error || 'Erro desconhecido ao criar empresa');
      }
      
      // Recarregar lista
      await listCompanies();
      
      return {
        companyId: result.company_id,
        email: result.email,
        password: result.password
      };
    } catch (err: any) {
      console.error('❌ Erro completo ao criar empresa:', err);
      setError(err.message || 'Erro desconhecido');
      return null;
    }
  }, [isSuperAdmin, listCompanies]);

  // Atualizar empresa
  const updateCompany = useCallback(async (companyId: string, data: {
    name?: string;
    email?: string;
    cnpj?: string;
    phone?: string;
    address?: string;
    plan?: string;
    max_users?: number;
    billing_email?: string;
    admin_notes?: string;
  }): Promise<boolean> => {
    if (!isSuperAdmin) return false;

    try {
      const { error: rpcError } = await supabase.rpc('update_company', {
        p_company_id: companyId,
        p_name: data.name || null,
        p_email: data.email || null,
        p_cnpj: data.cnpj || null,
        p_phone: data.phone || null,
        p_address: data.address || null,
        p_plan: data.plan || null,
        p_max_users: data.max_users || null,
        p_billing_email: data.billing_email || null,
        p_admin_notes: data.admin_notes || null,
      });

      if (rpcError) throw rpcError;

      // Recarregar lista
      await listCompanies();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [isSuperAdmin, listCompanies]);

  // Obter logs de acesso
  const getAccessLogs = useCallback(async (
    companyId?: string,
    limit = 50,
    offset = 0
  ): Promise<CompanyAccessLog[]> => {
    if (!isSuperAdmin) return [];

    try {
      const { data, error: rpcError } = await supabase.rpc('get_company_access_logs', {
        p_company_id: companyId || null,
        p_limit: limit,
        p_offset: offset,
      });

      if (rpcError) throw rpcError;

      return (data || []) as CompanyAccessLog[];
    } catch (err: any) {
      console.error('Erro ao obter logs:', err);
      return [];
    }
  }, [isSuperAdmin]);

  // Carregar dados iniciais
  useEffect(() => {
    if (isSuperAdmin && !adminLoading) {
      listCompanies().catch((err) => {
        console.error('Erro ao carregar empresas:', err);
        setError(err.message || 'Erro ao carregar empresas');
      });
      loadMetrics().catch((err) => {
        console.error('Erro ao carregar métricas:', err);
      });
    }
  }, [isSuperAdmin, adminLoading]); // Removendo listCompanies e loadMetrics das dependências

  return {
    companies,
    metrics,
    loading: loading || adminLoading,
    error,
    isSuperAdmin,
    listCompanies,
    loadMetrics,
    getCompanyDetails,
    blockCompany,
    unblockCompany,
    renewSubscription,
    createCompany,
    updateCompany,
    getAccessLogs,
    refresh: () => {
      listCompanies();
      loadMetrics();
    },
  };
}
