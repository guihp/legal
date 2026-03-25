import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Clock, User, MapPin, Edit, Trash2, CheckCircle } from "lucide-react";
import { EditEventModal } from "./EditEventModal";
import { CustomModal } from "./CustomModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Appointment {
  id: number;
  date: Date;
  client: string;
  property: string;
  address: string;
  type: string;
  status: string;
  corretor?: string;
}

interface AppointmentCalendarProps {
  appointments?: Appointment[];
  onDateChange?: (date: Date) => void;
  onMonthChange?: (newMonth: Date) => void;
  onRefreshRequested?: () => void;
  selectedDate?: Date;
  currentMonth?: Date;
  selectedAgenda?: string;
  selectedAgendaName?: string;
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
  selectedDate: externalSelectedDate,
  currentMonth: externalCurrentMonth,
  selectedAgenda = "Todos",
  selectedAgendaName
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

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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

  const hasAppointments = (date: Date) => {
    return getAppointmentsForDate(date).length > 0;
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
      // Payload simples para deletar - apenas ID e corretor
      const payload = {
        evento_id: appointment.id,
        corretor: appointment.corretor || "Não especificado"
      };

      console.log("🗑️ Deletando evento:", payload);

      // Novo contrato: enviar apenas { calendar_id, evento_id }
      const deleteBody = {
        calendar_id: (appointment as any).calendarId || selectedAgenda,
        evento_id: String(appointment.id)
      } as any;

      const response = await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/deletar-evento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deleteBody),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
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
  const executeStatusChange = async () => {
    if (!selectedAppointmentForStatus) {
      console.error('❌ Nenhum evento selecionado para alteração de status');
      showAlert('❌ Erro', 'Nenhum evento selecionado. Tente novamente.', 'error');
      return;
    }

    if (!newStatus) {
      console.error('❌ Nenhum status novo selecionado');
      showAlert('❌ Erro', 'Selecione um novo status.', 'error');
      return;
    }

    // 🎯 ALTERAÇÃO LOCAL IMEDIATA (Cache do navegador)
    // Atualizar o status localmente primeiro para feedback imediato
    setLocalAppointments(prevAppointments => 
      prevAppointments.map(apt => 
        apt.id === selectedAppointmentForStatus.id 
          ? { ...apt, status: newStatus }
          : apt
      )
    );

    console.log("🔄 Status alterado localmente (cache):", {
      evento_id: selectedAppointmentForStatus.id,
      status_anterior: selectedAppointmentForStatus.status,
      status_novo: newStatus,
      cliente: selectedAppointmentForStatus.client
    });

    // Fechar modal imediatamente
    setShowStatusModal(false);
    setSelectedAppointmentForStatus(null);
    setNewStatus('');
    
    // Mostrar sucesso imediato
    showAlert('✅ Sucesso', `Status alterado para "${newStatus}" localmente!`, 'success');

    // 📡 TENTATIVA DE SINCRONIZAÇÃO COM WEBHOOK (em background)
    try {
      const payload = {
        evento_id: selectedAppointmentForStatus.id,
        status_anterior: selectedAppointmentForStatus.status,
        status_novo: newStatus,
        cliente: selectedAppointmentForStatus.client,
        imovel: selectedAppointmentForStatus.property,
        data: selectedAppointmentForStatus.date.toISOString(),
        corretor: selectedAppointmentForStatus.corretor || "Não especificado",
        timestamp_alteracao: new Date().toISOString(),
        // Mapeamento para Google Calendar responseStatus
        google_calendar_status: {
          'Aguardando confirmação': 'needsAction',
          'Confirmado': 'accepted', 
          'Cancelado': 'declined',
          'Recusado': 'declined',
          'Talvez': 'tentative'
        }[newStatus] || 'needsAction'
      };

      console.log("📡 Tentando sincronizar com webhook...");

      // Timeout de 5 segundos para não travar a interface
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/alterar-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log("✅ Webhook sincronizado com sucesso!");
        if (onRefreshRequested) onRefreshRequested();
      } else {
        console.warn("⚠️ Webhook retornou erro, mas alteração local mantida");
      }
      
    } catch (error) {
      console.warn("⚠️ Falha na sincronização com webhook (alteração mantida localmente):", error);
      
      // Não mostrar erro para o usuário, pois a alteração local já foi feita
      // Apenas log silencioso para debug
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn("⏱️ Timeout na sincronização com webhook");
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        console.warn("🌐 Sem conexão com o webhook (modo offline)");
      }
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

