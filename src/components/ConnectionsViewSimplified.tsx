import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { 
  Smartphone, 
  Plus, 
  Trash2, 
  RefreshCw, 
  QrCode, 
  MessageCircle, 
  Users, 
  Signal,
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Play,
  Pause,
  Settings,
  MoreVertical,
  Zap,
  TrendingUp,
  Eye,
  Monitor,
  User,
  Crown,
  Shield,
  Filter,
  Search,
  Activity,
  Wifi,
  WifiOff,
  RotateCcw,
  Check
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Separator } from "./ui/separator";
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWhatsAppInstances, WhatsAppInstance } from '@/hooks/useWhatsAppInstances';
import { useNotifications } from '@/hooks/useNotifications';
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";

export function ConnectionsViewSimplified() {
  const { profile, isManager } = useUserProfile();
  const { createConnectionRequest } = useNotifications();
  const {
    instances,
    loading,
    error,
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

  // Tornar tolerante a diferenças de carregamento entre hooks: habilita criação se qualquer fonte indicar gestor/admin
  const canCreate = isManager || canCreateInstances;

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
  
  // Estados para solicitação ao gestor
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestingConnection, setRequestingConnection] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingRequestData, setPendingRequestData] = useState<any | null>(null);
  const [resending, setResending] = useState(false);
  
  // Novos estados para funcionalidades completas
  const [qrTimer, setQrTimer] = useState(15);
  const [qrExpired, setQrExpired] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [connectedInstanceName, setConnectedInstanceName] = useState("");
  
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
          webhook_url: `https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/${request.instance_name}`,
          is_active: true
        })
        .select()
        .single();

      if (instanceError) throw instanceError;

      // 3. Criar notificação para o solicitante
      await supabase
        .from('notifications')
        .insert({
          user_id: request.user_id,
          company_id: request.company_id,
          type: 'connection_approved',
          title: 'Solicitação Aprovada! 🎉',
          message: `Sua solicitação de conexão "${request.instance_name}" foi aprovada! Você pode gerar o QR code agora.`,
          data: {
            instance_id: newInstance.id,
            instance_name: request.instance_name,
            approved_by: profile?.id,
            approved_by_name: profile?.full_name
          }
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
        .from('notifications')
        .insert({
          user_id: request.user_id,
          company_id: request.company_id,
          type: 'connection_rejected',
          title: 'Solicitação Rejeitada',
          message: `Sua solicitação de conexão "${request.instance_name}" foi rejeitada.`,
          data: {
            request_id: requestId,
            instance_name: request.instance_name,
            rejected_by: profile?.id,
            rejected_by_name: profile?.full_name
          }
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
    if (isManager && profile?.company_id) {
      loadPendingRequests();
    }
  }, [isManager, profile?.company_id]);

  // Timer do QR Code (15 segundos)
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;

    if (showQrModal && qrCode && !qrExpired) {
      setQrTimer(15); // Reset timer when modal opens
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
      // Verificar status a cada 3 segundos através do endpoint externo
      intervalId = setInterval(async () => {
        try {
          console.log('🔍 Verificando status da instância:', selectedInstance.name);
          
          // Chamar endpoint para verificar status da instância específica
          const whatsappApiBase = import.meta.env.VITE_WHATSAPP_API_BASE || 'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook';
          const response = await fetch(`${whatsappApiBase}/whatsapp-instances`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            mode: 'cors',
          });

          if (!response.ok) {
            console.warn('Erro ao verificar status:', response.status);
            return;
          }

          const data = await response.json();
          
          if (data.success && data.data) {
            // Procurar a instância específica na resposta
            const updatedInstance = data.data.find((inst: any) => 
              inst.name === selectedInstance.name || 
              inst.instanceName === selectedInstance.name
            );
            
            if (updatedInstance && updatedInstance.connectionStatus === 'open') {
              console.log('✅ Instância conectada com sucesso via endpoint:', selectedInstance.name);
              
              // Fechar modal QR e mostrar sucesso
              setShowQrModal(false);
              setQrCode(null);
              setQrTimer(15);
              setQrExpired(false);
              setConnectedInstanceName(updatedInstance.profileName || selectedInstance.name);
              setShowSuccessModal(true);
              
              // Atualizar status local
              await updateInstanceStatus(selectedInstance.id, 'connected');
              
              // Atualizar lista de instâncias
              await refreshInstances();
              
              // Fechar modal de sucesso após 3 segundos
              setTimeout(() => {
                setShowSuccessModal(false);
              }, 3000);
            }
          }
        } catch (error) {
          console.error('Erro ao verificar status da instância via endpoint:', error);
        }
      }, 3000);
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
      
      if (!newInstanceName.trim()) {
        throw new Error('Nome da instância é obrigatório');
      }

      if (!newInstancePhone.trim()) {
        throw new Error('Número de telefone é obrigatório para criar a instância');
      }

      const result = await createInstance({
        instance_name: newInstanceName,
        phone_number: newInstancePhone,
        assigned_user_id: assignedUserId === "self" ? undefined : assignedUserId
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
    if (window.confirm('Tem certeza que deseja deletar esta instância?')) {
      try {
        await deleteInstance(instanceId);
      } catch (error: any) {
        console.error('Erro ao deletar instância:', error);
        alert(`Erro: ${error.message}`);
      }
    }
  };

  // Gerar QR Code
  const handleGenerateQrCode = async (instance: WhatsAppInstance) => {
    try {
      setGeneratingQr(true);
      setSelectedInstance(instance);
      
      const qrCodeData = await generateQrCode(instance.id);
      
      if (qrCodeData) {
        setQrCode(qrCodeData);
        setQrTimer(15); // Reset timer
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

  // Componente para exibir instância
  const InstanceCard = ({ instance }: { instance: WhatsAppInstance }) => {
    const isConnected = instance.status === 'connected';
    // Remover checagem de request_status (não existe mais)
    const isPendingRequest = false;
    const isApproved = false;

    return (
      <Card className={`p-6 ${isPendingRequest ? 'bg-yellow-900/20 border-yellow-500/50' : 'bg-gray-800 border-gray-700'}`}>
        {/* Cabeçalho de solicitação pendente */}
        {isPendingRequest && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-400">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Solicitação Pendente</span>
            </div>
            <p className="text-xs text-yellow-300/80 mt-1">
              Aguardando aprovação do gestor para ativação
            </p>
          </div>
        )}
        
        {/* Header com foto, nome e status */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Foto de perfil */}
            <div className="relative">
              {instance.profile_pic_url ? (
                <>
                  <img 
                    src={instance.profile_pic_url} 
                    alt={instance.profile_name || instance.instance_name}
                    className="h-12 w-12 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden h-12 w-12 rounded-full bg-gray-600 flex items-center justify-center">
                    <User className="h-6 w-6 text-gray-400" />
                  </div>
                </>
              ) : (
                <div className="h-12 w-12 rounded-full bg-gray-600 flex items-center justify-center">
                  <User className="h-6 w-6 text-gray-400" />
                </div>
              )}
              {/* Status indicator */}
              <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full ${
                isPendingRequest ? 'bg-yellow-500' : 
                isConnected ? 'bg-green-500' : 'bg-gray-500'
              } border-2 border-gray-800`} />
            </div>

            {/* Nome e status */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-medium">
                  {instance.profile_name || instance.name}
                </h3>
                {isPendingRequest ? (
                  <span className="text-yellow-500 text-sm flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Pendente
                  </span>
                ) : isConnected ? (
                  <span className="text-green-500 text-sm flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Online
                  </span>
                ) : null}
              </div>
              <div className="space-y-1">
                <p className="text-gray-400 text-sm">Instância: {instance.name}</p>
                {instance.user_profile && (
                  <p className="text-gray-500 text-xs flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {instance.user_profile.full_name} ({instance.user_profile.role})
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleShowConfig(instance)}
              disabled={isPendingRequest}
              className={`h-8 w-8 ${isPendingRequest ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDeleteInstance(instance.id)}
              disabled={isPendingRequest}
              className={`h-8 w-8 ${isPendingRequest ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-red-400 hover:bg-red-900/20'}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Informações */}
        <div className="space-y-2 mb-4">
          {instance.phone_number && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-gray-500" />
              <span className="text-gray-300">{instance.phone_number}</span>
            </div>
          )}
          <div className="text-sm text-gray-500">
            Última atividade: {instance.last_seen ? new Date(instance.last_seen).toLocaleString('pt-BR') : 'Nunca'}
          </div>
        </div>

        {/* Estatísticas */}
        {!isPendingRequest && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-blue-900/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">
                {instance.message_count.toLocaleString('pt-BR')}
              </div>
            <div className="text-xs text-gray-400">Mensagens</div>
          </div>
          <div className="bg-green-900/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">
              {instance.contact_count.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs text-gray-400">Contatos</div>
          </div>
          <div className="bg-purple-900/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-400">
              {instance.chat_count.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs text-gray-400">Chats</div>
          </div>
        </div>
        )}

        {/* Botões de ação principais */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleGenerateQrCode(instance)}
            disabled={generatingQr || isConnected || isPendingRequest}
            className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
          >
            <QrCode className="h-4 w-4 mr-2" />
            {isPendingRequest ? 'Aguardando Aprovação' : generatingQr ? 'Gerando...' : 'Gerar QR Code'}
          </Button>

          {isConnected ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDisconnect(instance)}
              className="flex-1"
            >
              <WifiOff className="h-4 w-4 mr-2" />
              Desconectar
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => handleConnect(instance)}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Wifi className="h-4 w-4 mr-2" />
              Conectar
            </Button>
          )}
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block">
          <Smartphone className="h-8 w-8 text-blue-400" />
        </div>
        <p className="ml-3 text-gray-400">Carregando conexões...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Conexões WhatsApp
            {isManager && <span className="text-sm text-gray-400 ml-2">(Visão Gestor)</span>}
          </h1>
          <p className="text-gray-400">
            {isManager ? 
              'Gerencie todas as conexões WhatsApp da equipe' : 
              'Gerencie suas conexões WhatsApp pessoais'
            }
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={refreshInstances}
            className="border-blue-600/50 text-blue-400 hover:bg-blue-600/20 backdrop-blur-sm bg-gray-900/50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          {canCreate ? (
            <Button 
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Conexão
            </Button>
          ) : (
            <Button 
              variant="outline"
              disabled
              className="border-gray-600 text-gray-400 cursor-not-allowed"
            >
              <Plus className="mr-2 h-4 w-4" />
              Apenas Gestores
            </Button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* System Alert */}
      {showSystemAlert && (
        <Alert className="border-orange-500/50 bg-orange-500/10">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertDescription className="text-orange-200">
            <strong>Sistema Híbrido:</strong> A instância foi criada localmente com sucesso! 
            O sistema externo WhatsApp pode estar temporariamente indisponível, mas você pode 
            tentar gerar o QR code quando precisar conectar.
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-2 h-6 px-2 text-orange-200 hover:bg-orange-500/20"
              onClick={() => setShowSystemAlert(false)}
            >
              Entendi
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total Instâncias", value: stats.total_instances, icon: Smartphone, color: "text-blue-400" },
          { title: "Conectadas", value: stats.connected_instances, icon: Wifi, color: "text-green-400" },
          { title: "Chats Ativos", value: stats.total_chats, icon: MessageCircle, color: "text-purple-400" },
          { title: "Mensagens", value: stats.total_messages, icon: Activity, color: "text-orange-400" }
        ].map((stat, index) => (
          <div
            key={stat.title}
          >
            <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700/60 hover:bg-gray-800/70 transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">{stat.title}</p>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                  </div>
                  <div className="p-3 rounded-full bg-gray-700/50">
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder-gray-400 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Solicitações Pendentes (apenas para gestores) */}
      {isManager && pendingRequests.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-400" />
            <h2 className="text-xl font-semibold text-white">Solicitações Pendentes</h2>
            <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full text-xs">
              {pendingRequests.length}
            </span>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingRequests.map((request) => (
              <Card key={request.id} className="bg-yellow-900/20 border-yellow-500/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-white mb-1">
                        {request.instance_name}
                      </h3>
                      <p className="text-sm text-yellow-300">
                        Solicitado por: {request.user_profile?.full_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(request.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="bg-yellow-500/20 p-1 rounded">
                      <Clock className="h-4 w-4 text-yellow-400" />
                    </div>
                  </div>
                  
                  {request.message && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 mb-3">
                      <p className="text-xs text-yellow-200">
                        "{request.message}"
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproveRequest(request.id)}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectRequest(request.id)}
                      className="flex-1 border-red-500 text-red-400 hover:bg-red-500/10"
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
      )}

      {/* Instances Grid */}
      <div className="space-y-4">
        {isManager && (
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Instâncias Ativas</h2>
          </div>
        )}
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredInstances.map((instance, index) => (
          <div
            key={instance.id}
          >
            <InstanceCard instance={instance} />
          </div>
        ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredInstances.length === 0 && !loading && (
        <div>
          <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700/60">
            <CardContent className="p-12 text-center">
              <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Nenhuma conexão encontrada</h3>
              <p className="text-gray-400 mb-4">
                 {searchTerm ? 'Não encontramos conexões com os critérios de busca.' : 
                  canCreate ? 'Nenhuma conexão foi criada ainda.' :
                 'Você ainda não possui conexões WhatsApp atribuídas.'}
              </p>
              {canCreate ? (
                <Button 
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeira Conexão
                </Button>
              ) : (
                <div className="text-center">
                  <p className="text-gray-500 mb-2">Apenas gestores podem criar conexões</p>
                  <Button 
                    variant="outline"
                    onClick={() => setShowRequestModal(true)}
                    className="border-blue-600 text-blue-400 hover:bg-blue-600/10"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Solicitar ao Gestor
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Adicionar Instância */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-gray-900/95 border-gray-700/50 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              {canCreate ? 'Nova Conexão WhatsApp' : 'Conexão WhatsApp'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {canCreate 
                ? 'Crie uma nova instância e atribua para um corretor'
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
                onChange={(e) => setNewInstanceName(e.target.value)}
                placeholder="Ex: João - WhatsApp Principal"
                className="bg-gray-800/50 border-gray-700 text-white placeholder-gray-400"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="instancePhone" className="text-gray-300">Número de Telefone *</Label>
              <Input
                id="instancePhone"
                value={newInstancePhone}
                onChange={(e) => setNewInstancePhone(e.target.value)}
                placeholder="Ex: +55 11 99999-9999"
                className="bg-gray-800/50 border-gray-700 text-white placeholder-gray-400"
                required
              />
              <p className="text-xs text-gray-500">
                Número que será usado para conectar ao WhatsApp
              </p>
            </div>
            
            {canCreate && (
              <div className="space-y-2">
                <Label htmlFor="assignedUser" className="text-gray-300">Atribuir Para *</Label>
                <Select
                  value={assignedUserId}
                  onValueChange={setAssignedUserId}
                >
                  <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
                    <SelectValue placeholder="Selecionar usuário..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="self" className="text-gray-300">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-yellow-500" />
                        Eu mesmo (Gestor)
                      </div>
                    </SelectItem>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id} className="text-gray-300">
                        <div className="flex items-center gap-2">
                          {user.role === 'admin' && <Shield className="h-4 w-4 text-red-500" />}
                          {user.role === 'gestor' && <Crown className="h-4 w-4 text-yellow-500" />}
                          {user.role === 'corretor' && <User className="h-4 w-4 text-blue-500" />}
                          <span className="flex-1">{user.full_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {user.role}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  A instância será atribuída ao usuário selecionado
                </p>
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
                disabled={creating || !newInstanceName.trim() || !newInstancePhone.trim()}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Criando...' : 'Criar Instância'}
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
          setQrTimer(15);
          setQrExpired(false);
          setSelectedInstance(null);
        }
      }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
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
                <p className="text-gray-400 mb-6">O tempo limite foi excedido. Gere um novo QR Code.</p>
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
                setQrTimer(15);
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

      {/* Modal de Sucesso */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="bg-gray-900/95 border-gray-700/50 text-white max-w-sm">
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
        <DialogContent className="bg-gray-900/95 border-gray-700/50 text-white max-w-lg">
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
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
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
        <DialogContent className="sm:max-w-md">
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