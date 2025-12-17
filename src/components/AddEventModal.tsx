import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CalendarIcon, Clock, Building2, ChevronsUpDown, Check } from "lucide-react";
import format from "date-fns/format";
import ptBR from "date-fns/locale/pt-BR";
import { PropertyWithImages } from "@/hooks/useProperties";
import { DatabaseClient } from "@/hooks/useClients";
import { cn } from "@/lib/utils";
import { CustomModal } from "./CustomModal";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: PropertyWithImages[];
  clients: DatabaseClient[];
  onSubmit: (eventData: {
    propertyId: string;
    clientId: string;
    email: string;
    date: Date;
    time: string;
    type: string;
    corretor: string;
    listingId?: string;
  }) => void;
}

export function AddEventModal({ 
  isOpen, 
  onClose, 
  properties, 
  clients, 
  onSubmit 
}: AddEventModalProps) {
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [time, setTime] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [eventType, setEventType] = useState<string>("Visita");
  const [selectedCorretor, setSelectedCorretor] = useState<string>("aleatorio");
  const [loading, setLoading] = useState(false);
  
  // Estados para seleção de imóvel via Viva Real
  const [listingId, setListingId] = useState<string>("");
  const [listingOpen, setListingOpen] = useState(false);
  const [listingQuery, setListingQuery] = useState("");
  const [listingLoading, setListingLoading] = useState(false);
  const [listingOptions, setListingOptions] = useState<{ id: number; listing_id: string; tipo_imovel: string | null; descricao: string | null; endereco: string | null; cidade: string | null }[]>([]);
  
  // Estados para corretores disponíveis com horários
  const [corretoresDisponiveis, setCorretoresDisponiveis] = useState<{ id: string; full_name: string; available: boolean }[]>([]);
  const [corretorLoading, setCorretorLoading] = useState(false);
  
  const { getCompanyUsers } = useUserProfile();
  
  // Estados para modais personalizados
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    type: 'success' as 'success' | 'error' | 'confirm' | 'alert',
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client?.email) {
      setEmail(client.email);
    }
  };

  // Carregar imóveis quando o modal abrir
  useEffect(() => {
    if (!isOpen) return;
    
    const loadImoveis = async () => {
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
          mapped.sort((a, b) => (Number(a.listing_id) || 0) - (Number(b.listing_id) || 0));
          setListingOptions(mapped);
        }
      } catch (err) {
        console.error('Erro ao carregar imóveis:', err);
      } finally {
        setListingLoading(false);
      }
    };

    loadImoveis();
  }, [isOpen]);

  // Buscar imóveis conforme digitação (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!isOpen) return;
      
      try {
        setListingLoading(true);
        const term = listingQuery.trim();
        let query = supabase
          .from('imoveisvivareal')
          .select('id, listing_id, tipo_imovel, descricao, endereco, cidade')
          .order('listing_id', { ascending: true })
          .limit(50);
          
        if (term) {
          query = query.ilike('listing_id', `%${term}%`);
        }
        
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
          mapped.sort((a, b) => (Number(a.listing_id) || 0) - (Number(b.listing_id) || 0));
          setListingOptions(mapped);
        }
      } catch (err) {
        console.error('Erro ao buscar imóveis:', err);
      } finally {
        setListingLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [listingQuery, isOpen]);


  // REMOVIDO: Lógica duplicada - agora carregamos apenas uma vez com escalas
  
  // Carregar APENAS corretores que têm escalas definidas
  useEffect(() => {
    if (!isOpen) return;
    
    const loadCorretoresComEscalas = async () => {
      try {
        setCorretorLoading(true);
        console.log('🔍 Buscando corretores com escalas definidas...');
        
        // Buscar escalas com dados essenciais (user e calendário)
        // Inclui também escalas sem assigned_user_id (usaremos calendar_name como fallback)
        const { data: escalasData, error: escalasError } = await supabase
          .from('oncall_schedules')
          .select('assigned_user_id, calendar_id, calendar_name');
          
        if (escalasError) {
          console.error('❌ Erro ao buscar escalas:', escalasError);
          setCorretoresDisponiveis([]);
          return;
        }
        
        const corretoresComEscalaIds = (escalasData?.map(e => e.assigned_user_id) || []).filter(Boolean);
        // Map auxiliares
        const idToCalendarInfo = new Map<string, { calendar_id?: string; calendar_name?: string }>();
        const calendarsWithoutUser: { calendar_id: string; calendar_name: string }[] = [];
        (escalasData || []).forEach((e: any) => {
          if (e.assigned_user_id) {
            idToCalendarInfo.set(e.assigned_user_id, { calendar_id: e.calendar_id, calendar_name: e.calendar_name });
          } else if (e.calendar_id) {
            calendarsWithoutUser.push({ calendar_id: e.calendar_id, calendar_name: e.calendar_name });
          }
        });
        console.log('📋 IDs de corretores com escalas:', corretoresComEscalaIds);
        
        if (corretoresComEscalaIds.length === 0) {
          console.log('❌ Nenhum corretor tem escalas definidas');
          setCorretoresDisponiveis([]);
          return;
        }
        
        // Agora buscar os dados dos corretores que têm escalas
        const { data: corretoresComEscalas, error } = await supabase
          .from('user_profiles')
          .select(`
            id,
            full_name,
            email,
            role,
            company_id
          `)
          .in('id', corretoresComEscalaIds);
        
        if (error) {
          console.error('❌ Erro ao buscar corretores com escalas:', error);
          setCorretoresDisponiveis([]);
          return;
        }
        
        // Combinar perfis com fallback do nome do calendário caso perfil não exista
        const formattedById = new Map<string, { id: string; full_name: string; available: boolean }>();
        (corretoresComEscalas || []).forEach((c: any) => {
          formattedById.set(c.id, { id: c.id, full_name: c.full_name || c.email, available: false });
        });
        // Adicionar faltantes com assigned_user_id usando o calendar_name
        corretoresComEscalaIds.forEach((id) => {
          if (!formattedById.has(id)) {
            const calInfo = idToCalendarInfo.get(id) || {} as any;
            formattedById.set(id, {
              id,
              full_name: (calInfo.calendar_name as string) || 'Corretor disponível',
              available: false
            });
          }
        });
        // Adicionar escalas sem assigned_user_id usando id sintético baseado no calendar_id
        calendarsWithoutUser.forEach(({ calendar_id, calendar_name }) => {
          const syntheticId = `cal:${calendar_id}`;
          if (!formattedById.has(syntheticId)) {
            formattedById.set(syntheticId, {
              id: syntheticId,
              full_name: calendar_name || 'Agenda disponível',
              available: false
            });
          }
        });
        const corretoresFormatados = Array.from(formattedById.values());
        
        console.log(`✅ Encontrados ${corretoresFormatados.length} corretores com escalas:`, 
          corretoresFormatados.map(c => c.full_name));
        
        setCorretoresDisponiveis(corretoresFormatados);
      } catch (err) {
        console.error('❌ Erro ao carregar corretores com escalas:', err);
        setCorretoresDisponiveis([]);
      } finally {
        setCorretorLoading(false);
      }
    };
    
    loadCorretoresComEscalas();
  }, [isOpen]);
  
  // Verificar disponibilidade apenas quando data E hora estiverem selecionadas
  useEffect(() => {
    if (!isOpen || !selectedDate || !time || corretoresDisponiveis.length === 0) return;
    
    const checkAvailability = async () => {
      try {
        setCorretorLoading(true);
        
        // Revalida partindo do conjunto base (sem poluir o array reativo durante o map)
        const base = [...corretoresDisponiveis];
        const corretoresComDisponibilidade = await Promise.all(
          base.map(async (corretor) => {
            const disponivel = await verificarDisponibilidadeCorretor(
              corretor.id, 
              selectedDate, 
              time
            );
            
            return {
              ...corretor,
              available: disponivel
            };
          })
        );
        
        // Ordena deixando disponíveis primeiro e ordena alfabeticamente
        corretoresComDisponibilidade.sort((a, b) => {
          if (a.available !== b.available) return a.available ? -1 : 1;
          return a.full_name.localeCompare(b.full_name);
        });
        setCorretoresDisponiveis(corretoresComDisponibilidade);
      } catch (err) {
        console.error('Erro ao verificar disponibilidade:', err);
        // Manter corretores como estão em caso de erro
      } finally {
        setCorretorLoading(false);
      }
    };
    
    // Debounce para evitar muitas chamadas
    const timeoutId = setTimeout(checkAvailability, 1000);
    return () => clearTimeout(timeoutId);
  }, [selectedDate, time, isOpen, corretoresDisponiveis]);

  // Cache para escalas (evitar consultas repetidas)
  const escalasCache = useRef<{ [key: string]: any[] }>({});
  const cacheTime = useRef<{ [key: string]: number }>({});
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  // Função otimizada para verificar disponibilidade do corretor no horário
  const verificarDisponibilidadeCorretor = async (
    corretorId: string, 
    data: Date, 
    horario: string
  ): Promise<boolean> => {
    try {
      console.log(`🔍 Verificando disponibilidade - Corretor: ${corretorId}, Data: ${data.toLocaleDateString()}, Horário: ${horario}`);
      
      // Verificar cache primeiro
      const cacheKey = `escalas_${corretorId}`;
      const now = Date.now();
      
      let escalas = escalasCache.current[cacheKey];
      
      // Se não há cache ou expirou, buscar do banco
      if (!escalas || !cacheTime.current[cacheKey] || (now - cacheTime.current[cacheKey]) > CACHE_DURATION) {
        console.log(`📥 Buscando escalas do banco para corretor ${corretorId}`);
        
        const { data: escalaData, error } = await supabase
          .from('oncall_schedules')
          .select('*')
          .eq('assigned_user_id', corretorId)
          .order('updated_at', { ascending: false, nullsFirst: false });
        
        if (error) {
          console.log('❌ Erro ao verificar escalas:', error);
          return false;
        }
        
        escalas = escalaData || [];
        escalasCache.current[cacheKey] = escalas;
        cacheTime.current[cacheKey] = now;
      } else {
        console.log(`💾 Usando escalas do cache para corretor ${corretorId}`);
      }
      
      if (!escalas || escalas.length === 0) {
        console.log(`❌ Nenhuma escala encontrada para corretor ${corretorId} - corretor não deve aparecer na lista`);
        return false;
      }
      
      console.log(`📋 Escalas encontradas para corretor ${corretorId}:`, escalas.length);
      
      // Verificar disponibilidade
      const diaSemana = data.getDay(); // 0=domingo, 1=segunda, etc
      const [hStr, mStr] = horario.split(':');
      const minutosSelecionados = parseInt(hStr) * 60 + parseInt(mStr || '0');
      
      const temEscalaDisponivel = escalas.some(escala => {
        const diaColunas = ['sun_works', 'mon_works', 'tue_works', 'wed_works', 'thu_works', 'fri_works', 'sat_works'];
        const diaStartColunas = ['sun_start', 'mon_start', 'tue_start', 'wed_start', 'thu_start', 'fri_start', 'sat_start'];
        const diaEndColunas = ['sun_end', 'mon_end', 'tue_end', 'wed_end', 'thu_end', 'fri_end', 'sat_end'];
        
        // Normalizar boolean vindo do banco (pode ser 't'/'f', 'TRUE', 1, etc.)
        const rawWorks = (escala as any)[diaColunas[diaSemana]];
        const worksStr = String(rawWorks).toLowerCase();
        const trabalhaNodia = rawWorks === true || rawWorks === 1 || worksStr === 't' || worksStr === 'true' || worksStr === '1' || worksStr === 'yes';
        
        if (!trabalhaNodia) return false;
        
        const rawIni = (escala as any)[diaStartColunas[diaSemana]];
        const rawFim = (escala as any)[diaEndColunas[diaSemana]];
        const iniStr = rawIni ? String(rawIni).slice(0,5) : '00:00';
        const fimStr = rawFim ? String(rawFim).slice(0,5) : '23:59';
        const [hIni, mIni] = iniStr.split(':');
        const [hFim, mFim] = fimStr.split(':');
        const minutosInicio = parseInt(hIni) * 60 + parseInt(mIni || '0');
        const minutosFim = parseInt(hFim) * 60 + parseInt(mFim || '0');

        // Dentro do intervalo inclusivo de trabalho
        return minutosSelecionados >= minutosInicio && minutosSelecionados <= minutosFim;
      });
      
      console.log(`🎯 Resultado para corretor ${corretorId}: ${temEscalaDisponivel ? 'DISPONÍVEL' : 'INDISPONÍVEL'}`);
      
      return temEscalaDisponivel || false;
      
    } catch (err) {
      console.error('❌ Erro ao verificar disponibilidade:', err);
      return false;
    }
  };

  // Funções para atalhos de data
  const setQuickDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setSelectedDate(date);
    setShowDatePicker(false);
  };

  // Horários comuns para seleção rápida (ordenados por popularidade)
  const commonTimes = [
    { label: "09:00", value: "09:00", popular: true },
    { label: "10:00", value: "10:00", popular: true },
    { label: "14:00", value: "14:00", popular: true },
    { label: "15:00", value: "15:00", popular: true },
    { label: "16:00", value: "16:00", popular: true },
    { label: "11:00", value: "11:00", popular: true },
    { label: "08:00", value: "08:00" },
    { label: "17:00", value: "17:00" },
    { label: "18:00", value: "18:00" },
  ];

  // Sugerir próximo horário disponível baseado na hora atual
  const getSuggestedTime = () => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Se for manhã (antes das 12h), sugerir horários da tarde
    if (currentHour < 12) {
      return "14:00";
    }
    // Se for tarde, sugerir próximo horário comercial
    else if (currentHour < 17) {
      const nextHour = currentHour + 1;
      return `${nextHour.toString().padStart(2, '0')}:00`;
    }
    // Se for final do dia, sugerir próximo dia útil manhã
    else {
      return "09:00";
    }
  };

  const setQuickTime = (timeValue: string) => {
    setTime(timeValue);
    setShowTimePicker(false);
  };

  // Função para mostrar modal personalizado
  const showCustomModal = (type: 'success' | 'error' | 'confirm' | 'alert', title: string, message: string, onConfirm?: () => void) => {
    setModalConfig({
      type,
      title,
      message,
      onConfirm: onConfirm || (() => setShowModal(false))
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProperty || !selectedClient || !email || !selectedDate || !time) {
      showCustomModal('alert', 'Campos Obrigatórios', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    
    try {
      // Combinar data e hora
      const [hours, minutes] = time.split(':');
      const eventDateTime = new Date(selectedDate);
      eventDateTime.setHours(parseInt(hours), parseInt(minutes));

      await onSubmit({
        propertyId: selectedProperty,
        clientId: selectedClient,
        email,
        date: eventDateTime,
        time,
        type: eventType,
        corretor: selectedCorretor,
        listingId: listingId || undefined
      });

      // Mostrar sucesso e resetar formulário
      const resetForm = () => {
        setSelectedProperty("");
        setSelectedClient("");
        setEmail("");
        setSelectedDate(undefined);
        setTime("");
        setEventType("Visita");
        setSelectedCorretor("aleatorio");
        setListingId("");
        setShowDatePicker(false);
        setShowTimePicker(false);
        onClose();
      };

      showCustomModal(
        'success', 
        'Evento Criado! 🎉', 
        'Evento criado com sucesso no Google Calendar!',
        resetForm
      );
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      
      // Verificar se é erro de rede ou do webhook
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      if (errorMessage.includes('fetch')) {
        showCustomModal('error', 'Erro de Conexão', 'Verifique sua internet e tente novamente.');
      } else if (errorMessage.includes('404') || errorMessage.includes('500')) {
        showCustomModal('alert', 'Serviço Indisponível', 'Serviço temporariamente indisponível. O evento foi salvo localmente.');
      } else {
        showCustomModal('error', 'Erro ao Criar Evento', `Erro: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Adicionar Evento na Agenda
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de Evento */}
          <div className="space-y-2">
            <Label htmlFor="eventType" className="text-gray-300">
              Tipo de Evento
            </Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="Visita">Visita</SelectItem>
                <SelectItem value="Avaliação">Avaliação</SelectItem>
                <SelectItem value="Apresentação">Apresentação</SelectItem>
                <SelectItem value="Vistoria">Vistoria</SelectItem>
                <SelectItem value="Reunião">Reunião</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de Imóvel via Viva Real */}
          <div className="space-y-2">
            <Label htmlFor="imovel" className="text-gray-300 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Imóvel <span className="text-red-400">*</span>
            </Label>
            <Popover open={listingOpen} onOpenChange={setListingOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-between rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-left text-white hover:bg-gray-600"
                  aria-label="Selecione o imóvel"
                >
                  <span className="truncate">
                    {listingId ? `${listingId} - ${listingOptions.find(opt => opt.listing_id === listingId)?.endereco || listingOptions.find(opt => opt.listing_id === listingId)?.cidade || 'Endereço não disponível'}` : 'Selecione o ID do imóvel ou digite'}
                  </span>
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
                            setSelectedProperty(opt.listing_id); // Manter compatibilidade
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
          </div>

          {/* Seleção de Cliente */}
          <div className="space-y-2">
            <Label htmlFor="client" className="text-gray-300">
              Cliente <span className="text-red-400">*</span>
            </Label>
            <Select value={selectedClient} onValueChange={handleClientChange}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} {client.email && `(${client.email})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-300">
              Email <span className="text-red-400">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          {/* Data e Hora - Seção Modernizada */}
          <div className="space-y-4 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <CalendarIcon className="h-5 w-5 text-blue-400" />
              <Label className="text-gray-300 font-medium">
                Data e Horário <span className="text-red-400">*</span>
              </Label>
            </div>

            {/* Seleção de Data */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Data do evento</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                >
                  {showDatePicker ? "Ocultar calendário" : "Ver calendário"}
                </Button>
              </div>

              {/* Atalhos rápidos de data */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDate(0)}
                  className={cn(
                    "bg-gray-700 border-gray-600 text-white hover:bg-gray-600 transition-all",
                    selectedDate && selectedDate.toDateString() === new Date().toDateString() && 
                    "bg-blue-600 border-blue-500 text-white"
                  )}
                >
                  🌅 Hoje
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDate(1)}
                  className={cn(
                    "bg-gray-700 border-gray-600 text-white hover:bg-gray-600 transition-all",
                    selectedDate && selectedDate.toDateString() === new Date(Date.now() + 86400000).toDateString() && 
                    "bg-blue-600 border-blue-500 text-white"
                  )}
                >
                  🌄 Amanhã
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDate(2)}
                  className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                >
                  📅 Em 2 dias
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDate(7)}
                  className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                >
                  🗓️ Próxima semana
                </Button>
              </div>

              {/* Data selecionada */}
              {selectedDate && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-green-400" />
                    <span className="text-green-300 font-medium">
                      {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              )}

              {/* Calendário expandido */}
              {showDatePicker && (
                <div className="border border-gray-600 rounded-lg overflow-hidden">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="bg-gray-800 text-white"
                  />
                </div>
              )}
            </div>

            {/* Seleção de Horário */}
            <div className="space-y-3 border-t border-gray-700 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Horário do evento</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTimePicker(!showTimePicker)}
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                >
                  {showTimePicker ? "Ocultar horários" : "Ver mais horários"}
                </Button>
              </div>

              {/* Sugestão inteligente */}
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💡</span>
                    <span className="text-yellow-300 text-sm font-medium">
                      Sugestão: {getSuggestedTime()}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuickTime(getSuggestedTime())}
                    className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                  >
                    Usar sugestão
                  </Button>
                </div>
              </div>

              {/* Horários rápidos populares */}
              <div className="space-y-2">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Horários mais populares</span>
                <div className="grid grid-cols-3 gap-2">
                  {commonTimes.slice(0, 6).map((timeOption) => (
                    <Button
                      key={timeOption.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickTime(timeOption.value)}
                      className={cn(
                        "bg-gray-700 border-gray-600 text-white hover:bg-gray-600 transition-all relative",
                        time === timeOption.value && "bg-blue-600 border-blue-500 text-white",
                        timeOption.popular && "border-green-500/30"
                      )}
                    >
                      <div className="flex flex-col items-center">
                        <span>🕐 {timeOption.label}</span>
                        {timeOption.popular && (
                          <span className="text-xs text-green-400">⭐</span>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Mais horários */}
              {showTimePicker && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-700">
                  {commonTimes.slice(6).map((timeOption) => (
                    <Button
                      key={timeOption.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickTime(timeOption.value)}
                      className={cn(
                        "bg-gray-700 border-gray-600 text-white hover:bg-gray-600 transition-all",
                        time === timeOption.value && "bg-blue-600 border-blue-500 text-white"
                      )}
                    >
                      🕐 {timeOption.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Input personalizado de horário */}
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="Ou escolha um horário personalizado"
                  className="bg-gray-700 border-gray-600 text-white pl-10"
                />
              </div>

              {/* Horário selecionado */}
              {time && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-400" />
                    <span className="text-blue-300 font-medium">
                      Horário selecionado: {time}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Resumo do agendamento */}
            {selectedDate && time && (
              <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg p-4 mt-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-green-500/20 rounded-full">
                    <span className="text-lg">✅</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium mb-1">
                      Agendamento confirmado para:
                    </div>
                    <div className="text-green-300 text-sm">
                      📅 {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })} às {time}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Seleção de Corretor com Disponibilidade */}
          <div className="space-y-2">
            <Label htmlFor="corretor" className="text-gray-300 flex items-center gap-2">
              <span className="text-lg">👥</span>
              Corretor
              {selectedDate && time && (
                <span className="text-xs bg-blue-500/20 px-2 py-1 rounded-full text-blue-300">
                  Baseado na disponibilidade
                </span>
              )}
            </Label>
            <Select value={selectedCorretor} onValueChange={setSelectedCorretor}>
              <SelectTrigger 
                className="bg-gray-700 border-gray-600 text-white"
                onClick={() => {
                  console.log('🎛️ DROPDOWN ABERTO - Estado atual:');
                  console.log('📅 Data selecionada:', selectedDate?.toLocaleDateString());
                  console.log('⏰ Horário selecionado:', time);
                  console.log('👥 Total corretores:', corretoresDisponiveis.length);
                  console.log('✅ Disponíveis:', corretoresDisponiveis.filter(c => c.available).length);
                  console.log('❌ Indisponíveis:', corretoresDisponiveis.filter(c => !c.available).length);
                  console.log('🔍 Modo filtragem ativa:', !!(selectedDate && time));
                  console.log('📋 Lista de corretores COM ESCALAS:', corretoresDisponiveis.map(c => `${c.full_name}: ${c.available ? 'DISPONÍVEL' : 'INDISPONÍVEL'}`));
                  
                  if (selectedDate && time) {
                    console.log('✨ FILTRO ATIVO: Mostrando apenas', corretoresDisponiveis.filter(c => c.available).length, 'corretores disponíveis no horário');
                  } else {
                    console.log('🔓 FILTRO INATIVO: Mostrando corretores com escalas (sem verificar horário)');
                  }
                }}
              >
                <SelectValue placeholder={corretorLoading ? "Verificando disponibilidade..." : "Selecione um corretor"} />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="aleatorio" className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎲</span>
                    <span>Aleatório (sistema escolhe)</span>
                  </div>
                </SelectItem>
                
                {/* Se data E horário selecionados: mostrar APENAS disponíveis */}
                {(selectedDate && time) ? (
                  // Modo filtrado: apenas corretores disponíveis no horário
                  corretoresDisponiveis.filter(c => c.available).map((corretor) => (
                    <SelectItem key={corretor.id} value={corretor.full_name} className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                        <span className="text-lg">👤</span>
                        <span>{corretor.full_name}</span>
                        <span className="text-xs text-green-400 ml-2">✓ Disponível</span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  // Modo sem filtro: mostrar todos os corretores
                  corretoresDisponiveis.map((corretor) => (
                    <SelectItem key={corretor.id} value={corretor.full_name} className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${corretor.available ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                        <span className="text-lg">👤</span>
                        <span>{corretor.full_name}</span>
                        <span className={`text-xs ml-2 ${corretor.available ? 'text-green-400' : 'text-gray-400'}`}>
                          {corretor.available ? '✓ Com escala' : '⏳ Verificar horário'}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            
            {/* Indicador visual do corretor selecionado */}
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-3 h-3 rounded-full ${
                selectedCorretor === 'aleatorio' ? 'bg-yellow-500' :
                corretoresDisponiveis.find(c => c.full_name === selectedCorretor)?.available ? 'bg-green-500' :
                'bg-red-500'
              }`}></div>
              <span className="text-sm text-gray-400">
                {selectedCorretor === 'aleatorio' ? 'Sistema escolherá entre corretores disponíveis' :
                 corretoresDisponiveis.find(c => c.full_name === selectedCorretor)?.available ? 
                   `${selectedCorretor} está disponível no horário selecionado` :
                 selectedCorretor ? `${selectedCorretor} não está no plantão neste horário` :
                 'Selecione um corretor'}
              </span>
            </div>
            
            {/* Avisos sobre filtragem */}
            {(!selectedDate || !time) ? (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <span className="text-yellow-300 text-sm">
                    Selecione data e horário para filtrar apenas corretores disponíveis no plantão
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔍</span>
                  <span className="text-blue-300 text-sm">
                    Mostrando apenas corretores disponíveis em {format(selectedDate, "dd/MM", { locale: ptBR })} às {time}
                    {corretoresDisponiveis.filter(c => c.available).length === 0 && (
                      <span className="text-red-400 ml-2">⚠️ Nenhum corretor disponível neste horário</span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Criando no Google Calendar...
                </div>
              ) : (
                "Criar Evento"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
      
      {/* Modal personalizado para substituir alerts */}
      <CustomModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
      />
    </Dialog>
  );
} 