import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Clock, Edit, User, MapPin } from "lucide-react";
import format from "date-fns/format";
import ptBR from "date-fns/locale/pt-BR";
import { cn } from "@/lib/utils";

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

interface EditEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onSubmit: (eventData: {
    id: number;
    newDate: Date;
    newTime: string;
  }) => void;
}

export function EditEventModal({ 
  isOpen, 
  onClose, 
  appointment,
  onSubmit 
}: EditEventModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [time, setTime] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Inicializar com dados do evento quando o modal abrir
  useEffect(() => {
    if (appointment && isOpen) {
      setSelectedDate(appointment.date);
      setTime(appointment.date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }));
    }
  }, [appointment, isOpen]);

  // Funções para atalhos de data
  const setQuickDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setSelectedDate(date);
    setShowDatePicker(false);
  };

  // Horários comuns para seleção rápida
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
    
    if (currentHour < 12) {
      return "14:00";
    } else if (currentHour < 17) {
      const nextHour = currentHour + 1;
      return `${nextHour.toString().padStart(2, '0')}:00`;
    } else {
      return "09:00";
    }
  };

  const setQuickTime = (timeValue: string) => {
    setTime(timeValue);
    setShowTimePicker(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!appointment || !selectedDate || !time) {
      // Não fazer nada - a validação visual já está ativa nos botões
      return;
    }

    setLoading(true);
    
    try {
      // Combinar data e hora
      const [hours, minutes] = time.split(':');
      const eventDateTime = new Date(selectedDate);
      eventDateTime.setHours(parseInt(hours), parseInt(minutes));

      await onSubmit({
        id: appointment.id,
        newDate: eventDateTime,
        newTime: time
      });

      onClose();
    } catch (error) {
      console.error('Erro ao editar evento:', error);
      // O erro será tratado no componente pai (AppointmentCalendar)
    } finally {
      setLoading(false);
    }
  };

  if (!appointment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700/70 shadow-xl rounded-2xl">
        <DialogHeader className="pb-2 border-b border-gray-700/60">
          <DialogTitle className="text-white flex items-center gap-3 text-lg">
            <div className="p-2 rounded-lg bg-blue-600/15 border border-blue-500/20">
              <Edit className="h-5 w-5 text-blue-300" />
            </div>
            <span className="tracking-wide">Editar Evento na Agenda</span>
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações do evento atual */}
          <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/60 shadow-inner">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-2xl">📋</span>
              Informações do Evento
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-400" />
                <span className="text-gray-300">Cliente: </span>
                <span className="text-white font-medium">{appointment.client}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-lg">🏠</span>
                <span className="text-gray-300">Imóvel: </span>
                <span className="text-white font-medium">{appointment.property}</span>
              </div>
              
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-amber-400 mt-1" />
                <span className="text-gray-300">Endereço: </span>
                <span className="text-white font-medium">{appointment.address}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-lg">📅</span>
                <span className="text-gray-300">Data atual: </span>
                <span className="text-white font-medium">
                  {format(appointment.date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            </div>
          </div>

          {/* Data e Hora - Seção Modernizada */}
          <div className="space-y-4 bg-gray-800/60 p-4 rounded-xl border border-gray-700/60">
            <div className="flex items-center gap-2 mb-3">
              <CalendarIcon className="h-5 w-5 text-blue-400" />
              <Label className="text-gray-200 font-medium">
                Nova Data e Horário <span className="text-red-400">*</span>
              </Label>
            </div>

            {/* Seleção de Data */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Nova data do evento</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="text-blue-300 hover:text-blue-200 hover:bg-blue-500/10"
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
                    "bg-gray-700/80 border-gray-600/80 text-white hover:bg-gray-600 transition-all",
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
                    "bg-gray-700/80 border-gray-600/80 text-white hover:bg-gray-600 transition-all",
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
                  className="bg-gray-700/80 border-gray-600/80 text-white hover:bg-gray-600"
                >
                  📅 Em 2 dias
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDate(7)}
                  className="bg-gray-700/80 border-gray-600/80 text-white hover:bg-gray-600"
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
                <div className="border border-gray-700/60 rounded-lg overflow-hidden shadow">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="bg-gray-900 text-white"
                  />
                </div>
              )}
            </div>

            {/* Seleção de Horário */}
            <div className="space-y-3 border-t border-gray-700 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Novo horário do evento</span>
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
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💡</span>
                    <span className="text-yellow-200 text-sm font-medium">
                      Sugestão: {getSuggestedTime()}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuickTime(getSuggestedTime())}
                    className="text-yellow-300 hover:text-yellow-200 hover:bg-yellow-500/10"
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
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-700/60">
                  {commonTimes.slice(6).map((timeOption) => (
                    <Button
                      key={timeOption.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickTime(timeOption.value)}
                      className={cn(
                        "bg-gray-700/80 border-gray-600/80 text-white hover:bg-gray-600 transition-all",
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
                  className="bg-gray-800/80 border-gray-700/70 text-white pl-10 rounded-lg"
                />
              </div>

              {/* Horário selecionado */}
              {time && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-400" />
                    <span className="text-blue-300 font-medium">
                      Novo horário: {time}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Resumo da alteração */}
            {selectedDate && time && (
              <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-lg p-4 mt-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-orange-500/20 rounded-full">
                    <span className="text-lg">🔄</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium mb-1">
                      Alteração confirmada para:
                    </div>
                    <div className="text-orange-300 text-sm">
                      📅 {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })} às {time}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-700/60">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-gray-800/80 border-gray-700 text-gray-200 hover:bg-gray-700"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedDate || !time}
              className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Atualizando evento...
                </div>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 