      // Chamar o webhook
      const response = await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/editar-evento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
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
      showAlert('❌ Erro', 'Erro ao editar evento. Tente novamente.', 'error');
    }
  };

  const days = getDaysInMonth(currentDate);
  const selectedAppointments = getAppointmentsForDate(selectedDate);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendário Modernizado */}
      <Card className="lg:col-span-2 bg-card border-border shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-border">
          <CardTitle className="text-foreground flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-semibold">Calendário</span>
              <span className="text-sm font-normal text-muted-foreground">
                {selectedAgenda === "Todos" 
                  ? "📋 Todos os calendários" 
                  : `Calendário: ${selectedAgendaName || selectedAgenda}`}
              </span>
            </div>
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-foreground font-semibold">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </p>
              <p className="text-sm text-muted-foreground">
                {validAppointments.length} eventos
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateMonth('prev')}
                className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-2"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateMonth('next')}
                className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-2"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Header dos dias da semana modernizado */}
          <div className="grid grid-cols-7 gap-2 mb-6">
            {dayNames.map(day => (
              <div key={day} className="p-3 text-center bg-muted/40 rounded-lg border border-border">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{day}</span>
              </div>
            ))}
          </div>

          {/* Grade de dias modernizada */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => {
              // Se for célula vazia, renderizar apenas um espaço vazio elegante
              if (day.isEmpty || !day.date) {
                return (
                  <div key={index} className="h-16 bg-muted/20 rounded-lg border border-border"></div>
                );
              }

              const isSelected = day.date.toDateString() === selectedDate.toDateString();
              const isToday = day.date.toDateString() === new Date().toDateString();
              const hasApts = hasAppointments(day.date);
              const dayAppointments = getAppointmentsForDate(day.date);
              const isPastDate = day.date < new Date(new Date().setHours(0, 0, 0, 0));
              
              return (
                <button
                  key={index}
                  onClick={() => {
                    setInternalSelectedDate(day.date);
                    if (onDateChange) {
                      onDateChange(day.date);
                    }
                  }}
                  className={`
                    group relative p-3 h-16 text-sm rounded-xl transition-all duration-300 transform hover:scale-105
                    border-2 shadow-sm hover:shadow-lg
                    ${isSelected 
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-400 shadow-blue-500/25 hover:shadow-blue-500/40' 
                      : isToday
                      ? 'bg-gradient-to-br from-violet-500/15 to-violet-600/25 border-violet-500/50 text-foreground font-bold dark:text-white hover:from-violet-500/25 hover:to-violet-600/35'
                      : hasApts
                      ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/15 border-emerald-500/35 text-foreground hover:from-emerald-500/18 hover:to-emerald-600/22'
                      : isPastDate
                      ? 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/60'
                      : 'bg-card border-border text-foreground hover:bg-muted/80'
                    }
                  `}
                >
                  {/* Número do dia */}
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className={`text-lg font-semibold mb-1 ${
                      isSelected ? 'text-white' :
                      isToday ? 'text-foreground dark:text-white' :
                      isPastDate ? 'text-muted-foreground' : 'text-foreground'
                    }`}>
                      {day.date.getDate()}
                    </span>
                    
                    {/* Indicadores de eventos */}
                    {hasApts && (
                      <div className="flex flex-col items-center gap-1">
                        {/* Contador de eventos */}
                        <div className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                          isSelected 
                            ? 'bg-white text-blue-600' 
                            : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                        }`}>
                          {dayAppointments.length}
                        </div>
                        
                        {/* Indicadores por corretor quando "Todos" está selecionado */}
                        {selectedAgenda === "Todos" && dayAppointments.length > 0 && (
                          <div className="flex gap-0.5">
                            {['Isis', 'Arthur'].map(corretor => {
                              const corretorCount = dayAppointments.filter(apt => apt.corretor === corretor).length;
                              if (corretorCount === 0) return null;
                              
                              return (
                                <div 
                                  key={corretor}
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    corretor === 'Isis' ? 'bg-pink-400' : 'bg-indigo-400'
                                  }`}
                                  title={`${corretorCount} evento(s) - ${corretor}`}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Indicador de hoje */}
                  {isToday && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full animate-pulse shadow-lg"></div>
                  )}

                  {/* Efeito de hover */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  
                  {/* Borda de seleção animada */}
                  {isSelected && (
                    <div className="absolute inset-0 rounded-xl border-2 border-white/20 animate-pulse pointer-events-none"></div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legenda dos indicadores */}
          <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gradient-to-br from-purple-600/20 to-purple-700/30 border border-purple-500/50 rounded"></div>
                <span className="text-muted-foreground">Hoje</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded"></div>
                <span className="text-muted-foreground">Selecionado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gradient-to-br from-emerald-600/10 to-emerald-700/20 border border-emerald-500/30 rounded"></div>
                <span className="text-muted-foreground">Com eventos</span>
              </div>
              {selectedAgenda === "Todos" && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
                    <span className="text-muted-foreground">Isis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                    <span className="text-muted-foreground">Arthur</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Agendamentos do Dia Modernizada */}
      <Card className="bg-card border-border shadow-lg">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-foreground flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/20 p-2 rounded-lg">
                <Clock className="h-6 w-6 text-purple-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold">
                  {selectedDate.toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
                <span className="text-sm text-muted-foreground font-normal capitalize">
                  {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                </span>
              </div>
            </div>
            {selectedAppointments.length > 0 && (
              <div className="flex flex-col items-end gap-1">
                <span className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-sm font-semibold border border-blue-500/30">
                  {selectedAppointments.length} evento{selectedAppointments.length !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-muted-foreground">
                  {selectedAppointments.filter(a => a.status === 'confirmada' || a.status === 'Confirmado').length} confirmados
                </span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedAppointments.length > 0 ? (
            <>
              <div className="mb-4 pb-2 border-b border-border">
                <span className="text-sm text-muted-foreground">
                  {selectedAppointments.length} {selectedAppointments.length === 1 ? 'compromisso' : 'compromissos'} agendados
                </span>
              </div>
              
              {selectedAppointments
                .sort((a, b) => a.date.getTime() - b.date.getTime()) // Ordenar por horário
                .map(appointment => (
                <div
                  key={appointment.id}
                  className="group relative p-5 rounded-xl bg-muted/30 border border-border hover:bg-muted/50 hover:border-border transition-all duration-300 shadow-sm hover:shadow-md"
                >
                  {/* Linha vertical colorida à esquerda com gradiente */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${
                    appointment.status === 'Confirmado' ? 'bg-gradient-to-b from-green-400 to-green-600' :
                    appointment.status === 'Aguardando confirmação' ? 'bg-gradient-to-b from-yellow-400 to-yellow-600' :
                    appointment.status === 'Cancelado' ? 'bg-gradient-to-b from-red-400 to-red-600' :
                    appointment.status === 'Recusado' ? 'bg-gradient-to-b from-red-400 to-red-600' :
                    appointment.status === 'Talvez' ? 'bg-gradient-to-b from-blue-400 to-blue-600' :
                    appointment.status === 'Agendada' ? 'bg-gradient-to-b from-blue-400 to-blue-600' :
                    // Compatibilidade com status antigos
                    appointment.status === 'confirmada' ? 'bg-gradient-to-b from-green-400 to-green-600' :
                    appointment.status === 'agendada' ? 'bg-gradient-to-b from-blue-400 to-blue-600' :
                    appointment.status === 'cancelada' ? 'bg-gradient-to-b from-red-400 to-red-600' : 'bg-gradient-to-b from-gray-400 to-gray-600'
                  }`}></div>
                  
                  {/* Header do evento com horário, tipo e corretor */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {/* Horário */}
                      <div className="flex items-center gap-2 bg-background px-3 py-2 rounded-lg border border-border">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="text-foreground font-semibold text-lg">
                          {formatTime(appointment.date)}
                        </span>
                      </div>
                      
                      {/* Tipo do evento */}
                      <div className={`px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide ${
                        appointment.type === 'Visita' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                        appointment.type === 'Avaliação' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                        appointment.type === 'Apresentação' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                        appointment.type === 'Vistoria' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                        'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                      }`}>
                        {appointment.type}
                      </div>
                    </div>
                    
                    {/* Corretor - sempre no canto direito quando "Todos" estiver selecionado */}
                    {selectedAgenda === "Todos" && appointment.corretor && (
                      <div className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200 ${
                        appointment.corretor === 'Isis' ? 'bg-pink-500/25 text-pink-200 border border-pink-400/50 hover:bg-pink-500/35' :
                        appointment.corretor === 'Arthur' ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/50 hover:bg-indigo-500/35' :
                        'bg-gray-500/25 text-gray-200 border border-gray-400/50 hover:bg-gray-500/35'
                      }`}>
                        <span className="text-lg animate-pulse">
                          {appointment.corretor === 'Isis' ? '👩‍💼' : 
                           appointment.corretor === 'Arthur' ? '👨‍💼' : '👤'}
                        </span>
                        <span className="font-bold tracking-wide">{appointment.corretor}</span>
                      </div>
                    )}
                  </div>
                   
                  {/* Nome do cliente */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-emerald-400" />
                      <span className="text-foreground font-medium text-lg">{appointment.client}</span>
                    </div>
                  </div>
                   
                  {/* Nome do imóvel */}
                  <div className="mb-3">
                    <span className="text-foreground font-medium text-base">
                      {appointment.property}
                    </span>
                  </div>
                   
                  {/* Endereço */}
                  <div className="mb-4">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-amber-400 mt-1 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm break-words">
                        {appointment.address}
                      </span>
                    </div>
                  </div>
                   
                  {/* Status e Ações */}
                  <div className="flex justify-between items-center">
                    {/* Botões de Ação */}
                    <div className="flex items-center gap-2">
                      {/* Botão de Alterar Status */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChangeStatus(appointment);
                        }}
                        className="bg-background border-border text-foreground hover:bg-green-600 hover:text-white hover:border-green-500 transition-all duration-200 flex items-center gap-2"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Status
                      </Button>

                      {/* Botão de Editar */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAppointmentToEdit(appointment);
                          setShowEditModal(true);
                        }}
                        className="bg-background border-border text-foreground hover:bg-orange-600 hover:text-white hover:border-orange-500 transition-all duration-200 flex items-center gap-2"
                      >
                        <Edit className="h-3 w-3" />
                        Editar
                      </Button>

                      {/* Botão de Deletar */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEvent(appointment);
                        }}
                        className="bg-background border-border text-foreground hover:bg-red-600 hover:text-white hover:border-red-500 transition-all duration-200 flex items-center gap-2"
                      >
                        <Trash2 className="h-3 w-3" />
                        Deletar
                      </Button>
                    </div>

                    {/* Status - Apenas ícone com tooltip */}
                    <div 
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-semibold ${getStatusColor(appointment.status)} border ${
                        appointment.status === 'Confirmado' ? 'border-green-400/30' :
                        appointment.status === 'Aguardando confirmação' ? 'border-yellow-400/30' :
                        appointment.status === 'Cancelado' ? 'border-red-400/30' :
                        appointment.status === 'Recusado' ? 'border-red-400/30' :
                        appointment.status === 'Talvez' ? 'border-blue-400/30' :
                        appointment.status === 'Agendada' ? 'border-blue-400/30' :
                        // Compatibilidade com status antigos
                        appointment.status === 'confirmada' ? 'border-green-400/30' :
                        appointment.status === 'agendada' ? 'border-blue-400/30' :
                        appointment.status === 'cancelada' ? 'border-red-400/30' : 'border-gray-400/30'
                      } hover:scale-110 transition-transform duration-200 cursor-help`}
                      title={getStatusIcon(appointment.status).tooltip}
                    >
                      {getStatusIcon(appointment.status).icon}
                    </div>
                  </div>
                  
                  {/* Indicador de hover */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-16">
              <div className="mb-6">
                <div className="relative">
                  <Calendar className="h-20 w-20 text-muted-foreground mx-auto opacity-30" />
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    <span className="text-2xl">✨</span>
                  </div>
                </div>
              </div>
              <h3 className="text-foreground font-semibold text-lg mb-3">Dia livre</h3>
              <p className="text-muted-foreground text-base mb-6">
                {selectedAgenda === "Todos" ? 
                  "Nenhum corretor tem compromissos agendados para este dia" :
                  `${selectedAgendaName || 'Calendário'} não tem compromissos agendados para este dia`
                }
              </p>
              <div className="max-w-sm mx-auto p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">💡</span>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">Dica</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Clique em "Adicionar Evento" para agendar um novo compromisso
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
} 