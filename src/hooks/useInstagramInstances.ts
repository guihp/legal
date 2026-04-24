import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';

export interface InstagramInstanceRow {
  id: string;
  handle: string;                  // exibição principal
  name: string;                    // alias para compatibilidade com ChatInstanceRow
  display_name?: string | null;
  instagram_user_id?: string | null;
  profile_pic_url?: string | null;
  status: 'connected' | 'connecting' | 'disconnected';
  conversationCount: number;
  is_active: boolean;
}

/**
 * Busca as contas Instagram configuradas para a empresa do usuário.
 * Conta de mensagens é calculada a partir de crm_instagram_messages (distinct session_id).
 */
export function useInstagramInstances() {
  const { profile, isManager, loading: profileLoading } = useUserProfile();
  const [instances, setInstances] = useState<InstagramInstanceRow[]>([]);
  /** ID Instagram na tabela `companies` (tabela legada imobipro_messages_{id}_instagram). */
  const [companyInstagramId, setCompanyInstagramId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const scopedInstance = useMemo(() => {
    if (!profile) return null;
    if (isManager) return null;
    // Para IG reutilizamos chat_instance — ou instagram_instance se existir no perfil.
    const inst = (profile as any)?.instagram_instance || (profile as any)?.chat_instance;
    return inst ? String(inst).trim().toLowerCase() : null;
  }, [profile, isManager]);

  const refresh = useCallback(async () => {
    if (!profile?.company_id) {
      setInstances([]);
      setCompanyInstagramId(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let idIg: string | null = null;
      try {
        const { data: co, error: coErr } = await supabase
          .from('companies')
          .select('id_instagram')
          .eq('id', profile.company_id)
          .single();
        if (!coErr && co?.id_instagram != null) {
          const v = String(co.id_instagram).replace(/[^\x20-\x7E]/g, '').trim();
          idIg = v.length > 0 ? v : null;
        }
      } catch {
        idIg = null;
      }
      setCompanyInstagramId(idIg);

      const { data: accounts, error: accErr } = await (supabase as any)
        .from('company_instagram_accounts')
        .select('id, handle, display_name, instagram_user_id, profile_pic_url, status, is_active')
        .eq('company_id', profile.company_id)
        .eq('is_active', true);

      if (accErr) throw accErr;

      let accountsList = accounts || [];

      // Corretor: apenas sua instância
      if (scopedInstance) {
        accountsList = accountsList.filter(
          (acc: any) => String(acc.handle || '').trim().toLowerCase() === scopedInstance
        );
      }

      // Buscar contagem de conversas por handle via RPC (fallback: 0)
      const counts: Record<string, number> = {};
      try {
        const { data: convs } = await (supabase.rpc as any)('list_instagram_conversations', {
          p_company_id: profile.company_id,
          p_instancia: null,
        });
        if (Array.isArray(convs)) {
          for (const c of convs) {
            const key = String(c.instancia || '').trim().toLowerCase();
            counts[key] = (counts[key] || 0) + 1;
          }
        }
      } catch (e) {
        // Ignorar — empresa pode nunca ter recebido mensagem ainda
      }

      const mapped: InstagramInstanceRow[] = accountsList.map((acc: any) => {
        const key = String(acc.handle || '').trim().toLowerCase();
        return {
          id: acc.id,
          handle: acc.handle,
          name: acc.handle, // compat
          display_name: acc.display_name,
          instagram_user_id: acc.instagram_user_id,
          profile_pic_url: acc.profile_pic_url,
          status: (acc.status as any) || 'disconnected',
          conversationCount: counts[key] || 0,
          is_active: acc.is_active,
        };
      });

      mapped.sort((a, b) => a.handle.localeCompare(b.handle));
      setInstances(mapped);
    } catch (e: any) {
      console.error('❌ Erro ao carregar contas Instagram:', e);
      setError(e.message || 'Erro ao carregar contas Instagram');
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, scopedInstance]);

  useEffect(() => {
    if (profileLoading) {
      setLoading(true);
      return;
    }
    refresh();
  }, [refresh, profileLoading]);

  const hasLegacyInstagramMessaging = Boolean(companyInstagramId?.trim());

  return {
    instances,
    loading,
    error,
    refresh,
    scopedInstance,
    companyInstagramId,
    hasLegacyInstagramMessaging,
  };
}
