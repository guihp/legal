import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, MapPin, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { fetchUpcomingFromAgenda, AgendaEvent } from "@/services/agenda/events";

// Tipagem compartilhada vem de services/agenda/events

interface UpcomingAppointmentsProps {
  onViewAll?: () => void;
}

export function UpcomingAppointments({ onViewAll }: UpcomingAppointmentsProps) {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar próximos compromissos a partir do mesmo webhook da Agenda (próximos 7 dias)
  const fetchUpcomingEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const upcoming = await fetchUpcomingFromAgenda(7, 5, "Todos");
      setEvents(upcoming);
      
    } catch (error) {
      console.error("❌ Erro ao buscar próximos compromissos:", error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
      
      // Usar dados mock em caso de erro
      setEvents([
        {
          id: '1',
          date: new Date(Date.now() + 2 * 60 * 60 * 1000), // Em 2 horas
          client: "João Silva",
          property: "Apartamento Centro",
          address: "Rua das Flores, 123",
          type: "Visita",
          status: "Confirmado",
          corretor: "Isis"
        },
        {
          id: '2',
          date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Amanhã
          client: "Maria Santos",
          property: "Casa Jardim América", 
          address: "Av. Principal, 456",
          type: "Avaliação",
          status: "Aguardando confirmação",
          corretor: "Arthur"
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpcomingEvents();
    // Atualização periódica (sem Realtime, segue a Agenda)
    const interval = setInterval(fetchUpcomingEvents, 5 * 60 * 1000);
    return () => { clearInterval(interval); };
  }, []);

  // Função para determinar se o compromisso é urgente (próximas 2 horas)
  const isUrgent = (date: Date) => {
    const now = new Date();
    const diffHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours <= 2 && diffHours > 0;
  };

  // Função para formatar tempo relativo
  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `em ${diffMinutes} min`;
    } else if (diffHours < 24) {
      return `em ${Math.floor(diffHours)}h`;
    } else if (diffDays < 7) {
      return `em ${Math.floor(diffDays)} dia${diffDays >= 2 ? 's' : ''}`;
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };

  // Função para obter cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmado': return 'text-green-400';
      case 'Aguardando confirmação': return 'text-yellow-400';
      case 'Cancelado': return 'text-red-400';
      case 'Talvez': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  // Função para obter ícone do status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Confirmado': return <CheckCircle2 className="h-3 w-3" />;
      case 'Aguardando confirmação': return <Clock className="h-3 w-3" />;
      case 'Cancelado': return <AlertCircle className="h-3 w-3" />;
      case 'Talvez': return <AlertCircle className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-white flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-400" />
          Próximos Compromissos
        </CardTitle>
        {onViewAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 h-8 px-3"
          >
            Ver todos
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-gray-700/30 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400 text-sm mb-2">Erro ao carregar compromissos</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUpcomingEvents}
              className="text-gray-300 border-gray-600 hover:bg-gray-700"
            >
              Tentar novamente
            </Button>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-500 mx-auto mb-3 opacity-50" />
            <p className="text-gray-400 text-sm mb-2">Nenhum compromisso próximo</p>
            <p className="text-gray-500 text-xs">Que tal agendar uma nova visita?</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className={`p-3 rounded-lg border transition-all duration-200 hover:border-gray-500/60 ${
                  isUrgent(event.date)
                    ? 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/15'
                    : 'bg-gray-700/30 border-gray-600/40 hover:bg-gray-700/50'
                }`}
              >
                {/* Header com horário e status */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className={`h-4 w-4 ${isUrgent(event.date) ? 'text-orange-400' : 'text-blue-400'}`} />
                    <span className={`text-sm font-medium ${isUrgent(event.date) ? 'text-orange-300' : 'text-white'}`}>
                      {event.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-xs text-gray-400">
                      {getRelativeTime(event.date)}
                    </span>
                    {isUrgent(event.date) && (
                      <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-300 rounded-full">
                        Urgente
                      </span>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${getStatusColor(event.status)}`}>
                    {getStatusIcon(event.status)}
                    <span className="hidden sm:inline">{event.status}</span>
                  </div>
                </div>

                {/* Informações do evento */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    <span className="text-white text-sm font-medium truncate">{event.client}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      event.type === 'Visita' ? 'bg-blue-500/20 text-blue-300' :
                      event.type === 'Avaliação' ? 'bg-purple-500/20 text-purple-300' :
                      event.type === 'Apresentação' ? 'bg-orange-500/20 text-orange-300' :
                      event.type === 'Vistoria' ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-gray-500/20 text-gray-300'
                    }`}>
                      {event.type}
                    </div>
                    <span className="text-gray-300 text-sm truncate">{event.property}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3 w-3 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-400 text-xs truncate">{event.address}</span>
                  </div>
                  {event.corretor && (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        event.corretor === 'Isis' ? 'bg-pink-500/20 text-pink-300' :
                        event.corretor === 'Arthur' ? 'bg-indigo-500/20 text-indigo-300' :
                        'bg-gray-500/20 text-gray-300'
                      }`}>
                        {event.corretor === 'Isis' ? '👩‍💼' : event.corretor === 'Arthur' ? '👨‍💼' : '👤'} {event.corretor}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 