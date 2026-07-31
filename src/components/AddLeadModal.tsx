import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, X, Mail, Phone, MapPin, CreditCard, Heart, Building2, UserCheck, ChevronsUpDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useKanbanLeads } from '@/hooks/useKanbanLeads';
import { KanbanLead, LeadStage } from '@/types/kanban';
import { supabase } from '@/integrations/supabase/client';
import { useImoveisVivaReal } from '@/hooks/useImoveisVivaReal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toCalendarDateYmdBrazil } from '@/lib/datetime-brazil';

const leadStages: LeadStage[] = [
  'Novo Lead',
  'Qualificado', 
  'Visita Agendada',
  'Visita Realizada',
  'Visita Cancelada',
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

const CPF_MASK_PLACEHOLDER = '000.000.000-00';

const FIELD_CLASS =
  'rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground h-10 dark:bg-gray-800/50 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-400';
const TEXTAREA_CLASS =
  'rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground min-h-[88px] dark:bg-gray-800/50 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-400';
const LABEL_CLASS = 'text-sm font-medium text-muted-foreground flex items-center gap-2 dark:text-gray-300';
const SECTION_CLASS =
  'rounded-xl border border-border/80 bg-card p-4 sm:p-5 space-y-4 shadow-sm dark:border-gray-700/60';
const SECTION_TITLE =
  'text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200 pb-1 border-b border-border/60 dark:border-gray-700';
const SELECT_TRIGGER_CLASS = `${FIELD_CLASS} h-10`;
const SELECT_CONTENT_CLASS =
  'border-border bg-popover text-popover-foreground dark:bg-gray-800 dark:border-gray-700';
const SELECT_ITEM_CLASS =
  'dark:text-white dark:focus:bg-gray-700 dark:focus:text-white cursor-pointer';
const POPOVER_TRIGGER_CLASS = `${FIELD_CLASS} inline-flex w-full items-center justify-between px-3 py-2 text-left h-10`;

function sanitizeCpfInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === CPF_MASK_PLACEHOLDER) return '';
  if (trimmed.replace(/\D/g, '') === '00000000000') return '';
  return trimmed;
}

const initialFormData = {
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
};

function buildLeadPayload(formData: typeof initialFormData, listingId: string) {
  return {
    nome: formData.nome.trim(),
    email: formData.email.trim() || '',
    telefone: formData.telefone.trim() || '',
    cpf: sanitizeCpfInput(formData.cpf),
    endereco: formData.endereco.trim() || '',
    estado_civil: formData.estado_civil || '',
    origem: formData.source || 'Website',
    stage: formData.stage,
    interesse: formData.interest.trim() || '',
    valor: formData.estimated_value ? parseFloat(formData.estimated_value) : 0,
    valorEstimado: formData.estimated_value ? parseFloat(formData.estimated_value) : 0,
    observacoes: formData.notes.trim() || '',
    message: formData.message.trim() || '',
    imovel_interesse: listingId || undefined,
    dataContato: toCalendarDateYmdBrazil(new Date()),
  };
}

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadToEdit?: KanbanLead | null;
  /** Preselect stage when creating a lead from a kanban column */
  defaultStage?: LeadStage | null;
  updateLeadOverride?: (leadId: string, updates: Partial<KanbanLead>) => Promise<boolean>;
}

