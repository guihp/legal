import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
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
  WifiOff
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Separator } from "./ui/separator";
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWhatsAppInstances, WhatsAppInstance } from '@/hooks/useWhatsAppInstances';

export function ConnectionsViewMultiUser() {
  const { profile, isManager, isAdmin, getCompanyUsers } = useUserProfile();
  const { 
    instances, 
    loading, 
    error, 
    createInstance, 
    updateInstanceStatus,
    deleteInstance,
    getInstanceStats,
    getInstancesByUser,
    refreshInstances 
  } = useWhatsAppInstances();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newInstancePhone, setNewInstancePhone] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("instances");

  // Carregar usuários da empresa se for gestor
  useEffect(() => {
    if (isManager) {
      getCompanyUsers().then(users => {
        setCompanyUsers(users);
      }).catch(console.error);
    }
  }, [isManager]);

  // Filtrar instâncias baseado nos filtros
  const filteredInstances = instances.filter(instance => {
    const matchesSearch = instance.instance_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         instance.phone_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         instance.user_profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || instance.status === statusFilter;
    const matchesUser = userFilter === "all" || instance.user_id === userFilter;

    return matchesSearch && matchesStatus && matchesUser;
  });

  // Obter estatísticas
  const stats = getInstanceStats();

  // Criar nova instância
  const handleCreateInstance = async () => {
    try {
      if (!newInstanceName.trim()) {
        throw new Error('Nome da instância é obrigatório');
      }

      await createInstance({
        instance_name: newInstanceName,
        phone_number: newInstancePhone || undefined
      });

      setNewInstanceName("");
      setNewInstancePhone("");
      setShowAddModal(false);
    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
    }
  };

  // Deletar instância
  const handleDeleteInstance = async (instanceId: string) => {
    if (window.confirm('Tem certeza que deseja deletar esta instância?')) {
      try {
        await deleteInstance(instanceId);
      } catch (error: any) {
        console.error('Erro ao deletar instância:', error);
      }
    }
  };

  // Atualizar status
  const handleUpdateStatus = async (instanceId: string, newStatus: WhatsAppInstance['status']) => {
    try {
      await updateInstanceStatus(instanceId, newStatus);
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  // Componente para exibir instância
  const InstanceCard = ({ instance }: { instance: WhatsAppInstance }) => {
    const statusColor = {
      connected: 'bg-green-500',
      disconnected: 'bg-red-500',
      connecting: 'bg-yellow-500',
      qr_code: 'bg-blue-500',
      error: 'bg-red-600'
    }[instance.status];

    const StatusIcon = {
      connected: CheckCircle,
      disconnected: XCircle,
      connecting: Clock,
      qr_code: QrCode,
      error: AlertTriangle
    }[instance.status];

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="group"
      >
        <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Smartphone className="h-6 w-6 text-gray-400" />
                  <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${statusColor} animate-pulse`} />
                </div>
                <div>
                  <CardTitle className="text-white text-lg">{instance.instance_name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {instance.status === 'connected' ? 'Conectado' : 
                       instance.status === 'disconnected' ? 'Desconectado' :
                       instance.status === 'connecting' ? 'Conectando' :
                       instance.status === 'qr_code' ? 'QR Code' : 'Erro'}
                    </Badge>
                    {isManager && (
                      <Badge variant="secondary" className="text-xs">
                        <User className="h-3 w-3 mr-1" />
                        {instance.user_profile?.full_name || 'Usuário'}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSelectedInstance(instance)}>
                    <QrCode className="h-4 w-4 mr-2" />
                    QR Code
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdateStatus(instance.id, 'connecting')}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reconectar
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleDeleteInstance(instance.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Deletar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Telefone:</span>
                <p className="text-white font-medium">{instance.phone_number || 'Não definido'}</p>
              </div>
              <div>
                <span className="text-gray-400">Mensagens:</span>
                <p className="text-white font-medium">{instance.message_count}</p>
              </div>
              <div>
                <span className="text-gray-400">Contatos:</span>
                <p className="text-white font-medium">{instance.contact_count}</p>
              </div>
              <div>
                <span className="text-gray-400">Chats:</span>
                <p className="text-white font-medium">{instance.chat_count}</p>
              </div>
            </div>
            
            {instance.last_seen && (
              <div className="mt-4 text-xs text-gray-400">
                Última atividade: {new Date(instance.last_seen).toLocaleString('pt-BR')}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Conexões WhatsApp</h2>
          <p className="text-gray-400 mt-1">
            {isManager ? 'Gerencie todas as instâncias da empresa' : 'Gerencie suas instâncias WhatsApp'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={refreshInstances}
            disabled={loading}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <Button 
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Instância
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Smartphone className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-sm text-gray-400">Total de Instâncias</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Wifi className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.connected}</p>
                <p className="text-sm text-gray-400">Conectadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <MessageCircle className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalMessages}</p>
                <p className="text-sm text-gray-400">Mensagens</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Users className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalContacts}</p>
                <p className="text-sm text-gray-400">Contatos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Pesquisar instâncias..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-900/50 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-gray-900/50 border-gray-600 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="connected">Conectadas</SelectItem>
                <SelectItem value="disconnected">Desconectadas</SelectItem>
                <SelectItem value="connecting">Conectando</SelectItem>
                <SelectItem value="qr_code">QR Code</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
              </SelectContent>
            </Select>

            {isManager && (
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-48 bg-gray-900/50 border-gray-600 text-white">
                  <SelectValue placeholder="Usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  {companyUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Instâncias */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <Alert className="bg-red-900/30 border-red-500/60">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-red-200">
            Erro ao carregar instâncias: {error}
          </AlertDescription>
        </Alert>
      ) : filteredInstances.length === 0 ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-12 text-center">
            <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Nenhuma instância encontrada</h3>
            <p className="text-gray-400 mb-4">
              {instances.length === 0 
                ? 'Crie sua primeira instância WhatsApp para começar'
                : 'Nenhuma instância corresponde aos filtros aplicados'
              }
            </p>
            {instances.length === 0 && (
              <Button 
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Instância
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredInstances.map(instance => (
              <InstanceCard key={instance.id} instance={instance} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal para adicionar instância */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Nova Instância WhatsApp</DialogTitle>
            <DialogDescription className="text-gray-400">
              Crie uma nova instância para conectar uma conta WhatsApp
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="instance-name" className="text-gray-300">Nome da Instância *</Label>
              <Input
                id="instance-name"
                placeholder="Ex: Minha Conta WhatsApp"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
              />
            </div>
            
            <div>
              <Label htmlFor="instance-phone" className="text-gray-300">Telefone (opcional)</Label>
              <Input
                id="instance-phone"
                placeholder="(11) 99999-9999"
                value={newInstancePhone}
                onChange={(e) => setNewInstancePhone(e.target.value)}
                className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setShowAddModal(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateInstance}
              disabled={!newInstanceName.trim()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Instância
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 