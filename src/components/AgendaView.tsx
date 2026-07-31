import { useState, useEffect, useRef, useMemo } from "react";
import { AppointmentCalendar } from "@/components/AppointmentCalendar";
import { AddEventModal } from "@/components/AddEventModal";
import { useProperties } from "@/hooks/useProperties";
import { logAudit } from "@/lib/audit/logger";
import { useClients } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { invokeEdge } from "@/integrations/supabase/invoke";
import { toast } from "sonner";
import { resolveAgendaEventCorretor } from "@/lib/agendaCorretor";
import { AgendaTopBar } from "@/components/agenda/AgendaTopBar";
import { AgendaToolbar } from "@/components/agenda/AgendaToolbar";
import { AgendaKpis } from "@/components/agenda/AgendaKpis";
import { AgendaFilters } from "@/components/agenda/AgendaFilters";
import {
  buildAgendaKpis,
  filterEventsByStatus,
  getAgentDotClass,
  resolveAgendaEventStatus,
  type AgendaStatusFilter,
  type AgendaViewMode,
} from "@/components/agenda/helpers";

interface AgendaEvent {
  id: number | string;
  date: Date;
  client: string;
  property: string;
  address: string;
  type: string;
  status: string;
  corretor?: string; // Campo opcional para identificar o corretor
  calendarId?: string; // ID do Google Calendar associado ao evento
  channel?: string; // Canal de origem do agendamento (WhatsApp, Instagram, Facebook, etc)
  phone?: string;
  leadId?: string;
}

type AgendaCalendarOption = {
  id: string;
  full_name: string;
  accessRole?: string;
  canWrite?: boolean;
  brokerName?: string | null;
  _assigned_user_id?: string | null;
};

const UNKNOWN_CLIENT = 'Cliente não informado';

function isUnknownClientName(value: unknown): boolean {
  const text = String(value || '').trim();
  return !text || text === UNKNOWN_CLIENT;
}

function pickLeadDisplayName(lead: any): string {
  return String(
    lead?.name ||
    lead?.nome_instagram_cliente ||
    lead?.arroba_instagram_cliente ||
    lead?.email ||
    lead?.phone ||
    ''
  ).trim();
}

function getEventContactFallback(event: any): string {
  const privateProps = event?.extendedProperties?.private || {};
  const handle = String(privateProps.client_handle || '').trim();
  const email =
    String(privateProps.client_email || '').trim() ||
    String(event?.attendees?.find((attendee: any) => attendee?.email)?.email || '').trim() ||
    String(event?.creator?.email || '').trim() ||
    String(event?.organizer?.email || '').trim();

  return handle || email || 'Contato do calendário';
}

