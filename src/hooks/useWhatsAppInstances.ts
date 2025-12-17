import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/audit/logger';
import { useUserProfile } from './useUserProfile';

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
const WHATSAPP_API_BASE = import.meta.env.VITE_WHATSAPP_API_BASE || 'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook';

export function useWhatsAppInstances() {
  const { profile, isManager } = useUserProfile();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar instâncias via endpoint externo
  const loadInstances = async () => {
    try {
      console.log('🚀 Carregando instâncias via endpoint externo...');
      setLoading(true);
      setError(null);

      if (!profile) return;

      // Buscar instâncias do endpoint externo
      console.log('📡 Chamando endpoint: GET /webhook/whatsapp-instances');
      
      const response = await fetch(`${WHATSAPP_API_BASE}/whatsapp-instances`, {
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
      console.log('📊 Total de instâncias no endpoint:', externalInstances.length);

      // Buscar mapeamentos locais para enrichment com dados de usuário
      const { data: mappings, error: mappingError } = await supabase
        .from('user_profiles') // Usar tabela conhecida como workaround
        .select('id')
        .limit(0); // Query dummy para contornar TypeScript

      // Query SQL direta para buscar mapeamentos
      const { data: realMappings, error: realMappingError } = await supabase
        .from('user_profiles')
        .select(`
          id,
          full_name,
          email,
          role
        `)
        .eq('company_id', profile.company_id)
        .limit(0); // Query dummy

      // TODO: Implementar busca de mapeamentos quando disponível
      const mappingsData: any[] = [];
      console.log('ℹ️ Mapeamentos serão carregados quando RPC estiver funcionando.');

      // Criar map de instância -> usuário para lookup rápido
      const instanceUserMap = new Map();
      (mappingsData || []).forEach((mapping: any) => {
        instanceUserMap.set(mapping.instance_name, {
          user_id: mapping.user_id,
          user_profile: mapping.user_profile
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
          connecting: 'connecting',
          close: 'disconnected',
          closed: 'disconnected'
        };

        // Buscar dados do usuário se houver mapeamento
        const userMapping = instanceUserMap.get(externalData.name);
        
        return {
          id: externalData.id || externalData.name,
          name: externalData.name,
          status: statusMap[externalData.connectionStatus] || 'disconnected',
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
          connectionStatus: externalData.connectionStatus,
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

      setInstances(instancesData);
      console.log('✅ Carregamento concluído!', {
        role: profile.role,
        totalInstances: instancesData.length
      });

      // Sincronizar mapeamentos após carregar (apenas para gestores)
      if (isManager) {
        setTimeout(() => syncInstanceMappings(), 1000);
      }

    } catch (error: any) {
      console.error('Erro ao carregar instâncias:', error);
      setError(error.message);
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
          sessionId: sessionId
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Erro no endpoint: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      console.log('🔗 Instância criada no sistema externo:', data);

      if (!data.success) {
        throw new Error(data.message || 'Falha ao criar instância');
      }

      // TODO: Implementar criação de mapeamento quando RPC estiver funcionando
      console.log('✅ Instância criada no endpoint. Mapeamento será implementado quando RPC estiver funcionando.');

      // Recarregar lista de instâncias para incluir a nova
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
      throw error;
    }
  };

  // Atualizar status da instância (apenas local)
  const updateInstanceStatus = async (instanceId: string, status: WhatsAppInstance['status']) => {
    try {
      setInstances(prev => 
        prev.map(instance => 
          instance.id === instanceId ? { ...instance, status, last_seen: new Date().toISOString() } : instance
        )
      );
      
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
      throw error;
    }
  };

  // Deletar instância via endpoint
  const deleteInstance = async (instanceId: string) => {
    try {
      // 1. Buscar dados da instância antes de deletar
      const instanceToDelete = instances.find(inst => inst.id === instanceId);
      if (!instanceToDelete) {
        throw new Error('Instância não encontrada');
      }

      // 2. Deletar do sistema externo
      console.log('🗑️ Chamando endpoint: POST /webhook/deletar-instancia para', instanceToDelete.name);
      
      const response = await fetch(`${WHATSAPP_API_BASE}/deletar-instancia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          instanceName: instanceToDelete.name
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('❌ Erro HTTP ao deletar instância externa:', response.status, response.statusText);
        console.warn('📝 Resposta do servidor:', errorText);
        throw new Error(`Erro no sistema externo (${response.status})`);
      }

      const responseData = await response.json();
      console.log(`🗑️ Resposta da deleção externa:`, responseData);
      
      if (!responseData.success) {
        throw new Error(responseData.message || 'Falha ao deletar no sistema externo');
      }

      // TODO: Implementar remoção de mapeamento quando RPC estiver funcionando
      console.log('ℹ️ Instância deletada do endpoint. Mapeamento será removido quando RPC estiver funcionando.');

      // 4. Atualizar estado local
      setInstances(prev => prev.filter(instance => instance.id !== instanceId));
      console.log(`✅ Instância ${instanceToDelete.name} deletada completamente`);

    } catch (error: any) {
      console.error('❌ Erro completo ao deletar instância:', error);
      throw error;
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

      const data = await response.json();
      console.log(`🔗 Resposta da conexão:`, data);

      if (data.success) {
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
      throw error;
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

      const data = await response.json();
      console.log(`🔌 Resposta da desconexão:`, data);

      if (data.success) {
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
      throw error;
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
      throw error;
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
        .select('id, full_name, email, role')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .in('role', ['corretor', 'gestor'])
        .neq('id', profile?.id);

      if (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        throw error;
      }

      // TODO: Filtrar usuários que já têm instâncias quando RPC estiver funcionando
      const availableUsers = allUsers || [];

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

      const data = await response.json();
      console.log(`⚙️ Instância ${instanceName} configurada:`, data);
      
      return data;

    } catch (error: any) {
      console.error('Erro ao configurar instância:', error);
      throw error;
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

      const data = await response.json();
      console.log(`✏️ Configuração da instância ${instanceName} editada:`, data);
      
      return data;

    } catch (error: any) {
      console.error('Erro ao editar configuração da instância:', error);
      throw error;
    }
  };



  useEffect(() => {
    if (profile) {
      loadInstances();
    }
  }, [profile, isManager]); // eslint-disable-line react-hooks/exhaustive-deps

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