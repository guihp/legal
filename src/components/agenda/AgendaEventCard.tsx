import { Clock, Edit, MapPin, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  formatAgendaTime,
  getAgentDotClass,
  getAgentInitial,
  getStatusBadgeClasses,
  getStatusLabel,
  getTypeBadgeClasses,
  isConfirmedStatus,
  isEventPastVisitThreshold,
  isVisitedStatus,
} from './helpers';

type Appointment = {
  id: number | string;
  date: Date;
  client: string;
  property: string;
  address: string;
  type: string;
  status: string;
  corretor?: string;
  phone?: string;
};

type Props = {
  appointment: Appointment;
  sortedAgentNames: string[];
  onConfirm: () => void;
  onMarkVisited: () => void;
  onReschedule: () => void;
  onChangeStatus: () => void;
  onDelete: () => void;
};

export function AgendaEventCard({
  appointment,
  sortedAgentNames,
  onConfirm,
  onMarkVisited,
  onReschedule,
  onChangeStatus,
  onDelete,
}: Props) {
  const agentName = appointment.corretor || 'Corretor';
  const dotClass = getAgentDotClass(agentName, sortedAgentNames);
  const confirmed = isConfirmedStatus(appointment.status);
  const visited = isVisitedStatus(appointment.status);
  const pastVisitWindow = isEventPastVisitThreshold(appointment.date);
  const showPrimaryAction = !confirmed && !visited;
  const visitMode = showPrimaryAction && pastVisitWindow;

  return (
    <div className="relative rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-800 dark:bg-emerald-600" aria-hidden />

      <div className="p-4 pl-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground tabular-nums">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {formatAgendaTime(appointment.date)}
          </span>
          <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', getTypeBadgeClasses(appointment.type))}>
            {appointment.type}
          </span>
          <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-semibold', getStatusBadgeClasses(appointment.status))}>
            {getStatusLabel(appointment.status)}
          </span>
        </div>

        <div>
          <h4 className="font-semibold text-foreground">{appointment.property}</h4>
          <div className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="break-words">{appointment.address}</span>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
            <span className="font-semibold text-foreground truncate">{appointment.client}</span>
            {appointment.phone ? (
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">{appointment.phone}</span>
            ) : null}
          </div>
          <div className="inline-flex items-center gap-2 min-w-0 max-w-full text-xs text-muted-foreground">
            <span
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white shrink-0',
                dotClass,
              )}
            >
              {getAgentInitial(agentName)}
            </span>
            <span className="truncate">{agentName}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {showPrimaryAction ? (
            <Button
              size="sm"
              onClick={visitMode ? onMarkVisited : onConfirm}
              className="btn-on-emerald rounded-lg h-8 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700"
              style={{ color: '#ffffff' }}
            >
              {visitMode ? 'Visitado' : 'Confirmar'}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={onReschedule}
            className="rounded-lg h-8 border-border bg-background shadow-sm"
          >
            Reagendar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-lg h-8 w-8 p-0 border-border bg-background shadow-sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border">
              <DropdownMenuItem onClick={onChangeStatus}>Alterar status</DropdownMenuItem>
              <DropdownMenuItem onClick={onReschedule}>
                <Edit className="mr-2 h-4 w-4" />
                Editar evento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-rose-600 focus:text-rose-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
