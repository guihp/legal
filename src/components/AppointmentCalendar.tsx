import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, CheckCircle, User } from "lucide-react";
import { EditEventModal } from "./EditEventModal";
import { CustomModal } from "./CustomModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { invokeEdge } from "@/integrations/supabase/invoke";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit/logger";
import { cn } from "@/lib/utils";
import { normalizeStage } from "@/components/pipeline/helpers";
import type { LeadStage } from "@/types/kanban";
import { toast } from "sonner";
import {
  formatAgendaShortDate,
  formatAgendaTime,
  getAgentDotClass,
  getStatusBadgeClasses,
  getStatusLabel,
  getTypeBadgeClasses,
  getUpcomingEvents,
  getStartOfWeek,
  isConfirmedStatus,
  isVisitedStatus,
  type AgendaViewMode,
} from "@/components/agenda/helpers";
import { AgendaEventCard } from "@/components/agenda/AgendaEventCard";
import { AgendaUpcomingList } from "@/components/agenda/AgendaUpcomingList";

interface Appointment {
  id: number | string;
  date: Date;
  client: string;
  property: string;
  address: string;
  type: string;
  status: string;
  corretor?: string;
  channel?: string;
  phone?: string;
  calendarId?: string;
  leadId?: string;
}

interface AppointmentCalendarProps {
  appointments?: Appointment[];
  onDateChange?: (date: Date) => void;
  onMonthChange?: (newMonth: Date) => void;
  onRefreshRequested?: () => void;
  onEventStatusChange?: (eventId: number | string, status: string) => void;
  selectedDate?: Date;
  currentMonth?: Date;
  selectedAgenda?: string;
  selectedAgendaName?: string;
  viewMode?: AgendaViewMode;
  sortedAgentNames?: string[];
}

// Mock data para agendamentos (fallback)
const mockAppointments: Appointment[] = [
  {
    id: 1,
    date: new Date(2025, 5, 20, 10, 0),
    client: "João Silva",
    property: "Apartamento Centro",
    address: "Rua das Flores, 123",
    type: "Visita",
    status: "confirmada",
    corretor: "Isis"
  },
  {
    id: 2,
    date: new Date(2025, 5, 20, 14, 30),
    client: "Maria Santos",
    property: "Casa Jardim América",
    address: "Av. Principal, 456",
    type: "Avaliação",
    status: "agendada",
    corretor: "Arthur"
  },
  {
    id: 3,
    date: new Date(2025, 5, 21, 9, 0),
    client: "Pedro Costa",
    property: "Sala Comercial",
    address: "Rua Comercial, 789",
    type: "Apresentação",
    status: "confirmada",
    corretor: "Isis"
  },
  {
    id: 4,
    date: new Date(2025, 5, 23, 16, 0),
    client: "Ana Oliveira",
    property: "Cobertura Vila Nova",
    address: "Rua das Palmeiras, 321",
    type: "Visita",
    status: "agendada",
    corretor: "Arthur"
  },
  {
    id: 5,
    date: new Date(2025, 5, 19, 11, 0),
    client: "Carlos Mendes",
    property: "Loft Moderno",
    address: "Rua Inovação, 100",
    type: "Vistoria",
    status: "confirmada",
    corretor: "Isis"
  }
];

