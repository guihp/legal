import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, X, Mail, Phone, MapPin, CreditCard, Heart, Building2, UserCheck, ChevronsUpDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useKanbanLeads } from '@/hooks/useKanbanLeads';
import { useProperties } from '@/hooks/useProperties';
import { KanbanLead, LeadStage } from '@/types/kanban';
import { supabase } from '@/integrations/supabase/client';
import { useImoveisVivaReal } from '@/hooks/useImoveisVivaReal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

const leadStages: LeadStage[] = [
  'Novo Lead',
  'Qualificado', 
  'Visita Agendada',
  'Em Negociação',
  'Documentação',
  'Contrato',
  'Fechamento'
];

const leadSources = [
  'Facebook',
  'Zap Imóveis',
  'Viva Real',
  'OLX',
  'Indicação',
  'Whatsapp',
  'Website',
  'Outros'
];

const estadosCivis = [
  'Solteiro',
  'Casado',
  'Divorciado',
  'Viúvo',
  'União Estável'
];

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadToEdit?: KanbanLead | null;
  updateLeadOverride?: (leadId: string, updates: Partial<KanbanLead>) => Promise<boolean>;
}

export const AddLeadModal: React.FC<AddLeadModalProps> = ({ 
  isOpen, 
  onClose, 
  leadToEdit = null,
  updateLeadOverride
}) => {
  const { createLead, updateLead } = useKanbanLeads();
  const { properties } = useProperties();
  const [loading, setLoading] = useState(false);
  const { imoveis, refetch: refetchImoveis } = useImoveisVivaReal({ pageSize: 50 });

  // Corretores disponíveis para atribuição
  const [corretores, setCorretores] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedCorretor, setSelectedCorretor] = useState<string>('');
  const [corretorOpen, setCorretorOpen] = useState(false);
  const [corretorQuery, setCorretorQuery] = useState('');
  const [corretorLoading, setCorretorLoading] = useState(false);

  // Estado para seleção de listing_id e detalhes do imóvel
  const [listingId, setListingId] = useState<string>('');
  const [listingPreview, setListingPreview] = useState<{ tipo_imovel?: string | null; descricao?: string | null } | null>(null);
  const [listingOpen, setListingOpen] = useState(false);
  const [listingQuery, setListingQuery] = useState('');
  const [listingLoading, setListingLoading] = useState(false);
  const [listingOptions, setListingOptions] = useState<{ id: number; listing_id: string; tipo_imovel: string | null; descricao: string | null; endereco: string | null; cidade: string | null }[]>([]);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    endereco: '',
    estado_civil: '',
    source: '',
    stage: 'Novo Lead' as LeadStage,
    interest: '',
    estimated_value: '',
    notes: '',
    message: '',
    property_id: ''
  });

  // Resetar/popular formulário quando modal abre/fecha ou lead muda
  useEffect(() => {
      if (isOpen) {
      // Carregar corretores (role = corretor) via RPC list_company_users
      (async () => {
        try {
          const { data, error } = await supabase.rpc('list_company_users', {
            target_company_id: null,
            search: null,
            roles: ['corretor'],
            limit_count: 100,
            offset_count: 0,
          });
          if (error) throw error;
          setCorretores((data || []).map((u: any) => ({ id: u.id, full_name: u.full_name || u.email })));
        } catch (err) {
          console.error('Erro ao carregar corretores:', err);
        }
      })();

      // Garantir catálogo de imóveis carregado
      refetchImoveis();
      // Precarregar algumas opções iniciais de listing_id
      (async () => {
        try {
          setListingLoading(true);
          const { data, error } = await supabase
            .from('imoveisvivareal')
            .select('id, listing_id, tipo_imovel, descricao, endereco, cidade')
            .order('listing_id', { ascending: true })
            .limit(50);
          if (!error) {
            const mapped = (data as any[] || []).map(r => ({
              id: r.id,
              listing_id: String(r.listing_id || r.id),
              tipo_imovel: r.tipo_imovel,
              descricao: r.descricao,
              endereco: r.endereco,
              cidade: r.cidade
            }));
            mapped.sort((a,b) => (Number(a.listing_id) || 0) - (Number(b.listing_id) || 0));
            setListingOptions(mapped);
          }
        } finally {
          setListingLoading(false);
        }
      })();

      if (leadToEdit) {
        // Modo edição - popular com dados do lead
        setFormData({
          nome: leadToEdit.nome || '',
          email: leadToEdit.email || '',
          telefone: leadToEdit.telefone || '',
          cpf: leadToEdit.cpf || '',
          endereco: leadToEdit.endereco || '',
          estado_civil: leadToEdit.estado_civil || '',
          source: leadToEdit.origem || '',
          stage: (leadToEdit.stage || 'Novo Lead') as LeadStage,
          interest: leadToEdit.interesse || '',
          estimated_value: leadToEdit.valorEstimado?.toString() || '',
          notes: leadToEdit.observacoes || '',
          message: leadToEdit.message || '',
          property_id: leadToEdit.property_id || ''
        });
        // Se houver imovel_interesse, refletir no state de listingId
        if (leadToEdit.imovel_interesse) {
          setListingId(String(leadToEdit.imovel_interesse));
        } else {
          setListingId('');
        }
        // Preselecionar corretor vinculado
        if ((leadToEdit as any).id_corretor_responsavel || leadToEdit.corretor?.id) {
          setSelectedCorretor(((leadToEdit as any).id_corretor_responsavel as string) || (leadToEdit.corretor?.id as string) || '');
        } else {
          setSelectedCorretor('');
        }
      } else {
        // Modo criação - resetar formulário
        setFormData({
          nome: '',
          email: '',
          telefone: '',
          cpf: '',
          endereco: '',
          estado_civil: '',
          source: '',
          stage: 'Novo Lead',
          interest: '',
          estimated_value: '',
          notes: '',
          message: '',
          property_id: ''
        });
        setSelectedCorretor('');
        setListingId('');
        setListingPreview(null);
      }
    }
  }, [isOpen, leadToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (!formData.email.trim() && !formData.telefone.trim()) {
      toast.error('Email ou telefone são obrigatórios');
      return;
    }

    setLoading(true);

    try {
      const leadData = {
        nome: formData.nome.trim(),
        email: formData.email.trim() || '',
        telefone: formData.telefone.trim() || '',
        cpf: formData.cpf.trim() || '',
        endereco: formData.endereco.trim() || '',
        estado_civil: formData.estado_civil || '',
        origem: formData.source || 'Website',
        stage: formData.stage,
        interesse: formData.interest.trim() || '',
        valor: formData.estimated_value ? parseFloat(formData.estimated_value) : 0,
        valorEstimado: formData.estimated_value ? parseFloat(formData.estimated_value) : 0,
        observacoes: formData.notes.trim() || '',
        message: formData.message.trim() || '',
        property_id: formData.property_id || '',
        imovel_interesse: listingId || undefined,
        dataContato: new Date().toISOString().split('T')[0]
      };

      if (leadToEdit) {
        // Modo edição
        // incluir id_corretor_responsavel no update quando houver
        const payload: any = { ...leadData };
        if (selectedCorretor) {
          payload.id_corretor_responsavel = selectedCorretor;
          console.log('Editando lead com corretor:', selectedCorretor); // Debug
        } else {
          payload.id_corretor_responsavel = null;
          console.log('Editando lead sem corretor específico'); // Debug
        }
        if (updateLeadOverride) {
          await updateLeadOverride(leadToEdit.id, payload);
        } else {
          await updateLead(leadToEdit.id, payload);
        }
        toast.success('Cliente atualizado com sucesso!');
      } else {
        // Modo criação — atribui opcionalmente ao corretor selecionado
        const assignedUserId = selectedCorretor || (corretores.length > 0
          ? corretores[Math.floor(Math.random() * corretores.length)].id
          : undefined);
        console.log('Criando lead com corretor:', assignedUserId); // Debug
        await createLead(leadData as KanbanLead, { assignedUserId });
        toast.success('Novo cliente adicionado com sucesso!');
      }

      onClose();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast.error('Erro ao salvar cliente. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Quando muda o listingId, atualizar preview
  useEffect(() => {
    if (!listingId) {
      setListingPreview(null);
      return;
    }
    const match = imoveis.find(i => String(i.listing_id) === String(listingId));
    if (match) {
      setListingPreview({ tipo_imovel: match.tipo_imovel, descricao: match.descricao });
    } else {
      setListingPreview(null);
    }
  }, [listingId, imoveis]);

  // Buscar sugestões de listing conforme digitação (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        if (!isOpen) return;
        setListingLoading(true);
        const term = listingQuery.trim();
        let query = supabase
          .from('imoveisvivareal')
          .select('id, listing_id, tipo_imovel, descricao, endereco, cidade')
          .order('listing_id', { ascending: true })
          .limit(50);
        if (term) query = query.ilike('listing_id', `%${term}%`);
        const { data, error } = await query;
        if (!error) {
          const mapped = (data as any[] || []).map(r => ({
            id: r.id,
            listing_id: String(r.listing_id || r.id),
            tipo_imovel: r.tipo_imovel,
            descricao: r.descricao,
            endereco: r.endereco,
            cidade: r.cidade
          }));
          mapped.sort((a,b) => (Number(a.listing_id) || 0) - (Number(b.listing_id) || 0));
          setListingOptions(mapped);
        }
      } finally {
        setListingLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [listingQuery, isOpen]);

  // Buscar sugestões de corretores conforme digitação (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        if (!isOpen) return;
        setCorretorLoading(true);
        const { data, error } = await supabase.rpc('list_company_users', {
          target_company_id: null,
          search: corretorQuery || null,
          roles: ['corretor'],
          limit_count: 100,
          offset_count: 0,
        });
        if (!error) setCorretores((data || []).map((u: any) => ({ id: u.id, full_name: u.full_name || u.email })));
      } finally {
        setCorretorLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [corretorQuery, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none max-h-[90vh] overflow-y-auto modal-content">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
              className="relative"
            >
              {/* Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl" />

              {/* Conteúdo principal */}
              <div className="relative z-10 p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        {leadToEdit ? 'Editar Cliente' : 'Adicionar Novo Cliente'}
                      </h2>
                      <p className="text-sm text-gray-400">
                        {leadToEdit ? 'Atualize as informações do cliente' : 'Preencha os dados do novo cliente'}
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-xl"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Formulário */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Informações Básicas */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">
                      Informações Básicas
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome" className="text-gray-300 flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Nome Completo *
                        </Label>
                        <Input
                          id="nome"
                          value={formData.nome}
                          onChange={(e) => handleChange('nome', e.target.value)}
                          placeholder="Nome completo do cliente"
                          className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-gray-300 flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleChange('email', e.target.value)}
                          placeholder="email@exemplo.com"
                          className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="telefone" className="text-gray-300 flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Telefone/WhatsApp
                        </Label>
                        <Input
                          id="telefone"
                          value={formData.telefone}
                          onChange={(e) => handleChange('telefone', e.target.value)}
                          placeholder="(11) 99999-9999"
                          className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
                        />
                      </div>

                      {/* Campos CPF, Estado Civil e Endereço */}
                      {true && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="cpf" className="text-gray-300 flex items-center gap-2">
                              <CreditCard className="w-4 h-4" />
                              CPF
                            </Label>
                            <Input
                              id="cpf"
                              value={formData.cpf}
                              onChange={(e) => handleChange('cpf', e.target.value)}
                              placeholder="000.000.000-00"
                              className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="estado_civil" className="text-gray-300 flex items-center gap-2">
                              <Heart className="w-4 h-4" />
                              Estado Civil
                            </Label>
                            <Select value={formData.estado_civil} onValueChange={(value) => handleChange('estado_civil', value)}>
                              <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
                                <SelectValue placeholder="Selecione o estado civil" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-700" style={{ zIndex: 10000 }}>
                                {estadosCivis.map((estado) => (
                                  <SelectItem key={estado} value={estado} className="text-white hover:bg-gray-700">
                                    {estado}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="endereco" className="text-gray-300 flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              Endereço Completo
                            </Label>
                            <Input
                              id="endereco"
                              value={formData.endereco}
                              onChange={(e) => handleChange('endereco', e.target.value)}
                              placeholder="Rua, número, bairro, cidade, estado, CEP"
                              className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Informações de Lead */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">
                      Informações de Lead
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="source" className="text-gray-300">Origem</Label>
                        <Select value={formData.source} onValueChange={(value) => handleChange('source', value)}>
                          <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
                            <SelectValue placeholder="Como nos conheceu?" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700" style={{ zIndex: 10000 }}>
                            {leadSources.map((source) => (
                              <SelectItem key={source} value={source} className="text-white hover:bg-gray-700">
                                {source}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stage" className="text-gray-300">Estágio</Label>
                        <Select value={formData.stage} onValueChange={(value) => handleChange('stage', value as LeadStage)}>
                          <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
                            <SelectValue placeholder="Estágio atual" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700" style={{ zIndex: 10000 }}>
                            {leadStages.map((stage) => (
                              <SelectItem key={stage} value={stage} className="text-white hover:bg-gray-700">
                                {stage}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="estimated_value" className="text-gray-300">Valor Estimado (R$)</Label>
                        <Input
                          id="estimated_value"
                          type="number"
                          value={formData.estimated_value}
                          onChange={(e) => handleChange('estimated_value', e.target.value)}
                          placeholder="850000"
                          className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="interest" className="text-gray-300">Interesse</Label>
                        <Input
                          id="interest"
                          value={formData.interest}
                          onChange={(e) => handleChange('interest', e.target.value)}
                          placeholder="Ex: Casa 3 quartos, apartamento centro"
                          className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
                        />
                      </div>

                      <div className="space-y-2 relative">
                        <Label htmlFor="imovel_interesse" className="text-gray-300 flex items-center gap-2 mt-[2px]">
                          <Building2 className="w-4 h-4" />
                          ID do imóvel de Interesse
                        </Label>
                        <Popover open={listingOpen} onOpenChange={setListingOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="mt-1 inline-flex w-full items-center justify-between rounded-md border border-gray-700 bg-gray-800/50 px-3 py-2 text-left text-white"
                              aria-label="Selecione o ID do imóvel"
                            >
                              <span className="truncate">{listingId || 'Selecione o ID do imóvel ou digite'}</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[--radix-popover-trigger-width] bg-gray-800 border-gray-600" style={{ zIndex: 10000 }}>
                            <Command>
                              <CommandInput placeholder="Digite o ID do imóvel..." value={listingQuery} onValueChange={setListingQuery} />
                              <CommandList>
                                <CommandEmpty>{listingLoading ? 'Carregando...' : 'Nenhum resultado'}</CommandEmpty>
                                <CommandGroup>
                                  {listingOptions.map((opt) => (
                                    <CommandItem
                                      key={`${opt.id}-${opt.listing_id}`}
                                      value={opt.listing_id}
                                      onSelect={() => {
                                        setListingId(opt.listing_id);
                                        setListingPreview({ tipo_imovel: opt.tipo_imovel, descricao: opt.descricao });
                                        setListingOpen(false);
                                      }}
                                    >
                                      <div className="flex flex-col text-white">
                                        <span className="font-medium">{opt.listing_id} - {(opt.endereco || opt.cidade || '-')}</span>
                                      </div>
                                      {listingId === opt.listing_id && (
                                        <Check className="ml-auto h-4 w-4 text-white" />
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {listingPreview && (
                          <div className="pointer-events-auto absolute left-0 right-0 top-full mt-2 z-20 rounded-lg border border-gray-700 bg-gray-900/90 backdrop-blur-sm p-3 shadow-xl">
                            <div className="text-sm text-gray-300"><span className="font-medium">Tipo do imóvel:</span> {listingPreview.tipo_imovel || '-'}</div>
                            <div className="text-sm text-gray-300 mt-1">
                              <span className="font-medium">Início da descrição:</span> {(listingPreview.descricao || '').slice(0, 160)}{(listingPreview.descricao || '').length > 160 ? '…' : ''}
                            </div>
                          </div>
                        )}
                      </div>
                  {/* Atribuição de Corretor */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">Atribuição</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="corretor" className="text-gray-300 flex items-center gap-2">
                          <UserCheck className="w-4 h-4" />
                          Corretor Responsável
                        </Label>
                        <Popover open={corretorOpen} onOpenChange={setCorretorOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex w-full items-center justify-between rounded-md border border-gray-700 bg-gray-800/50 px-3 py-2 text-left text-white min-w-[260px]"
                              aria-label="Selecione um Corretor"
                            >
                              <span className="truncate">{
                                selectedCorretor ? (corretores.find(c => c.id === selectedCorretor)?.full_name || 'Selecionado') : 'Selecione um Corretor ou digite'
                              }</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[--radix-popover-trigger-width] bg-gray-800 border-gray-600" style={{ zIndex: 10000 }}>
                            <Command>
                              <CommandInput placeholder="Digite o nome do corretor..." value={corretorQuery} onValueChange={setCorretorQuery} />
                              <CommandList>
                                <CommandEmpty>{corretorLoading ? 'Carregando...' : 'Nenhum corretor encontrado'}</CommandEmpty>
                                <CommandGroup>
                                  {corretores.map((c) => (
                                    <CommandItem
                                      key={c.id}
                                      value={c.full_name || ''}
                                      onSelect={() => {
                                        setSelectedCorretor(c.id);
                                        setCorretorOpen(false);
                                        console.log('Corretor selecionado:', c.id, c.full_name); // Debug
                                      }}
                                    >
                                      <span className="text-white font-medium">{c.full_name}</span>
                                      {selectedCorretor === c.id && (
                                        <Check className="ml-auto h-4 w-4 text-white" />
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {selectedCorretor && (
                          <p className="text-xs text-green-400">Corretor selecionado: {corretores.find(c => c.id === selectedCorretor)?.full_name}</p>
                        )}
                        {!selectedCorretor && (
                          <p className="text-xs text-gray-400">Deixe vazio para que o corretor seja<br />escolhido aleatoriamente.</p>
                        )}
                      </div>
                    </div>
                  </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="message" className="text-gray-300">Mensagem Inicial</Label>
                        <Textarea
                          id="message"
                          value={formData.message}
                          onChange={(e) => handleChange('message', e.target.value)}
                          placeholder="Primeira mensagem ou contato do cliente..."
                          className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400 min-h-[80px]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes" className="text-gray-300">Observações</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => handleChange('notes', e.target.value)}
                          placeholder="Observações internas sobre o cliente..."
                          className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400 min-h-[80px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Botões */}
                  <div className="flex gap-4 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      className="flex-1 border-gray-600 text-red-500 hover:bg-gray-700"
                      disabled={loading}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      disabled={loading}
                    >
                      {loading ? "Salvando..." : leadToEdit ? "Atualizar Cliente" : "Adicionar Cliente"}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}; 