export const AddLeadModal: React.FC<AddLeadModalProps> = ({ 
  isOpen, 
  onClose, 
  leadToEdit = null,
  defaultStage = null,
  updateLeadOverride
}) => {
  const { createLead, updateLead } = useKanbanLeads();
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

  const [formData, setFormData] = useState(initialFormData);

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
          ...initialFormData,
          stage: defaultStage || 'Novo Lead',
        });
        setSelectedCorretor('');
        setListingId('');
        setListingPreview(null);
      }
    }
  }, [isOpen, leadToEdit, defaultStage]);

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
      const leadData = buildLeadPayload(formData, listingId);

      if (leadToEdit) {
        const payload: Record<string, unknown> = { ...leadData };
        payload.id_corretor_responsavel = selectedCorretor || null;

        const ok = updateLeadOverride
          ? await updateLeadOverride(leadToEdit.id, payload as Partial<KanbanLead>)
          : await updateLead(leadToEdit.id, payload as Partial<KanbanLead>);

        if (!ok) {
          toast.error('Erro ao atualizar cliente. Tente novamente.');
          return;
        }
        toast.success('Cliente atualizado com sucesso!');
      } else {
        const assignedUserId = selectedCorretor || (corretores.length > 0
          ? corretores[Math.floor(Math.random() * corretores.length)].id
          : undefined);
        const created = await createLead(leadData as KanbanLead, { assignedUserId });
        if (!created) {
          toast.error('Erro ao adicionar cliente. Tente novamente.');
          return;
        }
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

  const isEdit = !!leadToEdit;
  const dialogTitle = isEdit ? 'Editar Cliente' : 'Adicionar Novo Cliente';
  const dialogSubtitle = isEdit
    ? 'Atualize as informações do cliente.'
    : 'Preencha os dados do novo cliente.';

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-4xl w-[min(100%,56rem)] max-h-[92vh] flex flex-col gap-0 overflow-hidden p-0 bg-background border-border text-foreground sm:rounded-2xl shadow-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25 }}
              className="relative flex flex-col max-h-[92vh] min-h-0"
            >
              {/* Header — forest green */}
              <div
                className="flex-shrink-0 flex items-start justify-between gap-3 px-5 sm:px-6 py-4 sm:py-5"
                style={{ backgroundColor: '#1a2e24' }}
              >
                <DialogHeader className="space-y-1.5 text-left min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-emerald-100" />
                    </div>
                    <div className="min-w-0">
                      <DialogTitle className="text-lg sm:text-xl font-semibold" style={{ color: '#ffffff' }}>
                        {dialogTitle}
                      </DialogTitle>
                      <DialogDescription className="text-sm mt-0.5" style={{ color: '#a3a3a3' }}>
                        {dialogSubtitle}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-9 w-9 rounded-lg hover:bg-white/10 shrink-0"
                  aria-label="Fechar"
                  style={{ color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.25)' }}
                >
                  <X className="h-4 w-4" style={{ color: '#ffffff' }} />
                </Button>
              </div>

              {/* Body — cream */}
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 bg-[#F7F5F0] dark:bg-background">
                  <div className="space-y-5">
                    {/* Informações Básicas */}
                    <section className={SECTION_CLASS}>
                      <h3 className={SECTION_TITLE}>Informações Básicas</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="nome" className={LABEL_CLASS}>
                            <User className="w-4 h-4" />
                            Nome Completo *
                          </Label>
                          <Input
                            id="nome"
                            value={formData.nome}
                            onChange={(e) => handleChange('nome', e.target.value)}
                            placeholder="Nome completo do cliente"
                            className={FIELD_CLASS}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email" className={LABEL_CLASS}>
                            <Mail className="w-4 h-4" />
                            Email
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            placeholder="email@exemplo.com"
                            className={FIELD_CLASS}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="telefone" className={LABEL_CLASS}>
                            <Phone className="w-4 h-4" />
                            Telefone/WhatsApp
                          </Label>
                          <Input
                            id="telefone"
                            value={formData.telefone}
                            onChange={(e) => handleChange('telefone', e.target.value)}
                            placeholder="(11) 99999-9999"
                            className={FIELD_CLASS}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cpf" className={LABEL_CLASS}>
                            <CreditCard className="w-4 h-4" />
                            CPF
                          </Label>
                          <Input
                            id="cpf"
                            value={formData.cpf}
                            onChange={(e) => handleChange('cpf', e.target.value)}
                            placeholder={CPF_MASK_PLACEHOLDER}
                            className={FIELD_CLASS}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="estado_civil" className={LABEL_CLASS}>
                            <Heart className="w-4 h-4" />
                            Estado Civil
                          </Label>
                          <Select value={formData.estado_civil} onValueChange={(value) => handleChange('estado_civil', value)}>
                            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                              <SelectValue placeholder="Selecione o estado civil" />
                            </SelectTrigger>
                            <SelectContent className={SELECT_CONTENT_CLASS} style={{ zIndex: 10000 }}>
                              {estadosCivis.map((estado) => (
                                <SelectItem key={estado} value={estado} className={SELECT_ITEM_CLASS}>
                                  {estado}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <Label htmlFor="endereco" className={LABEL_CLASS}>
                            <MapPin className="w-4 h-4" />
                            Endereço Completo
                          </Label>
                          <Input
                            id="endereco"
                            value={formData.endereco}
                            onChange={(e) => handleChange('endereco', e.target.value)}
                            placeholder="Rua, número, bairro, cidade, estado, CEP"
                            className={FIELD_CLASS}
                          />
                        </div>
                      </div>
                    </section>

                    {/* Informações de Lead */}
                    <section className={SECTION_CLASS}>
                      <h3 className={SECTION_TITLE}>Informações de Lead</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="source" className={LABEL_CLASS}>Origem</Label>
                          <Select value={formData.source} onValueChange={(value) => handleChange('source', value)}>
                            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                              <SelectValue placeholder="Como nos conheceu?" />
                            </SelectTrigger>
                            <SelectContent className={SELECT_CONTENT_CLASS} style={{ zIndex: 10000 }}>
                              {leadSources.map((source) => (
                                <SelectItem key={source} value={source} className={SELECT_ITEM_CLASS}>
                                  {source}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="stage" className={LABEL_CLASS}>Estágio</Label>
                          <Select value={formData.stage} onValueChange={(value) => handleChange('stage', value as LeadStage)}>
                            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                              <SelectValue placeholder="Estágio atual" />
                            </SelectTrigger>
                            <SelectContent className={SELECT_CONTENT_CLASS} style={{ zIndex: 10000 }}>
                              {leadStages.map((stage) => (
                                <SelectItem key={stage} value={stage} className={SELECT_ITEM_CLASS}>
                                  {stage}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="estimated_value" className={LABEL_CLASS}>Valor Estimado (R$)</Label>
                          <Input
                            id="estimated_value"
                            type="number"
                            value={formData.estimated_value}
                            onChange={(e) => handleChange('estimated_value', e.target.value)}
                            placeholder="850000"
                            className={FIELD_CLASS}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="interest" className={LABEL_CLASS}>Interesse</Label>
                          <Input
                            id="interest"
                            value={formData.interest}
                            onChange={(e) => handleChange('interest', e.target.value)}
                            placeholder="Ex: Casa 3 quartos, apartamento centro"
                            className={FIELD_CLASS}
                          />
                        </div>

                        <div className="md:col-span-2 space-y-2 relative">
                          <Label htmlFor="imovel_interesse" className={LABEL_CLASS}>
                            <Building2 className="w-4 h-4" />
                            ID do imóvel de Interesse
                          </Label>
                          <Popover open={listingOpen} onOpenChange={setListingOpen}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={POPOVER_TRIGGER_CLASS}
                                aria-label="Selecione o ID do imóvel"
                              >
                                <span className="truncate">{listingId || 'Selecione o ID do imóvel ou digite'}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[--radix-popover-trigger-width] border-border bg-popover text-popover-foreground dark:bg-gray-800 dark:border-gray-600" style={{ zIndex: 10000 }}>
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
                                        <div className="flex flex-col text-foreground dark:text-white">
                                          <span className="font-medium">{opt.listing_id} - {(opt.endereco || opt.cidade || '-')}</span>
                                        </div>
                                        {listingId === opt.listing_id && (
                                          <Check className="ml-auto h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                                        )}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {listingPreview && (
                            <div className="rounded-xl border border-border/80 bg-[#F7F5F0]/90 dark:bg-gray-900/90 p-3 text-sm shadow-sm">
                              <div className="text-muted-foreground dark:text-gray-300">
                                <span className="font-medium text-foreground dark:text-gray-200">Tipo:</span>{' '}
                                {listingPreview.tipo_imovel || '-'}
                              </div>
                              <div className="text-muted-foreground mt-1 dark:text-gray-300">
                                <span className="font-medium text-foreground dark:text-gray-200">Descrição:</span>{' '}
                                {(listingPreview.descricao || '').slice(0, 160)}{(listingPreview.descricao || '').length > 160 ? '…' : ''}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="message" className={LABEL_CLASS}>Mensagem Inicial</Label>
                          <Textarea
                            id="message"
                            value={formData.message}
                            onChange={(e) => handleChange('message', e.target.value)}
                            placeholder="Primeira mensagem ou contato do cliente..."
                            className={TEXTAREA_CLASS}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="notes" className={LABEL_CLASS}>Observações</Label>
                          <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            placeholder="Observações internas sobre o cliente..."
                            className={TEXTAREA_CLASS}
                          />
                        </div>
                      </div>
                    </section>

                    {/* Atribuição */}
                    <section className={SECTION_CLASS}>
                      <h3 className={SECTION_TITLE}>Atribuição</h3>
                      <div className="space-y-2">
                        <Label htmlFor="corretor" className={LABEL_CLASS}>
                          <UserCheck className="w-4 h-4" />
                          Corretor Responsável
                        </Label>
                        <Popover open={corretorOpen} onOpenChange={setCorretorOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={POPOVER_TRIGGER_CLASS}
                              aria-label="Selecione um Corretor"
                            >
                              <span className="truncate">{
                                selectedCorretor
                                  ? (corretores.find(c => c.id === selectedCorretor)?.full_name || 'Selecionado')
                                  : 'Selecione um Corretor ou digite'
                              }</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[--radix-popover-trigger-width] border-border bg-popover text-popover-foreground dark:bg-gray-800 dark:border-gray-600" style={{ zIndex: 10000 }}>
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
                                      }}
                                    >
                                      <span className="font-medium text-foreground dark:text-white">{c.full_name}</span>
                                      {selectedCorretor === c.id && (
                                        <Check className="ml-auto h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {selectedCorretor ? (
                          <p className="text-xs text-emerald-700 dark:text-emerald-400">
                            Corretor selecionado: {corretores.find(c => c.id === selectedCorretor)?.full_name}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground dark:text-gray-400">
                            Deixe vazio para que o corretor seja escolhido aleatoriamente.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 border-t border-border bg-background px-5 sm:px-6 py-4">
                  <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      className="sm:min-w-[140px] border-border text-foreground hover:bg-muted"
                      disabled={loading}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="btn-on-emerald sm:min-w-[180px] bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50"
                      style={{ color: '#ffffff' }}
                      disabled={loading}
                    >
                      {loading ? 'Salvando...' : isEdit ? 'Atualizar Cliente' : 'Adicionar Cliente'}
                    </Button>
                  </div>
                </div>
              </form>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}; 