import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import {
  Smartphone,
  Plus,
  RefreshCw,
  QrCode,
  MessageCircle,
  Phone,
  XCircle,
  Clock,
  AlertTriangle,
  Settings,
  Search,
  RotateCcw,
  Check
} from "lucide-react";
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWhatsAppInstances, WhatsAppInstance } from '@/hooks/useWhatsAppInstances';
import { useNotifications } from '@/hooks/useNotifications';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useCompanyApiMode } from '@/hooks/useCompanyApiMode';
import { supabase } from '@/integrations/supabase/client';
import { useConversasList } from '@/hooks/useConversasList';
import { useInstagramConversasList } from '@/hooks/useInstagramConversasList';
import { useInstagramInstances } from '@/hooks/useInstagramInstances';
import { invokeEdge } from '@/integrations/supabase/invoke';
import { toast } from 'sonner';
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import { OfficialApiConnectionsView } from "./OfficialApiConnectionsView";
import { CompanyInstagramConnectionsSection } from "./CompanyInstagramConnectionsSection";
import { syncCompanyPhoneFromWhatsApp } from '@/lib/syncCompanyPhoneFromWhatsApp';
import { ConnectionsTopBar } from '@/components/connections/ConnectionsTopBar';
import { ConnectionsToolbar } from '@/components/connections/ConnectionsToolbar';
import { ConnectionsKpis } from '@/components/connections/ConnectionsKpis';
import { ConnectionsSyncBanner } from '@/components/connections/ConnectionsSyncBanner';
import { ConnectionsInstanceCard } from '@/components/connections/ConnectionsInstanceCard';
import {
  INSTANCE_PLAN_LIMIT,
  buildActiveChannelLabels,
  buildConnectionsKpis,
  buildConnectionsSubtitle,
  buildInstanceChannelStats,
  countActiveChannels,
} from '@/components/connections/helpers';

const QR_TIMEOUT_SECONDS = 180;

