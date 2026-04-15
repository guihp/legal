import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/audit/logger';
import { useUserProfile } from './useUserProfile';
import { useCompanySettings } from './useCompanySettings';
import { useCompanyApiMode } from './useCompanyApiMode';

export interface WhatsAppInstance {
  id: string;
  name: string; // instance_name via endpoint
  phone_number?: string;
  profile_name?: string;
  profile_pic_url?: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_code' | 'error';
  webhook_url?: string;
  api_key?: string;
  last_seen?: string;
  message_count: number;
  contact_count: number;
  chat_count: number;
  created_at: string;
  updated_at: string;
  // Campos do endpoint
  connectionStatus?: string;
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  token?: string;
  _count?: {
    Message: number;
    Contact: number;
    Chat: number;
  };
  // Dados do usuário (mapeamento local)
  user_id?: string | null;
  user_profile?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
}

export interface WhatsAppChat {
  id: string;
  instance_id: string;
  user_id: string;
  contact_phone: string;
  contact_name?: string;
  contact_avatar?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
  is_archived: boolean;
  tags?: string[];
  lead_id?: string;
  property_id?: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  chat_id: string;
  instance_id: string;
  user_id: string;
  message_id?: string;
  from_me: boolean;
  contact_phone?: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact';
  content?: string;
  media_url?: string;
  caption?: string;
  timestamp: string;
  read_at?: string;
  delivered_at?: string;
  created_at: string;
}

// Base URL para os endpoints WhatsApp (configurado via variável de ambiente)
const WHATSAPP_API_BASE =
  import.meta.env.VITE_WHATSAPP_API_BASE ||
  'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook';
const FIXED_INSTANCE_WEBHOOK_URL = 'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/imobiliaria';

async function parseWebhookResponse(response: Response) {
  const raw = await response.text();
  if (!raw || !raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { success: true, message: raw };
  }
}

function getUserFriendlyErrorMessage(error: any, fallback: string) {
  const raw = String(error?.message || '').toLowerCase();
  if (
    raw.includes('json') ||
    raw.includes('endpoint') ||
    raw.includes('failed to fetch') ||
    raw.includes('network') ||
    raw.includes('formato de resposta')
  ) {
    return fallback;
  }
  return error?.message || fallback;
}

