import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  UserCheck,
  Clock,
  Building2,
  Star,
  MessageSquare,
  AlertCircle,
  User,
  CheckCircle,
  CreditCard,
  Heart,
  ChevronDown,
  ChevronUp,
  X,
  AlertTriangle,
  Info
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useKanbanLeads } from '@/hooks/useKanbanLeads';
import { AddLeadModal } from '@/components/AddLeadModal';
import { BulkAssignModal } from '@/components/BulkAssignModal';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useRef } from 'react';

// Função para determinar cor do status baseado no stage
const getStageColor = (stage: string) => {
  switch (stage) {
    case 'Fechado': return 'bg-green-100 text-green-800 border-green-300';
    case 'Em Atendimento': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'Reunião Agendada': return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'Novo Lead': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'Perdido': return 'bg-red-100 text-red-800 border-red-300';
    case 'Desistiu': return 'bg-gray-100 text-gray-800 border-gray-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

// Função para determinar cor da origem
const getSourceColor = (source: string) => {
  switch (source.toLowerCase()) {
    case 'facebook': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'zap imóveis': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'viva real': return 'bg-green-100 text-green-800 border-green-300';
    case 'olx': return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'indicação': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'whatsapp': return 'bg-teal-100 text-teal-800 border-teal-300';
    case 'website': return 'bg-cyan-100 text-cyan-800 border-cyan-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

// Função para determinar cor do badge do corretor
const getBrokerColor = (role: string) => {
  switch (role.toLowerCase()) {
    case 'admin': return 'bg-red-100 text-red-800 border-red-300';
    case 'gestor': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    case 'corretor': return 'bg-amber-100 text-amber-800 border-amber-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

export function ClientsCRMView() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('todos');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [brokerFilter, setBrokerFilter] = useState<string>('all');
  const [selectedBrokers, setSelectedBrokers] = useState<Set<string>>(new Set());
  const [showBrokerFilter, setShowBrokerFilter] = useState<boolean>(false);
  const [brokers, setBrokers] = useState<Array<{ id: string; full_name: string; role: string }>>([]);
  const brokerFilterRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const [showBulkAssignModal, setShowBulkAssignModal] = useState<boolean>(false);
  const [leadsWithChats, setLeadsWithChats] = useState<Set<string>>(new Set());
  
  // Usar o mesmo hook que o Pipeline de Clientes
  const { leads, loading, createLead, bulkAssignLeads } = useKanbanLeads();
  
  // Verificar se o usuário pode ver informações de todos os corretores
  const { profile, getCompanyUsers } = useUserProfile();
  const canSeeAllBrokers = profile?.role === 'gestor' || profile?.role === 'admin';
  

  React.useEffect(() => {
    let cancelled = false;
    const loadBrokers = async () => {
      if (!canSeeAllBrokers) return;
      try {
        const users = await getCompanyUsers();
        if (cancelled) return;
        const onlyBrokers = (users || []).filter((u: any) => (u.role ?? 'corretor') === 'corretor');
        setBrokers(onlyBrokers.map((u: any) => ({ 
          id: u.id, 
          full_name: u.full_name || 'Sem nome',
          role: u.role || 'corretor'
        })));
      } catch (e) {
        // silencioso
      }
    };
    loadBrokers();
    return () => { cancelled = true; };
  }, [canSeeAllBrokers, getCompanyUsers]);

  // Carregar leads que possuem conversas no WhatsApp
  React.useEffect(() => {
    let cancelled = false;
    const loadLeadsWithChats = async () => {
      if (!leads.length) return;
      
      try {
        // Pegar lista de IDs dos leads atuais
        const leadIds = leads.map(lead => lead.id);
        
        // Buscar conversas apenas para os leads atuais
        const { data: chats, error } = await supabase
          .from('whatsapp_chats')
          .select('lead_id')
          .not('lead_id', 'is', null)
          .in('lead_id', leadIds);

        if (error) {
          console.error('Erro ao buscar chats:', error);
          return;
        }

        if (cancelled) return;

        // Criar set com os IDs dos leads que têm conversas
        const leadsWithChatsSet = new Set(
          (chats || [])
            .map(chat => chat.lead_id)
            .filter(Boolean)
        );
        
        setLeadsWithChats(leadsWithChatsSet);
        console.log('📱 Leads com conversas WhatsApp:', leadsWithChatsSet.size, 'de', leads.length, 'leads');
      } catch (error) {
        console.error('Erro ao verificar conversas dos leads:', error);
      }
    };

    loadLeadsWithChats();
    return () => { cancelled = true; };
  }, [leads]);

  // Effect para fechar filtro ao clicar fora
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (brokerFilterRef.current && !brokerFilterRef.current.contains(event.target as Node)) {
        setShowBrokerFilter(false);
      }
    };

    if (showBrokerFilter) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBrokerFilter]);

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (lead.telefone && lead.telefone.includes(searchTerm));
    
    const matchesTab = selectedTab === 'todos' || 
                      (selectedTab === 'ativos' && ['Fechado', 'Em Atendimento', 'Reunião Agendada'].includes(lead.stage)) ||
                      (selectedTab === 'prospects' && ['Novo Lead'].includes(lead.stage)) ||
                      (selectedTab === 'negociacao' && ['Em Atendimento', 'Reunião Agendada'].includes(lead.stage)) ||
                      (selectedTab === 'fechados' && lead.stage === 'Fechado') ||
                      (selectedTab === 'perdidos' && ['Perdido', 'Desistiu'].includes(lead.stage));

    const matchesBroker = !canSeeAllBrokers || 
                      selectedBrokers.size === 0 || 
                      (lead.id_corretor_responsavel && selectedBrokers.has(lead.id_corretor_responsavel)) ||
                      (selectedBrokers.has('unassigned') && !lead.id_corretor_responsavel);

    return matchesSearch && matchesTab && matchesBroker;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedTab, selectedBrokers]);

  // Funções para gerenciar filtro de corretores
  const handleBrokerToggle = (brokerId: string) => {
    const newSelected = new Set(selectedBrokers);
    if (newSelected.has(brokerId)) {
      newSelected.delete(brokerId);
    } else {
      newSelected.add(brokerId);
    }
    setSelectedBrokers(newSelected);
  };

  const clearBrokerFilter = () => {
    setSelectedBrokers(new Set());
  };

  const selectAllBrokers = () => {
    const allBrokerIds = new Set([...brokers.map(b => b.id), 'unassigned']);
    setSelectedBrokers(allBrokerIds);
  };

  const stats = {
    total: leads.length,
    ativos: leads.filter(l => ['Fechado', 'Em Atendimento', 'Reunião Agendada'].includes(l.stage)).length,
    prospects: leads.filter(l => l.stage === 'Novo Lead').length,
    fechados: leads.filter(l => l.stage === 'Fechado').length,
    totalValue: leads.reduce((sum, l) => sum + (l.valorEstimado || l.valor || 0), 0)
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
  };

  const handleViewLead = (lead) => {
    setSelectedLead(lead);
    setShowViewModal(true);
  };

  const handleEditLead = (lead) => {
    setSelectedLead(lead);
    setShowEditModal(true);
  };

  const handleOpenWhatsApp = (lead) => {
    // Verificar se o lead tem conversa ativa
    if (!leadsWithChats.has(lead.id)) {
      console.log('❌ Lead não possui conversa ativa no WhatsApp:', lead.nome);
      return;
    }
    
    // Módulo de chats foi removido - funcionalidade desabilitada
    console.log('ℹ️ Funcionalidade de chats foi removida do sistema');
    // navigate('/chats', { state: { leadPhone: lead.telefone, leadName: lead.nome } });
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setSelectedLead(null);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedLead(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="inline-block"
        >
          <Users className="h-8 w-8 text-blue-400" />
        </motion.div>
        <p className="ml-3 text-gray-400">Carregando clientes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            CRM de Clientes
          </h1>
          <p className="text-gray-400">
            Gestão completa do relacionamento com clientes e prospects
          </p>
        </div>
        
        <motion.div 
          className="flex gap-3"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          {canSeeAllBrokers && (
            <Button
              variant="outline"
              onClick={() => setShowBulkAssignModal(true)}
              className="flex items-center gap-2 bg-gray-900/50 border-green-600/50 text-green-400 hover:bg-gray-800"
            >
              <Users className="h-4 w-4" />
              Gestão em Massa
            </Button>
          )}
          
          {canSeeAllBrokers && (
            <div ref={brokerFilterRef} className="relative">
              <Button
                variant="outline"
                onClick={() => setShowBrokerFilter(!showBrokerFilter)}
                className="flex items-center gap-2 bg-gray-900/50 border-blue-600/50 text-blue-400 hover:bg-gray-800"
              >
                <Filter className="h-4 w-4" />
                Filtrar Corretores 
                {selectedBrokers.size > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-blue-600 text-white">
                    {selectedBrokers.size}
                  </Badge>
                )}
                {showBrokerFilter ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>

              {showBrokerFilter && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-white">Filtrar por Corretor</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowBrokerFilter(false)}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllBrokers}
                      className="text-xs bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Todos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearBrokerFilter}
                      className="text-xs bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Limpar
                    </Button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {/* Opção para leads sem corretor */}
                    <div className="flex items-center space-x-2 p-2 hover:bg-gray-800 rounded">
                      <Checkbox
                        id="unassigned"
                        checked={selectedBrokers.has('unassigned')}
                        onCheckedChange={() => handleBrokerToggle('unassigned')}
                      />
                      <label
                        htmlFor="unassigned"
                        className="text-sm text-gray-300 cursor-pointer flex-1"
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          Sem corretor atribuído
                        </div>
                      </label>
                    </div>

                    {/* Lista de corretores */}
                    {brokers.map(broker => (
                      <div key={broker.id} className="flex items-center space-x-2 p-2 hover:bg-gray-800 rounded">
                        <Checkbox
                          id={broker.id}
                          checked={selectedBrokers.has(broker.id)}
                          onCheckedChange={() => handleBrokerToggle(broker.id)}
                        />
                        <label
                          htmlFor={broker.id}
                          className="text-sm text-gray-300 cursor-pointer flex-1"
                        >
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-amber-400" />
                            {broker.full_name}
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>

                  {selectedBrokers.size > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-400">
                        {selectedBrokers.size} corretor{selectedBrokers.size !== 1 ? 'es' : ''} selecionado{selectedBrokers.size !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}


          <Button 
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        </motion.div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
      >
        {[
          { title: "Total Clientes", value: stats.total, icon: Users, color: "text-blue-400" },
          { title: "Clientes Ativos", value: stats.ativos, icon: UserCheck, color: "text-green-400" },
          { title: "Prospects", value: stats.prospects, icon: Star, color: "text-yellow-400" },
          { title: "Fechados", value: stats.fechados, icon: CheckCircle, color: "text-emerald-400" }
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            whileHover={{ scale: 1.02, y: -5 }}
            transition={{ duration: 0.2 }}
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
          </motion.div>
        ))}
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.8 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder-gray-400 focus:border-blue-500"
          />
        </div>
      </motion.div>

      {/* Clients List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.8 }}
      >
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-gray-800/50 backdrop-blur-sm">
            <TabsTrigger value="todos" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-400">
              Todos ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="ativos" className="data-[state=active]:bg-green-600/20 data-[state=active]:text-green-400">
              Ativos ({stats.ativos})
            </TabsTrigger>
            <TabsTrigger value="prospects" className="data-[state=active]:bg-yellow-600/20 data-[state=active]:text-yellow-400">
              Prospects ({stats.prospects})
            </TabsTrigger>
            <TabsTrigger value="negociacao" className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-400">
              Em Negociação
            </TabsTrigger>
            <TabsTrigger value="fechados" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
              Fechados ({stats.fechados})
            </TabsTrigger>
            <TabsTrigger value="perdidos" className="data-[state=active]:bg-red-600/20 data-[state=active]:text-red-400">
              Perdidos
            </TabsTrigger>
          </TabsList>

          {['todos', 'ativos', 'prospects', 'negociacao', 'fechados', 'perdidos'].map(tab => (
            <TabsContent key={tab} value={tab} className="space-y-4 mt-6">
              <div className="grid gap-4">
                {paginatedLeads.map((lead, index) => (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    whileHover={{ scale: 1.01, y: -2 }}
                  >
                    <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700/60 hover:bg-gray-800/70 transition-all duration-300">
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          {/* Informações Principais do Cliente */}
                          <div className="flex-1">
                            {/* Header com Nome e Status */}
                            <div className="flex items-start gap-3 mb-4">
                              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-semibold text-sm">
                                  {lead.nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold text-white mb-2">{lead.nome}</h3>
                                <div className="flex gap-2 flex-wrap">
                                  <Badge variant="outline" className={getStageColor(lead.stage)}>
                                    {lead.stage}
                                  </Badge>
                                  <Badge variant="outline" className={getSourceColor(lead.origem)}>
                                    {lead.origem}
                                  </Badge>
                                  {/* Label do corretor responsável (sempre exibir, com fallbacks) */}
                                  {(() => {
                                    const brokerFromList = lead.id_corretor_responsavel 
                                      ? brokers.find(b => b.id === lead.id_corretor_responsavel) 
                                      : undefined;
                                    const brokerName = lead.corretor?.nome 
                                      || brokerFromList?.full_name 
                                      || (lead.id_corretor_responsavel && profile?.id && lead.id_corretor_responsavel === profile.id ? 'Você' 
                                      : 'Sem corretor');
                                    const brokerRole = (lead.corretor?.role || brokerFromList?.role || 'corretor');
                                    return (
                                      <Badge variant="outline" className={getBrokerColor(brokerRole)}>
                                        <User className="h-3 w-3 mr-1" />
                                        {brokerName}
                                      </Badge>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                            
                            {/* Grupos de Informações lado a lado */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                              {/* Informações de Contato - Seção 1 */}
                              <div className="bg-gray-900/30 p-4 rounded-lg">
                                <h4 className="text-sm font-medium text-blue-400 mb-3 flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4" />
                                  Informações de Contato
                                </h4>
                                <div className="space-y-2">
                                  {lead.email && (
                                    <div className="flex items-center gap-2 text-gray-300">
                                      <Mail className="h-4 w-4 text-blue-400" />
                                      <span className="text-sm truncate">{lead.email}</span>
                                    </div>
                                  )}
                                  {lead.telefone && (
                                    <div className="flex items-center gap-2 text-gray-300">
                                      <Phone className="h-4 w-4 text-green-400" />
                                      <span className="text-sm">{lead.telefone}</span>
                                    </div>
                                  )}
                                  {lead.endereco && (
                                    <div className="flex items-start gap-2 text-gray-300">
                                      <MapPin className="h-4 w-4 text-orange-400 mt-0.5" />
                                      <span className="text-sm text-gray-400 line-clamp-2">{lead.endereco}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Informações do Negócio - Seção 2 */}
                              <div className="bg-gray-900/30 p-4 rounded-lg">
                                <h4 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4" />
                                  Interesse e Valor
                                </h4>
                                <div className="space-y-2">
                                  {lead.interesse && (
                                    <div className="flex items-start gap-2 text-gray-300">
                                      <Building2 className="h-4 w-4 text-green-400 mt-0.5" />
                                      <span className="text-sm text-gray-400 line-clamp-2">{lead.interesse}</span>
                                    </div>
                                  )}
                                  {(lead.valorEstimado || lead.valor) && (
                                    <div className="flex items-center gap-2 text-gray-300">
                                      <DollarSign className="h-4 w-4 text-green-400" />
                                      <span className="text-sm font-medium">
                                        R$ {(lead.valorEstimado || lead.valor || 0).toLocaleString('pt-BR')}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 text-gray-300">
                                    <Calendar className="h-4 w-4 text-purple-400" />
                                    <span className="text-sm">
                                      {new Date(lead.dataContato).toLocaleDateString('pt-BR')}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Informações Adicionais - Seção 3 */}
                              {(lead.observacoes || lead.cpf || lead.estado_civil || lead.message) ? (
                                <div className="bg-gray-900/30 p-4 rounded-lg">
                                  <h4 className="text-sm font-medium text-purple-400 mb-3 flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Informações Adicionais
                                  </h4>
                                  <div className="space-y-2">
                                    {lead.cpf && (
                                      <div className="flex items-center gap-2 text-gray-300">
                                        <CreditCard className="h-4 w-4 text-purple-400" />
                                        <span className="text-sm">
                                          <strong>CPF:</strong> {lead.cpf}
                                        </span>
                                      </div>
                                    )}
                                    {lead.estado_civil && (
                                      <div className="flex items-center gap-2 text-gray-300">
                                        <Heart className="h-4 w-4 text-purple-400" />
                                        <span className="text-sm">
                                          <strong>Estado Civil:</strong> {lead.estado_civil}
                                        </span>
                                      </div>
                                    )}
                                    {lead.message && (
                                      <div className="flex items-start gap-2 text-gray-300">
                                        <MessageSquare className="h-4 w-4 text-purple-400 mt-0.5" />
                                        <div className="text-sm">
                                          <strong>Mensagem:</strong>
                                          <p className="text-gray-400 mt-1 italic line-clamp-2">"{lead.message}"</p>
                                        </div>
                                      </div>
                                    )}
                                    {lead.observacoes && (
                                      <div className="flex items-start gap-2 text-gray-300">
                                        <FileText className="h-4 w-4 text-purple-400 mt-0.5" />
                                        <div className="text-sm">
                                          <strong>Observações:</strong>
                                          <p className="text-gray-400 mt-1 line-clamp-2">{lead.observacoes}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                // Placeholder vazio para manter alinhamento
                                <div className="bg-gray-900/30 p-4 rounded-lg opacity-50">
                                  <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Sem dados adicionais
                                  </h4>
                                  <p className="text-xs text-gray-500">Nenhuma informação adicional disponível</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-2 lg:flex-col lg:items-end">
                            {(() => {
                              const hasWhatsAppChat = leadsWithChats.has(lead.id);
                              const actions = [
                                { 
                                  icon: Eye, 
                                  color: "bg-blue-700 border-blue-600 text-blue-100 hover:bg-blue-600", 
                                  label: "Ver Detalhes",
                                  action: () => handleViewLead(lead),
                                  disabled: false
                                },
                                { 
                                  icon: Edit, 
                                  color: "bg-green-700 border-green-600 text-green-100 hover:bg-green-600", 
                                  label: "Editar",
                                  action: () => handleEditLead(lead),
                                  disabled: false
                                },
                                { 
                                  icon: MessageSquare, 
                                  color: hasWhatsAppChat 
                                    ? "bg-emerald-700 border-emerald-600 text-emerald-100 hover:bg-emerald-600" 
                                    : "bg-gray-700 border-gray-600 text-gray-400 cursor-not-allowed",
                                  label: hasWhatsAppChat 
                                    ? "WhatsApp" 
                                    : "WhatsApp (Sem conversa)",
                                  action: () => handleOpenWhatsApp(lead),
                                  disabled: !hasWhatsAppChat
                                }
                              ];
                              
                              return actions.map((action, actionIndex) => (
                                <motion.div
                                  key={actionIndex}
                                  whileHover={!action.disabled ? { scale: 1.1, y: -2 } : {}}
                                  whileTap={!action.disabled ? { scale: 0.9 } : {}}
                                >
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    disabled={action.disabled}
                                    className={`${action.color} backdrop-blur-sm transition-all duration-200 ${action.disabled ? 'opacity-50' : ''}`}
                                    title={action.label}
                                    onClick={action.disabled ? undefined : action.action}
                                  >
                                    <action.icon className="h-4 w-4" />
                                  </Button>
                                </motion.div>
                              ));
                            })()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {filteredLeads.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8 }}
                >
                  <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700/60">
                    <CardContent className="p-12 text-center">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-white mb-2">Nenhum cliente encontrado</h3>
                      <p className="text-gray-400 mb-4">
                        {searchTerm ? 'Não encontramos clientes com os critérios de busca.' : 'Você ainda não possui clientes cadastrados.'}
                      </p>
                      <Button 
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                        onClick={() => setShowAddModal(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Primeiro Cliente
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {filteredLeads.length > 0 && (
                <div className="mt-6 flex items-center justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }}
                          className={safePage === 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink
                            href="#"
                            isActive={safePage === (i + 1)}
                            className="text-white hover:text-blue-400 data-[state=active]:text-blue-400"
                            onClick={(e) => { e.preventDefault(); setCurrentPage(i + 1); }}
                          >
                            {i + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }}
                          className={safePage === totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </motion.div>

      {/* Modal Adicionar Cliente */}
      <AddLeadModal
        isOpen={showAddModal}
        onClose={handleCloseModal}
      />

      {/* Modal Editar Cliente */}
      <AddLeadModal
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        leadToEdit={selectedLead}
      />

      {/* Modal Gestão em Massa */}
      <BulkAssignModal
        isOpen={showBulkAssignModal}
        onClose={() => setShowBulkAssignModal(false)}
        leads={leads}
        brokers={brokers}
        onBulkAssign={bulkAssignLeads}
      />

      {/* Modal Visualizar Cliente */}
      <Dialog open={showViewModal} onOpenChange={handleCloseViewModal}>
        <DialogContent className="max-w-4xl bg-gray-900/95 border-gray-700/50 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <span className="text-white font-semibold">
                  {selectedLead?.nome?.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </span>
              </div>
              {selectedLead?.nome}
            </DialogTitle>
          </DialogHeader>
          
          {selectedLead && (
            <div className="space-y-6 py-4">
              {/* Status e Badges */}
              <div className="flex gap-3 flex-wrap">
                <Badge variant="outline" className={getStageColor(selectedLead.stage)}>
                  {selectedLead.stage}
                </Badge>
                <Badge variant="outline" className={getSourceColor(selectedLead.origem)}>
                  {selectedLead.origem}
                </Badge>
                {/* Label do corretor responsável (sempre exibir, com fallbacks) */}
                {(() => {
                  const brokerFromList = selectedLead.id_corretor_responsavel 
                    ? brokers.find(b => b.id === selectedLead.id_corretor_responsavel) 
                    : undefined;
                  const brokerName = selectedLead.corretor?.nome 
                    || brokerFromList?.full_name 
                    || (selectedLead.id_corretor_responsavel && profile?.id && selectedLead.id_corretor_responsavel === profile.id ? 'Você' 
                    : 'Sem corretor');
                  const brokerRole = (selectedLead.corretor?.role || brokerFromList?.role || 'corretor');
                  return (
                    <Badge variant="outline" className={getBrokerColor(brokerRole)}>
                      <User className="h-3 w-3 mr-1" />
                      {brokerName}
                    </Badge>
                  );
                })()}
              </div>

              {/* Informações em Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Dados Pessoais */}
                <Card className="bg-gray-800/50 border-gray-700/60">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <User className="h-5 w-5 text-blue-400" />
                      Dados Pessoais
                    </h3>
                    <div className="space-y-3">
                      {selectedLead.email && (
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-300">{selectedLead.email}</span>
                        </div>
                      )}
                      {selectedLead.telefone && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-300">{selectedLead.telefone}</span>
                        </div>
                      )}
                      {selectedLead.cpf && (
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-300">CPF: {selectedLead.cpf}</span>
                        </div>
                      )}
                      {selectedLead.estado_civil && (
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-300">Estado Civil: {selectedLead.estado_civil}</span>
                        </div>
                      )}
                      {selectedLead.endereco && (
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-300">{selectedLead.endereco}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Informações do Negócio */}
                <Card className="bg-gray-800/50 border-gray-700/60">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-green-400" />
                      Informações do Negócio
                    </h3>
                    <div className="space-y-3">
                      {selectedLead.interesse && (
                        <div className="flex items-center gap-3">
                          <Star className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-300">Interesse: {selectedLead.interesse}</span>
                        </div>
                      )}
                      {(selectedLead.valorEstimado || selectedLead.valor) && (
                        <div className="flex items-center gap-3">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-300">
                            Valor Estimado: R$ {(selectedLead.valorEstimado || selectedLead.valor || 0).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-300">
                          Cadastro: {new Date(selectedLead.dataContato).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Observações */}
              {selectedLead.observacoes && (
                <Card className="bg-gray-800/50 border-gray-700/60">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-purple-400" />
                      Observações
                    </h3>
                    <p className="text-gray-300 leading-relaxed">{selectedLead.observacoes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Actions Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <Button
                  variant="outline"
                  onClick={handleCloseViewModal}
                  className="border-gray-600 text-red-400 hover:bg-gray-800 hover:text-red-300"
                >
                  Fechar
                </Button>
                <Button
                  onClick={() => {
                    handleCloseViewModal();
                    handleEditLead(selectedLead);
                  }}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar Cliente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 