export function AgendaView() {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date()); // Controlar mês atual
  const [isConnected, setIsConnected] = useState(false);
  const [connectedGoogleEmail, setConnectedGoogleEmail] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [selectedAgenda, setSelectedAgenda] = useState<string>("Todos"); // ID do calendário selecionado ou 'Todos'
  const [selectedAgendaName, setSelectedAgendaName] = useState<string>("Todos os calendários");
  const [corretores, setCorretores] = useState<AgendaCalendarOption[]>([]);
  const [loadingCorretores, setLoadingCorretores] = useState(false);
  const [viewMode, setViewMode] = useState<AgendaViewMode>("month");
  const [statusFilter, setStatusFilter] = useState<AgendaStatusFilter>("all");
  const [syncing, setSyncing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchInFlightRef = useRef(false);

  // Buscar propriedades e clientes existentes
  const { properties } = useProperties();
  const { clients } = useClients();
  const { getCompanyUsers, profile } = useUserProfile();

  const checkGoogleConnectionStatus = async () => {
    try {
      const { data: integration } = await supabase
        .from("company_google_calendar_integrations")
        .select("google_email")
        .maybeSingle();

      const connected = !!integration;
      setIsConnected(connected);
      setConnectedGoogleEmail(integration?.google_email || null);

      if (!connected) {
        setCorretores([]);
      }
    } catch {
      setIsConnected(false);
      setConnectedGoogleEmail(null);
      setCorretores([]);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      setConnectingGoogle(true);
      const redirectUri = `${window.location.origin}/auth/google/callback`;
      const { data, error } = await invokeEdge<any, any>("google-calendar-auth", {
        body: { action: "get_auth_url", redirect_uri: redirectUri },
      });
      if (error) throw new Error(error.message || "Falha ao iniciar conexão Google");
      if (!data?.auth_url) throw new Error("URL de autorização não retornada");
      window.location.href = data.auth_url;
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível conectar Google Calendar");
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      setConnectingGoogle(true);
      const { data, error } = await invokeEdge<any, any>("google-calendar-auth", {
        body: { action: "disconnect" },
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || "Falha ao desconectar Google Calendar");
      }

      setIsConnected(false);
      setConnectedGoogleEmail(null);
      setCorretores([]);
      setSelectedAgenda("Todos");
      setSelectedAgendaName("Todos os calendários");
      toast.success("Google Calendar desconectado com sucesso");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível desconectar Google Calendar");
    } finally {
      setConnectingGoogle(false);
    }
  };

  // Função para carregar calendários (mesma fonte do Plantão > Calendários)
  const loadCorretores = async (): Promise<AgendaCalendarOption[]> => {
    try {
      setLoadingCorretores(true);
      console.log('🔍 Carregando calendários da Agenda (Plantão > Calendários)...');

      // 1. Obter dados do usuário e empresa PRIMEIRO
      const { data: { user } } = await supabase.auth.getUser();
      let companyId = null;
      let userRole = null;

      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id, role')
          .eq('id', user.id)
          .single();
        companyId = profile?.company_id;
        userRole = profile?.role;
      }

      const { data: edgeData, error: edgeError } = await invokeEdge<any, any>("google-calendar-api", {
        body: { action: "list_calendars" },
      });
      if (edgeError) throw new Error(edgeError.message || "Falha ao carregar calendários Google");
      const list: any[] = Array.isArray(edgeData?.calendars) ? edgeData.calendars : [];
      setIsConnected(true);
      setConnectedGoogleEmail(edgeData?.google_email || null);

      const normalized: AgendaCalendarOption[] = list.map((item: any) => ({
        id: item?.id ?? "",
        full_name: item?.name ?? "Sem nome",
        accessRole: item?.accessRole || "",
        canWrite: ["owner", "writer"].includes(String(item?.accessRole || "").toLowerCase()),
        brokerName: null,
        _assigned_user_id: null,
      }));

      console.log(`✅ Encontrados ${normalized.length} calendários.`);

      // 3. Filtragem por empresa e perfil (Reusando dados obtidos)
      // IMPORTANTE: O N8N já filtra por company_id, então todos os calendários retornados
      // já são da empresa correta. A filtragem aqui é apenas por role do usuário.
      let finalAndRel = normalized;

      if (companyId) {
        // Buscar vínculos no banco (corretor atribuído ao calendário)
        const { data: schedules } = await supabase
          .from('oncall_schedules')
          .select('calendar_id, assigned_user_id, assigned_user:assigned_user_id(full_name)')
          .eq('company_id', companyId);

        const brokerByCalendar = new Map<string, { userId: string | null; name: string | null }>();
        for (const s of schedules || []) {
          const calId = String((s as any).calendar_id || "");
          if (!calId) continue;
          const profile = (s as any).assigned_user;
          const name = String(profile?.full_name || "").trim() || null;
          brokerByCalendar.set(calId, {
            userId: (s as any).assigned_user_id || null,
            name,
          });
        }

        for (const cal of normalized) {
          const link = brokerByCalendar.get(cal.id);
          if (!link) continue;
          cal._assigned_user_id = link.userId;
          if (link.name) {
            cal.brokerName = link.name;
            // Badge/lista: preferir nome do corretor vinculado ao nome genérico do calendário
            cal.full_name = link.name;
          }
        }

        if (userRole === 'corretor') {
          // Corretor: apenas as vinculadas a ele
          const myIds = schedules
            ?.filter(s => s.assigned_user_id === user?.id)
            .map(s => s.calendar_id) || [];
          
          finalAndRel = normalized.filter(c => 
            c._assigned_user_id === user?.id || myIds.includes(c.id)
          );
          console.log(`🔐 Corretor: ${finalAndRel.length} calendários permitidos.`);
        } else {
          // Gestor/Admin: TODOS os calendários que vêm do N8N
          finalAndRel = normalized;
          console.log(`🔐 Gestor/Admin: ${finalAndRel.length} calendários permitidos (todos da empresa via N8N).`);
        }
      } else {
        // Se não tiver companyId, não mostrar nada por segurança
        finalAndRel = [];
      }


      setCorretores(finalAndRel);
      return finalAndRel;
    } catch (error) {
      console.error('❌ Erro ao carregar calendários:', error);
      setCorretores([]);
      return [];
    } finally {
      setLoadingCorretores(false);
    }
  };

  // Função para salvar evento nas notas do cliente (fallback)
  const saveEventToClientNotes = async (eventInfo: {
    eventId: string;
    summary: string;
    description: string;
    startTime: string;
    location: string;
    clientId: string;
    clientName: string;
    corretorName: string;
    eventType: string;
  }) => {
    try {
      const eventDate = new Date(eventInfo.startTime);
      const eventNote = `
[EVENTO AGENDADO] ${eventInfo.eventType} - ${eventInfo.summary}
📅 Data: ${eventDate.toISOString()}
📍 Local: ${eventInfo.location}
👤 Corretor: ${eventInfo.corretorName}
📝 Descrição: ${eventInfo.description}
🆔 ID: ${eventInfo.eventId}
⏰ Criado em: ${new Date().toISOString()}
`;

      const { data: client, error: fetchError } = await supabase
        .from('leads')
        .select('notes')
        .eq('id', eventInfo.clientId)
        .single();

      if (fetchError) {
        console.error('❌ Erro ao buscar cliente para fallback:', fetchError);
        return;
      }

      const currentNotes = client?.notes || '';
      const updatedNotes = currentNotes + '\n\n' + eventNote;

      const { error: updateError } = await supabase
        .from('leads')
        .update({ notes: updatedNotes })
        .eq('id', eventInfo.clientId);

      if (updateError) {
        console.error('❌ Erro ao salvar evento nas notas:', updateError);
      } else {
        console.log('✅ Evento salvo nas notas do cliente como fallback');
      }
    } catch (error) {
      console.error('❌ Erro no fallback para notas:', error);
    }
  };

  // Função para salvar evento na tabela oncall_events
  const saveEventToDatabase = async (eventData: {
    event_id: string;
    summary: string;
    description: string;
    start_time: string;
    end_time: string;
    location: string;
    attendee_email: string;
    attendee_name: string;
    property_id: string;
    property_title: string;
    client_id: string;
    client_name: string;
    corretor_name: string;
    event_type: string;
    status: string;
  }) => {
    try {
      // Buscar o user_id e company_id do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Buscar o profile do usuário para obter company_id
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        throw new Error('Profile do usuário não encontrado');
      }

      // Encontrar o assigned_user_id baseado no corretor_name
      let assignedUserId = null;
      if (eventData.corretor_name && eventData.corretor_name !== 'Não informado') {
        try {
          const { data: corretorProfile, error: corretorError } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('company_id', profile.company_id)
            .ilike('full_name', `%${eventData.corretor_name}%`)
            .maybeSingle();

          if (corretorError) {
            console.warn('❌ Erro ao buscar corretor:', corretorError.message);
          } else if (corretorProfile) {
            assignedUserId = corretorProfile.id;
            console.log('✅ Corretor encontrado:', corretorProfile.id);
          } else {
            console.warn('⚠️ Corretor não encontrado:', eventData.corretor_name);
          }
        } catch (error) {
          console.warn('❌ Erro na busca do corretor:', error);
        }
      }

      // A tabela oncall_events já foi criada na migration anterior
      console.log('✅ Procedendo com inserção na tabela oncall_events...');

      const insertData = {
        title: eventData.summary,
        description: eventData.description,
        starts_at: eventData.start_time,
        ends_at: eventData.end_time,
        client_name: eventData.client_name,
        client_email: eventData.attendee_email,
        property_id: eventData.property_id,
        property_title: eventData.property_title,
        address: eventData.location,
        type: eventData.event_type,
        status: eventData.status,
        google_event_id: eventData.event_id.startsWith('local_') ? null : eventData.event_id,
        webhook_source: eventData.event_id.startsWith('local_') ? 'local' : 'google',
        company_id: profile.company_id.toString(),
        user_id: user.id.toString(),
        assigned_user_id: assignedUserId ? assignedUserId.toString() : null
      };

      console.log('📤 Dados para inserção na oncall_events:', insertData);

      // Salvar evento na tabela oncall_events
      const { data, error } = await supabase
        .from('oncall_events')
        .insert(insertData)
        .select();

      if (error) {
        console.error('❌ Erro ao salvar na tabela oncall_events:', error);
        console.log('⚠️ Tentando fallback para notas do cliente...');

        // Fallback: salvar nas notas do cliente
        await saveEventToClientNotes({
          eventId: eventData.event_id,
          summary: eventData.summary,
          description: eventData.description,
          startTime: eventData.start_time,
          location: eventData.location,
          clientId: eventData.client_id,
          clientName: eventData.client_name,
          corretorName: eventData.corretor_name,
          eventType: eventData.event_type
        });

        return { id: eventData.event_id, fallback: true };
      }

      console.log('✅ Evento salvo na tabela oncall_events:', data?.[0]);
      return data?.[0];

    } catch (error) {
      console.error('❌ Erro ao salvar evento no banco:', error);
      throw error;
    }
  };

  // REMOVIDO: leitura e mescla de eventos locais (oncall_events) para simplificar a Agenda
  // Consulta de eventos exclusivamente via Edge Function google-calendar-api

  // REMOVIDO: leitura de eventos a partir de notas locais para simplificação

  const fetchAgendaEvents = async (
    date: Date,
    isAutoUpdate = false,
    calendarIdsOverride?: string[],
  ) => {
    if (fetchInFlightRef.current && isAutoUpdate) return;

    try {
      fetchInFlightRef.current = true;

      if (!isAutoUpdate) {
        console.log('🔄 Carregando eventos para:', date.toLocaleDateString('pt-BR'));
        setLoading(true);
      }
      setError(null);

      // Calcular primeiro e último dia do mês
      const year = date.getFullYear();
      const month = date.getMonth();

      // Primeiro dia do mês às 00:01 (horário local)
      const dataInicial = new Date(year, month, 1, 0, 1, 0, 0);

      // Último dia do mês às 23:59 (horário local)
      const ultimoDiaDoMes = new Date(year, month + 1, 0).getDate();
      const dataFinal = new Date(year, month, ultimoDiaDoMes, 23, 59, 59, 999);

      // Converter para strings ISO mas mantendo o horário local
      const dataInicialFormatada = new Date(dataInicial.getTime() - (dataInicial.getTimezoneOffset() * 60000)).toISOString();
      const dataFinalFormatada = new Date(dataFinal.getTime() - (dataFinal.getTimezoneOffset() * 60000)).toISOString();

      // Montar body conforme regra: tipo_busca e agenda_ids
      const isTodos = selectedAgenda === 'Todos';
      const agendaIds =
        calendarIdsOverride ??
        (isTodos ? corretores.map((c) => c.id).filter(Boolean) : [selectedAgenda]);

      if (isTodos && agendaIds.length === 0) {
        if (loadingCorretores) return;
        setEvents([]);
        setLastUpdate(new Date());
        return;
      }

      if (!isAutoUpdate) {
        console.log("📤 Buscando eventos via google-calendar-api");
      }
      const { data: edgeData, error: edgeError } = await invokeEdge<any, any>("google-calendar-api", {
        body: {
          action: "list_events",
          calendar_ids: agendaIds,
          time_min: dataInicialFormatada,
          time_max: dataFinalFormatada,
        },
      });
      if (edgeError) throw new Error(edgeError.message || "Falha ao listar eventos do Google");
      const data = edgeData?.events || [];
      if (!isAutoUpdate) {
        console.log("✅ Dados da agenda recebidos:", Array.isArray(data) ? data.length : "formato não reconhecido");
      }

      // Processar os dados recebidos do Google Calendar
      let processedEvents: AgendaEvent[] = [];

      // Primeira filtragem: remover objetos vazios ou inválidos
      const cleanData = Array.isArray(data) ? data.filter(event => {
        // Verificar se é um objeto vazio {}
        if (!event || typeof event !== 'object') {
          // Objeto nulo removido
          return false;
        }

        // Verificar se tem propriedades
        const keys = Object.keys(event);
        if (keys.length === 0) {
          // Objeto vazio removido
          return false;
        }

        // Verificar se tem dados essenciais do Google Calendar
        if (!event.summary && !event.start && !event.id) {
          // Evento sem dados essenciais removido
          return false;
        }

        return true;
      }) : [];

      if (Array.isArray(cleanData) && cleanData.length > 0) {
        if (!isAutoUpdate) console.log(`📋 Processando ${cleanData.length} eventos válidos`);
        processedEvents = await Promise.all(cleanData.map(async (event: any, index: number) => {
          // Processando evento...

          // 1. Extrair horário (usar start.dateTime)
          const startDateTime = event.start?.dateTime || event.start?.date;
          const eventDate = startDateTime ? new Date(startDateTime) : new Date();

          // 2. Extrair summary e description
          const summary = event.summary || 'Evento sem título';
          const description = event.description || 'Descrição não disponível';

          // 3. Extrair cliente da description com múltiplas estratégias
          let clientName = UNKNOWN_CLIENT;
          let eventChannel = '';
          let clientPhone = '';

          // Estratégia 0 (PRIORIDADE): extendedProperties.private.client_name (fonte canônica da API)
          if (event.extendedProperties?.private?.client_name) {
            clientName = String(event.extendedProperties.private.client_name).trim();
          }
          
          // Estratégia 1: Regex melhorado para capturar "com o cliente NOME" ou "com a cliente NOME"
          if (isUnknownClientName(clientName)) {
            const clientMatch1 = description.match(/com (?:o cliente |a cliente )?([^(\n\r]+?)(?:\s*\(|$)/i);
            if (clientMatch1 && clientMatch1[1]) {
              clientName = clientMatch1[1].trim();
            }
          }
          
          // Estratégia 2: Buscar padrão "Cliente: NOME" ou "Cliente - NOME"
          if (isUnknownClientName(clientName)) {
            const clientMatch2 = description.match(/(?:cliente|client)[:-]\s*([^\n\r(]+?)(?:\s*\(|$)/i);
            if (clientMatch2 && clientMatch2[1]) {
              clientName = clientMatch2[1].trim();
            }
          }
          
          // Estratégia 3: Buscar no summary se tiver padrão "TÍTULO - NOME DO CLIENTE"
          if (isUnknownClientName(clientName) && summary.includes(' - ')) {
            const parts = summary.split(' - ');
            if (parts.length >= 2) {
              const potentialClient = parts[parts.length - 1].trim();
              if (potentialClient.length >= 3 && potentialClient.length <= 50) {
                clientName = potentialClient;
              }
            }
          }
          
          // Estratégia 4: Buscar padrão entre parênteses no summary ou description
          if (isUnknownClientName(clientName)) {
            const parenMatch = (summary + ' ' + description).match(/\(([^)]{3,50})\)/);
            if (parenMatch && parenMatch[1]) {
              const potentialClient = parenMatch[1].trim();
              if (!/\d/.test(potentialClient) && !potentialClient.includes('http')) {
                clientName = potentialClient;
              }
            }
          }
          
          // Limpar o nome do cliente (remover espaços extras, caracteres especiais no final)
          if (!isUnknownClientName(clientName)) {
            clientName = clientName.replace(/\s+/g, ' ').trim();
            clientName = clientName.replace(/[.,;:!?]+$/, '').trim();
          }

          // 3.5. Se ainda não encontrou o cliente, buscar na tabela leads pelo email do evento
          // Também buscar nome_instagram_cliente como fallback e source para o canal
          let resolvedLeadId = event.extendedProperties?.private?.lead_id
            ? String(event.extendedProperties.private.lead_id)
            : '';
          if (profile?.company_id) {
            try {
              let eventEmail: string | null = null;
              
              if (event.attendees && event.attendees.length > 0 && event.attendees[0].email) {
                eventEmail = event.attendees[0].email.toLowerCase().trim();
              } else if (event.creator?.email) {
                eventEmail = event.creator.email.toLowerCase().trim();
              } else if (event.organizer?.email) {
                eventEmail = event.organizer.email.toLowerCase().trim();
              }

              // Tentar buscar por lead_id (extendedProperties) primeiro, senão por email
              const leadId = event.extendedProperties?.private?.lead_id || '';
              let lead: any = null;

              if (leadId) {
                const { data: leadById } = await supabase
                  .from('leads')
                  .select('id, name, email, phone, nome_instagram_cliente, arroba_instagram_cliente, source')
                  .eq('id', leadId)
                  .eq('company_id', profile.company_id)
                  .maybeSingle();
                lead = leadById;
              }

              if (!lead && eventEmail) {
                const { data: leadByEmail } = await supabase
                  .from('leads')
                  .select('id, name, email, phone, nome_instagram_cliente, arroba_instagram_cliente, source')
                  .eq('company_id', profile.company_id)
                  .ilike('email', eventEmail)
                  .limit(1)
                  .maybeSingle();
                lead = leadByEmail;
              }

              if (lead) {
                if (lead.id) resolvedLeadId = String(lead.id);
                // Preencher nome se ainda não encontrado
                if (isUnknownClientName(clientName)) {
                  clientName = pickLeadDisplayName(lead) || UNKNOWN_CLIENT;
                }
                // Preencher canal de origem
                if (lead.source) {
                  eventChannel = lead.source;
                }
                if (lead.phone) {
                  clientPhone = String(lead.phone).trim();
                }
              }
            } catch (error) {
              console.debug('Erro ao buscar cliente na tabela leads:', error);
            }
          }

          if (isUnknownClientName(clientName)) {
            clientName = getEventContactFallback(event);
          }

          // 4. Extrair tipo do evento da description
          let eventType = 'Reunião';
          const descLower = description.toLowerCase();
          if (descLower.includes('visita')) eventType = 'Visita';
          else if (descLower.includes('avaliação') || descLower.includes('avaliacao')) eventType = 'Avaliação';
          else if (descLower.includes('apresentação') || descLower.includes('apresentacao')) eventType = 'Apresentação';
          else if (descLower.includes('vistoria')) eventType = 'Vistoria';

          // 5. Extrair status dos attendees (responseStatus)
          let attendeeStatus = 'agendada';
          if (event.attendees && event.attendees.length > 0) {
            const responseStatus = event.attendees[0].responseStatus;
            switch (responseStatus) {
              case 'needsAction':
                attendeeStatus = 'Aguardando confirmação';
                break;
              case 'accepted':
                attendeeStatus = 'Confirmado';
                break;
              case 'declined':
                attendeeStatus = 'Recusado';
                break;
              case 'tentative':
                attendeeStatus = 'Talvez';
                break;
              default:
                attendeeStatus = 'Agendada';
            }
          }

          // 6. Extrair localização
          const location = event.location || 'Local não informado';

          // 7. Corretor: calendarId (Todos) / broker_name / descrição — sem hardcode Isis/Arthur
          const calendarId: string | undefined =
            event.calendarId || event.calendar_id || event.organizer?.id || event.creator?.id || event.calendar?.id;
          const corretor = resolveAgendaEventCorretor({
            event,
            description,
            selectedAgenda,
            selectedAgendaName,
            calendars: corretores,
          });

          const processedEvent = {
            id: event.id || `event_${index + 1}`,
            date: eventDate,
            client: clientName,
            property: summary,
            address: location,
            type: eventType,
            status: resolveAgendaEventStatus(attendeeStatus, event.extendedProperties?.private),
            corretor: corretor,
            calendarId: calendarId || (selectedAgenda !== 'Todos' ? selectedAgenda : undefined),
            channel: eventChannel || undefined,
            phone: clientPhone || undefined,
            leadId: resolvedLeadId || undefined,
          };

          // Evento processado com sucesso

          return processedEvent;
        }));
      } else if (data.events && Array.isArray(data.events)) {
        if (!isAutoUpdate) console.log('📋 Processando eventos (formato alternativo)...');
        processedEvents = await Promise.all(data.events.map(async (event: any, index: number) => {
          const summary = event.summary || 'Evento sem título';
          const startDateTime = event.start?.dateTime || event.start?.date;
          const eventDate = startDateTime ? new Date(startDateTime) : new Date();

          // Extrair cliente: prioridade extendedProperties > leads.name > leads.nome_instagram_cliente
          let clientName = event.extendedProperties?.private?.client_name || UNKNOWN_CLIENT;
          let eventChannel = '';
          let clientPhone = '';
          let resolvedLeadId = event.extendedProperties?.private?.lead_id
            ? String(event.extendedProperties.private.lead_id)
            : '';
          if (profile?.company_id) {
            try {
              let eventEmail: string | null = null;
              if (event.attendees && event.attendees.length > 0 && event.attendees[0].email) {
                eventEmail = event.attendees[0].email.toLowerCase().trim();
              } else if (event.creator?.email) {
                eventEmail = event.creator.email.toLowerCase().trim();
              } else if (event.organizer?.email) {
                eventEmail = event.organizer.email.toLowerCase().trim();
              }

              const leadId = event.extendedProperties?.private?.lead_id || '';
              let lead: any = null;
              if (leadId) {
                const { data: leadById } = await supabase
                  .from('leads')
                  .select('id, name, email, phone, nome_instagram_cliente, arroba_instagram_cliente, source')
                  .eq('id', leadId)
                  .eq('company_id', profile.company_id)
                  .maybeSingle();
                lead = leadById;
              }
              if (!lead && eventEmail) {
                const { data: leadByEmail } = await supabase
                  .from('leads')
                  .select('id, name, email, phone, nome_instagram_cliente, arroba_instagram_cliente, source')
                  .eq('company_id', profile.company_id)
                  .ilike('email', eventEmail)
                  .limit(1)
                  .maybeSingle();
                lead = leadByEmail;
              }
              if (lead) {
                if (lead.id) resolvedLeadId = String(lead.id);
                if (isUnknownClientName(clientName)) {
                  clientName = pickLeadDisplayName(lead) || UNKNOWN_CLIENT;
                }
                if (lead.source) eventChannel = lead.source;
                if (lead.phone) clientPhone = String(lead.phone).trim();
              }
            } catch (error) {
              console.debug('Erro ao buscar cliente na tabela leads:', error);
            }
          }

          if (isUnknownClientName(clientName)) {
            clientName = getEventContactFallback(event);
          }

          // Corretor via calendarId / broker_name / descrição
          const calendarId: string | undefined =
            (event as any).calendarId ||
            (event as any).calendar_id ||
            (event as any).organizer?.id ||
            (event as any).creator?.id ||
            (event as any).calendar?.id ||
            (selectedAgenda !== 'Todos' ? selectedAgenda : undefined);
          const corretor = resolveAgendaEventCorretor({
            event,
            description: event.description || '',
            selectedAgenda,
            selectedAgendaName,
            calendars: corretores,
          });

          return {
            id: event.id || `event_${index + 1}`,
            date: eventDate,
            client: clientName,
            property: summary,
            address: 'Endereço será confirmado',
            type: 'Visita',
            status: resolveAgendaEventStatus(
              event.status === 'confirmed' ? 'confirmada' : 'agendada',
              event.extendedProperties?.private,
            ),
            corretor: corretor,
            calendarId,
            channel: eventChannel || undefined,
            phone: clientPhone || undefined,
            leadId: resolvedLeadId || undefined,
          };
        }));
      } else {
        console.log('⚠️ Formato de resposta não reconhecido, usando dados mock');
      }

      // Validação final: filtrar eventos com dados válidos
      const validEvents = processedEvents.filter(event => {
        // Verificar se tem dados essenciais
        if (!event.id || !event.date || !event.client || !event.property) {
          // Evento inválido removido
          return false;
        }

        // Verificar se os campos não são strings vazias
        if (typeof event.client === 'string' && event.client.trim() === '') {
          // Evento com cliente vazio removido
          return false;
        }

        if (typeof event.property === 'string' && event.property.trim() === '') {
          // Evento com propriedade vazia removido
          return false;
        }

        // Verificar se a data é válida
        if (!(event.date instanceof Date) || isNaN(event.date.getTime())) {
          // Evento com data inválida removido
          return false;
        }

        return true;
      });

      // Usar somente os eventos retornados pelo endpoint (sem mesclas adicionais)
      setEvents(validEvents);
      setIsConnected(true);
      setLastUpdate(new Date());
      if (!isAutoUpdate) console.log('✅ Agenda atualizada com sucesso (google-calendar-api)');

    } catch (error) {
      console.log('⚠️ Falha ao carregar eventos da agenda:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
    }
  };

  // UseEffect para carregamento inicial dos corretores
  useEffect(() => {
    checkGoogleConnectionStatus();
  }, []);

  useEffect(() => {
    loadCorretores();
  }, []);

  // Busca eventos após calendários carregarem (evita calendar_ids vazio em "Todos")
  useEffect(() => {
    if (selectedAgenda === 'Todos' && loadingCorretores) return;

    (async () => {
      try {
        if (profile?.role === 'corretor' && selectedAgenda === 'Todos') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            const { data: schedules } = await supabase
              .from('oncall_schedules')
              .select('calendar_id, calendar_name')
              .eq('assigned_user_id', user.id);
            if (schedules && schedules.length > 0 && schedules[0]?.calendar_id) {
              setSelectedAgenda(schedules[0].calendar_id);
              setSelectedAgendaName(schedules[0].calendar_name || 'Minha agenda');
              return;
            }
            console.warn('⚠️ Corretor sem agenda vinculada. Não exibindo eventos.');
            setEvents([]);
            setIsConnected(true);
            setLastUpdate(new Date());
            return;
          }
        }

        const calendarIds =
          selectedAgenda === 'Todos'
            ? corretores.map((c) => c.id).filter(Boolean)
            : [selectedAgenda];

        await fetchAgendaEvents(currentMonth, false, calendarIds);
      } catch (e) {
        console.warn('⚠️ Falha ao processar carregamento da agenda:', e);
      }
    })();
  }, [currentMonth, selectedAgenda, profile?.role, corretores, loadingCorretores]);

  // Atualização automática a cada 30s (somente após calendários carregados)
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const canPoll =
      selectedAgenda !== 'Todos' || (!loadingCorretores && corretores.length > 0);
    if (!canPoll) return;

    intervalRef.current = setInterval(() => {
      fetchAgendaEvents(currentMonth, true);
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentMonth, selectedAgenda, corretores, loadingCorretores]);

  const handleDateChange = (date: Date) => {
    console.log('📅 Data selecionada no calendário:', date.toLocaleDateString('pt-BR'));
    setSelectedDate(date);

    // Verificar se a data selecionada é de um mês diferente do atual
    const selectedMonth = date.getMonth();
    const selectedYear = date.getFullYear();
    const currentDisplayMonth = currentMonth.getMonth();
    const currentDisplayYear = currentMonth.getFullYear();

    if (selectedMonth !== currentDisplayMonth || selectedYear !== currentDisplayYear) {
      console.log('🔄 Data de mês diferente detectada - buscando eventos do novo mês');
      const newMonthDate = new Date(selectedYear, selectedMonth, 1);
      setCurrentMonth(newMonthDate);
      // Isto irá disparar o useEffect para buscar eventos do novo mês
    }
  };

  const handleMonthChange = (newMonth: Date) => {
    console.log('📅 Mudança de mês detectada:', newMonth.toLocaleDateString('pt-BR'));
    setCurrentMonth(new Date(newMonth.getFullYear(), newMonth.getMonth(), 1));
    // Isto irá disparar o useEffect para buscar eventos do novo mês
  };

  const handleRefreshAgenda = async () => {
    try {
      setSyncing(true);
      const loadedCorretores = await loadCorretores();
      const calendarIds =
        selectedAgenda === 'Todos'
          ? loadedCorretores.map((c) => c.id).filter(Boolean)
          : [selectedAgenda];
      await fetchAgendaEvents(currentMonth, false, calendarIds);
    } catch (e) {
      console.warn('⚠️ Falha ao atualizar agenda:', e);
      toast.error('Não foi possível atualizar a agenda');
    } finally {
      setSyncing(false);
    }
  };

  // Atualização manual solicitada por filhos (ex.: após editar/deletar/criar)
  const refreshEvents = () => {
    const calendarIds =
      selectedAgenda === 'Todos'
        ? corretores.map((c) => c.id).filter(Boolean)
        : [selectedAgenda];
    fetchAgendaEvents(currentMonth, true, calendarIds);
  };

  const handleEventStatusChange = (eventId: number | string, status: string) => {
    setEvents((prev) =>
      prev.map((event) => (event.id === eventId ? { ...event, status } : event)),
    );
  };

  const handleAddEvent = async (eventData: {
    propertyId: string;
    clientId: string;
    email: string;
    date: Date;
    time: string;
    type: string;
    corretor: string;
    listingId?: string;
  }) => {
    // Declarar variáveis fora do try para serem acessíveis no catch
    let property = null;
    let propertyTitle = '';
    let propertyAddress = '';
    let client = null;

    try {
      console.log('📝 Criando novo evento:', eventData);
      console.log('📊 Properties disponíveis no momento:', properties?.length || 0);
      console.log('📊 Clients disponíveis no momento:', clients?.length || 0);

      // Encontrar dados do imóvel e cliente selecionados
      // Priorizar listingId se disponível, senão usar propertyId
      if (eventData.listingId) {
        // Buscar imóvel via Viva Real - tentar como string e como número
        try {
          let imovelVivaReal = null;
          let errorVivaReal = null;

          // Primeira tentativa: como string
          const resultString = await supabase
            .from('imoveisvivareal')
            .select('listing_id, tipo_imovel, descricao, endereco, cidade')
            .eq('listing_id', String(eventData.listingId))
            .single();

          if (resultString.data) {
            imovelVivaReal = resultString.data;
          } else {
            // Segunda tentativa: como número (se for válido)
            const numericId = Number(eventData.listingId);
            if (!isNaN(numericId)) {
              const resultNumber = await supabase
                .from('imoveisvivareal')
                .select('listing_id, tipo_imovel, descricao, endereco, cidade')
                .eq('listing_id', numericId)
                .single();
              imovelVivaReal = resultNumber.data;
              errorVivaReal = resultNumber.error;
            } else {
              errorVivaReal = resultString.error;
            }
          }

          console.log('📊 Resultado busca Viva Real - data:', imovelVivaReal, 'error:', errorVivaReal);

          if (imovelVivaReal) {
            propertyTitle = `${imovelVivaReal.tipo_imovel || 'Imóvel'} (ID: ${imovelVivaReal.listing_id})`;
            propertyAddress = imovelVivaReal.endereco || imovelVivaReal.cidade || 'Endereço a definir';
            console.log('✅ Imóvel encontrado no Viva Real:', propertyTitle);
          }
        } catch (err) {
          console.log('❌ Erro ao buscar imóvel Viva Real:', err);
        }
      }

      // Fallback para properties tradicionais se listingId não funcionou
      if (!propertyTitle && eventData.propertyId) {
        console.log('🔍 Fallback: Tentando buscar property tradicional com ID:', eventData.propertyId);
        property = properties.find(p => p.id === eventData.propertyId);
        if (property) {
          propertyTitle = property.title;
          propertyAddress = property.address;
        } else {
          // Se não encontrou na tabela properties, tentar o propertyId na tabela imoveisvivareal
          console.log('🔍 Tentando usar propertyId na tabela imoveisvivareal...');
          try {
            let imovelVivaRealFallback = null;

            // Primeira tentativa: como string
            const resultString = await supabase
              .from('imoveisvivareal')
              .select('listing_id, tipo_imovel, descricao, endereco, cidade')
              .eq('listing_id', String(eventData.propertyId))
              .single();

            if (resultString.data) {
              imovelVivaRealFallback = resultString.data;
            } else {
              // Segunda tentativa: como número
              const numericId = Number(eventData.propertyId);
              if (!isNaN(numericId)) {
                const resultNumber = await supabase
                  .from('imoveisvivareal')
                  .select('listing_id, tipo_imovel, descricao, endereco, cidade')
                  .eq('listing_id', numericId)
                  .single();
                imovelVivaRealFallback = resultNumber.data;
              }
            }

            if (imovelVivaRealFallback) {
              propertyTitle = `${imovelVivaRealFallback.tipo_imovel || 'Imóvel'} (ID: ${imovelVivaRealFallback.listing_id})`;
              propertyAddress = imovelVivaRealFallback.endereco || imovelVivaRealFallback.cidade || 'Endereço a definir';
              console.log('✅ Imóvel encontrado via propertyId fallback:', propertyTitle);
            }
          } catch (err) {
            console.log('❌ Erro no fallback propertyId:', err);
          }
        }
      }

      // Buscar cliente - primeiro na lista local, depois diretamente no Supabase
      client = clients.find(c => c.id === eventData.clientId);

      if (!client) {
        console.log('🔍 Cliente não encontrado na lista local, buscando diretamente no Supabase...');
        try {
          const { data: clientData, error: clientError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', eventData.clientId)
            .single();

          if (clientData && !clientError) {
            client = clientData;
            console.log('✅ Cliente encontrado no Supabase:', client.name);
          } else {
            console.log('❌ Cliente não encontrado no Supabase:', clientError);
          }
        } catch (err) {
          console.log('❌ Erro ao buscar cliente no Supabase:', err);
        }
      }

      console.log('🔍 Resultado final - Property:', propertyTitle || 'NÃO ENCONTRADO', 'Cliente:', client?.name || 'NÃO ENCONTRADO');

      if (!propertyTitle || !client) {
        throw new Error('Imóvel ou cliente não encontrado');
      }

      // Calcular data/hora de fim (1 hora depois do início)
      const endDateTime = new Date(eventData.date.getTime() + 60 * 60 * 1000);

      // Processar seleção do corretor
      let corretorAssignado = eventData.corretor;

      // Se selecionou "aleatorio", escolher automaticamente entre corretores disponíveis
      if (eventData.corretor === 'aleatorio') {
        try {
          const users = await getCompanyUsers();
          const corretores = users.filter((u: any) => u.role === 'corretor').map((u: any) => u.full_name || u.email);

          if (corretores.length > 0) {
            corretorAssignado = corretores[Math.floor(Math.random() * corretores.length)];
            console.log(`🎲 Corretor atribuído automaticamente: ${corretorAssignado}`);
          } else {
            console.log('⚠️ Nenhum corretor encontrado, usando valor padrão');
            corretorAssignado = 'Corretor disponível';
          }
        } catch (err) {
          console.log('Erro ao buscar corretores, usando fallback');
          corretorAssignado = 'Corretor disponível';
        }
      } else {
        console.log(`👤 Corretor selecionado manualmente: ${corretorAssignado}`);
      }

      const writableCalendars = corretores.filter(c => c.canWrite);
      let targetCalendarId =
        selectedAgenda !== "Todos"
          ? selectedAgenda
          : (writableCalendars[0]?.id || "");

      if (selectedAgenda !== "Todos") {
        const selectedCalendar = corretores.find(c => c.id === selectedAgenda);
        if (selectedCalendar && !selectedCalendar.canWrite) {
          throw new Error("Você não tem permissão de escrita neste calendário. Selecione um calendário com permissão de edição.");
        }
      }

      // Fallback: se a lista local ainda não carregou, consulta direto no Google API
      if (!targetCalendarId) {
        const { data: calendarsData, error: calendarsError } = await invokeEdge<any, any>("google-calendar-api", {
          body: { action: "list_calendars" },
        });
        if (calendarsError) {
          throw new Error(calendarsError.message || "Falha ao carregar calendários para criação do evento");
        }
        const calendars = Array.isArray(calendarsData?.calendars) ? calendarsData.calendars : [];
        const writable = calendars.filter((c: any) =>
          ["owner", "writer"].includes(String(c?.accessRole || "").toLowerCase())
        );
        const preferred = writable.find((c: any) => c?.primary) || writable[0];
        targetCalendarId = preferred?.id || "";
      }

      if (!targetCalendarId) {
        throw new Error("Selecione um calendário para criar o evento");
      }

      const googleEventPayload = {
        summary: `${eventData.type} ao ${propertyTitle}`,
        description: `${eventData.type} agendada para o imóvel ${propertyTitle} (${propertyAddress}) com o cliente ${client.name}. Corretor responsável: ${corretorAssignado}`,
        start: {
          dateTime: eventData.date.toISOString(),
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: "America/Sao_Paulo",
        },
        attendees: [
          {
            email: eventData.email,
            displayName: client.name,
          },
        ],
        location: propertyAddress,
      };

      const { data: createdData, error: createdError } = await invokeEdge<any, any>("google-calendar-api", {
        body: {
          action: "create_event",
          calendar_id: targetCalendarId,
          event: googleEventPayload,
        },
      });
      if (createdError || !createdData?.success) {
        throw new Error(createdError?.message || createdData?.error || "Erro ao criar evento no Google Calendar");
      }

      const eventId = createdData?.event?.id || `local_${Date.now()}`;

      // Salvar evento no banco local para persistência
      try {
        await saveEventToDatabase({
          event_id: eventId,
          summary: googleEventPayload.summary,
          description: googleEventPayload.description,
          start_time: googleEventPayload.start.dateTime,
          end_time: googleEventPayload.end.dateTime,
          location: googleEventPayload.location,
          attendee_email: googleEventPayload.attendees[0]?.email,
          attendee_name: googleEventPayload.attendees[0]?.displayName,
          property_id: eventData.listingId || eventData.propertyId,
          property_title: propertyTitle,
          client_id: client.id,
          client_name: client.name,
          corretor_name: corretorAssignado,
          event_type: eventData.type,
          status: 'Confirmado'
        });
        console.log('✅ Evento salvo no banco local com ID:', eventId);
      } catch (saveError) {
        console.error('❌ Erro ao salvar evento no banco local:', saveError);
      }

      try {
        await logAudit({
          action: 'agenda.event_created',
          resource: 'agenda_event',
          resourceId: eventId,
          meta: {
            summary: googleEventPayload.summary,
            date: googleEventPayload.start.dateTime,
            property: propertyTitle,
            client: client.name,
            corretor: corretorAssignado
          }
        });
      } catch (auditError) {
        console.error('❌ Erro ao registrar audit log:', auditError);
      }
      console.log('✅ EVENTO CRIADO COM SUCESSO NO GOOGLE CALENDAR');

      // Criar o evento localmente após sucesso no Google
      const newEvent: AgendaEvent = {
        id: createdData?.event?.id || Date.now(), // Usar ID do Google Calendar se disponível
        date: eventData.date,
        client: client.name,
        property: propertyTitle,
        address: propertyAddress,
        type: eventData.type,
        status: 'confirmada', // Confirmada porque foi criada no Google Calendar
        corretor: corretorAssignado, // Usar o corretor efetivamente atribuído
        calendarId: targetCalendarId
      };

      // Adicionar o evento localmente
      setEvents(prevEvents => [...prevEvents, newEvent]);

      console.log('✅ Evento adicionado à agenda local:', newEvent);

    } catch (error) {
      console.error('❌ Erro ao criar evento:', error);

      // Se o Google falhar, ainda assim criar localmente como backup
      if (propertyTitle && client) {
        // Processar corretor para backup também
        let corretorBackup = eventData.corretor;
        if (eventData.corretor === 'aleatorio') {
          corretorBackup = 'Corretor disponível'; // Fallback simples para o caso de erro
        }

        const backupEvent: AgendaEvent = {
          id: Date.now(),
          date: eventData.date,
          client: client.name,
          property: propertyTitle,
          address: propertyAddress,
          type: eventData.type,
          status: 'agendada', // Status diferente para indicar que não foi sincronizado
          corretor: corretorBackup, // Usar o corretor processado
          calendarId: selectedAgenda !== 'Todos' ? selectedAgenda : undefined
        };

        setEvents(prevEvents => [...prevEvents, backupEvent]);
        console.log('⚠️ Evento criado localmente como backup:', backupEvent);
      }

      throw error;
    }
  };

  const filteredEvents = useMemo(
    () => filterEventsByStatus(events, statusFilter),
    [events, statusFilter],
  );

  const sortedAgentNames = useMemo(() => {
    const names = new Set<string>();
    for (const e of events) {
      if (e.corretor?.trim()) names.add(e.corretor.trim());
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [events]);

  const agentChips = useMemo(() => {
    const chips = [
      {
        id: 'Todos',
        label: 'Todos',
        count: events.length,
        dotClass: 'bg-muted-foreground/50',
      },
    ];
    for (const cal of corretores) {
      const name = cal.full_name;
      const count = events.filter(
        (e) => e.calendarId === cal.id || e.corretor === name,
      ).length;
      chips.push({
        id: cal.id,
        label: name,
        count,
        dotClass: getAgentDotClass(name, sortedAgentNames),
      });
    }
    return chips;
  }, [events, corretores, sortedAgentNames]);

  const kpis = useMemo(() => buildAgendaKpis(events), [events]);

  const handleGoToday = () => {
    const today = new Date();
    setSelectedDate(today);
    handleDateChange(today);
  };

  const handleGoTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow);
    handleDateChange(tomorrow);
  };

  const handleGoNextWeek = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setSelectedDate(nextWeek);
    handleDateChange(nextWeek);
  };

  const handleAgentChange = (id: string) => {
    setSelectedAgenda(id);
    if (id === 'Todos') {
      setSelectedAgendaName('Todos os calendários');
    } else {
      const found = corretores.find((c) => c.id === id);
      setSelectedAgendaName(found?.full_name || 'Calendário');
    }
  };

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col min-w-0">
      <div className="border-b border-border/70">
        <div className="px-3 py-2 sm:px-5 sm:py-3 md:py-4">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm px-3 py-2 space-y-2 sm:px-4 sm:py-3 sm:space-y-3 md:px-6 md:py-4 md:space-y-4">
            <AgendaTopBar />
            <AgendaToolbar
              isConnected={isConnected}
              connectedEmail={connectedGoogleEmail}
              lastSync={lastUpdate}
              loading={loading}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onSync={() => void handleRefreshAgenda()}
              onNewEvent={() => setIsAddEventModalOpen(true)}
              syncing={syncing || loadingCorretores}
            />
            {!isConnected ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleConnectGoogle()}
                  disabled={connectingGoogle}
                  className="text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-400 disabled:opacity-50"
                >
                  {connectingGoogle ? 'Conectando…' : 'Conectar Google Calendar'}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void handleDisconnectGoogle()}
                  disabled={connectingGoogle}
                  className="text-xs text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-50"
                >
                  {connectingGoogle ? 'Desconectando…' : 'Desconectar Google'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background">
        <AgendaKpis items={kpis} />

        <AgendaFilters
          agents={agentChips}
          selectedAgentId={selectedAgenda}
          onAgentChange={handleAgentChange}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onGoToday={handleGoToday}
          onGoTomorrow={handleGoTomorrow}
          onGoNextWeek={handleGoNextWeek}
          disableAgentFilter={profile?.role === 'corretor'}
        />

        {error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            {error}
          </div>
        ) : null}

        <AppointmentCalendar
          appointments={filteredEvents}
          onDateChange={handleDateChange}
          onMonthChange={handleMonthChange}
          onRefreshRequested={refreshEvents}
          onEventStatusChange={handleEventStatusChange}
          selectedDate={selectedDate}
          currentMonth={currentMonth}
          selectedAgenda={selectedAgenda}
          selectedAgendaName={selectedAgendaName}
          viewMode={viewMode}
          sortedAgentNames={sortedAgentNames}
        />
      </div>

      <AddEventModal
        isOpen={isAddEventModalOpen}
        onClose={() => setIsAddEventModalOpen(false)}
        properties={properties || []}
        clients={clients || []}
        onSubmit={handleAddEvent}
      />
    </div>
  );
} 