export function ConnectionsViewSimplified() {
  const parseInstancesFromPayload = (payload: any): any[] => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.instances)) return payload.instances;
    if (Array.isArray(payload?.response)) return payload.response;
    if (payload?.instance && typeof payload.instance === "object") return [payload.instance];
    if (payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data)) return [payload.data];
    return [];
  };

  const isInstanceOnline = (instance: any) => {
    const statusCandidates = [
      instance?.connectionStatus,
      instance?.status,
      instance?.state,
      instance?.instance?.state,
      instance?.instance?.status,
      instance?.data?.state,
      instance?.data?.status,
      instance?.session?.status,
      instance?.session?.state,
      instance?.connection?.state,
      instance?.connection?.status,
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    if (statusCandidates.some((s) => ["open", "connected", "online", "opened"].includes(s))) {
      return true;
    }

    const boolCandidates = [
      instance?.connected,
      instance?.isConnected,
      instance?.instance?.connected,
      instance?.instance?.isConnected,
      instance?.session?.connected,
      instance?.session?.isConnected,
      instance?.data?.connected,
      instance?.data?.isConnected,
    ];
    return boolCandidates.some((v) => v === true);
  };
  const navigate = useNavigate();
  const { profile, isManager } = useUserProfile();
  const { settings } = useCompanySettings();
  const { isOfficialApi, loadingApiMode } = useCompanyApiMode();
  const { createConnectionRequest } = useNotifications();
  const {
    instances,
    loading,
    error,
    syncWarning,
    createInstance,
    requestConnection,  // Nova função integrada
    updateInstanceStatus,
    deleteInstance,
    generateQrCode,
    configureInstance,
    editInstanceConfig,
    getInstanceStats,
    loadAllUsers,
    refreshInstances,
    canCreateInstances,
    connectInstance,
    disconnectInstance,
    resendConnectionRequest
  } = useWhatsAppInstances();

  const canCreate = (isManager || canCreateInstances) && !isOfficialApi;
  const { conversas } = useConversasList(null);
  const { companyInstagramId, scopedInstance } = useInstagramInstances();
  const { conversas: conversasInstagram } = useInstagramConversasList(
    scopedInstance,
    companyInstagramId,
  );
  const [hasCurrentUserConnection, setHasCurrentUserConnection] = useState(Boolean(profile?.chat_instance));

  const [showAddModal, setShowAddModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newInstancePhone, setNewInstancePhone] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<string>("self");
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [showSystemAlert, setShowSystemAlert] = useState(false);
  const [systemMessagesCount, setSystemMessagesCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [syncBannerDismissed, setSyncBannerDismissed] = useState(false);
  const [lastSuccessfulSync, setLastSuccessfulSync] = useState<Date | null>(null);
  const [hasInstagramChannel, setHasInstagramChannel] = useState(false);
  const [hasSiteChannel, setHasSiteChannel] = useState(false);

  // Estados para solicitação ao gestor
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestingConnection, setRequestingConnection] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingRequestData, setPendingRequestData] = useState<any | null>(null);
  const [resending, setResending] = useState(false);

  // Novos estados para funcionalidades completas
  const [qrTimer, setQrTimer] = useState(15);

  // Função para formatar telefone brasileiro: (DDD) 9 XXXX-XXXX
  const formatPhoneInput = (value: string): string => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');

    // Limita a 11 dígitos (DDD + 9 dígitos do número)
    const limitedNumbers = numbers.slice(0, 11);

    if (limitedNumbers.length === 0) return '';

    const ddd = limitedNumbers.slice(0, 2);
    let numero = limitedNumbers.slice(2);

    // Garante que sempre começa com 9 após o DDD
    if (numero.length > 0 && !numero.startsWith('9')) {
      numero = '9' + numero.slice(0, 8);
    }

    // Aplica a máscara progressivamente
    if (limitedNumbers.length <= 2) {
      return `(${ddd}`;
    } else if (limitedNumbers.length <= 7) {
      return `(${ddd}) ${numero.slice(0, 5)}`;
    } else if (limitedNumbers.length <= 10) {
      return `(${ddd}) ${numero.slice(0, 1)} ${numero.slice(1, 5)}-${numero.slice(5)}`;
    } else {
      // Completo: (DDD) 9 XXXX-XXXX
      return `(${ddd}) ${numero.slice(0, 1)} ${numero.slice(1, 5)}-${numero.slice(5, 9)}`;
    }
  };

  // Handler para mudança do telefone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setNewInstancePhone(formatted);
  };
  const [qrExpired, setQrExpired] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [connectedInstanceName, setConnectedInstanceName] = useState("");
  const [instanceToDelete, setInstanceToDelete] = useState<WhatsAppInstance | null>(null);
  const [deletingInstance, setDeletingInstance] = useState(false);

  // Estados para gestão de solicitações pendentes (apenas gestores)
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Carregar solicitações pendentes (apenas para gestores)
  const loadPendingRequests = async () => {
    if (!isManager || !profile?.company_id) return;

    try {
      setLoadingRequests(true);
      const { data, error } = await supabase
        .from('connection_requests')
        .select(`
          *,
          user_profile:user_profiles!connection_requests_user_id_fkey(full_name, email, role)
        `)
        .eq('company_id', profile.company_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingRequests(data || []);
    } catch (error) {
      console.error('Erro ao carregar solicitações pendentes:', error);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Aprovar solicitação
  const handleApproveRequest = async (requestId: string) => {
    try {
      const request = pendingRequests.find(req => req.id === requestId);
      if (!request) return;

      // 1. Marcar solicitação como aprovada
      const { error: updateError } = await supabase
        .from('connection_requests')
        .update({
          status: 'approved',
          approved_by: profile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // 2. Criar a instância WhatsApp AGORA (só quando aprovada)
      const { data: newInstance, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .insert({
          user_id: request.user_id,
          company_id: request.company_id,
          instance_name: request.instance_name,
          phone_number: request.phone_number,
          request_status: 'approved',
          status: 'qr_code', // Pronto para gerar QR
          webhook_url: `https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/imobiliaria`,
          is_active: true
        })
        .select()
        .single();

      if (instanceError) throw instanceError;

      // 3. Criar notificação para o solicitante
      await supabase
        .from('user_notifications')
        .insert({
          user_id: request.user_id,
          company_id: request.company_id,
          type: 'connection_approved',
          title: 'Solicitação aprovada',
          body: `Sua solicitação de conexão "${request.instance_name}" foi aprovada! Você pode gerar o QR code agora.`,
          meta: {
            instance_id: newInstance.id,
            instance_name: request.instance_name,
            approved_by: profile?.id,
            approved_by_name: profile?.full_name,
            route: '/connections',
          },
        });

      // 4. Remover da lista de pendentes e atualizar instâncias
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));
      refreshInstances();

      alert('Solicitação aprovada com sucesso! Instância criada.');
    } catch (error) {
      console.error('Erro ao aprovar solicitação:', error);
      alert('Erro ao aprovar solicitação. Tente novamente.');
    }
  };

  // Rejeitar solicitação
  const handleRejectRequest = async (requestId: string) => {
    try {
      const request = pendingRequests.find(req => req.id === requestId);
      if (!request) return;

      // Marcar solicitação como rejeitada (não deletar, manter histórico)
      const { error } = await supabase
        .from('connection_requests')
        .update({
          status: 'rejected',
          rejected_by: profile?.id,
          rejected_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      // Criar notificação para o solicitante
      await supabase
        .from('user_notifications')
        .insert({
          user_id: request.user_id,
          company_id: request.company_id,
          type: 'connection_rejected',
          title: 'Solicitação rejeitada',
          body: `Sua solicitação de conexão "${request.instance_name}" foi rejeitada.`,
          meta: {
            request_id: requestId,
            instance_name: request.instance_name,
            rejected_by: profile?.id,
            rejected_by_name: profile?.full_name,
            route: '/connections',
          },
        });

      // Remover da lista de pendentes
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));

      alert('Solicitação rejeitada.');
    } catch (error) {
      console.error('Erro ao rejeitar solicitação:', error);
      alert('Erro ao rejeitar solicitação. Tente novamente.');
    }
  };
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedConfigInstance, setSelectedConfigInstance] = useState<WhatsAppInstance | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [instanceConfig, setInstanceConfig] = useState<any>(null);
  const [configFields, setConfigFields] = useState({
    rejectCall: false,
    msgCall: '',
    groupsIgnore: false,
    alwaysOnline: false,
    readMessages: false,
    readStatus: false
  });

  // Filtrar instâncias
  const filteredInstances = instances.filter(instance => {
    const matchesSearch = instance.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instance.phone_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || instance.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Obter estatísticas
  const stats = getInstanceStats();
  const systemChatsCount = conversas.length + conversasInstagram.length;
  const instanceLimit = INSTANCE_PLAN_LIMIT;
  const atInstanceLimit = hasCurrentUserConnection || stats.total_instances >= instanceLimit;

  const kpis = useMemo(
    () =>
      buildConnectionsKpis({
        totalInstances: stats.total_instances,
        instanceLimit,
        connectedInstances: stats.connected_instances,
        activeChats: systemChatsCount,
        messagesCount: systemMessagesCount,
        messagesHint: 'últimas 24 h · WhatsApp + Instagram',
        activeChannels: countActiveChannels({
          whatsappConnected: stats.connected_instances > 0,
          hasInstagram:
            hasInstagramChannel ||
            conversasInstagram.length > 0 ||
            Boolean(companyInstagramId),
          // Canais de mensageria: WA + IG (Site não entra neste KPI)
        }),
        channelLabels: buildActiveChannelLabels({
          whatsappConnected: stats.connected_instances > 0,
          hasInstagram:
            hasInstagramChannel ||
            conversasInstagram.length > 0 ||
            Boolean(companyInstagramId),
        }),
        chatsHint:
          conversas.length > 0 || conversasInstagram.length > 0
            ? `WhatsApp ${conversas.length.toLocaleString('pt-BR')} · Instagram ${conversasInstagram.length.toLocaleString('pt-BR')}`
            : undefined,
      }),
    [
      stats.total_instances,
      stats.connected_instances,
      systemChatsCount,
      systemMessagesCount,
      hasInstagramChannel,
      instanceLimit,
      conversas.length,
      conversasInstagram.length,
      companyInstagramId,
    ],
  );

  const handleRefreshConnections = async () => {
    try {
      setRefreshing(true);
      await refreshInstances();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!loading && !syncWarning) {
      setLastSuccessfulSync(new Date());
      setSyncBannerDismissed(false);
    }
  }, [loading, syncWarning, instances.length]);

  useEffect(() => {
    const loadChannelFlags = async () => {
      if (!profile?.company_id) {
        setHasInstagramChannel(false);
        setHasSiteChannel(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('companies')
          .select('id_instagram, slug, display_name')
          .eq('id', profile.company_id)
          .single();
        const idIg = data?.id_instagram != null ? String(data.id_instagram).trim() : '';
        setHasInstagramChannel(Boolean(idIg));
        setHasSiteChannel(Boolean(data?.slug || data?.display_name));
      } catch {
        setHasInstagramChannel(false);
        setHasSiteChannel(false);
      }
    };
    void loadChannelFlags();
  }, [profile?.company_id]);
  const buildSafeInstanceName = (fullName?: string | null, email?: string | null) => {
    const raw = `${fullName || "usuario"}_${email || "sememail"}`.toLowerCase().trim();
    const noAccents = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const sanitized = noAccents
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._-]/g, "")
      .replace(/^[._-]+|[._-]+$/g, "");
    return sanitized || `usuario_${Date.now()}`;
  };
  const autoInstanceName = buildSafeInstanceName(profile?.full_name, profile?.email);

  useEffect(() => {
    const loadMessagesLast24h = async () => {
      if (!profile?.company_id) {
        setSystemMessagesCount(0);
        return;
      }

      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        // Tabela unificada `mensagens` (WhatsApp + Instagram) — últimas 24h de todos os canais.
        const { count, error } = await supabase
          .from('mensagens')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', profile.company_id)
          .gte('created_at', since);

        if (error) throw error;
        setSystemMessagesCount(count ?? 0);
      } catch (err) {
        console.warn('Falha ao contar mensagens 24h:', err);
        setSystemMessagesCount(0);
      }
    };

    void loadMessagesLast24h();
  }, [profile?.company_id, instances.length, conversas.length, conversasInstagram.length]);

  useEffect(() => {
    const syncCurrentUserConnectionState = async () => {
      if (!profile?.id) return;

      try {
        // Busca estado real salvo no banco
        const { data: userRow, error: userError } = await supabase
          .from('user_profiles')
          .select('chat_instance')
          .eq('id', profile.id)
          .maybeSingle();

        if (userError) {
          setHasCurrentUserConnection(Boolean(profile?.chat_instance));
          return;
        }

        const chatInstance = String(userRow?.chat_instance || '').trim();
        if (!chatInstance) {
          setHasCurrentUserConnection(false);
          return;
        }

        // Se a instância não existe mais na listagem atual, limpa vínculo órfão
        // (evita ficar travado quando foi apagada manualmente fora da plataforma)
        const existsInCurrentList = instances.some(
          (inst) => String(inst?.name || '').trim().toLowerCase() === chatInstance.toLowerCase()
        );

        if (!existsInCurrentList && !error) {
          // Confere registro local antes de limpar vínculo do usuário
          const { data: localRegistryMatch } = await supabase
            .from('company_whatsapp_instances' as any)
            .select('id')
            .eq('company_id', profile.company_id)
            .eq('instance_name', chatInstance)
            .eq('is_active', true)
            .limit(1);

          const hasLocalActiveRegistry = Array.isArray(localRegistryMatch) && localRegistryMatch.length > 0;
          if (hasLocalActiveRegistry) {
            setHasCurrentUserConnection(true);
            return;
          }

          const { error: clearError } = await supabase
            .from('user_profiles')
            .update({ chat_instance: null })
            .eq('id', profile.id);

          if (!clearError) {
            setHasCurrentUserConnection(false);
            return;
          }
        }

        setHasCurrentUserConnection(true);
      } catch {
        setHasCurrentUserConnection(Boolean(profile?.chat_instance));
      }
    };

    syncCurrentUserConnectionState();
  }, [profile?.id, profile?.chat_instance, instances, error]);

  useEffect(() => {
    if (showAddModal) {
      setNewInstanceName(autoInstanceName);
      setAssignedUserId("self");
    }
  }, [showAddModal, autoInstanceName]);

  // Carregar usuários quando modal abrir (apenas para gestores/admin)
  useEffect(() => {
    if (showAddModal && canCreate) {
      loadAllUsers().then(users => {
        setAvailableUsers(users);
      });
    }
  }, [showAddModal, canCreate]);

  // Carregar solicitações pendentes quando for gestor
  useEffect(() => {
    if (isManager && profile?.company_id && !isOfficialApi) {
      loadPendingRequests();
    }
  }, [isManager, profile?.company_id, isOfficialApi]);

  // Timer do QR Code
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;

    if (showQrModal && qrCode && !qrExpired) {
      setQrTimer(QR_TIMEOUT_SECONDS); // Reset timer when modal opens
      timerInterval = setInterval(() => {
        setQrTimer((prevTimer) => {
          if (prevTimer <= 1) {
            setQrExpired(true);
            return 0;
          }
          return prevTimer - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [showQrModal, qrCode, qrExpired]);

  // Monitorar conexão quando QR code modal estiver aberto
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (showQrModal && selectedInstance && !qrExpired) {
      // Verificar status a cada 5 segundos através do endpoint externo
      intervalId = setInterval(async () => {
        try {
          console.log('🔍 Verificando status da instância:', selectedInstance.name);

          // Consulta de status conforme fluxo n8n informado:
          // POST /webhook/config-instancia com body { instanceName }
          const whatsappApiBase =
            import.meta.env.VITE_WHATSAPP_API_BASE ||
            'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook';

          const response = await fetch(`${whatsappApiBase}/config-instancia`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            mode: 'cors',
            body: JSON.stringify({
              instanceName: selectedInstance.name,
            }),
          });

          if (!response.ok) {
            console.warn('Erro ao verificar status:', response.status);
            return;
          }

          const rawText = await response.text();
          let payload: any = null;
          if (rawText?.trim()) {
            try {
              payload = JSON.parse(rawText);
            } catch {
              payload = null;
            }
          }

          const instanceList = parseInstancesFromPayload(payload);
          const updatedInstanceFromList = instanceList.find((inst: any) =>
            String(inst?.name || inst?.instanceName || '').toLowerCase() === String(selectedInstance.name || '').toLowerCase()
          );
          const updatedInstance = updatedInstanceFromList || payload?.data || payload;
          const isOnline = isInstanceOnline(updatedInstance);

          if (isOnline) {
            console.log('✅ Instância conectada com sucesso via endpoint:', selectedInstance.name);

            const connectedPhone =
              updatedInstance?.ownerJid?.replace('@s.whatsapp.net', '') ||
              updatedInstance?.ownerJid ||
              selectedInstance.phone_number ||
              '';

            if (connectedPhone) {
              await syncCompanyPhoneFromWhatsApp(connectedPhone);
            }

            // Fechar modal QR e mostrar sucesso
            setShowQrModal(false);
            setQrCode(null);
            setQrTimer(QR_TIMEOUT_SECONDS);
            setQrExpired(false);
            setConnectedInstanceName(
              updatedInstance?.profileName ||
              updatedInstance?.profile_name ||
              selectedInstance.name
            );
            setShowSuccessModal(true);

            // Atualizar status local
            await updateInstanceStatus(selectedInstance.id, 'connected', connectedPhone);

            // Atualizar lista de instâncias
            await refreshInstances();

            // Fechar modal de sucesso após 3 segundos
            setTimeout(() => {
              setShowSuccessModal(false);
            }, 3000);
          }
        } catch (error) {
          console.error('Erro ao verificar status da instância via endpoint:', error);
        }
      }, 5000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [showQrModal, selectedInstance, qrExpired]);

  // Criar nova instância
  const handleCreateInstance = async () => {
    try {
      setCreating(true);
      const safeInstanceName = autoInstanceName;

      if (!newInstancePhone.trim()) {
        throw new Error('Número de telefone é obrigatório para criar a instância');
      }

      // Remove formatação do telefone antes de enviar (apenas números)
      const phoneNumbersOnly = newInstancePhone.replace(/\D/g, '');
      // Adiciona código do país +55 se não tiver
      const formattedPhone = phoneNumbersOnly.length === 11
        ? `55${phoneNumbersOnly}`
        : phoneNumbersOnly.startsWith('55')
          ? phoneNumbersOnly
          : `55${phoneNumbersOnly}`;

      const result = await createInstance({
        instance_name: safeInstanceName,
        phone_number: formattedPhone,
        assigned_user_id: undefined
      });

      setNewInstanceName("");
      setNewInstancePhone("");
      setAssignedUserId("self");
      setShowAddModal(false);

      // Mostrar sucesso
      if (result && result.success) {
        alert('Instância criada com sucesso!');
      }
    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  // Simular conexão (atualizar status)
  const handleConnect = async (instance: WhatsAppInstance) => {
    try {
      await connectInstance(instance.id);
    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      alert(`Erro: ${error.message}`);
    }
  };

  // Simular desconexão
  const handleDisconnect = async (instance: WhatsAppInstance) => {
    try {
      await disconnectInstance(instance.id);
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      alert(`Erro: ${error.message}`);
    }
  };

  // Deletar instância
  const handleDeleteInstance = async (instanceId: string) => {
    const target = instances.find((inst) => inst.id === instanceId) || null;
    setInstanceToDelete(target);
  };

  const confirmDeleteInstance = async () => {
    if (!instanceToDelete) return;
    try {
      setDeletingInstance(true);
      await deleteInstance(instanceToDelete.id);
      setInstanceToDelete(null);
      toast.success('Instância removida com sucesso.');
    } catch (error: any) {
      console.error('Erro ao deletar instância:', error);
      toast.error(error?.message || 'Não foi possível remover a instância.');
    } finally {
      setDeletingInstance(false);
    }
  };

  // Gerar QR Code
  const handleGenerateQrCode = async (instance: WhatsAppInstance) => {
    try {
      setGeneratingQr(true);
      setSelectedInstance(instance);

      const { data: googleStatus, error: googleStatusError } = await invokeEdge<any, any>("google-calendar-auth", {
        body: { action: "status" },
      });

      if (googleStatusError || !googleStatus?.connected) {
        toast.warning("Conecte sua Agenda Google para a IA oferecer horarios corretamente.");
      }

      const qrCodeData = await generateQrCode(instance.id);

      if (qrCodeData) {
        setQrCode(qrCodeData);
        setQrTimer(QR_TIMEOUT_SECONDS); // Reset timer
        setQrExpired(false); // Reset expired state
        setShowQrModal(true);
      } else {
        alert('Não foi possível gerar o QR code');
      }
    } catch (error: any) {
      console.error('Erro ao gerar QR code:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setGeneratingQr(false);
    }
  };

  // Retry QR Code quando expirado
  const handleRetryQrCode = async () => {
    if (selectedInstance) {
      setQrExpired(false);
      await handleGenerateQrCode(selectedInstance);
    }
  };

  // Configurar instância
  const handleShowConfig = async (instance: WhatsAppInstance) => {
    setSelectedConfigInstance(instance);
    setShowConfigModal(true);
    setLoadingConfig(true);
    setInstanceConfig(null);

    try {
      const result = await configureInstance(instance.name, {
        instanceName: instance.name,
        instanceId: instance.id
      });

      if (result && result.success && result.data) {
        const configData = Array.isArray(result.data) && result.data[0]?.Setting ?
          result.data[0].Setting : result.data;

        setInstanceConfig(configData);

        // Atualizar campos com os dados recebidos
        if (configData) {
          setConfigFields({
            rejectCall: Boolean(configData.rejectCall),
            msgCall: String(configData.msgCall || ''),
            groupsIgnore: Boolean(configData.groupsIgnore),
            alwaysOnline: Boolean(configData.alwaysOnline),
            readMessages: Boolean(configData.readMessages),
            readStatus: Boolean(configData.readStatus)
          });
        }
      }
    } catch (error: any) {
      console.error('Erro ao buscar configurações:', error);
      alert('Erro ao carregar configurações. Tente novamente.');
    } finally {
      setLoadingConfig(false);
    }
  };

  // Salvar configurações
  const handleSaveConfig = async () => {
    if (!selectedConfigInstance) return;

    try {
      setSavingConfig(true);

      await editInstanceConfig(selectedConfigInstance.name, {
        instanceName: selectedConfigInstance.name,
        instanceId: selectedConfigInstance.id,
        config: configFields
      });

      setShowConfigModal(false);
      alert('Configurações salvas com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setSavingConfig(false);
    }
  };

  // Solicitar conexão ao gestor (novo método integrado)
  const handleRequestConnection = async () => {
    try {
      setRequestingConnection(true);

      // Validar nome da instância
      if (!newInstanceName.trim()) {
        alert('Por favor, informe o nome da instância');
        return;
      }

      // Usar o novo método integrado que cria a instância + notifica automaticamente
      await requestConnection({
        instance_name: newInstanceName.trim(),
        phone_number: newInstancePhone.trim() || undefined,
        message: requestMessage || undefined
      });

      setShowRequestModal(false);
      setNewInstanceName("");
      setNewInstancePhone("");
      setRequestMessage("");

      alert('Solicitação criada com sucesso! Os gestores foram notificados automaticamente.');
    } catch (error: any) {
      console.error('Erro ao solicitar conexão:', error);
      if (error?.code === 'REQUEST_ALREADY_EXISTS' && error?.pendingRequest) {
        setPendingRequestData(error.pendingRequest);
        setShowPendingModal(true);
      } else {
        alert(error.message || 'Erro ao enviar solicitação. Tente novamente.');
      }
    } finally {
      setRequestingConnection(false);
    }
  };

  const handleResendRequest = async () => {
    if (!pendingRequestData?.id) return;
    try {
      setResending(true);
      await resendConnectionRequest(pendingRequestData.id);
      alert('Solicitação reenviada aos gestores com sucesso.');
      setShowPendingModal(false);
    } catch (error: any) {
      console.error('Erro ao reenviar solicitação:', error);
      alert(error.message || 'Falha ao reenviar solicitação.');
    } finally {
      setResending(false);
    }
  };

  // Componente removido — ConnectionsInstanceCard em src/components/connections/

  if (loadingApiMode) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-[#F7F5F0] dark:bg-background">
        <Smartphone className="h-8 w-8 text-emerald-700" />
        <p className="ml-3 text-muted-foreground">Carregando tipo de integração...</p>
      </div>
    );
  }

  if (isOfficialApi) {
    return <OfficialApiConnectionsView />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-[#F7F5F0] dark:bg-background">
        <Smartphone className="h-8 w-8 text-emerald-700" />
        <p className="ml-3 text-muted-foreground">Carregando conexões...</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col min-w-0">
      <div className="border-b border-border/70">
        <div className="px-3 py-2 sm:px-5 sm:py-3 md:py-4">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm px-3 py-2 space-y-2 sm:px-4 sm:py-3 sm:space-y-3 md:px-6 md:py-4 md:space-y-4">
            <ConnectionsTopBar />
            <ConnectionsToolbar
              subtitle={buildConnectionsSubtitle(isManager)}
              instanceCount={stats.total_instances}
              instanceLimit={instanceLimit}
              atLimit={atInstanceLimit}
              canCreate={canCreate}
              onRefresh={() => void handleRefreshConnections()}
              onNewInstance={() => setShowAddModal(true)}
              refreshing={refreshing}
            />
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background">
        {syncWarning && !error && !syncBannerDismissed ? (
          <ConnectionsSyncBanner
            message="Sincronização com o servidor WhatsApp indisponível"
            lastSyncLabel={lastSuccessfulSync?.toLocaleTimeString('pt-BR')}
            onRetry={() => void handleRefreshConnections()}
            onDismiss={() => setSyncBannerDismissed(true)}
            retrying={refreshing}
          />
        ) : null}

        <ConnectionsKpis items={kpis} />

        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {showSystemAlert ? (
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-950 dark:text-amber-100">
              <strong>Sistema híbrido:</strong> A instância foi criada localmente com sucesso. O servidor WhatsApp
              externo pode estar indisponível — tente gerar o QR code quando precisar conectar.
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-6 px-2"
                onClick={() => setShowSystemAlert(false)}
              >
                Entendi
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4 min-w-0">
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Instâncias WhatsApp</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {filteredInstances.length} de {stats.total_instances} instância
                  {stats.total_instances !== 1 ? 's' : ''} · sincronização a cada 5 min
                </p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl bg-card border-border"
                />
              </div>
            </div>

            {isManager && pendingRequests.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  <h3 className="text-base font-semibold text-foreground">Solicitações pendentes</h3>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    {pendingRequests.length}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {pendingRequests.map((request) => (
                    <Card key={request.id} className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-foreground mb-1">{request.instance_name}</h4>
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                              Solicitado por: {request.user_profile?.full_name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(request.created_at).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                        </div>
                        {request.message ? (
                          <div className="rounded-lg border border-amber-200 bg-white/60 dark:bg-background/40 p-2 mb-3 text-xs text-amber-900 dark:text-amber-100">
                            "{request.message}"
                          </div>
                        ) : null}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApproveRequest(request.id)}
                            className="flex-1 btn-on-emerald bg-emerald-800 hover:bg-emerald-700"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectRequest(request.id)}
                            className="flex-1 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Rejeitar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : null}

            {filteredInstances.length > 0 ? (
              <div className="space-y-4">
                {filteredInstances.map((instance) => (
                  <ConnectionsInstanceCard
                    key={instance.id}
                    instance={instance}
                    generatingQr={generatingQr && selectedInstance?.id === instance.id}
                    channelStats={buildInstanceChannelStats({
                      instanceName: instance.name,
                      evolutionMessages: instance.message_count,
                      evolutionContacts: instance.contact_count,
                      evolutionChats: instance.chat_count,
                      conversas,
                      companyMessagesTotal: systemMessagesCount,
                      isSoleInstance: filteredInstances.length === 1 || instances.length === 1,
                    })}
                    onGenerateQr={handleGenerateQrCode}
                    onViewConversations={() => navigate('/conversas')}
                    onDisconnect={handleDisconnect}
                    onConnect={handleConnect}
                    onConfigure={handleShowConfig}
                    onDelete={handleDeleteInstance}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-border bg-card shadow-sm">
                <CardContent className="p-10 text-center">
                  <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma conexão encontrada</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm
                      ? 'Não encontramos conexões com os critérios de busca.'
                      : canCreate
                        ? 'Nenhuma conexão foi criada ainda.'
                        : 'Você ainda não possui conexões WhatsApp atribuídas.'}
                  </p>
                  {canCreate ? (
                    <Button
                      className="btn-on-emerald bg-emerald-800 hover:bg-emerald-700"
                      onClick={() => setShowAddModal(true)}
                      disabled={atInstanceLimit}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Criar primeira conexão
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Apenas gestores podem criar conexões</p>
                      <Button variant="outline" onClick={() => setShowRequestModal(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Solicitar ao gestor
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1 min-w-0">
            <CompanyInstagramConnectionsSection />
          </div>
        </div>
      </div>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-white">
              {canCreate ? 'Nova Conexão WhatsApp' : 'Conexão WhatsApp'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {canCreate
                ? 'Conexão exclusiva da IA. A plataforma permite somente 1 número por usuário.'
                : 'Solicite ao seu gestor para criar uma nova conexão'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="instanceName" className="text-gray-300">Nome da Instância *</Label>
              <Input
                id="instanceName"
                value={newInstanceName}
                onChange={() => {}}
                placeholder="Gerado automaticamente"
                className="bg-gray-800/50 border-gray-700 text-white placeholder-gray-400"
                required
                readOnly
              />
              <p className="text-xs text-gray-500">
                Nome gerado automaticamente com base no usuário (nome+email), sem espaços.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instancePhone" className="text-gray-300">Número de Telefone *</Label>
              <Input
                id="instancePhone"
                value={newInstancePhone}
                onChange={handlePhoneChange}
                placeholder="Ex: (11) 9 9999-9999"
                className="bg-gray-800/50 border-gray-700 text-white placeholder-gray-400"
                required
                type="tel"
                inputMode="numeric"
              />
              <p className="text-xs text-gray-500">
                Número que será usado para conectar ao WhatsApp
              </p>
            </div>

            {canCreate && (
              <div className="space-y-2">
                <Label className="text-gray-300">Atribuição</Label>
                <div className="rounded-md border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-gray-300">
                  Conexão exclusiva da IA (não atribuível para outros usuários neste momento)
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <Button
              variant="outline"
              onClick={() => setShowAddModal(false)}
              className="border-gray-600 text-red-400 hover:bg-gray-800 hover:text-red-300"
            >
              {canCreate ? 'Cancelar' : 'Fechar'}
            </Button>
            {canCreate && (
              <Button
                onClick={handleCreateInstance}
                disabled={creating || hasCurrentUserConnection || !newInstancePhone.trim()}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Criando...' : (hasCurrentUserConnection ? 'Você já possui 1 conexão' : 'Criar Instância')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal QR Code */}
      <Dialog open={showQrModal} onOpenChange={(open) => {
        setShowQrModal(open);
        if (!open) {
          setQrCode(null);
          setQrTimer(QR_TIMEOUT_SECONDS);
          setQrExpired(false);
          setSelectedInstance(null);
        }
      }}>
        <DialogContent className="bg-background border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">
              QR Code - {selectedInstance?.instance_name}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Escaneie o QR code com seu WhatsApp para conectar
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 max-h-[70vh] overflow-y-auto">
            {qrExpired ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="h-12 w-12 text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">QR Code Expirado</h3>
                <p className="text-gray-400 mb-6">O tempo limite de {QR_TIMEOUT_SECONDS} segundos foi excedido. Gere um novo QR Code.</p>
                <Button
                  onClick={handleRetryQrCode}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Gerar Novo QR Code
                </Button>
              </div>
            ) : qrCode ? (
              <>
                {/* Timer */}
                <div className="text-center mb-4">
                  <div className={`text-2xl font-bold ${qrTimer <= 5 ? 'text-red-400' : 'text-blue-400'}`}>
                    {qrTimer}s
                  </div>
                  <p className="text-gray-400 text-sm">Tempo restante</p>
                </div>

                {/* QR Code */}
                <div className="bg-white p-4 rounded-lg mx-auto w-fit">
                  <img
                    src={qrCode}
                    alt="QR Code"
                    className="max-w-[300px] max-h-[300px] w-full h-auto"
                  />
                </div>

                {/* Instruções */}
                <div className="mt-6 space-y-3">
                  <h4 className="font-medium text-white">Como conectar:</h4>
                  <ol className="space-y-2 text-sm text-gray-300">
                    <li className="flex gap-2">
                      <span className="text-blue-400">1.</span>
                      Abra o WhatsApp no seu celular
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">2.</span>
                      Toque em Mais opções (⋮) {">"} Dispositivos conectados
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">3.</span>
                      Toque em Conectar dispositivo
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">4.</span>
                      Aponte seu telefone para esta tela para escanear o código
                    </li>
                  </ol>
                </div>

                {/* Status de monitoramento */}
                <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <div className="flex items-center gap-2 text-sm text-blue-400">
                    <div className="h-2 w-2 bg-blue-400 rounded-full animate-pulse" />
                    Monitorando conexão...
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="h-2 w-2 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Gerando QR Code...</p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowQrModal(false);
                setQrCode(null);
                setQrTimer(QR_TIMEOUT_SECONDS);
                setQrExpired(false);
                setSelectedInstance(null);
              }}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusão */}
      <Dialog open={!!instanceToDelete} onOpenChange={(open) => {
        if (!open && !deletingInstance) setInstanceToDelete(null);
      }}>
        <DialogContent className="bg-background border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar exclusão</DialogTitle>
            <DialogDescription className="text-gray-400">
              Deseja realmente excluir a instância <span className="text-white font-medium">{instanceToDelete?.name}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setInstanceToDelete(null)}
              disabled={deletingInstance}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteInstance}
              disabled={deletingInstance}
            >
              {deletingInstance ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Sucesso */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="bg-background border-border text-foreground max-w-sm">
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-gradient-to-br from-green-600/30 to-green-700/30 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-green-500/50">
              <Check className="h-12 w-12 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Conectado com Sucesso!
            </h3>
            <p className="text-gray-300 mb-2">
              {connectedInstanceName || 'WhatsApp'} foi conectado com sucesso
            </p>
            <p className="text-sm text-gray-400">
              Esta janela fechará automaticamente...
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Configurações */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="bg-background border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-400" />
              Configurações - {selectedConfigInstance?.instance_name}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Personalize o comportamento da instância WhatsApp
            </DialogDescription>
          </DialogHeader>

          {loadingConfig ? (
            <div className="py-8 text-center">
              <div className="inline-block">
                <Settings className="h-8 w-8 text-blue-400" />
              </div>
              <p className="mt-3 text-gray-400">Carregando configurações...</p>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Rejeitar Chamadas */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="rejectCall" className="text-gray-300">
                    Rejeitar Chamadas
                  </Label>
                  <p className="text-xs text-gray-500">
                    Recusa automaticamente chamadas recebidas
                  </p>
                </div>
                <Switch
                  id="rejectCall"
                  checked={configFields.rejectCall}
                  onCheckedChange={(checked) =>
                    setConfigFields(prev => ({ ...prev, rejectCall: checked }))
                  }
                />
              </div>

              {/* Mensagem de Chamada */}
              {configFields.rejectCall && (
                <div className="space-y-2 pl-4 border-l-2 border-blue-500/30">
                  <Label htmlFor="msgCall" className="text-gray-300">
                    Mensagem ao Rejeitar Chamada
                  </Label>
                  <Textarea
                    id="msgCall"
                    value={configFields.msgCall}
                    onChange={(e) =>
                      setConfigFields(prev => ({ ...prev, msgCall: e.target.value }))
                    }
                    placeholder="Ex: Estou ocupado no momento..."
                    className="bg-gray-800/50 border-gray-700 text-white placeholder-gray-400"
                    rows={3}
                  />
                </div>
              )}

              {/* Ignorar Grupos */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="groupsIgnore" className="text-gray-300">
                    Ignorar Grupos
                  </Label>
                  <p className="text-xs text-gray-500">
                    Não recebe mensagens de grupos
                  </p>
                </div>
                <Switch
                  id="groupsIgnore"
                  checked={configFields.groupsIgnore}
                  onCheckedChange={(checked) =>
                    setConfigFields(prev => ({ ...prev, groupsIgnore: checked }))
                  }
                />
              </div>

              {/* Sempre Online */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="alwaysOnline" className="text-gray-300">
                    Sempre Online
                  </Label>
                  <p className="text-xs text-gray-500">
                    Aparece sempre como online
                  </p>
                </div>
                <Switch
                  id="alwaysOnline"
                  checked={configFields.alwaysOnline}
                  onCheckedChange={(checked) =>
                    setConfigFields(prev => ({ ...prev, alwaysOnline: checked }))
                  }
                />
              </div>

              {/* Ler Mensagens */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="readMessages" className="text-gray-300">
                    Marcar como Lida
                  </Label>
                  <p className="text-xs text-gray-500">
                    Marca mensagens como lidas automaticamente
                  </p>
                </div>
                <Switch
                  id="readMessages"
                  checked={configFields.readMessages}
                  onCheckedChange={(checked) =>
                    setConfigFields(prev => ({ ...prev, readMessages: checked }))
                  }
                />
              </div>

              {/* Ler Status */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="readStatus" className="text-gray-300">
                    Ver Status
                  </Label>
                  <p className="text-xs text-gray-500">
                    Visualiza status automaticamente
                  </p>
                </div>
                <Switch
                  id="readStatus"
                  checked={configFields.readStatus}
                  onCheckedChange={(checked) =>
                    setConfigFields(prev => ({ ...prev, readStatus: checked }))
                  }
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <Button
              variant="outline"
              onClick={() => setShowConfigModal(false)}
              className="border-gray-600 text-red-400 hover:bg-gray-800 hover:text-red-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveConfig}
              disabled={savingConfig || loadingConfig}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white disabled:opacity-50"
            >
              {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Solicitar Conexão */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="bg-background border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-400" />
              Solicitar Conexão WhatsApp
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Sua solicitação será enviada para todos os gestores da empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="instance-name" className="text-gray-300">
                Nome da Instância *
              </Label>
              <Input
                id="instance-name"
                placeholder="Ex: Meu WhatsApp Business"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 mt-2"
                required
              />
            </div>

            <div>
              <Label htmlFor="instance-phone" className="text-gray-300">
                Número do WhatsApp (opcional)
              </Label>
              <Input
                id="instance-phone"
                placeholder="Ex: +55 11 99999-9999"
                value={newInstancePhone}
                onChange={(e) => setNewInstancePhone(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 mt-2"
              />
            </div>

            <div>
              <Label htmlFor="request-message" className="text-gray-300">
                Mensagem (opcional)
              </Label>
              <Textarea
                id="request-message"
                placeholder="Descreva o motivo da sua solicitação..."
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 mt-2"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowRequestModal(false)}
              className="border-gray-600 text-red-400 hover:bg-gray-800 hover:text-red-300"
              disabled={requestingConnection}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRequestConnection}
              disabled={requestingConnection}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
            >
              {requestingConnection ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Enviar Solicitação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Solicitação pendente existente */}
      <Dialog open={showPendingModal} onOpenChange={setShowPendingModal}>
        <DialogContent className="sm:max-w-md bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Solicitação pendente encontrada</DialogTitle>
            <DialogDescription>
              Você já possui uma solicitação em análise por um gestor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Instância</span>
              <span className="font-medium">{pendingRequestData?.instance_name || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Telefone</span>
              <span className="font-medium">{pendingRequestData?.phone_number || '-'}</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-gray-400">Mensagem</span>
              <span className="font-medium text-right max-w-[60%] break-words">{pendingRequestData?.message || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Criada em</span>
              <span className="font-medium">{pendingRequestData?.created_at ? new Date(pendingRequestData.created_at).toLocaleString() : '-'}</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPendingModal(false)}>Fechar</Button>
            <Button onClick={handleResendRequest} disabled={resending}>
              {resending ? 'Reenviando...' : 'Reenviar solicitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 