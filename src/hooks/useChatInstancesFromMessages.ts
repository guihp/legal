import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { useCompanySettings } from './useCompanySettings';
import { useCompanyApiMode } from './useCompanyApiMode';

export interface ChatInstanceRow {
  name: string;
  conversationCount: number;
  status?: 'connected' | 'connecting' | 'disconnected';
  profile_name?: string;
  profile_pic_url?: string;
}

// Base URL para os endpoints WhatsApp (configurado via variável de ambiente)
const WHATSAPP_API_BASE = import.meta.env.VITE_WHATSAPP_API_BASE || 'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook';

export function useChatInstancesFromMessages() {
  const { profile, isManager, loading: profileLoading } = useUserProfile();
  const { settings } = useCompanySettings();
  const { isOfficialApi } = useCompanyApiMode();
  const [instances, setInstances] = useState<ChatInstanceRow[]>([]);
  const [registryInstanceNames, setRegistryInstanceNames] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const scopedInstance = useMemo(() => {
    if (!profile) return null;
    if (isManager) return null; // gestores veem todas
    const inst = (profile as any)?.chat_instance;
    return inst ? String(inst).trim().toLowerCase() : null;
  }, [profile, isManager]);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      setRegistryInstanceNames([]);

      // Evitar mostrar todas as instâncias enquanto o perfil/escopo não está pronto
      if (profileLoading || !profile) {
        setInstances([]);
        setLoading(true);
        return;
      }

      // Para corretor: só buscar quando chat_instance estiver definido
      if (!isManager && !scopedInstance) {
        setInstances([]);
        setLoading(false);
        return;
      }

      const loadRegistryNames = async (): Promise<string[]> => {
        if (!profile.company_id) return [];
        const { data } = await supabase
          .from('company_whatsapp_instances' as any)
          .select('instance_name, status')
          .eq('company_id', profile.company_id)
          .eq('is_active', true);
        const rows = Array.isArray(data) ? data : [];
        const names = rows
          .map((r: any) => String(r.instance_name || '').trim())
          .filter(Boolean);
        setRegistryInstanceNames(names);
        return names;
      };

      // API Oficial: não depende de instância Evolution no chat
      if (isOfficialApi) {
        console.log('⚡ API Oficial: pulando busca de instâncias Evolution');
        setInstances([]);
        await loadRegistryNames();
        setLoading(false);
        return;
      }

      const registryNames = await loadRegistryNames();

      // Buscar instâncias do webhook N8N (mesmo padrão usado em ConnectionsView)
      console.log('📡 Chamando endpoint: GET /webhook/whatsapp-instances');

      const url = new URL(`${WHATSAPP_API_BASE}/whatsapp-instances`);
      url.searchParams.append('company_id', profile.company_id);
      url.searchParams.append('company_name', settings?.display_name || '');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`Erro no endpoint: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ Resposta recebida do webhook:', responseData);

      if (!responseData.success || !Array.isArray(responseData.data)) {
        throw new Error('Formato de resposta inválido do endpoint');
      }

      const externalInstances = responseData.data || [];

      // Filtrar instâncias se for corretor (apenas a instância atribuída)
      let filteredInstances = externalInstances;
      if (scopedInstance) {
        filteredInstances = externalInstances.filter((inst: any) =>
          String(inst.name || '').trim().toLowerCase() === scopedInstance
        );
      }

      // Mapear status
      const statusMap: Record<string, 'connected' | 'connecting' | 'disconnected'> = {
        open: 'connected',
        connecting: 'connecting',
        close: 'disconnected',
        closed: 'disconnected'
      };

      // Mapear para o formato esperado
      let mappedInstances: ChatInstanceRow[] = filteredInstances.map((externalData: any) => ({
        name: externalData.name,
        conversationCount: externalData._count?.Chat || externalData._count?.Message || 0,
        status: statusMap[externalData.connectionStatus] || 'disconnected',
        profile_name: externalData.profileName,
        profile_pic_url: externalData.profilePicUrl,
      }));

      // Fallback: instâncias cadastradas em Conexões (company_whatsapp_instances)
      if (mappedInstances.length === 0 && registryNames.length > 0) {
        mappedInstances = registryNames.map((name) => ({
          name,
          conversationCount: 0,
          status: 'connected' as const,
        }));
      }

      // Ordenar por nome
      mappedInstances.sort((a, b) => a.name.localeCompare(b.name));

      setInstances(mappedInstances);
    } catch (e: any) {
      console.error('❌ Erro ao carregar instâncias do webhook:', e);
      setError(e.message || 'Erro ao carregar instâncias');

      // Mesmo com falha no webhook, usa registro local de conexões
      if (profile?.company_id) {
        const { data } = await supabase
          .from('company_whatsapp_instances' as any)
          .select('instance_name, status')
          .eq('company_id', profile.company_id)
          .eq('is_active', true);
        const rows = Array.isArray(data) ? data : [];
        const names = rows
          .map((r: any) => String(r.instance_name || '').trim())
          .filter(Boolean);
        setRegistryInstanceNames(names);
        if (names.length > 0) {
          setInstances(
            names.map((name) => ({
              name,
              conversationCount: 0,
              status: 'connected' as const,
            })),
          );
          setError(null);
        } else {
          setInstances([]);
        }
      } else {
        setInstances([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileLoading) {
      setLoading(true);
      setInstances([]);
      return;
    }
    // Só carregar quando o escopo estiver definido (ou for gestor)
    if (isManager || scopedInstance) {
      refresh();
    } else {
      setInstances([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedInstance, isManager, profileLoading, isOfficialApi]);

  return { instances, loading, error, refresh, scopedInstance, registryInstanceNames };
}


