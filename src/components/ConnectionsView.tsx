import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Smartphone, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Plus, 
  Settings, 
  QrCode,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  Zap,
  Activity,
  Users,
  Check,
  Clock,
  RotateCcw,
  UserPlus
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { supabase } from "@/integrations/supabase/client";

interface WhatsAppInstance {
  id: string;
  name: string;
  phone?: string;
  profileName?: string;
  profilePicUrl?: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_code' | 'error';
  lastSeen?: Date;
  qrCode?: string;
  webhookUrl?: string;
  apiKey?: string;
  messageCount?: number;
  contactCount?: number;
  chatCount?: number;
  battery?: number;
  deviceModel?: string;
  user_profile?: {
    full_name: string;
    email: string;
    role: string;
  };
}

export function ConnectionsView() {
  // URLs dos webhooks através do proxy
  const WEBHOOK_BASE_URL = '/api/webhook';
  const { profile, isManager } = useUserProfile();
  const { settings } = useCompanySettings();
  const { 
    instances, 
    loading, 
    createInstance, 
    refreshInstances,
    canCreateInstances,
    loadAvailableUsersForAssignment  // Nova função centralizada
  } = useWhatsAppInstances();
  
  // Estados locais para o modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newInstanceNumber, setNewInstanceNumber] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [availableUsers, setAvailableUsers] = useState<Array<{id: string, full_name: string, email: string, role: string}>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [connectedInstanceName, setConnectedInstanceName] = useState("");
  const [qrTimer, setQrTimer] = useState(15);
  const [qrExpired, setQrExpired] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [instanceToDelete, setInstanceToDelete] = useState<WhatsAppInstance | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedConfigInstance, setSelectedConfigInstance] = useState<WhatsAppInstance | null>(null);
  const [instanceConfig, setInstanceConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfigSuccessModal, setShowConfigSuccessModal] = useState(false);
  
  // Estados dos campos editáveis
  const [configFields, setConfigFields] = useState({
    rejectCall: false,
    msgCall: '',
    groupsIgnore: false,
    alwaysOnline: false,
    readMessages: false,
    readStatus: false
  });


  // Função para verificar status das instâncias (sem loading)
  const checkInstancesStatus = async () => {
    try {
      console.log('🔄 Verificando status das instâncias...');
      
      let urlString = `${WEBHOOK_BASE_URL}/whatsapp-instances`;
      const params = new URLSearchParams();
      if (profile?.company_id) {
        params.append('company_id', profile.company_id);
      }
      if (settings?.display_name) {
        params.append('company_name', settings.display_name);
      }
      if (params.toString()) {
        urlString += `?${params.toString()}`;
      }

      const response = await fetch(urlString, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await response.json();
      
      let processedInstances: WhatsAppInstance[] = [];

      if (data.success && Array.isArray(data.data)) {
        data.data.forEach((instance: any) => {
          const mappedInstance: WhatsAppInstance = {
            id: instance.id,
            name: instance.name,
            phone: instance.ownerJid ? formatPhoneNumber(instance.ownerJid.replace('@s.whatsapp.net', '')) : undefined,
            profileName: instance.profileName,
            profilePicUrl: instance.profilePicUrl,
            status: instance.connectionStatus === 'open' ? 'connected' : 'disconnected',
            messageCount: instance._count?.Message || 0,
            contactCount: instance._count?.Contact || 0,
            chatCount: instance._count?.Chat || 0,
            lastSeen: instance.updatedAt ? new Date(instance.updatedAt) : undefined,
            deviceModel: instance.integration === 'WHATSAPP-BAILEYS' ? undefined : (instance.integration || undefined),
            webhookUrl: `https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/${instance.name}`,
            apiKey: instance.token
          };
          
          processedInstances.push(mappedInstance);
        });
        
        setInstances(processedInstances);
        return processedInstances;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Erro ao verificar status:', error);
      return [];
    }
  };

  // Função para buscar instâncias do webhook
  const fetchInstances = async () => {
    try {
      setLoading(true);
      console.log('🔄 Buscando instâncias WhatsApp...');
      console.log('🌐 URL da requisição:', `${WEBHOOK_BASE_URL}/whatsapp-instances`);
      
      let urlString = `${WEBHOOK_BASE_URL}/whatsapp-instances`;
      const params = new URLSearchParams();
      if (profile?.company_id) {
        params.append('company_id', profile.company_id);
      }
      if (settings?.display_name) {
        params.append('company_name', settings.display_name);
      }
      if (params.toString()) {
        urlString += `?${params.toString()}`;
      }

      const response = await fetch(urlString, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Status da resposta:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na resposta:', response.status, errorText);
        throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('📱 Instâncias recebidas:', data);
      console.log('🔍 Tipo de dados recebidos:', typeof data, Array.isArray(data));

      let processedInstances: WhatsAppInstance[] = [];

      // Verificar se a resposta tem success e data diretamente
      if (data.success && Array.isArray(data.data)) {

        
        data.data.forEach((instance: any) => {
          // Mapear os dados do webhook para nossa interface
          const mappedInstance: WhatsAppInstance = {
            id: instance.id,
            name: instance.name,
            phone: instance.ownerJid ? formatPhoneNumber(instance.ownerJid.replace('@s.whatsapp.net', '')) : undefined,
            profileName: instance.profileName,
            profilePicUrl: instance.profilePicUrl,
            status: instance.connectionStatus === 'open' ? 'connected' : 'disconnected',
            messageCount: instance._count?.Message || 0,
            contactCount: instance._count?.Contact || 0,
            chatCount: instance._count?.Chat || 0,
            lastSeen: instance.updatedAt ? new Date(instance.updatedAt) : undefined,
            deviceModel: instance.integration === 'WHATSAPP-BAILEYS' ? undefined : (instance.integration || undefined),
            webhookUrl: `https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/${instance.name}`,
            apiKey: instance.token
          };
          
          processedInstances.push(mappedInstance);
        });
        
        setInstances(processedInstances);
      } else if (Array.isArray(data)) {
        // Fallback para array de objetos com success/data (formato anterior)

        
        data.forEach((item, index) => {
          if (item.success && Array.isArray(item.data)) {
            item.data.forEach((instance: any) => {
              const mappedInstance: WhatsAppInstance = {
                id: instance.id,
                name: instance.name,
                phone: instance.ownerJid ? formatPhoneNumber(instance.ownerJid.replace('@s.whatsapp.net', '')) : undefined,
                profileName: instance.profileName,
                profilePicUrl: instance.profilePicUrl,
                status: instance.connectionStatus === 'open' ? 'connected' : 'disconnected',
                messageCount: instance._count?.Message || 0,
                contactCount: instance._count?.Contact || 0,
                chatCount: instance._count?.Chat || 0,
                lastSeen: instance.updatedAt ? new Date(instance.updatedAt) : undefined,
                deviceModel: undefined,
                webhookUrl: `https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/${instance.name}`,
                apiKey: instance.token
              };
              processedInstances.push(mappedInstance);
            });
          }
        });
        
        setInstances(processedInstances);
      } else {
        setInstances([]);
      }
    } catch (error) {
      console.error('❌ Erro na fetchInstances:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      
      // Mostrar mensagem de erro mais clara para o usuário
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        console.error('🌐 Erro de rede - Servidor pode estar offline ou proxy não funcionando');
      }
      
      setInstances([]);
    } finally {
      setLoading(false);
    }
  };


  // Timer do QR Code (15 segundos)
  useEffect(() => {
    let timerIntervalId: NodeJS.Timeout | null = null;

    if (showQrModal && qrCodeImage && !qrExpired) {
      timerIntervalId = setInterval(() => {
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
      if (timerIntervalId) {
        clearInterval(timerIntervalId);
      }
    };
  }, [showQrModal, qrCodeImage, qrExpired]);

  // Monitorar conexão quando QR code modal estiver aberto
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (showQrModal && selectedInstance && !qrExpired) {
      // Verificar status a cada 2 segundos
      intervalId = setInterval(async () => {
        refreshInstances();
        
        // Procurar a instância selecionada na lista atualizada
        const currentInstance = instances.find(inst => inst.id === selectedInstance.id);
        
        if (currentInstance && currentInstance.status === 'connected') {
          console.log('✅ Instância conectada com sucesso:', currentInstance.name);
          
          // Fechar modal QR e mostrar sucesso
          setShowQrModal(false);
          setQrCodeImage(null);
          setQrTimer(15);
          setQrExpired(false);
          setConnectedInstanceName(currentInstance.profileName || currentInstance.name);
          setShowSuccessModal(true);
          
          // Fechar modal de sucesso após 3 segundos
          setTimeout(() => {
            setShowSuccessModal(false);
          }, 3000);
        }
      }, 2000);
    }

    // Limpar intervalo quando modal fechar
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [showQrModal, selectedInstance, qrExpired]);



  const getStatusColor = (status: WhatsAppInstance['status']) => {
    switch (status) {
      case 'connected': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'connecting': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'qr_code': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'disconnected': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: WhatsAppInstance['status']) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4" />;
      case 'connecting': return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'qr_code': return <QrCode className="h-4 w-4" />;
      case 'disconnected': return <WifiOff className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: WhatsAppInstance['status']) => {
    switch (status) {
      case 'connected': return 'Online';
      case 'connecting': return 'Conectando...';
      case 'qr_code': return 'QR Code';
      case 'disconnected': return 'Offline';
      case 'error': return 'Erro';
      default: return 'Desconhecido';
    }
  };

  const formatLastSeen = (date?: Date) => {
    if (!date) return 'Nunca';
    const diffMinutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
    if (diffMinutes < 1) return 'Agora mesmo';
    if (diffMinutes < 60) return `${diffMinutes}min atrás`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    return `${Math.floor(diffHours / 24)} dias atrás`;
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Formatar para padrão brasileiro se tiver 13 dígitos (55 + DDD + número)
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      const ddd = cleaned.substring(2, 4);
      const number = cleaned.substring(4);
      return `+55 (${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
    }
    
    // Formatar para padrão brasileiro se tiver 11 dígitos (DDD + número)
    if (cleaned.length === 11) {
      const ddd = cleaned.substring(0, 2);
      const number = cleaned.substring(2);
      return `+55 (${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
    }
    
    // Retornar original se não conseguir formatar
    return `+${cleaned}`;
  };

  const handleRefreshInstances = () => {
    refreshInstances();
  };

  const handleShowQrCode = (instance: WhatsAppInstance) => {
    setSelectedInstance(instance);
    setShowQrModal(true);
  };

  const handleRetryQrCode = async () => {
    if (selectedInstance) {
      setQrExpired(false);
      await handleGenerateQrCode(selectedInstance);
    }
  };

  const handleGenerateQrCode = async (instance: WhatsAppInstance) => {
    try {
      setGeneratingQr(true);
      console.log('📱 Gerando QR Code para instância:', instance.name);
      
      const response = await fetch(`${WEBHOOK_BASE_URL}/puxar-qrcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName: instance.name,
          instanceId: instance.id
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ QR Code recebido:', result);
      
      // Verificar se o webhook retornou a estrutura esperada
      let qrData = null;
      
      // Suportar tanto array quanto objeto direto
      if (Array.isArray(result) && result.length > 0 && result[0].success && result[0].data) {
        qrData = result[0].data;
      } else if (result.success && result.data) {
        qrData = result.data;
      }
      
      if (qrData && qrData.base64) {
        // O base64 já vem com o prefixo "data:image/png;base64" mas pode estar incompleto
        // Vamos verificar se tem o conteúdo base64 real
        let imageData = qrData.base64;
        
        // Se o base64 está apenas como "data:image/png;base64", significa que pode estar incompleto
        // Neste caso, podemos usar o campo 'code' ou aguardar uma implementação específica
        if (imageData === "data:image/png;base64") {
          console.warn('Base64 parece estar incompleto:', imageData);
          alert('QR Code recebido mas a imagem está incompleta. Verifique o servidor.');
          return;
        }
        
        setQrCodeImage(imageData);
        setSelectedInstance(instance);
        setQrTimer(15);
        setQrExpired(false);
        setShowQrModal(true);
      } else {
        console.error('Estrutura de resposta inesperada ou dados ausentes:', result);
        alert('QR Code não foi retornado pelo servidor ou dados estão ausentes.');
      }
      
      // Atualizar lista de instâncias para verificar mudança de status
      refreshInstances();
      
    } catch (error) {
      console.error('❌ Erro ao gerar QR Code:', error);
      alert('Erro ao gerar QR Code. Tente novamente.');
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleDeleteInstance = (instance: WhatsAppInstance) => {
    setInstanceToDelete(instance);
    setShowDeleteModal(true);
  };

  const confirmDeleteInstance = async () => {
    if (!instanceToDelete) return;

    try {
      setDeleting(true);
      console.log('🗑️ Deletando instância:', instanceToDelete.name);
      
      const response = await fetch(`${WEBHOOK_BASE_URL}/deletar-instancia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: instanceToDelete.name
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Instância deletada:', result);
      
      // Fechar modal e limpar estados
      setShowDeleteModal(false);
      setInstanceToDelete(null);
      
      // Atualizar lista de instâncias
      refreshInstances();
      
    } catch (error) {
      console.error('❌ Erro ao deletar instância:', error);
      alert('Erro ao deletar instância. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  const handleShowConfig = async (instance: WhatsAppInstance) => {
    setSelectedConfigInstance(instance);
    setShowConfigModal(true);
    setLoadingConfig(true);
    setInstanceConfig(null);

    try {
      console.log('⚙️ Buscando configurações da instância:', instance.name);
      
      const response = await fetch(`${WEBHOOK_BASE_URL}/config-instancia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName: instance.name,
          instanceId: instance.id
        }),
      });

      console.log('📡 Status da resposta de config:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na resposta de config:', response.status, errorText);
        throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Configurações recebidas (RAW):', result);
      console.log('🔍 Tipo da resposta:', typeof result, Array.isArray(result));
      
      // Processar a resposta do webhook passo a passo
      let configData = null;
      
      console.log('🚀 INICIANDO PROCESSAMENTO:');
      console.log('1️⃣ result é array?', Array.isArray(result));
      console.log('2️⃣ result tem success?', !!result.success);
      console.log('3️⃣ result.data existe?', !!result.data);
      console.log('4️⃣ result.data é array?', Array.isArray(result.data));
      console.log('5️⃣ result.data.length:', Array.isArray(result.data) ? result.data.length : 'N/A');
      
      // Primeiro cenário: result é objeto com success e data (caso atual)
      if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
        const instanceData = result.data[0];
        console.log('6️⃣ instanceData:', instanceData);
        console.log('7️⃣ instanceData.Setting existe?', !!instanceData.Setting);
        console.log('8️⃣ instanceData.Setting:', instanceData.Setting);
        
        if (instanceData.Setting) {
          configData = instanceData.Setting;
          console.log('✅ ConfigData FINAL extraída de result.data[0].Setting:', configData);
        } else {
          configData = instanceData;
          console.log('⚠️ ConfigData FINAL extraída de result.data[0] completo:', configData);
        }
      }
      // Segundo cenário: result é array (formato antigo)
      else if (Array.isArray(result) && result.length > 0) {
        const firstItem = result[0];
        console.log('9️⃣ firstItem (array format):', firstItem);
        
        if (firstItem.success && firstItem.data && Array.isArray(firstItem.data) && firstItem.data.length > 0) {
          const instanceData = firstItem.data[0];
          if (instanceData.Setting) {
            configData = instanceData.Setting;
            console.log('✅ ConfigData FINAL extraída de Array[0].data[0].Setting:', configData);
          } else {
            configData = instanceData;
            console.log('⚠️ ConfigData FINAL extraída de Array[0].data[0]:', configData);
          }
        } else {
          configData = firstItem.data || firstItem;
          console.log('⚠️ ConfigData FINAL extraída de Array[0] fallback:', configData);
        }
      }
      // Terceiro cenário: fallback
      else {
        console.log('❌ Formato não reconhecido, usando fallback');
        configData = result.data || result;
        console.log('⚠️ ConfigData FINAL extraída de fallback geral:', configData);
      }
      
      setInstanceConfig(configData);
      
      // Atualizar campos editáveis com os dados recebidos
      if (configData) {
        console.log('🔧 PROCESSANDO CAMPOS:');
        console.log('🔧 Campos ANTES da atualização:', configFields);
        console.log('🗂️ Propriedades disponíveis no configData:', Object.keys(configData));
        console.log('📊 Valores CRUS no configData:', {
          rejectCall: configData.rejectCall,
          msgCall: configData.msgCall,
          groupsIgnore: configData.groupsIgnore,
          alwaysOnline: configData.alwaysOnline,
          readMessages: configData.readMessages,
          readStatus: configData.readStatus
        });
        
        // Verificar tipos individuais
        console.log('🔍 TIPOS DOS VALORES:');
        console.log('  - rejectCall tipo:', typeof configData.rejectCall, 'valor:', configData.rejectCall);
        console.log('  - msgCall tipo:', typeof configData.msgCall, 'valor:', configData.msgCall);
        console.log('  - groupsIgnore tipo:', typeof configData.groupsIgnore, 'valor:', configData.groupsIgnore);
        console.log('  - alwaysOnline tipo:', typeof configData.alwaysOnline, 'valor:', configData.alwaysOnline);
        console.log('  - readMessages tipo:', typeof configData.readMessages, 'valor:', configData.readMessages);
        console.log('  - readStatus tipo:', typeof configData.readStatus, 'valor:', configData.readStatus);
        
        const newConfigFields = {
          rejectCall: Boolean(configData.rejectCall),
          msgCall: String(configData.msgCall || ''),
          groupsIgnore: Boolean(configData.groupsIgnore),
          alwaysOnline: Boolean(configData.alwaysOnline),
          readMessages: Boolean(configData.readMessages),
          readStatus: Boolean(configData.readStatus)
        };
        
        console.log('🔧 CAMPOS FINAIS calculados:', newConfigFields);
        console.log('📊 CONVERSÕES APLICADAS:');
        console.log('  - rejectCall:', configData.rejectCall, '→ Boolean() →', newConfigFields.rejectCall);
        console.log('  - msgCall:', configData.msgCall, '→ String() →', newConfigFields.msgCall);
        console.log('  - groupsIgnore:', configData.groupsIgnore, '→ Boolean() →', newConfigFields.groupsIgnore);
        console.log('  - alwaysOnline:', configData.alwaysOnline, '→ Boolean() →', newConfigFields.alwaysOnline);
        console.log('  - readMessages:', configData.readMessages, '→ Boolean() →', newConfigFields.readMessages);
        console.log('  - readStatus:', configData.readStatus, '→ Boolean() →', newConfigFields.readStatus);
        
        console.log('🚀 DEFININDO NOVOS CAMPOS...');
        setConfigFields(newConfigFields);
        console.log('✅ CAMPOS DEFINIDOS COM SUCESSO!');
        
        // Verificar se realmente foram aplicados (será mostrado na próxima renderização)
        setTimeout(() => {
          console.log('⏰ VERIFICAÇÃO APÓS 100ms - configFields atual:', {
            rejectCall: configFields.rejectCall,
            msgCall: configFields.msgCall,
            groupsIgnore: configFields.groupsIgnore,
            alwaysOnline: configFields.alwaysOnline,
            readMessages: configFields.readMessages,
            readStatus: configFields.readStatus
          });
        }, 100);
      } else {
        console.log('❌ configData é null/undefined, não pode processar campos');
      }
      
    } catch (error) {
      console.error('❌ Erro ao buscar configurações:', error);
      console.error('❌ Detalhes do erro de config:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      alert('Erro ao carregar configurações. Tente novamente.');
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedConfigInstance) return;

    try {
      setSavingConfig(true);
      console.log('💾 Salvando configurações da instância:', selectedConfigInstance.name);
      console.log('📄 Dados a serem salvos:', configFields);
      
      const response = await fetch(`${WEBHOOK_BASE_URL}/edit-config-instancia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName: selectedConfigInstance.name,
          instanceId: selectedConfigInstance.id,
          config: {
            rejectCall: configFields.rejectCall,
            msgCall: configFields.msgCall,
            groupsIgnore: configFields.groupsIgnore,
            alwaysOnline: configFields.alwaysOnline,
            readMessages: configFields.readMessages,
            readStatus: configFields.readStatus
          }
        }),
      });

      console.log('📡 Status da resposta de salvamento:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na resposta de salvamento:', response.status, errorText);
        throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Configurações salvas com sucesso:', result);
      
      // Fechar modal de configurações e mostrar modal de sucesso
      setShowConfigModal(false);
      setShowConfigSuccessModal(true);
      
      // Fechar modal de sucesso automaticamente após 3 segundos
      setTimeout(() => {
        setShowConfigSuccessModal(false);
      }, 3000);
      
    } catch (error) {
      console.error('❌ Erro ao salvar configurações:', error);
      console.error('❌ Detalhes do erro de salvamento:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      alert('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setSavingConfig(false);
    }
  };

  // Carregar usuários disponíveis usando a função centralizada do hook
  const loadAvailableUsers = async () => {
    if (!isManager) {
      console.log('❌ Usuário não é gestor, interrompendo carregamento');
      return;
    }
    
    try {
      setLoadingUsers(true);
      console.log('🔄 Carregando usuários disponíveis via hook centralizado...');
      
      // Usar a função centralizada do hook que consulta diretamente a tabela whatsapp_instances
      const availableUsersData = await loadAvailableUsersForAssignment();
      
      console.log('✅ Usuários disponíveis carregados:', {
        count: availableUsersData.length,
        users: availableUsersData.map(u => `${u.full_name} (${u.role})`)
      });
      
      setAvailableUsers(availableUsersData);
    } catch (error) {
      console.error('❌ Erro ao carregar usuários disponíveis:', error);
      setAvailableUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddInstance = async () => {
    if (!newInstanceName.trim() || !newInstanceNumber.trim()) return;
    
    // Para gestores, verificar se selecionou um usuário
    if (isManager && !selectedUserId) {
      alert('Por favor, selecione para qual usuário esta instância será atribuída.');
      return;
    }
    
    // Verificar se há usuários disponíveis
    if (isManager && availableUsers.length === 0) {
      alert('Não há usuários disponíveis. Todos os usuários já possuem instâncias conectadas.');
      return;
    }

    try {
      setCreatingInstance(true);
      const targetUserId = isManager ? selectedUserId : profile?.id;
      
      await createInstance({
        instance_name: newInstanceName,
        phone_number: newInstanceNumber,
        assigned_user_id: targetUserId
      });

      // Limpar form
      setNewInstanceName("");
      setNewInstanceNumber("");
      setSelectedUserId("");
      setShowAddModal(false);
      
      // Recarregar lista de usuários disponíveis para o próximo uso
      if (isManager) {
        loadAvailableUsers();
      }
      
    } catch (error) {
      console.error('❌ Erro ao criar instância:', error);
      alert('Erro ao criar instância. Tente novamente.');
    } finally {
      setCreatingInstance(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header com loading */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Conexões WhatsApp</h1>
            <p className="text-gray-400">Carregando instâncias...</p>
          </div>
          <div className="animate-pulse">
            <div className="h-10 w-32 bg-gray-700 rounded"></div>
          </div>
        </div>

        {/* Cards de loading com animação */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-gray-800/50 border-gray-700/50 animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gray-700/50 rounded-full"></div>
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-700/50 rounded"></div>
                    <div className="h-3 w-16 bg-gray-700/50 rounded"></div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-3 w-full bg-gray-700/50 rounded"></div>
                  <div className="h-3 w-3/4 bg-gray-700/50 rounded"></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-8 bg-gray-700/50 rounded"></div>
                    <div className="h-8 bg-gray-700/50 rounded"></div>
                    <div className="h-8 bg-gray-700/50 rounded"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" key={instances.length}>
      {/* Header moderno com gradiente */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-green-600/20 p-6 border border-gray-700/50">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 animate-pulse"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Wifi className="h-8 w-8 text-blue-400" />
              Conexões WhatsApp
            </h1>
            <p className="text-gray-300">Gerencie suas instâncias do WhatsApp Business</p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2 text-sm text-green-400">
                <Activity className="h-4 w-4" />
                <span>{instances.filter(i => i.status === 'connected').length} Online</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <Zap className="h-4 w-4" />
                <span>{instances.reduce((sum, i) => sum + (i.messageCount || 0), 0)} Mensagens</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-purple-400">
                <Users className="h-4 w-4" />
                <span>{instances.reduce((sum, i) => sum + (i.contactCount || 0), 0)} Contatos</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">

            <Button
              variant="outline"
              onClick={handleRefreshInstances}
              disabled={loading}
              className="bg-gray-800/50 border-gray-600 text-white hover:bg-gray-700/50 transition-all duration-200"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {canCreateInstances && (
              <Button
                onClick={() => {
                  setShowAddModal(true);
                  if (isManager) {
                    loadAvailableUsers();
                  }
                }}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Instância
              </Button>
            )}
          </div>
        </div>
      </div>



      {/* Grid de cards animados ou estado vazio */}
      {instances.length === 0 ? (
        <div className="text-center py-16">
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl p-12 border border-gray-700/50 max-w-md mx-auto">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-600/20 to-blue-700/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-blue-500/30">
              <Smartphone className="h-12 w-12 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Nenhuma instância encontrada</h3>
            <p className="text-gray-400 mb-6">
              Não há instâncias WhatsApp configuradas no momento. 
              Clique no botão acima para adicionar uma nova instância.
            </p>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Instância
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {instances.map((instance, index) => (
            <Card 
              key={instance.id} 
              className="group bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-600/50 hover:border-blue-500/60 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/30 animate-fadeInUp backdrop-blur-sm"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <CardContent className="p-6">
                {/* Header do card com foto e status */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {instance.profilePicUrl ? (
                        <img 
                          src={instance.profilePicUrl} 
                          alt={instance.profileName || instance.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-gray-600/40 shadow-lg group-hover:border-blue-500/50 transition-all duration-300"
                        />
                      ) : (
                                              <div className="w-16 h-16 bg-gradient-to-br from-blue-600/30 to-blue-700/30 rounded-full flex items-center justify-center border-2 border-blue-400/40 shadow-lg">
                        <Smartphone className="h-8 w-8 text-blue-300" />
                      </div>
                      )}
                      <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-gray-800 shadow-lg ${
                        instance.status === 'connected' ? 'bg-green-500 animate-pulse' :
                        instance.status === 'connecting' ? 'bg-blue-500 animate-bounce' :
                        instance.status === 'qr_code' ? 'bg-yellow-500 animate-pulse' :
                        instance.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                      }`}></div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-lg truncate group-hover:text-blue-300 transition-colors">
                        {instance.profileName || instance.name}
                      </h3>
                      {instance.profileName && (
                        <p className="text-gray-400 text-sm truncate">Instância: {instance.name}</p>
                      )}
                      {/* Mostrar informações do usuário proprietário (para gestores) */}
                      {isManager && (
                        <div className="flex items-center gap-1 mt-1">
                          <UserPlus className="h-3 w-3 text-blue-400" />
                          <span className="text-xs text-blue-400 truncate">
                            {instance.user_profile?.full_name || 'Sem usuário atribuído'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Badge className={`${getStatusColor(instance.status)} transition-all duration-300 group-hover:scale-110`}>
                    {getStatusIcon(instance.status)}
                    <span className="ml-1 text-xs">{getStatusText(instance.status)}</span>
                  </Badge>
                </div>

                {/* Informações da instância */}
                <div className="space-y-3 mb-4">
                  {instance.phone && (
                    <div className="bg-slate-700/40 rounded-lg p-3 border border-slate-500/30 group-hover:bg-slate-600/50 transition-all duration-300">
                      <div className="flex items-center gap-2 text-slate-200">
                        <Smartphone className="h-4 w-4 text-blue-300" />
                        <span className="font-mono text-sm">{instance.phone}</span>
                      </div>
                    </div>
                  )}

                  {instance.lastSeen && (
                    <div className="text-center text-sm text-slate-300">
                      Última atividade: {formatLastSeen(instance.lastSeen)}
                    </div>
                  )}

                  {instance.battery && (
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <div className={`w-2 h-2 rounded-full ${
                        instance.battery > 50 ? 'bg-green-400' : 
                        instance.battery > 20 ? 'bg-yellow-400' : 'bg-red-400'
                      }`}></div>
                      <span>Bateria: {instance.battery}%</span>
                    </div>
                  )}

                  {instance.deviceModel && (
                    <div className="text-center text-xs text-slate-400">
                      {instance.deviceModel}
                    </div>
                  )}
                </div>

                {/* Estatísticas com animação */}
                {instance.status === 'connected' && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 rounded-lg p-3 border border-blue-500/20 group-hover:from-blue-600/30 group-hover:to-blue-700/30 transition-all duration-300">
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-400">{instance.messageCount || 0}</div>
                        <div className="text-xs text-gray-400">Mensagens</div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-green-600/20 to-green-700/20 rounded-lg p-3 border border-green-500/20 group-hover:from-green-600/30 group-hover:to-green-700/30 transition-all duration-300">
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-400">{instance.contactCount || 0}</div>
                        <div className="text-xs text-gray-400">Contatos</div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 rounded-lg p-3 border border-purple-500/20 group-hover:from-purple-600/30 group-hover:to-purple-700/30 transition-all duration-300">
                      <div className="text-center">
                        <div className="text-xl font-bold text-purple-400">{instance.chatCount || 0}</div>
                        <div className="text-xs text-gray-400">Chats</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botões de ação */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-600/50">
                  {instance.status === 'disconnected' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateQrCode(instance)}
                      disabled={generatingQr}
                      className="flex-1 bg-blue-600/20 border-blue-500/30 text-blue-400 hover:bg-blue-600/30 hover:border-blue-400/50 transition-all duration-200 disabled:opacity-50"
                    >
                      {generatingQr ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4 mr-2" />
                      )}
                      {generatingQr ? 'Gerando...' : 'Gerar QR Code'}
                    </Button>
                  )}
                  
                  {instance.status === 'qr_code' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShowQrCode(instance)}
                      className="flex-1 bg-yellow-600/20 border-yellow-500/30 text-yellow-400 hover:bg-yellow-600/30 hover:border-yellow-400/50 transition-all duration-200"
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      Ver QR Code
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShowConfig(instance)}
                    className="bg-slate-700/50 border-slate-500/50 text-slate-300 hover:bg-slate-600/60 hover:border-slate-400/60 transition-all duration-200"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteInstance(instance)}
                    className="bg-red-600/20 border-red-500/30 text-red-400 hover:bg-red-600/30 hover:border-red-400/50 transition-all duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Adicionar Instância */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[425px] bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-400" />
              Nova Instância WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor="instanceName" className="text-gray-300">Nome da Instância</Label>
              <Input
                id="instanceName"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                placeholder="Ex: whatsappvendas"
                className="bg-gray-700 border-gray-600 text-white mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">
                Evite número, espaços e letras maiúsculas.
              </p>
            </div>
            <div>
              <Label htmlFor="instanceNumber" className="text-gray-300">Telefone</Label>
              <Input
                id="instanceNumber"
                value={newInstanceNumber}
                onChange={(e) => setNewInstanceNumber(e.target.value)}
                placeholder="Ex: 5519994419319"
                className="bg-gray-700 border-gray-600 text-white mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">
                Coloque no formato DDI+DDD+NUMERO ex: 5519994419319
              </p>
            </div>
            
            {/* Campo de seleção de usuário (apenas para gestores) */}
            {isManager && (
              <div>
                <Label htmlFor="assignedUser" className="text-gray-300">Atribuir para Usuário</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white mt-1">
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    {loadingUsers ? (
                      <SelectItem value="loading" disabled className="text-gray-400">
                        Carregando usuários...
                      </SelectItem>
                    ) : availableUsers.length === 0 ? (
                      <SelectItem value="no-users" disabled className="text-gray-400">
                        Todos os usuários já possuem instâncias conectadas
                      </SelectItem>
                    ) : (
                      availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id} className="text-white hover:bg-gray-600">
                          <div className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-green-400" />
                            <div>
                              <div className="font-medium">{user.full_name}</div>
                              <div className="text-xs text-gray-400">
                                {user.role} • {user.email} • Sem instância conectada
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 mt-1">
                  Apenas usuários sem instâncias conectadas são exibidos.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setNewInstanceName("");
                  setNewInstanceNumber("");
                  setSelectedUserId("");
                }}
                className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddInstance}
                disabled={
                  creatingInstance ||
                  !newInstanceName.trim() || 
                  !newInstanceNumber.trim() || 
                  (isManager && (!selectedUserId || availableUsers.length === 0))
                }
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {creatingInstance ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Instância'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal QR Code */}
      <Dialog open={showQrModal} onOpenChange={(open) => {
        setShowQrModal(open);
        if (!open) {
          setQrCodeImage(null);
          setQrTimer(15);
          setQrExpired(false);
        }
      }}>
        <DialogContent className="sm:max-w-[450px] bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <QrCode className="h-5 w-5 text-blue-400" />
              QR Code - {selectedInstance?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {qrExpired ? (
              // Tela de erro por timeout
              <div className="text-center py-6">
                <div className="w-20 h-20 bg-gradient-to-br from-red-600/30 to-red-700/30 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-500/50">
                  <Clock className="h-12 w-12 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  QR Code Expirado
                </h3>
                <p className="text-gray-300 mb-6">
                  O tempo limite de 15 segundos foi atingido. Tente gerar um novo QR Code.
                </p>
                <div className="flex items-center gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowQrModal(false);
                      setQrCodeImage(null);
                      setQrTimer(15);
                      setQrExpired(false);
                    }}
                    className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleRetryQrCode}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </Button>
                </div>
              </div>
            ) : (
              // Tela normal do QR Code
              <div className="text-center">
                <div className="w-80 h-80 bg-white rounded-lg mx-auto mb-4 flex items-center justify-center overflow-hidden">
                  {qrCodeImage ? (
                    <img 
                      src={qrCodeImage} 
                      alt="QR Code WhatsApp" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-gray-500">
                      <QrCode className="h-16 w-16 mx-auto mb-2" />
                      <p>Aguardando QR Code...</p>
                    </div>
                  )}
                </div>
                
                {/* Timer */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Clock className={`h-5 w-5 ${qrTimer <= 5 ? 'text-red-400' : 'text-blue-400'}`} />
                  <span className={`text-lg font-bold ${qrTimer <= 5 ? 'text-red-400' : 'text-blue-400'}`}>
                    {qrTimer}s
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-gray-300 font-medium">
                    Como conectar:
                  </p>
                  <p className="text-xs text-gray-400">
                    1. Abra o WhatsApp no seu celular<br/>
                    2. Vá em Configurações → Aparelhos conectados<br/>
                    3. Toque em "Conectar um aparelho"<br/>
                    4. Escaneie este QR Code
                  </p>
                  <div className="flex items-center justify-center gap-2 text-xs text-blue-400 mt-4">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span>Aguardando conexão...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Sucesso */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-[400px] bg-gray-800 border-gray-700">
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-gradient-to-br from-green-600/30 to-green-700/30 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-green-500/50">
              <CheckCircle className="h-12 w-12 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Conexão Efetuada com Sucesso!
            </h3>
            <p className="text-gray-300 mb-4">
              A instância <strong>{connectedInstanceName}</strong> foi conectada com sucesso ao WhatsApp.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-green-400">
              <Check className="h-4 w-4" />
              <span>Pronto para usar!</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusão */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-[400px] bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Confirmar Exclusão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-red-600/30 to-red-700/30 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-500/50">
                <Trash2 className="h-8 w-8 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Tem certeza que deseja excluir?
              </h3>
              <p className="text-gray-300 mb-4">
                Esta ação irá excluir permanentemente a instância <strong>{instanceToDelete?.profileName || instanceToDelete?.name}</strong> e não poderá ser desfeita.
              </p>
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
                <p className="text-xs text-red-300">
                  ⚠️ Todos os dados relacionados à esta instância serão perdidos.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setInstanceToDelete(null);
                }}
                className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmDeleteInstance}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Instância
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Configurações */}
      <Dialog open={showConfigModal} onOpenChange={(open) => {
        setShowConfigModal(open);
        if (!open) {
          setSelectedConfigInstance(null);
          setInstanceConfig(null);
          setConfigFields({
            rejectCall: false,
            msgCall: '',
            groupsIgnore: false,
            alwaysOnline: false,
            readMessages: false,
            readStatus: false
          });
        }
      }}>
        <DialogContent className="sm:max-w-[600px] bg-gray-800 border-gray-700 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-400" />
              Configurações - {selectedConfigInstance?.profileName || selectedConfigInstance?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {loadingConfig ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600/30 to-blue-700/30 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-500/50">
                  <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Carregando Configurações...
                </h3>
                <p className="text-gray-300">
                  Aguarde enquanto buscamos as configurações da instância.
                </p>
              </div>
            ) : instanceConfig ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg p-4 border border-blue-500/30">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Settings className="h-5 w-5 text-blue-400" />
                    Configurações da Instância
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Rejeitar Chamadas */}
                    <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-500/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-white">
                            Rejeitar Chamadas
                          </label>
                          <p className="text-xs text-gray-400 mt-1">
                            Rejeitar automaticamente chamadas recebidas
                          </p>
                        </div>
                        <Switch
                          checked={configFields.rejectCall}
                          onCheckedChange={(checked) => setConfigFields(prev => ({ ...prev, rejectCall: checked }))}
                          className="ml-4"
                        />
                      </div>
                    </div>

                    {/* Mensagem de Chamada */}
                    <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-500/30">
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-white">
                            Mensagem de Chamada
                          </label>
                          <p className="text-xs text-gray-400 mt-1">
                            Mensagem enviada quando uma chamada é rejeitada
                          </p>
                        </div>
                        <Input
                          value={configFields.msgCall}
                          onChange={(e) => setConfigFields(prev => ({ ...prev, msgCall: e.target.value }))}
                          placeholder="Digite a mensagem..."
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                    </div>

                    {/* Ignorar Grupos */}
                    <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-500/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-white">
                            Ignorar Grupos
                          </label>
                          <p className="text-xs text-gray-400 mt-1">
                            Ignorar mensagens de grupos
                          </p>
                        </div>
                        <Switch
                          checked={configFields.groupsIgnore}
                          onCheckedChange={(checked) => setConfigFields(prev => ({ ...prev, groupsIgnore: checked }))}
                          className="ml-4"
                        />
                      </div>
                    </div>

                    {/* Sempre Online */}
                    <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-500/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-white">
                            Sempre Online
                          </label>
                          <p className="text-xs text-gray-400 mt-1">
                            Manter status sempre online
                          </p>
                        </div>
                        <Switch
                          checked={configFields.alwaysOnline}
                          onCheckedChange={(checked) => setConfigFields(prev => ({ ...prev, alwaysOnline: checked }))}
                          className="ml-4"
                        />
                      </div>
                    </div>

                    {/* Ler Mensagens */}
                    <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-500/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-white">
                            Ler Mensagens
                          </label>
                          <p className="text-xs text-gray-400 mt-1">
                            Marcar mensagens como lidas automaticamente
                          </p>
                        </div>
                        <Switch
                          checked={configFields.readMessages}
                          onCheckedChange={(checked) => setConfigFields(prev => ({ ...prev, readMessages: checked }))}
                          className="ml-4"
                        />
                      </div>
                    </div>

                    {/* Ler Status */}
                    <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-500/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-white">
                            Ler Status
                          </label>
                          <p className="text-xs text-gray-400 mt-1">
                            Ler status dos contatos automaticamente
                          </p>
                        </div>
                        <Switch
                          checked={configFields.readStatus}
                          onCheckedChange={(checked) => setConfigFields(prev => ({ ...prev, readStatus: checked }))}
                          className="ml-4"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowConfigModal(false)}
                    className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                    disabled={savingConfig}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {savingConfig ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Settings className="h-4 w-4 mr-2" />
                        Salvar Configurações
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gradient-to-br from-red-600/30 to-red-700/30 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-500/50">
                  <XCircle className="h-8 w-8 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Erro ao Carregar Configurações
                </h3>
                <p className="text-gray-300 mb-4">
                  Não foi possível carregar as configurações desta instância.
                </p>
                <div className="flex items-center gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowConfigModal(false)}
                    className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                  >
                    Fechar
                  </Button>
                  <Button
                    onClick={() => selectedConfigInstance && handleShowConfig(selectedConfigInstance)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Sucesso das Configurações */}
      <Dialog open={showConfigSuccessModal} onOpenChange={setShowConfigSuccessModal}>
        <DialogContent className="sm:max-w-[400px] bg-gray-800 border-gray-700">
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-gradient-to-br from-green-600/30 to-green-700/30 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-green-500/50">
              <CheckCircle className="h-12 w-12 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Configurações Salvas com Sucesso!
            </h3>
            <p className="text-gray-300 mb-4">
              As configurações da instância <strong>{selectedConfigInstance?.profileName || selectedConfigInstance?.name}</strong> foram atualizadas com sucesso.
            </p>
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-center gap-2 text-sm text-green-400">
                <Settings className="h-4 w-4" />
                <span>Configurações aplicadas!</span>
              </div>
            </div>
            <Button
              onClick={() => setShowConfigSuccessModal(false)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="h-4 w-4 mr-2" />
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 