export function AppointmentCalendar({ 
  appointments = mockAppointments, 
  onDateChange,
  onMonthChange,
  onRefreshRequested,
  onEventStatusChange,
  selectedDate: externalSelectedDate,
  currentMonth: externalCurrentMonth,
  selectedAgenda = "Todos",
  selectedAgendaName,
  viewMode = "month",
  sortedAgentNames: externalSortedAgentNames,
}: AppointmentCalendarProps) {
  const [internalCurrentDate, setInternalCurrentDate] = useState(new Date());
  const [internalSelectedDate, setInternalSelectedDate] = useState(new Date());
  
  // Estado local para appointments (permite alterações no cache)
  const [localAppointments, setLocalAppointments] = useState<Appointment[]>(appointments);
  
  // Estados para o modal de edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAppointmentToEdit, setSelectedAppointmentToEdit] = useState<Appointment | null>(null);
  
  // Estados para alteração de status
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedAppointmentForStatus, setSelectedAppointmentForStatus] = useState<Appointment | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [visitConfirmAppointment, setVisitConfirmAppointment] = useState<Appointment | null>(null);
  const [visitConfirmLoading, setVisitConfirmLoading] = useState(false);
  
  // Estados para modais personalizados
  const [customModal, setCustomModal] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'alert' | 'success' | 'error';
    title: string;
    message: string;
    onConfirm?: () => void;
    confirmText?: string;
    showCancel?: boolean;
    cancelText?: string;
  }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
  });
  
  // Usar as datas externas se fornecidas, senão usar as internas
  const selectedDate = externalSelectedDate || internalSelectedDate;
  const currentDate = externalCurrentMonth || internalCurrentDate;

  // Atualizar appointments locais quando props mudarem
  useEffect(() => {
    setLocalAppointments(appointments);
  }, [appointments]);

  // Funções para modais personalizados
  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'alert' = 'alert') => {
    setCustomModal({
      isOpen: true,
      type,
      title,
      message,
      showCancel: false,
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText: string = 'Confirmar') => {
    setCustomModal({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      onConfirm,
      confirmText,
      showCancel: true,
      cancelText: 'Cancelar'
    });
  };

  const closeModal = () => {
    setCustomModal(prev => ({ ...prev, isOpen: false }));
  };

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const dayNames = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Células vazias para os dias anteriores (sem data)
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: null, isCurrentMonth: false, isEmpty: true });
    }

    // Apenas os dias do mês atual
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({ date, isCurrentMonth: true, isEmpty: false });
    }

    // Células vazias para completar a última semana (sem data)
    const totalCells = Math.ceil(days.length / 7) * 7;
    while (days.length < totalCells) {
      days.push({ date: null, isCurrentMonth: false, isEmpty: true });
    }

    return days;
  };

  const getAppointmentsForDate = (date: Date) => {
    return validAppointments.filter(apt => 
      apt.date.toDateString() === date.toDateString()
    );
  };

  // Filtrar appointments válidos para evitar eventos fantasma (DUPLA PROTEÇÃO)
  const validAppointments = localAppointments.filter(apt => {
    // 1. Verificar se o appointment existe
    if (!apt) {
      console.log("🧹 AppointmentCalendar: Removido appointment nulo");
      return false;
    }
    
    // 2. Verificar se é um objeto vazio {} 
    if (typeof apt === 'object' && Object.keys(apt).length === 0) {
      console.log("🧹 AppointmentCalendar: Removido objeto vazio {}");
      return false;
    }
    
    // 3. Verificar se tem apenas propriedades vazias/undefined/null
    const keys = Object.keys(apt);
    const hasValidData = keys.some(key => {
      const value = apt[key as keyof typeof apt];
      if (value === null || value === undefined) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      return true;
    });
    
    if (!hasValidData) {
      console.log("🧹 AppointmentCalendar: Removido appointment sem dados válidos:", apt);
      return false;
    }
    
    // 4. Verificar campos obrigatórios
    if (!apt.date || !apt.client || !apt.property) {
      console.log("🧹 AppointmentCalendar: Removido appointment sem campos obrigatórios:", {
        id: apt.id,
        hasDate: !!apt.date,
        hasClient: !!apt.client,
        hasProperty: !!apt.property
      });
      return false;
    }
    
    // 5. Verificar se os campos não são strings vazias
    if (typeof apt.client === 'string' && apt.client.trim() === '') {
      console.log("🧹 AppointmentCalendar: Removido appointment com cliente vazio");
      return false;
    }
    
    if (typeof apt.property === 'string' && apt.property.trim() === '') {
      console.log("🧹 AppointmentCalendar: Removido appointment com propriedade vazia");
      return false;
    }
    
    // 6. Verificar se a data é válida
    if (!(apt.date instanceof Date) || isNaN(apt.date.getTime())) {
      console.log("🧹 AppointmentCalendar: Removido appointment com data inválida:", apt.date);
      return false;
    }
    
    // 7. Verificar se não é um evento "fantasma" comum
    const isGhostEvent = (
      apt.client === 'Cliente não informado' &&
      apt.property === 'Evento sem título' &&
      apt.address === 'Local não informado'
    );
    
    if (isGhostEvent) {
      console.log("🧹 AppointmentCalendar: Removido evento fantasma com dados padrão");
      return false;
    }
    
    return true;
  });

  // Log detalhado da filtragem
  if (localAppointments.length !== validAppointments.length) {
    console.log(`📊 AppointmentCalendar FILTRAGEM CONCLUÍDA:`);
    console.log(`   📥 Eventos recebidos: ${localAppointments.length}`);
    console.log(`   🧹 Eventos removidos: ${localAppointments.length - validAppointments.length}`);
    console.log(`   ✅ Eventos válidos: ${validAppointments.length}`);
    
    if (validAppointments.length > 0) {
      console.log(`   📋 Eventos válidos:`, validAppointments.map(apt => ({
        id: apt.id,
        client: apt.client,
        property: apt.property,
        date: apt.date.toLocaleDateString('pt-BR'),
        time: apt.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      })));
    }
  } else if (validAppointments.length > 0) {
    console.log(`✅ AppointmentCalendar: Todos os ${validAppointments.length} eventos são válidos`);
  } else {
    console.log(`📭 AppointmentCalendar: Nenhum evento para exibir`);
  }

  const uniqueCorretoresSorted = useMemo(() => {
    if (externalSortedAgentNames?.length) return externalSortedAgentNames;
    const names = new Set<string>();
    for (const apt of localAppointments) {
      if (!apt?.corretor?.trim()) continue;
      if (!apt.date || !apt.client || !apt.property) continue;
      if (!(apt.date instanceof Date) || isNaN(apt.date.getTime())) continue;
      names.add(apt.corretor.trim());
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [localAppointments, externalSortedAgentNames]);

  const getCorretorDotClass = (corretor: string) =>
    getAgentDotClass(corretor, uniqueCorretoresSorted);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else {
      newDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // Se temos a função externa, usar ela (para buscar novos eventos do mês)
    if (onMonthChange) {
      onMonthChange(newDate);
    } else {
      // Senão usar o estado interno
      setInternalCurrentDate(newDate);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmado': return 'text-green-400 bg-green-400/10';
      case 'Aguardando confirmação': return 'text-yellow-400 bg-yellow-400/10';
      case 'Cancelado': return 'text-red-400 bg-red-400/10';
      case 'Recusado': return 'text-red-400 bg-red-400/10';
      case 'Talvez': return 'text-blue-400 bg-blue-400/10';
      case 'Agendada': return 'text-blue-400 bg-blue-400/10';
      // Manter compatibilidade com status antigos
      case 'confirmada': return 'text-green-400 bg-green-400/10';
      case 'agendada': return 'text-blue-400 bg-blue-400/10';
      case 'cancelada': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Confirmado': return { icon: '✅', tooltip: 'Confirmado' };
      case 'Aguardando confirmação': return { icon: '⏳', tooltip: 'Aguardando confirmação' };
      case 'Cancelado': return { icon: '❌', tooltip: 'Cancelado' };
      case 'Recusado': return { icon: '🚫', tooltip: 'Recusado' };
      case 'Talvez': return { icon: '❓', tooltip: 'Talvez' };
      case 'Agendada': return { icon: '📅', tooltip: 'Agendada' };
      // Manter compatibilidade com status antigos
      case 'confirmada': return { icon: '✅', tooltip: 'Confirmada' };
      case 'agendada': return { icon: '📅', tooltip: 'Agendada' };
      case 'cancelada': return { icon: '❌', tooltip: 'Cancelada' };
      default: return { icon: '❔', tooltip: status };
    }
  };

  // Função para deletar evento
  const handleDeleteEvent = (appointment: Appointment) => {
    const message = `Tem certeza que deseja deletar este evento?\n\nCliente: ${appointment.client}\nImóvel: ${appointment.property}\nData: ${appointment.date.toLocaleDateString('pt-BR')} às ${appointment.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n\nEsta ação não pode ser desfeita!`;
    
    showConfirm(
      'Excluir evento da agenda',
      `Cliente: ${appointment.client}\nImóvel: ${appointment.property}\nData: ${appointment.date.toLocaleDateString('pt-BR')} às ${appointment.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      () => executeDelete(appointment),
      'Excluir definitivamente'
    );
  };

  // Função que executa a deleção
  const executeDelete = async (appointment: Appointment) => {
    try {
      const deleteBody = {
        calendar_id: (appointment as any).calendarId || selectedAgenda,
        evento_id: String(appointment.id)
      } as any;
      const { data, error } = await invokeEdge<any, any>("google-calendar-api", {
        body: { action: "delete_event", ...deleteBody },
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || "Erro ao apagar evento no Google");
      }

      console.log("✅ Evento deletado com sucesso");
      showAlert('✅ Sucesso', 'Evento deletado com sucesso!', 'success');
      // Atualizar agenda após sucesso
      if (onRefreshRequested) onRefreshRequested();
      
    } catch (error) {
      console.error('❌ Erro ao deletar evento:', error);
      showAlert('❌ Erro', 'Erro ao deletar evento. Tente novamente.', 'error');
    }
  };

  // Função para alterar status do evento
  const handleChangeStatus = (appointment: Appointment) => {
    console.log("🔄 Abrindo modal de alteração de status para:", {
      id: appointment.id,
      client: appointment.client,
      status: appointment.status
    });
    setSelectedAppointmentForStatus(appointment);
    setNewStatus(appointment.status);
    setShowStatusModal(true);
  };

  // Função que executa a alteração de status
  const executeStatusChange = async (appointmentOverride?: Appointment, statusOverride?: string) => {
    const target = appointmentOverride || selectedAppointmentForStatus;
    const nextStatus = statusOverride || newStatus;

    if (!target) {
      console.error('❌ Nenhum evento selecionado para alteração de status');
      showAlert('❌ Erro', 'Nenhum evento selecionado. Tente novamente.', 'error');
      return;
    }

    if (!nextStatus) {
      console.error('❌ Nenhum status novo selecionado');
      showAlert('❌ Erro', 'Selecione um novo status.', 'error');
      return;
    }

    setLocalAppointments(prevAppointments => 
      prevAppointments.map(apt => 
        apt.id === target.id 
          ? { ...apt, status: nextStatus }
          : apt
      )
    );
    onEventStatusChange?.(target.id, nextStatus);

    if (!appointmentOverride) {
      setShowStatusModal(false);
      setSelectedAppointmentForStatus(null);
      setNewStatus('');
    }
    
    if (appointmentOverride) {
      const successMsg =
        nextStatus === 'Visitado'
          ? 'Visita foi realizada com sucesso.'
          : 'Evento confirmado com sucesso!';
      showAlert(nextStatus === 'Visitado' ? 'Sucesso' : '✅ Sucesso', successMsg, 'success');
    } else {
      showAlert('✅ Sucesso', `Status alterado para "${nextStatus}" localmente!`, 'success');
    }

    try {
      const visitMark = nextStatus === 'Visitado' || isVisitedStatus(nextStatus);
      const googleStatus = visitMark
        ? undefined
        : ({
          'Aguardando confirmação': 'needsAction',
          'Confirmado': 'accepted', 
          'Cancelado': 'declined',
          'Recusado': 'declined',
          'Talvez': 'tentative'
        }[nextStatus] || 'needsAction');

      const { data, error } = await invokeEdge<any, any>("google-calendar-api", {
        body: {
          action: "update_event_status",
          calendar_id: (target as any).calendarId || (selectedAgenda !== "Todos" ? selectedAgenda : undefined),
          evento_id: String(target.id),
          ...(googleStatus ? { response_status: googleStatus } : {}),
          custom_status: nextStatus,
        },
      });
      if (!error && data?.success) {
        console.log("✅ Evento sincronizado com Google com sucesso!");
        if (onRefreshRequested) onRefreshRequested();
      } else {
        console.warn("⚠️ Falha ao sincronizar status com Google, alteração local mantida");
      }
      
    } catch (error) {
      console.warn("⚠️ Falha na sincronização com Google (alteração mantida localmente):", error);
    }
  };

  const handleQuickConfirm = (appointment: Appointment) => {
    void executeStatusChange(appointment, 'Confirmado');
  };

  const handleQuickVisit = (appointment: Appointment) => {
    setVisitConfirmAppointment(appointment);
  };

  const executeVisitConfirmed = async (appointment: Appointment) => {
    setVisitConfirmLoading(true);
    try {
      await executeStatusChange(appointment, 'Visitado');

      const leadId = appointment.leadId?.trim();
      if (!leadId) {
        toast.info('Visita registrada', {
          description: 'Nenhum card vinculado a este evento no pipeline.',
        });
        return;
      }

      const { data: lead, error: fetchError } = await supabase
        .from('leads')
        .select('stage')
        .eq('id', leadId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!lead) {
        toast.info('Visita registrada', {
          description: 'Nenhum card vinculado a este evento no pipeline.',
        });
        return;
      }

      if (normalizeStage(lead.stage) === 'visita realizada') {
        return;
      }

      const newStage: LeadStage = 'Visita Realizada';
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          stage: newStage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (updateError) throw updateError;

      logAudit({
        action: 'lead.stage_changed',
        resource: 'lead',
        resourceId: leadId,
        meta: { newStage, source: 'agenda_visitado' },
      });

      toast.success('Lead atualizado', {
        description: 'Card movido para Visita Realizada no pipeline.',
      });
    } catch (error) {
      console.error('Erro ao mover lead para Visita Realizada:', error);
      showAlert(
        '❌ Erro',
        'A visita foi registrada na agenda, mas não foi possível mover o card no pipeline. Tente arrastar manualmente.',
        'error',
      );
    } finally {
      setVisitConfirmLoading(false);
      setVisitConfirmAppointment(null);
    }
  };

  // Função para editar evento
  const handleEditEvent = async (eventData: {
    id: number;
    newDate: Date;
    newTime: string;
  }) => {
    try {
      const appointmentToEdit = selectedAppointmentToEdit;
      if (!appointmentToEdit) {
        throw new Error("Evento não encontrado");
      }

      // Novo contrato: enviar apenas { calendar_id, evento_id, update }
      const newStartISO = eventData.newDate.toISOString();
      const newEndISO = new Date(eventData.newDate.getTime() + (60 * 60 * 1000)).toISOString();

      // Enviar TODOS os dados novos (mesmo se não alterados)
      const summary = `${appointmentToEdit.type} - ${appointmentToEdit.client}`;
      const description = `Imóvel: ${appointmentToEdit.property}\nEndereço: ${appointmentToEdit.address}\nCorretor: ${appointmentToEdit.corretor || 'Não especificado'}`;
      const location = appointmentToEdit.address;
      const tipoEvento = appointmentToEdit.type;
      const horaEvento = eventData.newTime;

      const update: any = {
        summary,
        description,
        location,
        start: { dateTime: newStartISO, timeZone: 'America/Sao_Paulo' },
        end:   { dateTime: newEndISO,   timeZone: 'America/Sao_Paulo' },
        tipo_evento: tipoEvento,
        data_evento: newStartISO,
        hora_evento: horaEvento
      };

      const payload = {
        calendar_id: (appointmentToEdit as any).calendarId || (selectedAgenda !== "Todos" ? selectedAgenda : undefined),
        evento_id: String(eventData.id),
        update
      } as any;

      console.log("🔄 Editando evento:", payload);

      const { data, error } = await invokeEdge<any, any>("google-calendar-api", {
        body: {
          action: "update_event",
          ...payload,
        },
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || "Erro ao editar evento no Google");
      }

      console.log("✅ Evento editado com sucesso");
      
      // Fechar modal
      setShowEditModal(false);
      setSelectedAppointmentToEdit(null);
      
      // Mostrar sucesso
      showAlert('✅ Sucesso', 'Evento atualizado com sucesso!', 'success');
      // Atualizar agenda após sucesso
      if (onRefreshRequested) onRefreshRequested();
      
    } catch (error) {
      console.error('❌ Erro ao editar evento:', error);
      const detail = error instanceof Error ? error.message : "";
      showAlert(
        '❌ Erro',
        detail
          ? `${detail}\n\nSe o problema continuar, verifique se a agenda correta está selecionada (não use "Todos" se o evento não tiver calendário vinculado).`
          : 'Erro ao editar evento. Tente novamente.',
        'error',
      );
    }
  };

  const days = getDaysInMonth(currentDate);
  const selectedAppointments = getAppointmentsForDate(selectedDate);
  const confirmedCount = selectedAppointments.filter((a) => isConfirmedStatus(a.status)).length;
  const upcomingEvents = getUpcomingEvents(
    validAppointments.filter((a) => a.date.toDateString() !== selectedDate.toDateString()),
    selectedDate,
    5,
  );

  const weekStart = getStartOfWeek(selectedDate);
  const renderEventCard = (appointment: Appointment) => (
    <AgendaEventCard
      key={appointment.id}
      appointment={appointment}
      sortedAgentNames={uniqueCorretoresSorted}
      onConfirm={() => handleQuickConfirm(appointment)}
      onMarkVisited={() => handleQuickVisit(appointment)}
      onReschedule={() => {
        setSelectedAppointmentToEdit(appointment);
        setShowEditModal(true);
      }}
      onChangeStatus={() => handleChangeStatus(appointment)}
      onDelete={() => handleDeleteEvent(appointment)}
    />
  );

  const calendarSubtitle =
    selectedAgenda === 'Todos'
      ? `${validAppointments.length} eventos · todos os calendários`
      : `${validAppointments.length} eventos · ${selectedAgendaName || 'calendário'}`;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 sm:gap-5 min-w-0">
      <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm min-w-0 overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border px-4 py-4 sm:px-5 sm:py-5">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground capitalize">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{calendarSubtitle}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth('prev')}
              className="h-8 w-8 rounded-lg border-border bg-background shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth('next')}
              className="h-8 w-8 rounded-lg border-border bg-background shadow-sm"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-3 sm:p-4 md:p-5">
          {viewMode === 'month' ? (
            <>
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-2">
                {dayNames.map((day) => (
                  <div key={day} className="py-2 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {days.map((day, index) => {
                  if (day.isEmpty || !day.date) {
                    return <div key={index} className="aspect-square min-h-[2.75rem] sm:min-h-[3.25rem]" />;
                  }

                  const isSelected = day.date.toDateString() === selectedDate.toDateString();
                  const isToday = day.date.toDateString() === new Date().toDateString();
                  const dayAppointments = getAppointmentsForDate(day.date);
                  const hasApts = dayAppointments.length > 0;
                  const maxDots = 3;
                  const dotCount = Math.min(dayAppointments.length, maxDots);
                  const overflowCount = dayAppointments.length - maxDots;

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setInternalSelectedDate(day.date!);
                        onDateChange?.(day.date!);
                      }}
                      className={cn(
                        'relative aspect-square min-h-[2.75rem] sm:min-h-[3.25rem] rounded-lg sm:rounded-xl border text-left p-1.5 sm:p-2 transition-colors',
                        isSelected
                          ? 'btn-on-emerald bg-emerald-900 border-emerald-900 text-white dark:bg-emerald-950 dark:border-emerald-800'
                          : isToday
                            ? 'bg-emerald-50 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-800/40'
                            : 'bg-background border-border hover:bg-muted/40',
                      )}
                    >
                      <span
                        className={cn(
                          'text-sm sm:text-base font-semibold leading-none',
                          isSelected ? 'text-white' : isToday ? 'text-emerald-900 dark:text-emerald-200' : 'text-foreground',
                        )}
                      >
                        {day.date.getDate()}
                      </span>
                      {hasApts ? (
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-center gap-0.5">
                          {Array.from({ length: dotCount }).map((_, dotIndex) => {
                            const apt = dayAppointments[dotIndex];
                            const dotClass = isSelected
                              ? 'bg-white/90'
                              : apt?.corretor
                                ? getCorretorDotClass(apt.corretor)
                                : 'bg-emerald-600';
                            return (
                              <span
                                key={dotIndex}
                                className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotClass)}
                              />
                            );
                          })}
                          {overflowCount > 0 ? (
                            <span
                              className={cn(
                                'text-[9px] font-semibold tabular-nums leading-none',
                                isSelected ? 'text-white/90' : 'text-muted-foreground',
                              )}
                            >
                              +{overflowCount}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : viewMode === 'week' ? (
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, i) => {
                const day = new Date(weekStart);
                day.setDate(day.getDate() + i);
                const dayEvents = getAppointmentsForDate(day);
                const isSelected = day.toDateString() === selectedDate.toDateString();
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setInternalSelectedDate(day);
                      onDateChange?.(day);
                    }}
                    className={cn(
                      'w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
                      isSelected
                        ? 'border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20'
                        : 'border-border bg-background hover:bg-muted/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm font-semibold capitalize', isToday && 'text-emerald-800 dark:text-emerald-300')}>
                        {day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {dayEvents.length} evento{dayEvents.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
              {validAppointments.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento no período.</p>
              ) : (
                validAppointments
                  .slice()
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map((apt) => (
                    <button
                      key={apt.id}
                      type="button"
                      onClick={() => {
                        setInternalSelectedDate(apt.date);
                        onDateChange?.(apt.date);
                      }}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-left hover:bg-muted/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatAgendaShortDate(apt.date)} · {formatAgendaTime(apt.date)}
                        </span>
                        <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-semibold', getStatusBadgeClasses(apt.status))}>
                          {getStatusLabel(apt.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground truncate">{apt.property}</p>
                      <p className="text-xs text-muted-foreground truncate">{apt.client}</p>
                    </button>
                  ))
              )}
            </div>
          )}

          {viewMode === 'month' ? (
            <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-900 dark:bg-emerald-800" />
                Dia selecionado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/40" />
                Hoje
              </span>
              {uniqueCorretoresSorted.map((corretor) => (
                <span key={corretor} className="inline-flex items-center gap-1.5 max-w-[10rem]">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', getCorretorDotClass(corretor))} />
                  <span className="truncate">{corretor}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm min-w-0 overflow-hidden flex flex-col">
        <div className="border-b border-border px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-foreground capitalize break-words">
                {selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground capitalize">
                {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                {selectedAppointments.length} evento{selectedAppointments.length !== 1 ? 's' : ''}
              </span>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {confirmedCount} confirmado{confirmedCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
          {selectedAppointments.length > 0 ? (
            selectedAppointments
              .slice()
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .map(renderEventCard)
          ) : (
            <div className="py-10 text-center">
              <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold text-foreground">Dia livre</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
                {selectedAgenda === 'Todos'
                  ? 'Nenhum compromisso agendado para este dia.'
                  : `${selectedAgendaName || 'Calendário'} sem compromissos neste dia.`}
              </p>
            </div>
          )}

          <AgendaUpcomingList events={upcomingEvents} sortedAgentNames={uniqueCorretoresSorted} />
        </div>
      </div>

      {/* Modal de Edição de Evento */}
      <EditEventModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedAppointmentToEdit(null);
        }}
        appointment={selectedAppointmentToEdit}
        onSubmit={handleEditEvent}
      />

      {/* Modal de Alteração de Status */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="sm:max-w-[450px] bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              Alterar Status do Evento
            </DialogTitle>
          </DialogHeader>
          
          {selectedAppointmentForStatus && (
            <div className="space-y-6">
              {/* Informações do evento */}
              <div className="bg-muted/40 rounded-lg p-4 border border-border">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-emerald-400" />
                    <span className="text-foreground font-medium">{selectedAppointmentForStatus.client}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-amber-400" />
                    <span className="text-muted-foreground text-sm">{selectedAppointmentForStatus.property}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-400" />
                    <span className="text-muted-foreground text-sm">
                      {selectedAppointmentForStatus.date.toLocaleDateString('pt-BR')} às {formatTime(selectedAppointmentForStatus.date)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status atual */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Status Atual</Label>
                <div className={`px-4 py-3 rounded-lg text-sm font-semibold ${getStatusColor(selectedAppointmentForStatus.status)} border ${
                  selectedAppointmentForStatus.status === 'Confirmado' ? 'border-green-400/30' :
                  selectedAppointmentForStatus.status === 'Aguardando confirmação' ? 'border-yellow-400/30' :
                  selectedAppointmentForStatus.status === 'Recusado' ? 'border-red-400/30' :
                  selectedAppointmentForStatus.status === 'Talvez' ? 'border-blue-400/30' :
                  selectedAppointmentForStatus.status === 'Agendada' ? 'border-blue-400/30' :
                  selectedAppointmentForStatus.status === 'confirmada' ? 'border-green-400/30' :
                  selectedAppointmentForStatus.status === 'agendada' ? 'border-blue-400/30' :
                  selectedAppointmentForStatus.status === 'cancelada' ? 'border-red-400/30' : 'border-gray-400/30'
                }`}>
                  {selectedAppointmentForStatus.status === 'Confirmado' ? '✓ Confirmado' :
                   selectedAppointmentForStatus.status === 'Aguardando confirmação' ? '⏳ Aguardando confirmação' :
                   selectedAppointmentForStatus.status === 'Recusado' ? '✗ Recusado' :
                   selectedAppointmentForStatus.status === 'Talvez' ? '❓ Talvez' :
                   selectedAppointmentForStatus.status === 'Agendada' ? '○ Agendada' :
                   selectedAppointmentForStatus.status === 'confirmada' ? '✓ Confirmada' :
                   selectedAppointmentForStatus.status === 'agendada' ? '○ Agendada' :
                   selectedAppointmentForStatus.status === 'cancelada' ? '✗ Cancelada' : selectedAppointmentForStatus.status}
                </div>
              </div>

              {/* Novo status */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Novo Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue placeholder="Selecione o novo status" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="Aguardando confirmação" className="focus:bg-muted">
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-400">⏳</span>
                        <span>Aguardando confirmação</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Confirmado" className="focus:bg-muted">
                      <div className="flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        <span>Confirmado</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Cancelado" className="focus:bg-muted">
                      <div className="flex items-center gap-2">
                        <span className="text-red-400">✗</span>
                        <span>Cancelado</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Recusado" className="focus:bg-muted">
                      <div className="flex items-center gap-2">
                        <span className="text-red-400">✗</span>
                        <span>Recusado</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Talvez" className="focus:bg-muted">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400">❓</span>
                        <span>Talvez</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Indicador de mudança */}
              {newStatus && newStatus !== selectedAppointmentForStatus.status && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-500/20 rounded-full">
                      <span className="text-lg">🔄</span>
                    </div>
                    <div>
                      <div className="text-blue-600 dark:text-blue-400 font-medium text-sm">
                        Status será alterado de:
                      </div>
                      <div className="text-foreground text-sm">
                        <span className="text-muted-foreground">{selectedAppointmentForStatus.status}</span> 
                        <span className="text-blue-400 mx-2">→</span> 
                        <span className="text-green-300 font-semibold">{newStatus}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Botões */}
              <div className="flex justify-end space-x-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowStatusModal(false);
                    setSelectedAppointmentForStatus(null);
                    setNewStatus('');
                  }}
                  className="bg-background border-border text-foreground hover:bg-muted"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    console.log("🔄 Botão 'Alterar Status' clicado", {
                      newStatus,
                      selectedAppointment: selectedAppointmentForStatus?.id,
                      isDisabled: !newStatus || newStatus === selectedAppointmentForStatus?.status
                    });
                    executeStatusChange();
                  }}
                  disabled={!newStatus || newStatus === selectedAppointmentForStatus.status}
                  className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Alterar Status
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Personalizado */}
      <CustomModal
        isOpen={customModal.isOpen}
        onClose={closeModal}
        type={customModal.type}
        title={customModal.title}
        message={customModal.message}
        onConfirm={customModal.onConfirm}
        confirmText={customModal.confirmText}
      />

      <AlertDialog
        open={!!visitConfirmAppointment}
        onOpenChange={(open) => {
          if (!open && !visitConfirmLoading) setVisitConfirmAppointment(null);
        }}
      >
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar visita?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Confirma que a visita com{' '}
                  <span className="font-medium text-foreground">{visitConfirmAppointment?.client}</span>{' '}
                  ao imóvel{' '}
                  <span className="font-medium text-foreground">{visitConfirmAppointment?.property}</span>{' '}
                  realmente aconteceu?
                </p>
                <p>O card do lead será movido para Visita Realizada no pipeline.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={visitConfirmLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={visitConfirmLoading}
              className="btn-on-emerald bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700"
              onClick={(e) => {
                e.preventDefault();
                if (visitConfirmAppointment) {
                  void executeVisitConfirmed(visitConfirmAppointment);
                }
              }}
            >
              {visitConfirmLoading ? 'Confirmando…' : 'Sim, visitado'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 