export function useWhatsAppInstances() {
  const { profile, isManager } = useUserProfile();
  const { settings } = useCompanySettings();
  const { isOfficialApi } = useCompanyApiMode();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLocalRegistry = async () => {
    if (!profile?.company_id) return [];
    const { data } = await supabase
      .from('company_whatsapp_instances' as any)
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('is_active', true);
    return Array.isArray(data) ? data : [];
  };

  const upsertLocalRegistryItem = async (item: {
    company_id: string;
    user_id?: string | null;
    instance_name: string;
    phone_number?: string | null;
    api_key?: string | null;
    webhook_url?: string | null;
    status?: string;
    metadata?: any;
  }) => {
    await supabase
      .from('company_whatsapp_instances' as any)
      .upsert(
        {
          company_id: item.company_id,
          user_id: item.user_id ?? null,
          instance_name: item.instance_name,
          phone_number: item.phone_number ?? null,
          api_key: item.api_key ?? null,
          webhook_url: item.webhook_url ?? FIXED_INSTANCE_WEBHOOK_URL,
          status: item.status ?? 'disconnected',
          is_active: true,
          metadata: item.metadata ?? {},
        },
        { onConflict: 'company_id,instance_name' }
      );
  };

  const ensureWebhookConfigured = async (instanceName: string) => {
    // Tenta reforçar a configuração do webhook após criação.
    // Alguns provedores ignoram campos no create e exigem update de settings.
    const webhookPayload = {
      instanceName,
      enabled: true,
      webhookUrl: FIXED_INSTANCE_WEBHOOK_URL,
      webhook: FIXED_INSTANCE_WEBHOOK_URL,
      webhookByEvents: false,
      webhookBase64: true,
      messagesUpsert: true,
      url: FIXED_INSTANCE_WEBHOOK_URL,
      byEvents: false,
      base64: true,
      webhook_by_events: false,
      webhook_base64: true,
      messages_upsert: true,
      events: ['MESSAGES_UPSERT'],
      config: {
        enabled: true,
        webhookUrl: FIXED_INSTANCE_WEBHOOK_URL,
        webhook: FIXED_INSTANCE_WEBHOOK_URL,
        webhookByEvents: false,
        webhookBase64: true,
        messagesUpsert: true,
        url: FIXED_INSTANCE_WEBHOOK_URL,
        byEvents: false,
        base64: true,
        webhook_by_events: false,
        webhook_base64: true,
        messages_upsert: true,
        events: ['MESSAGES_UPSERT'],
        webhookSettings: {
          enabled: true,
          url: FIXED_INSTANCE_WEBHOOK_URL,
          byEvents: false,
          base64: true,
          events: ['MESSAGES_UPSERT'],
        },
      },
    };

    const tryConfigure = async (route: string) => {
      const response = await fetch(`${WHATSAPP_API_BASE}/${route}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify(webhookPayload),
      });
      const body = await parseWebhookResponse(response);
      return { ok: response.ok, body };
    };

    try {
      // Ordem de tentativas: set-settings (Evolution), edit-config, config
      const attempts = [
        'set-settings',
        'set-setting',
        'edit-config-instancia',
        'config-instancia',
      ];
      let configured = false;
      for (const route of attempts) {
        try {
          const result = await tryConfigure(route);
          if (result.ok && (result.body == null || result.body?.success !== false)) {
            configured = true;
            break;
          }
        } catch {
          // segue para próxima rota
        }
      }

      if (!configured) {
        console.warn('⚠️ Não foi possível confirmar webhook automaticamente para a instância:', instanceName);
      }
      return configured;
    } catch (e) {
      console.warn('⚠️ Não foi possível confirmar webhook automaticamente:', e);
      return false;
    }
  };

  // Carregar instâncias via endpoint externo
  const loadInstances = async () => {
    try {
      console.log('🚀 Carregando instâncias via endpoint externo...');
      setLoading(true);
      setError(null);

      if (!profile) return;

      if (isOfficialApi) {
        setInstances([]);
        setLoading(false);
        return;
      }

      // Carregar registros locais da empresa para garantir isolamento entre clientes
      const registry = await loadLocalRegistry();
      const registryByName = new Map(
        registry.map((r: any) => [String(r.instance_name || '').trim().toLowerCase(), r])
      );

      // Buscar instâncias do endpoint externo (escopo da empresa)
      console.log('📡 Chamando endpoint: GET /webhook/whatsapp-instances');

      const buildListFromResponse = (payload: any): any[] => {
        if (Array.isArray(payload)) return payload;
        if (payload?.success && Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.items)) return payload.items;
        if (Array.isArray(payload?.instances)) return payload.instances;
        if (Array.isArray(payload?.response)) return payload.response;
        if (payload?.instance && typeof payload.instance === 'object') return [payload.instance];
        if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) return [payload.data];
        return [];
      };

      const scopedUrl = new URL(`${WHATSAPP_API_BASE}/whatsapp-instances`);
      scopedUrl.searchParams.append('company_id', profile.company_id);
      scopedUrl.searchParams.append('company_name', settings?.display_name || '');

      const response = await fetch(scopedUrl.toString(), {
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

      const responseData = await parseWebhookResponse(response);
      console.log('✅ Resposta recebida do webhook:', responseData);

      let externalInstances: any[] = buildListFromResponse(responseData);

      // Fallback: quando o filtro da empresa não retorna, tenta sem filtros
      // e filtra localmente pelas instâncias vinculadas aos usuários da empresa.
      if (externalInstances.length === 0) {
        console.warn('⚠️ Lista vazia com filtro da empresa. Tentando fallback sem filtros...');
        const rawUrl = new URL(`${WHATSAPP_API_BASE}/whatsapp-instances`);
        const rawResp = await fetch(rawUrl.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          mode: 'cors',
        });

        if (rawResp.ok) {
          const rawPayload = await parseWebhookResponse(rawResp);
          const rawInstances = buildListFromResponse(rawPayload);

          const { data: companyUsers } = await supabase
            .from('user_profiles')
            .select('chat_instance')
            .eq('company_id', profile.company_id)
            .not('chat_instance', 'is', null);

          const allowedNamesFromUsers = new Set(
            (companyUsers || [])
              .map((u: any) => String(u?.chat_instance || '').trim().toLowerCase())
              .filter(Boolean)
          );

          const allowedNamesFromRegistry = new Set(
            (registry || [])
              .map((r: any) => String(r?.instance_name || '').trim().toLowerCase())
              .filter(Boolean)
          );

          const allowedNames = new Set([
            ...Array.from(allowedNamesFromUsers),
            ...Array.from(allowedNamesFromRegistry),
          ]);

          externalInstances = rawInstances.filter((inst: any) =>
            allowedNames.has(String(inst?.name || '').trim().toLowerCase())
          );
        }
      }

      // Segurança: mesmo quando o endpoint retorna dados "escopados", ainda filtramos
      // pelo vínculo local/usuário para evitar reaparecimento de instâncias removidas localmente.
      const { data: companyUsersForFilter } = await supabase
        .from('user_profiles')
        .select('chat_instance')
        .eq('company_id', profile.company_id)
        .not('chat_instance', 'is', null);

      const allowedNamesFromUsers = new Set(
        (companyUsersForFilter || [])
          .map((u: any) => String(u?.chat_instance || '').trim().toLowerCase())
          .filter(Boolean)
      );

      const allowedNamesFromRegistry = new Set(
        (registry || [])
          .map((r: any) => String(r?.instance_name || '').trim().toLowerCase())
          .filter(Boolean)
      );

      const strictAllowedNames = new Set([
        ...Array.from(allowedNamesFromUsers),
        ...Array.from(allowedNamesFromRegistry),
      ]);

      if (strictAllowedNames.size > 0) {
        externalInstances = externalInstances.filter((inst: any) =>
          strictAllowedNames.has(String(inst?.name || inst?.instanceName || '').trim().toLowerCase())
        );
      } else {
        // Sem vínculos ativos no sistema: não exibir instâncias externas órfãs.
        externalInstances = [];
      }

      console.log('📊 Total de instâncias no endpoint (filtradas pelo sistema):', externalInstances.length);

      // Criar map de instância -> usuário para lookup rápido
      const instanceUserMap = new Map();
      (registry || []).forEach((mapping: any) => {
        instanceUserMap.set(String(mapping.instance_name || '').trim().toLowerCase(), {
          user_id: mapping.user_id,
          user_profile: null
        });
      });

      // Mapear dados do endpoint para interface local
      const instancesData = externalInstances.map((externalData: any) => {
        console.log(`🔗 Processando instância ${externalData.name}:`, {
          status: externalData.connectionStatus,
          messages: externalData._count?.Message,
          contacts: externalData._count?.Contact
        });
        
        // Mapear status
        const statusMap: Record<string, 'connected' | 'connecting' | 'disconnected'> = {
          open: 'connected',
          opened: 'connected',
          connected: 'connected',
          online: 'connected',
          connecting: 'connecting',
          close: 'disconnected',
          closed: 'disconnected',
          disconnected: 'disconnected',
        };

        const rawStatus = String(
          externalData?.connectionStatus ??
          externalData?.status ??
          externalData?.state ??
          externalData?.instance?.state ??
          externalData?.instance?.status ??
          externalData?.data?.state ??
          externalData?.data?.status ??
          ''
        ).toLowerCase();
        const boolConnected =
          externalData?.connected === true ||
          externalData?.isConnected === true ||
          externalData?.instance?.connected === true ||
          externalData?.instance?.isConnected === true ||
          externalData?.session?.connected === true;

        // Buscar dados do usuário se houver mapeamento
        const normalizedName = String(externalData?.name || '').trim().toLowerCase();
        const userMapping = instanceUserMap.get(normalizedName);
        
        return {
          id: externalData.id || externalData.name,
          name: externalData.name,
          status: boolConnected ? 'connected' : (statusMap[rawStatus] || 'disconnected'),
          profile_name: externalData.profileName,
          profile_pic_url: externalData.profilePicUrl,
          message_count: externalData._count?.Message || 0,
          contact_count: externalData._count?.Contact || 0,
          chat_count: externalData._count?.Chat || 0,
          last_seen: externalData.updatedAt,
          phone_number: externalData.ownerJid ? 
            formatPhoneNumber(externalData.ownerJid.replace('@s.whatsapp.net', '')) : 
            null,
          api_key: externalData.token,
          webhook_url: `${WHATSAPP_API_BASE}/${externalData.name}`,
          created_at: externalData.createdAt || new Date().toISOString(),
          updated_at: externalData.updatedAt || new Date().toISOString(),
          // Campos do endpoint
          connectionStatus: rawStatus || externalData.connectionStatus,
          ownerJid: externalData.ownerJid,
          profileName: externalData.profileName,
          profilePicUrl: externalData.profilePicUrl,
          token: externalData.token,
          _count: externalData._count,
          // Dados do usuário (se mapeado)
          user_id: userMapping?.user_id || null,
          user_profile: userMapping?.user_profile || null
        };
      });

      // Isolamento forte: se já existe registro local, usa registro local como fonte principal
      // e complementa com dados da Evolution quando disponíveis.
      const externalByName = new Map(
        instancesData.map((inst: any) => [String(inst.name || '').trim().toLowerCase(), inst])
      );

      const isolatedInstances = registry.length
        ? registry.map((row: any) => {
            const key = String(row.instance_name || '').trim().toLowerCase();
            const ext = externalByName.get(key);
            if (ext) {
              return {
                ...ext,
                user_id: row.user_id || ext.user_id || null,
                api_key: row.api_key || ext.api_key || null,
                webhook_url: row.webhook_url || ext.webhook_url || FIXED_INSTANCE_WEBHOOK_URL,
              };
            }

            // Fallback offline: mantém visível mesmo sem retorno da Evolution
            return {
              id: String(row.id || row.instance_name),
              name: String(row.instance_name || ''),
              status: (String(row.status || 'disconnected') as 'connected' | 'connecting' | 'disconnected'),
              profile_name: null,
              profile_pic_url: null,
              message_count: 0,
              contact_count: 0,
              chat_count: 0,
              last_seen: row.updated_at || row.created_at || new Date().toISOString(),
              phone_number: row.phone_number || null,
              api_key: row.api_key || null,
              webhook_url: row.webhook_url || FIXED_INSTANCE_WEBHOOK_URL,
              created_at: row.created_at || new Date().toISOString(),
              updated_at: row.updated_at || new Date().toISOString(),
              connectionStatus: null,
              ownerJid: null,
              profileName: null,
              profilePicUrl: null,
              token: row.api_key || null,
              _count: { Message: 0, Contact: 0, Chat: 0 },
              user_id: row.user_id || null,
              user_profile: null,
            } as WhatsAppInstance;
          })
        : instancesData;

      // Persistir/atualizar cache local com API key e metadados recebidos
      for (const inst of isolatedInstances) {
        await upsertLocalRegistryItem({
          company_id: profile.company_id,
          user_id: inst.user_id || profile.id,
          instance_name: inst.name,
          phone_number: inst.phone_number || null,
          api_key: inst.api_key || null,
          webhook_url: FIXED_INSTANCE_WEBHOOK_URL,
          status: inst.status,
          metadata: {
            connectionStatus: inst.connectionStatus || null,
            profileName: inst.profile_name || null,
            ownerJid: inst.ownerJid || null,
          },
        });
      }

      setInstances(isolatedInstances);
      console.log('✅ Carregamento concluído!', {
        role: profile.role,
        totalInstances: isolatedInstances.length
      });

      // Sincronizar mapeamentos após carregar (apenas para gestores)
      if (isManager) {
        setTimeout(() => syncInstanceMappings(), 1000);
      }

    } catch (error: any) {
      console.error('Erro ao carregar instâncias:', error);
      setError(getUserFriendlyErrorMessage(error, 'Não foi possível carregar as conexões no momento. Tente novamente em instantes.'));
    } finally {
      setLoading(false);
    }
  };

  // Função auxiliar para formatar telefone
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return phone;
    // Formato brasileiro: +55 (11) 99999-9999
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      return `+55 (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return `+${cleaned}`;
  };

  // Criar nova instância via endpoint
  const createInstance = async (instanceData: {
    instance_name: string;
    phone_number?: string;
    assigned_user_id?: string; // Para gestores atribuírem a outros usuários
  }) => {
    try {
      if (!profile) throw new Error('Perfil não encontrado');
      
      // Verificar se o usuário tem permissão para criar instâncias (apenas gestores/admins)
      if (profile.role === 'corretor') {
        throw new Error('Apenas gestores e administradores podem criar instâncias WhatsApp');
      }

      // Definir para qual usuário a instância será atribuída
      const targetUserId = instanceData.assigned_user_id || profile.id;

      // Regra de negócio: cada usuário pode ter apenas 1 instância conectada
      const { data: targetProfile, error: targetProfileError } = await supabase
        .from('user_profiles')
        .select('id, full_name, company_id, chat_instance')
        .eq('id', targetUserId)
        .eq('company_id', profile.company_id)
        .single();

      if (targetProfileError || !targetProfile) {
        throw new Error('Usuário de destino não encontrado para criar instância');
      }

      if (targetProfile.chat_instance) {
        // Se apagou direto na Evolution, limpamos o vínculo órfão automaticamente
        const syncUrl = new URL(`${WHATSAPP_API_BASE}/whatsapp-instances`);
        syncUrl.searchParams.append('company_id', profile.company_id);
        syncUrl.searchParams.append('company_name', settings?.display_name || '');

        const syncResponse = await fetch(syncUrl.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          mode: 'cors',
        });

        let instanceStillExists = false;
        if (syncResponse.ok) {
          const syncData = await parseWebhookResponse(syncResponse);
          const listed = Array.isArray(syncData?.data) ? syncData.data : [];
          instanceStillExists = listed.some(
            (inst: any) =>
              String(inst?.name || '').toLowerCase() === String(targetProfile.chat_instance || '').toLowerCase()
          );
        }

        if (!instanceStillExists) {
          await supabase
            .from('user_profiles')
            .update({ chat_instance: null })
            .eq('id', targetUserId)
            .eq('company_id', profile.company_id);
        } else {
          throw new Error(`O usuário ${targetProfile.full_name} já possui um número conectado. Cada usuário pode ter apenas 1 conexão.`);
        }
      }
      
      console.log('🔍 Criando instância via endpoint:', {
        currentUser: profile.id,
        currentUserRole: profile.role,
        targetUserId: targetUserId,
        assignedUserId: instanceData.assigned_user_id,
        instanceName: instanceData.instance_name
      });

      // Se for atribuir para outro usuário, validar se existe e pertence à mesma empresa
      if (instanceData.assigned_user_id && instanceData.assigned_user_id !== profile.id) {
        const { data: targetUser, error: userError } = await supabase
          .from('user_profiles')
          .select('id, full_name, role, company_id, is_active')
          .eq('id', instanceData.assigned_user_id)
          .eq('company_id', profile.company_id)
          .eq('is_active', true)
          .single();

        if (userError || !targetUser) {
          throw new Error('Usuário selecionado não encontrado ou inativo');
        }

        if (!['corretor', 'gestor'].includes(targetUser.role)) {
          throw new Error('Instâncias só podem ser atribuídas a corretores ou gestores');
        }

        console.log('✅ Usuário de destino validado:', targetUser.full_name);
      }

      // Gerar UUID para sessionId
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      const sessionId = generateUUID();
      console.log('🆕 Chamando endpoint: POST /webhook/criar-instancia para', instanceData.instance_name);
      console.log('📋 Parâmetros enviados:', {
        instanceName: instanceData.instance_name,
        phoneNumber: instanceData.phone_number,
        sessionId: sessionId
      });
      
      const response = await fetch(`${WHATSAPP_API_BASE}/criar-instancia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          instanceName: instanceData.instance_name,
          phoneNumber: instanceData.phone_number,
          sessionId: sessionId,
          webhookUrl: FIXED_INSTANCE_WEBHOOK_URL,
          webhook: FIXED_INSTANCE_WEBHOOK_URL,
          options: {
            webhookUrl: FIXED_INSTANCE_WEBHOOK_URL,
            webhook: FIXED_INSTANCE_WEBHOOK_URL,
          },
          options_Create_instance: {
            webhook: {
              webhookSettings: {
                webhookUrl: FIXED_INSTANCE_WEBHOOK_URL,
                webhookBase64: true,
                webhookEvents: ['MESSAGES_UPSERT'],
              },
            },
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Erro no endpoint: ${response.status} - ${errorData}`);
      }

      let data: any = await parseWebhookResponse(response);
      if (!data) {
        data = { success: true, message: 'Instância criada (resposta vazia do servidor)' };
      }
      console.log('🔗 Instância criada no sistema externo:', data);

      if (!data?.success) {
        throw new Error(data.message || 'Falha ao criar instância');
      }

      // TODO: Implementar criação de mapeamento quando RPC estiver funcionando
      console.log('✅ Instância criada no endpoint. Mapeamento será implementado quando RPC estiver funcionando.');

      // Persistir vínculo da instância no sistema para manter regra de 1 número por usuário
      const { error: updateChatInstanceError } = await supabase
        .from('user_profiles')
        .update({ chat_instance: instanceData.instance_name })
        .eq('id', targetUserId)
        .eq('company_id', profile.company_id);

      if (updateChatInstanceError) {
        console.warn('⚠️ Instância criada no endpoint, mas falhou ao vincular chat_instance no usuário:', updateChatInstanceError);
      }

      // Fonte de verdade local: salvar vínculo da instância e API key para esta empresa
      await upsertLocalRegistryItem({
        company_id: profile.company_id,
        user_id: targetUserId,
        instance_name: instanceData.instance_name,
        phone_number: instanceData.phone_number || null,
        api_key: data?.data?.token || data?.token || null,
        webhook_url: FIXED_INSTANCE_WEBHOOK_URL,
        status: 'disconnected',
        metadata: {
          created_from: 'connections_ui',
        },
      });

      const webhookConfigured = await ensureWebhookConfigured(instanceData.instance_name);

      await upsertLocalRegistryItem({
        company_id: profile.company_id,
        user_id: targetUserId,
        instance_name: instanceData.instance_name,
        phone_number: instanceData.phone_number || null,
        api_key: data?.data?.token || data?.token || null,
        webhook_url: FIXED_INSTANCE_WEBHOOK_URL,
        status: 'disconnected',
        metadata: {
          created_from: 'connections_ui',
          webhook_configured: webhookConfigured,
          webhook_last_check_at: new Date().toISOString(),
        },
      });

      // Recarregar lista após persistir registro local para garantir visualização imediata
      await loadInstances();

      try { 
        await logAudit({ 
          action: 'whatsapp.instance_created', 
          resource: 'whatsapp_instance', 
          resourceId: instanceData.instance_name, 
          meta: { 
            instance_name: instanceData.instance_name,
            assigned_to: targetUserId,
            created_by: profile.id
          } 
        }); 
      } catch (auditError) {
        console.warn('Erro no log de auditoria:', auditError);
      }

      return data;

    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
      throw new Error(getUserFriendlyErrorMessage(error, 'Não foi possível criar a conexão agora. Tente novamente.'));
    }
  };

  // Atualizar status da instância no estado e no registro local
  const updateInstanceStatus = async (instanceId: string, status: WhatsAppInstance['status']) => {
    try {
      const currentInstance = instances.find((inst) => inst.id === instanceId);
      setInstances(prev => 
        prev.map(instance => 
          instance.id === instanceId ? { ...instance, status, last_seen: new Date().toISOString() } : instance
        )
      );

      if (profile?.company_id && currentInstance?.name) {
        await upsertLocalRegistryItem({
          company_id: profile.company_id,
          user_id: currentInstance.user_id || profile.id,
          instance_name: currentInstance.name,
          phone_number: currentInstance.phone_number || null,
          api_key: currentInstance.api_key || null,
          webhook_url: currentInstance.webhook_url || FIXED_INSTANCE_WEBHOOK_URL,
          status,
          metadata: {
            connectionStatus: status,
            status_updated_at: new Date().toISOString(),
          },
        });
      }
      
      try { 
        await logAudit({ 
          action: 'whatsapp.instance_status_updated', 
          resource: 'whatsapp_instance', 
          resourceId: instanceId, 
          meta: { status } 
        }); 
      } catch (auditError) {
        console.warn('Erro no log de auditoria:', auditError);
      }

      console.log(`✅ Status da instância ${instanceId} atualizado para: ${status}`);

    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      throw new Error(getUserFriendlyErrorMessage(error, 'Não foi possível atualizar o status da conexão.'));
    }
  };

  // Deletar instância localmente (sem webhook externo)
  const deleteInstance = async (instanceId: string) => {
    try {
      // 1. Buscar dados da instância antes de deletar
      const instanceToDelete = instances.find(inst => inst.id === instanceId);
      if (!instanceToDelete) {
        throw new Error('Instância não encontrada');
      }

      // 2. Atualizar estado local da tela
      setInstances(prev => prev.filter(instance => instance.id !== instanceId));

      // 3. Marcar registro local como inativo
      const { error: disableRegistryError } = await supabase
        .from('company_whatsapp_instances' as any)
        .update({ is_active: false, status: 'deleted' })
        .eq('company_id', profile?.company_id || '')
        .eq('instance_name', instanceToDelete.name);
      if (disableRegistryError) {
        throw disableRegistryError;
      }

      // 4. Limpar vínculo do usuário por nome da instância
      const { error: clearUserLinkError } = await supabase
        .from('user_profiles')
        .update({ chat_instance: null })
        .eq('chat_instance', instanceToDelete.name)
        .eq('company_id', profile?.company_id || '');
      if (clearUserLinkError) {
        throw clearUserLinkError;
      }

      // 5. Recarregar para refletir estado real após exclusão
      await loadInstances();

      console.log(`✅ Instância ${instanceToDelete.name} deletada completamente`);

    } catch (error: any) {
      console.error('❌ Erro completo ao deletar instância:', error);
      throw new Error(getUserFriendlyErrorMessage(error, 'Não foi possível remover a conexão agora. Tente novamente.'));
    }
  };

  // Conectar instância via endpoint
  const connectInstance = async (instanceId: string) => {
    try {
      const instance = instances.find(inst => inst.id === instanceId);
      if (!instance) {
        throw new Error('Instância não encontrada');
      }

      console.log('🔗 Chamando endpoint: POST /webhook/conectar-instancia para', instance.name);

      const response = await fetch(`${WHATSAPP_API_BASE}/conectar-instancia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          instanceName: instance.name
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('❌ Erro HTTP ao conectar instância:', response.status, response.statusText);
        console.warn('📝 Resposta do servidor:', errorText);
        throw new Error(`Erro ao conectar instância (${response.status})`);
      }

      const data = await parseWebhookResponse(response);
      console.log(`🔗 Resposta da conexão:`, data);

      if (data?.success) {
        // Atualizar status local
        await updateInstanceStatus(instanceId, 'connected');
        try { 
          await logAudit({ action: 'whatsapp.instance_connected', resource: 'whatsapp_instance', resourceId: instanceId, meta: null }); 
        } catch (auditError) {
          console.warn('Erro no log de auditoria:', auditError);
        }
        console.log(`✅ Instância ${instance.name} conectada com sucesso`);
        return data;
      } else {
        throw new Error(data.message || 'Falha ao conectar instância');
      }

    } catch (error: any) {
      console.error('❌ Erro ao conectar instância:', error);
      throw new Error(getUserFriendlyErrorMessage(error, 'Não foi possível conectar este número agora.'));
    }
  };

  // Desconectar instância via endpoint
  const disconnectInstance = async (instanceId: string) => {
    try {
      const instance = instances.find(inst => inst.id === instanceId);
      if (!instance) {
        throw new Error('Instância não encontrada');
      }

      console.log('🔌 Chamando endpoint: POST /webhook/desconectar-instancia para', instance.name);

      const response = await fetch(`${WHATSAPP_API_BASE}/desconectar-instancia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          instanceName: instance.name
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('❌ Erro HTTP ao desconectar instância:', response.status, response.statusText);
        console.warn('📝 Resposta do servidor:', errorText);
        throw new Error(`Erro ao desconectar instância (${response.status})`);
      }

      const data = await parseWebhookResponse(response);
      console.log(`🔌 Resposta da desconexão:`, data);

      if (data?.success) {
        // Atualizar status local
        await updateInstanceStatus(instanceId, 'disconnected');
        try { 
          await logAudit({ action: 'whatsapp.instance_disconnected', resource: 'whatsapp_instance', resourceId: instanceId, meta: null }); 
        } catch (auditError) {
          console.warn('Erro no log de auditoria:', auditError);
        }
        console.log(`✅ Instância ${instance.name} desconectada com sucesso`);
        return data;
      } else {
        throw new Error(data.message || 'Falha ao desconectar instância');
      }

    } catch (error: any) {
      console.error('❌ Erro ao desconectar instância:', error);
      throw new Error(getUserFriendlyErrorMessage(error, 'Não foi possível desconectar este número agora.'));
    }
  };

  // Gerar QR Code para conexão via endpoint
  const generateQrCode = async (instanceId: string): Promise<string | null> => {
    try {
      const instance = instances.find(inst => inst.id === instanceId);
      if (!instance) {
        throw new Error('Instância não encontrada');
      }

      console.log('📱 Chamando endpoint: POST /webhook/puxar-qrcode para', instance.name);

      const response = await fetch(`${WHATSAPP_API_BASE}/puxar-qrcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          instanceName: instance.name
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('❌ Erro HTTP ao gerar QR code:', response.status, response.statusText);
        console.warn('📝 Resposta do servidor:', errorText);
        throw new Error(`Sistema externo indisponível (${response.status}). Verifique se a instância foi criada corretamente.`);
      }

      // Verificar se a resposta tem conteúdo
      const responseText = await response.text();
      console.log('📥 Resposta bruta do QR code:', responseText);

      if (!responseText || responseText.trim() === '') {
        throw new Error('Resposta vazia do servidor. A instância pode não ter sido criada corretamente.');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Erro ao fazer parse do JSON:', parseError);
        console.error('📝 Conteúdo que falhou no parse:', responseText);
        throw new Error('Resposta inválida do servidor. Tente novamente em alguns segundos.');
      }

      console.log('✅ Dados parseados do QR code:', data);
      
      if (data.success && data.data?.qrcode) {
        // Atualizar status da instância
        await updateInstanceStatus(instanceId, 'qr_code');
        try { 
          await logAudit({ action: 'whatsapp.instance_qr_generated', resource: 'whatsapp_instance', resourceId: instanceId, meta: null }); 
        } catch (auditError) {
          console.warn('Erro no log de auditoria:', auditError);
        }
        return data.data.qrcode;
      } else if (data.success && data.qrcode) {
        // Formato alternativo da resposta
        await updateInstanceStatus(instanceId, 'qr_code');
        try { 
          await logAudit({ action: 'whatsapp.instance_qr_generated', resource: 'whatsapp_instance', resourceId: instanceId, meta: null }); 
        } catch (auditError) {
          console.warn('Erro no log de auditoria:', auditError);
        }
        return data.qrcode;
      } else if (data.success && data.data?.base64) {
        // Novo formato com base64
        await updateInstanceStatus(instanceId, 'qr_code');
        try { 
          await logAudit({ action: 'whatsapp.instance_qr_generated', resource: 'whatsapp_instance', resourceId: instanceId, meta: null }); 
        } catch (auditError) {
          console.warn('Erro no log de auditoria:', auditError);
        }
        return data.data.base64;
      } else {
        console.warn('⚠️ QR code não encontrado na resposta:', data);
        throw new Error(data.message || 'QR code não disponível. Verifique se a instância foi criada corretamente.');
      }

    } catch (error: any) {
      console.error('❌ Erro completo ao gerar QR code:', error);
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Erro de conexão com o servidor. Verifique sua internet e tente novamente.');
      }
      throw new Error(getUserFriendlyErrorMessage(error, 'Não foi possível gerar o QR Code agora. Tente novamente.'));
    }
  };

  // Funções simplificadas para compatibilidade
  const loadChats = async (instanceId: string) => {
    console.warn('⚠️ loadChats: Funcionalidade não implementada - usando apenas endpoints externos');
    return [];
  };

  const createChat = async (chatData: any) => {
    console.warn('⚠️ createChat: Funcionalidade não implementada - usando apenas endpoints externos');
    throw new Error('Funcionalidade não disponível via endpoints');
  };

  const loadMessages = async (chatId: string): Promise<WhatsAppMessage[]> => {
    console.warn('⚠️ loadMessages: Funcionalidade não implementada - usando apenas endpoints externos');
    return [];
  };

  const sendMessage = async (messageData: any) => {
    console.warn('⚠️ sendMessage: Funcionalidade não implementada - usando apenas endpoints externos');
    throw new Error('Funcionalidade não disponível via endpoints');
  };

  const markAsRead = async (chatId: string) => {
    console.warn('⚠️ markAsRead: Funcionalidade não implementada - usando apenas endpoints externos');
  };

  const getInstancesByUser = (userId: string) => {
    return instances.filter(instance => instance.user_id === userId);
  };

  const loadAvailableUsersForAssignment = async () => {
    try {
      if (!isManager) {
        console.warn('Apenas gestores podem carregar lista de usuários disponíveis');
        return [];
      }

      console.log('🔄 Carregando usuários disponíveis para atribuição de instâncias');

      // Buscar todos os usuários da empresa
      const { data: allUsers, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role, chat_instance')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .in('role', ['corretor', 'gestor'])
        .neq('id', profile?.id);

      if (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        throw error;
      }

      // TODO: Filtrar usuários que já têm instâncias quando RPC estiver funcionando
      const availableUsers = (allUsers || []).filter((u: any) => !u.chat_instance);

      console.log('✅ Usuários encontrados:', {
        count: availableUsers.length,
        users: availableUsers.map(u => `${u.full_name} (${u.role})`)
      });

      return availableUsers || [];
    } catch (error: any) {
      console.error('❌ Erro ao carregar usuários disponíveis:', error);
      return [];
    }
  };

  const requestConnection = async (instanceData: any) => {
    console.warn('⚠️ requestConnection: Funcionalidade não implementada - criação direta via endpoints');
    return await createInstance(instanceData);
  };

  const resendConnectionRequest = async (requestId: string, extraMessage?: string) => {
    console.warn('⚠️ resendConnectionRequest: Funcionalidade não implementada - sem sistema de solicitações');
    return { ok: true };
  };

  const approveConnectionRequest = async (instanceId: string) => {
    console.warn('⚠️ approveConnectionRequest: Funcionalidade não implementada - sem sistema de solicitações');
    throw new Error('Funcionalidade não disponível via endpoints');
  };

  const getPendingRequests = () => {
    console.warn('⚠️ getPendingRequests: Funcionalidade não implementada - sem sistema de solicitações');
    return [];
  };

  // Sincronizar mapeamentos com instâncias existentes no endpoint
  const syncInstanceMappings = async () => {
    try {
      if (!isManager || !profile?.company_id) return;

      console.log('🔄 Sincronizando mapeamentos com instâncias do endpoint...');

      // Buscar instâncias que existem no endpoint mas não têm mapeamento
      const instancesWithoutMapping = instances.filter(instance => !instance.user_id);
      
      if (instancesWithoutMapping.length > 0) {
        console.log(`⚠️ Encontradas ${instancesWithoutMapping.length} instâncias sem mapeamento:`, 
          instancesWithoutMapping.map(i => i.name));
      }

      // TODO: Implementar limpeza de mapeamentos órfãos quando RPC estiver funcionando
      console.log('ℹ️ Sincronização de mapeamentos será implementada quando RPC estiver funcionando.');

    } catch (error) {
      console.error('❌ Erro na sincronização de mapeamentos:', error);
    }
  };

  const loadAllUsers = async () => {
    console.warn('⚠️ loadAllUsers está deprecated, use loadAvailableUsersForAssignment');
    return loadAvailableUsersForAssignment();
  };

  // Obter estatísticas das instâncias
  const getInstanceStats = () => {
    return {
      total_instances: instances.length,
      connected_instances: instances.filter(i => i.status === 'connected').length,
      total_chats: instances.reduce((sum, i) => sum + (i.chat_count || 0), 0),
      total_messages: instances.reduce((sum, i) => sum + (i.message_count || 0), 0),
      unread_messages: 0 // Será calculado quando tivermos dados dos chats
    };
  };

  // Configurar instância via endpoint
  const configureInstance = async (instanceName: string, config: any) => {
    try {
      console.log('⚙️ Chamando endpoint: POST /webhook/config-instancia para', instanceName);
      
      const response = await fetch(`${WHATSAPP_API_BASE}/config-instancia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          instanceName,
          ...config
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Erro ao configurar instância:', response.status, errorText);
        throw new Error(`Erro ao configurar instância (${response.status})`);
      }

      const data = await parseWebhookResponse(response);
      console.log(`⚙️ Instância ${instanceName} configurada:`, data);
      
      return data;

    } catch (error: any) {
      console.error('Erro ao configurar instância:', error);
      throw new Error(getUserFriendlyErrorMessage(error, 'Não foi possível carregar as configurações desta conexão.'));
    }
  };

  // Editar configuração da instância via endpoint
  const editInstanceConfig = async (instanceName: string, newConfig: any) => {
    try {
      console.log('✏️ Chamando endpoint: POST /webhook/edit-config-instancia para', instanceName);
      
      const response = await fetch(`${WHATSAPP_API_BASE}/edit-config-instancia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          instanceName,
          ...newConfig
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Erro ao editar configuração da instância:', response.status, errorText);
        throw new Error(`Erro ao editar configuração (${response.status})`);
      }

      const data = await parseWebhookResponse(response);
      console.log(`✏️ Configuração da instância ${instanceName} editada:`, data);
      
      return data;

    } catch (error: any) {
      console.error('Erro ao editar configuração da instância:', error);
      throw new Error(getUserFriendlyErrorMessage(error, 'Não foi possível salvar as configurações desta conexão.'));
    }
  };



  useEffect(() => {
    if (profile) {
      loadInstances();
    }
  }, [profile, isManager, isOfficialApi]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    instances,
    chats,
    loading,
    error,
    // Funções principais via endpoints
    createInstance,
    updateInstanceStatus,
    deleteInstance,
    generateQrCode,
    configureInstance,
    editInstanceConfig,
    connectInstance,
    disconnectInstance,
    // Funções de compatibilidade (simplificadas)
    loadChats,
    createChat,
    loadMessages,
    sendMessage,
    markAsRead,
    getInstancesByUser,
    loadAllUsers,
    loadAvailableUsersForAssignment,
    requestConnection,
    resendConnectionRequest,
    approveConnectionRequest,
    getPendingRequests,
    // Utilitários
    getInstanceStats,
    refreshInstances: loadInstances,
    syncInstanceMappings, // Nova função de sincronização
    canCreateInstances: isManager // Helper para saber se pode criar instâncias
  };
} 