import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Clock, Edit, User, MapPin, X } from "lucide-react";
import format from "date-fns/format";
import ptBR from "date-fns/locale/pt-BR";

const FIELD_CLASS =
  'rounded-xl border-border bg-card text-foreground placeholder:text-muted-foreground h-10 dark:bg-gray-800/50 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-400';
const LABEL_CLASS = 'text-sm font-medium text-muted-foreground flex items-center gap-2 dark:text-gray-300';

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
      <DialogContent className="sm:max-w-[640px] max-h-[92vh] flex flex-col gap-0 overflow-hidden p-0 bg-background border-border text-foreground sm:rounded-2xl shadow-2xl">
        {/* Header — forest green */}
        <div
          className="flex-shrink-0 flex items-start justify-between gap-3 px-5 sm:px-6 py-4 sm:py-5"
          style={{ backgroundColor: '#1a2e24' }}
        >
          <DialogHeader className="space-y-1.5 text-left min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/10 flex items-center justify-center shrink-0">
                <Edit className="h-5 w-5 text-emerald-100" />
              </div>
              <DialogTitle className="text-lg sm:text-xl font-semibold" style={{ color: '#ffffff' }}>
                Editar Evento na Agenda
              </DialogTitle>
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

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 bg-[#F7F5F0] dark:bg-background space-y-5">
          {/* Informações do evento atual */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm dark:border-gray-700/60">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200 pb-2 mb-3 border-b border-border/60 dark:border-gray-700 flex items-center gap-2">
              <span className="text-lg">📋</span>
              Informações do Evento
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                <span className="text-muted-foreground">Cliente: </span>
                <span className="font-medium text-foreground">{appointment.client}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-lg">🏠</span>
                <span className="text-muted-foreground">Imóvel: </span>
                <span className="font-medium text-foreground">{appointment.property}</span>
              </div>
              
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <span className="text-muted-foreground">Endereço: </span>
                <span className="font-medium text-foreground">{appointment.address}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                <span className="text-muted-foreground">Data atual: </span>
                <span className="font-medium text-foreground">
                  {format(appointment.date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            </div>
          </div>

          {/* Data e Hora */}
          <div className="space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm dark:border-gray-700/60">
            <div className="flex items-center gap-2 mb-1">
              <CalendarIcon className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
              <Label className={`${LABEL_CLASS} font-medium text-foreground dark:text-gray-200`}>
                Nova Data e Horário <span className="text-red-500 dark:text-red-400">*</span>
              </Label>
            </div>

            {/* Seleção de Data */}
            <div className="space-y-3">
              <span className="text-sm text-muted-foreground">Nova data do evento</span>

              {selectedDate && (
                <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/80 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    <span className="font-medium text-emerald-900 dark:text-emerald-300">
                      {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border overflow-hidden dark:border-gray-700">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className="bg-card text-foreground dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Seleção de Horário */}
            <div className="space-y-3 border-t border-border/60 pt-4 dark:border-gray-700">
              <span className="text-sm text-muted-foreground">Novo horário do evento</span>

              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={`${FIELD_CLASS} pl-10`}
                />
              </div>

              {time && (
                <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/80 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    <span className="font-medium text-emerald-900 dark:text-emerald-300">
                      Novo horário: {time}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {selectedDate && time && (
              <div className="rounded-lg border border-emerald-200/60 bg-gradient-to-r from-emerald-50/90 to-emerald-100/50 p-4 mt-4 dark:border-emerald-800/40 dark:from-emerald-950/30 dark:to-emerald-900/20">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-full dark:bg-emerald-900/40">
                    <span className="text-lg">🔄</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-foreground dark:text-white mb-1">
                      Alteração confirmada para:
                    </div>
                    <div className="text-sm text-emerald-800 dark:text-emerald-300">
                      📅 {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })} às {time}
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                disabled={loading || !selectedDate || !time}
                className="btn-on-emerald sm:min-w-[180px] bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50"
                style={{ color: '#ffffff' }}
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
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 