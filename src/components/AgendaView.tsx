import { useState, useEffect, useRef } from "react";
import { AppointmentCalendar } from "@/components/AppointmentCalendar";
import { AddEventModal } from "@/components/AddEventModal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar } from "lucide-react";
import { useProperties } from "@/hooks/useProperties";
import { logAudit } from "@/lib/audit/logger";
import { useClients } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";

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
}

const mockEvents: AgendaEvent[] = [
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
  }
];

export function AgendaView() {
  const [events, setEvents] = useState<AgendaEvent[]>(mockEvents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date()); // Controlar mês atual
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [selectedAgenda, setSelectedAgenda] = useState<string>("Todos"); // ID do calendário selecionado ou 'Todos'
  const [selectedAgendaName, setSelectedAgendaName] = useState<string>("Todos os calendários");
  const [corretores, setCorretores] = useState<{ id: string; full_name: string }[]>([]);
  const [loadingCorretores, setLoadingCorretores] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Buscar propriedades e clientes existentes
  const { properties } = useProperties();
  const { clients } = useClients();
  const { getCompanyUsers, profile } = useUserProfile();

  // Função para carregar calendários (mesma fonte do Plantão > Calendários)
  const loadCorretores = async () => {
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

      // 2. Fazer requisição ao Webhook com company_id
      const resp = await fetch("https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/id_agendas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funcao: "leitura",
          company_id: companyId,
          user_id: user?.id
        }),
      });

      if (!resp.ok) {
        throw new Error(`Erro na API: ${resp.status} - ${resp.statusText}`);
      }

      const data = await resp.json();
      let list: any[] = [];
      
      // Novo formato: array de objetos com { calendars: [...], assigned_user_id: "..." }
      if (Array.isArray(data)) {
        // Verificar se é o novo formato (objetos com propriedade "calendars")
        if (data.length > 0 && Array.isArray((data[0] as any)?.calendars)) {
          // Novo formato: extrair calendários e preservar assigned_user_id
          list = (data as any[]).flatMap((item: any) => {
            const calendars = item.calendars || [];
            // Adicionar assigned_user_id a cada calendário para facilitar filtragem
            return calendars.map((cal: any) => ({
              ...cal,
              _assigned_user_id: item.assigned_user_id // Prefixo _ para indicar campo auxiliar
            }));
          });
        }
        // Formato antigo: lista de wrappers com chave "Calendars" (maiúscula)
        else if (data.length > 0 && Array.isArray((data[0] as any)?.Calendars)) {
          list = (data as any[]).flatMap((item: any) => item.Calendars || []);
        }
        // Formato antigo: array direto de calendários
        else {
          list = data;
        }
      } else if (Array.isArray((data as any)?.Calendars) || Array.isArray((data as any)?.calendars)) {
        list = (data as any).Calendars || (data as any).calendars;
      } else if (Array.isArray((data as any)?.events)) {
        list = (data as any).events;
      } else {
        list = [];
      }

      const normalized = list.map((item: any) => ({
        id: item?.["Calendar ID"] ?? item?.id ?? "",
        full_name: item?.["Calendar Name"] ?? item?.name ?? "Sem nome",
        // Preservar assigned_user_id se vier do novo formato
        _assigned_user_id: item?._assigned_user_id,
      }));

      console.log(`✅ Encontrados ${normalized.length} calendários.`);

      // 3. Filtragem por empresa e perfil (Reusando dados obtidos)
      // IMPORTANTE: O N8N já filtra por company_id, então todos os calendários retornados
      // já são da empresa correta. A filtragem aqui é apenas por role do usuário.
      let finalAndRel = normalized;

      if (companyId) {
        // Buscar vínculos no banco (para casos onde precisamos verificar vínculos)
        const { data: schedules } = await supabase
          .from('oncall_schedules')
          .select('calendar_id, assigned_user_id')
          .eq('company_id', companyId);

        if (userRole === 'corretor') {
          // Corretor: apenas as vinculadas a ele
          // Verificar se assigned_user_id vem do N8N (novo formato)
          // Também verificar no banco (para compatibilidade com calendários antigos)
          const myIds = schedules
            ?.filter(s => s.assigned_user_id === user?.id)
            .map(s => s.calendar_id) || [];
          
          // Combinar ambos: calendários do N8N com assigned_user_id OU do banco
          finalAndRel = normalized.filter(c => 
            c._assigned_user_id === user?.id || myIds.includes(c.id)
          );
          console.log(`🔐 Corretor: ${finalAndRel.length} calendários permitidos.`);
        } else {
          // Gestor/Admin: TODOS os calendários que vêm do N8N
          // O N8N já filtra por company_id, então todos são da empresa correta
          finalAndRel = normalized;
          console.log(`🔐 Gestor/Admin: ${finalAndRel.length} calendários permitidos (todos da empresa via N8N).`);
        }
      } else {
        // Se não tiver companyId, não mostrar nada por segurança
        finalAndRel = [];
      }


      setCorretores(finalAndRel);
    } catch (error) {
      console.error('❌ Erro ao carregar calendários:', error);
      setCorretores([]);
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
  // Conforme solicitado, manteremos apenas a consulta ao endpoint ver-agenda

  // REMOVIDO: leitura de eventos a partir de notas locais para simplificação

  const fetchAgendaEvents = async (date: Date, isAutoUpdate = false) => {
    try {
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
      const agendaIds = isTodos
        ? corretores.map(c => c.id)
        : [selectedAgenda];

      // Novo contrato de payload
      const requestBody = isTodos ? {
        tipo_busca: 'todos',
        calendar_ids: agendaIds,
        data_inicial: dataInicialFormatada,
        data_final: dataFinalFormatada,
        mes: month + 1,
        ano: year,
        data_inicial_formatada: dataInicial.toLocaleDateString('pt-BR') + ' 00:01',
        data_final_formatada: dataFinal.toLocaleDateString('pt-BR') + ' 23:59',
        periodo: `${dataInicial.toLocaleDateString('pt-BR')} até ${dataFinal.toLocaleDateString('pt-BR')}`
      } : {
        tipo_busca: 'individual',
        calendar_id: selectedAgenda,
        calendar_ids: [selectedAgenda], // Garantir que até busca individual envie array
        data_inicial: dataInicialFormatada,
        data_final: dataFinalFormatada,
        mes: month + 1,
        ano: year,
        data_inicial_formatada: dataInicial.toLocaleDateString('pt-BR') + ' 00:01',
        data_final_formatada: dataFinal.toLocaleDateString('pt-BR') + ' 23:59',
        periodo: `${dataInicial.toLocaleDateString('pt-BR')} até ${dataFinal.toLocaleDateString('pt-BR')}`
      } as any;

      if (!isAutoUpdate) {
        console.log('📤 Buscando eventos via webhook para:', requestBody.periodo);
      }

      const response = await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/ver-agenda', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!isAutoUpdate) {
        console.log('📡 Status resposta:', response.status);
      }

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      if (!isAutoUpdate) {
        console.log('✅ Dados da agenda recebidos:', Array.isArray(data) ? data.length : 'formato não reconhecido');
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
          let clientName = 'Cliente não informado';
          
          // Estratégia 1: Regex melhorado para capturar "com o cliente NOME" ou "com a cliente NOME"
          const clientMatch1 = description.match(/com (?:o cliente |a cliente )?([^(\n\r]+?)(?:\s*\(|$)/i);
          if (clientMatch1 && clientMatch1[1]) {
            clientName = clientMatch1[1].trim();
          }
          
          // Estratégia 2: Buscar padrão "Cliente: NOME" ou "Cliente - NOME"
          if (clientName === 'Cliente não informado') {
            const clientMatch2 = description.match(/(?:cliente|client)[:\-]\s*([^\n\r(]+?)(?:\s*\(|$)/i);
            if (clientMatch2 && clientMatch2[1]) {
              clientName = clientMatch2[1].trim();
            }
          }
          
          // Estratégia 3: Buscar no summary se tiver padrão "TÍTULO - NOME DO CLIENTE"
          if (clientName === 'Cliente não informado' && summary.includes(' - ')) {
            const parts = summary.split(' - ');
            if (parts.length >= 2) {
              const potentialClient = parts[parts.length - 1].trim();
              // Validar se não é muito curto ou muito longo (provavelmente é um nome)
              if (potentialClient.length >= 3 && potentialClient.length <= 50) {
                clientName = potentialClient;
              }
            }
          }
          
          // Estratégia 4: Buscar padrão entre parênteses no summary ou description
          if (clientName === 'Cliente não informado') {
            const parenMatch = (summary + ' ' + description).match(/\(([^)]{3,50})\)/);
            if (parenMatch && parenMatch[1]) {
              const potentialClient = parenMatch[1].trim();
              // Validar se parece um nome (não contém números, URLs, etc)
              if (!/\d/.test(potentialClient) && !potentialClient.includes('http')) {
                clientName = potentialClient;
              }
            }
          }
          
          // Limpar o nome do cliente (remover espaços extras, caracteres especiais no final)
          if (clientName !== 'Cliente não informado') {
            clientName = clientName.replace(/\s+/g, ' ').trim();
            // Remover caracteres especiais no final se houver
            clientName = clientName.replace(/[.,;:!?]+$/, '').trim();
          }

          // 3.5. Se ainda não encontrou o cliente, buscar na tabela leads pelo email do evento
          if (clientName === 'Cliente não informado' && profile?.company_id) {
            try {
              // Extrair email do evento (prioridade: attendees[0] > creator > organizer)
              let eventEmail: string | null = null;
              
              if (event.attendees && event.attendees.length > 0 && event.attendees[0].email) {
                eventEmail = event.attendees[0].email.toLowerCase().trim();
              } else if (event.creator?.email) {
                eventEmail = event.creator.email.toLowerCase().trim();
              } else if (event.organizer?.email) {
                eventEmail = event.organizer.email.toLowerCase().trim();
              }

              // Se encontrou um email, buscar na tabela leads
              if (eventEmail) {
                const { data: lead } = await supabase
                  .from('leads')
                  .select('name, email')
                  .eq('company_id', profile.company_id)
                  .ilike('email', eventEmail)
                  .limit(1)
                  .single();

                if (lead?.name) {
                  clientName = lead.name;
                  console.log(`✅ Cliente encontrado na tabela leads pelo email ${eventEmail}: ${lead.name}`);
                }
              }
            } catch (error) {
              // Ignorar erros silenciosamente (pode não ter encontrado ou não ter email)
              console.debug('Erro ao buscar cliente na tabela leads:', error);
            }
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

          // 7. Extrair corretor do evento (prioridade para displayName)
          let corretor = 'Não informado';

          // 1ª prioridade: Verificar displayName no creator
          if (event.creator?.displayName) {
            const displayName = event.creator.displayName.toLowerCase();
            if (displayName.includes('isis')) corretor = 'Isis';
            else if (displayName.includes('arthur')) corretor = 'Arthur';
            else corretor = event.creator.displayName; // Usar o nome como está se não for Isis/Arthur
          }

          // 2ª prioridade: Verificar displayName no organizer
          if (corretor === 'Não informado' && event.organizer?.displayName) {
            const displayName = event.organizer.displayName.toLowerCase();
            if (displayName.includes('isis')) corretor = 'Isis';
            else if (displayName.includes('arthur')) corretor = 'Arthur';
            else corretor = event.organizer.displayName; // Usar o nome como está se não for Isis/Arthur
          }

          // 3ª prioridade: Tentar extrair do email do creator/organizer
          if (corretor === 'Não informado' && event.creator?.email) {
            const email = event.creator.email.toLowerCase();
            if (email.includes('isis')) corretor = 'Isis';
            else if (email.includes('arthur')) corretor = 'Arthur';
          }

          // 4ª prioridade: Tentar extrair do email do organizer
          if (corretor === 'Não informado' && event.organizer?.email) {
            const email = event.organizer.email.toLowerCase();
            if (email.includes('isis')) corretor = 'Isis';
            else if (email.includes('arthur')) corretor = 'Arthur';
          }

          // 5ª prioridade: Tentar na description
          if (corretor === 'Não informado') {
            const descLower = description.toLowerCase();
            if (descLower.includes('isis')) corretor = 'Isis';
            else if (descLower.includes('arthur')) corretor = 'Arthur';
          }

          // 6ª prioridade: Se ainda não identificou e não está filtrando por agenda específica,
          // usar o nome do corretor vinculado ao calendário selecionado como fallback (não o ID)
          if (corretor === 'Não informado' && selectedAgenda !== 'Todos') {
            const found = corretores.find(c => c.id === selectedAgenda);
            corretor = found?.full_name || selectedAgendaName || 'Corretor';
          }

          // Calendar ID do evento (preferir campo do payload; senão inferir por seleção/nomes)
          let calendarId: string | undefined = event.calendarId || event.calendar_id || event.organizer?.id || event.creator?.id || event.calendar?.id;
          if (!calendarId) {
            if (selectedAgenda !== 'Todos') {
              calendarId = selectedAgenda;
            } else if (corretor && corretores.length > 0 && corretor !== 'Não informado') {
              const match = corretores.find(c => (c.full_name || '').toLowerCase().includes(corretor.toLowerCase()));
              if (match) calendarId = match.id;
            }
          }

          const processedEvent = {
            id: event.id || `event_${index + 1}`,
            date: eventDate,
            client: clientName,
            property: summary, // Usar o summary ao invés da description
            address: location,
            type: eventType,
            status: attendeeStatus,
            corretor: corretor,
            calendarId
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

          // Extrair cliente (inicialmente do email do creator como fallback)
          let clientName = event.creator?.email?.split('@')[0] || 'Cliente não informado';
          
          // Se ainda não encontrou o cliente, buscar na tabela leads pelo email do evento
          if (clientName === 'Cliente não informado' && profile?.company_id) {
            try {
              // Extrair email do evento (prioridade: attendees[0] > creator > organizer)
              let eventEmail: string | null = null;
              
              if (event.attendees && event.attendees.length > 0 && event.attendees[0].email) {
                eventEmail = event.attendees[0].email.toLowerCase().trim();
              } else if (event.creator?.email) {
                eventEmail = event.creator.email.toLowerCase().trim();
              } else if (event.organizer?.email) {
                eventEmail = event.organizer.email.toLowerCase().trim();
              }

              // Se encontrou um email, buscar na tabela leads
              if (eventEmail) {
                const { data: lead } = await supabase
                  .from('leads')
                  .select('name, email')
                  .eq('company_id', profile.company_id)
                  .ilike('email', eventEmail)
                  .limit(1)
                  .single();

                if (lead?.name) {
                  clientName = lead.name;
                  console.log(`✅ Cliente encontrado na tabela leads pelo email ${eventEmail}: ${lead.name}`);
                }
              }
            } catch (error) {
              // Ignorar erros silenciosamente (pode não ter encontrado ou não ter email)
              console.debug('Erro ao buscar cliente na tabela leads:', error);
            }
          }

          // Extrair corretor (prioridade para displayName)
          let corretor = 'Não informado';
          if (event.creator?.displayName) {
            const displayName = event.creator.displayName.toLowerCase();
            if (displayName.includes('isis')) corretor = 'Isis';
            else if (displayName.includes('arthur')) corretor = 'Arthur';
            else corretor = event.creator.displayName;
          } else if (event.creator?.email) {
            const email = event.creator.email.toLowerCase();
            if (email.includes('isis')) corretor = 'Isis';
            else if (email.includes('arthur')) corretor = 'Arthur';
          }

          // Fallback: se não identificado e filtrando agenda específica, usar o nome do corretor da agenda
          if (corretor === 'Não informado' && selectedAgenda !== 'Todos') {
            const found = corretores.find(c => c.id === selectedAgenda);
            corretor = found?.full_name || selectedAgendaName || 'Corretor';
          }

          // Calendar ID (mesma estratégia de inferência)
          let calendarId: string | undefined = (event as any).calendarId || (event as any).calendar_id || (event as any).organizer?.id || (event as any).creator?.id || (event as any).calendar?.id;
          if (!calendarId) {
            if (selectedAgenda !== 'Todos') {
              calendarId = selectedAgenda;
            } else if (corretor && corretores.length > 0 && corretor !== 'Não informado') {
              const match = corretores.find(c => (c.full_name || '').toLowerCase().includes(corretor.toLowerCase()));
              if (match) calendarId = match.id;
            }
          }

          return {
            id: event.id || `event_${index + 1}`,
            date: eventDate,
            client: clientName,
            property: summary,
            address: 'Endereço será confirmado',
            type: 'Visita',
            status: event.status === 'confirmed' ? 'confirmada' : 'agendada',
            corretor: corretor,
            calendarId
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
      if (!isAutoUpdate) console.log('✅ Agenda atualizada com sucesso (ver-agenda)');

    } catch (error) {
      console.log('⚠️ Webhook indisponível, mantendo dados de exemplo:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
      setIsConnected(false);
      // Manter os dados mock que já estão carregados
    } finally {
      setLoading(false);
    }
  };

  // UseEffect para carregamento inicial dos corretores
  useEffect(() => {
    console.log('🚀 Carregando corretores na inicialização...');
    loadCorretores();
  }, []); // Executa apenas uma vez na montagem

  // UseEffect para carregamento inicial da agenda
  useEffect(() => {
    console.log('🚀 USE_EFFECT EXECUTADO! Carregando eventos do mês');
    console.log('📅 Mês/Ano:', `${currentMonth.getMonth() + 1}/${currentMonth.getFullYear()}`);
    console.log('👤 Agenda selecionada:', selectedAgenda);
    console.log('🕐 Timestamp:', new Date().toISOString());

    (async () => {
      try {
        // Para corretor: se ainda estiver em "Todos", detectar agenda vinculada e NÃO buscar ainda
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
              return; // aguardar re-execução com selectedAgenda definido
            } else {
              console.warn('⚠️ Corretor sem agenda vinculada. Não exibindo eventos.');
              setEvents([]);
              setIsConnected(true);
              setLastUpdate(new Date());
              return;
            }
          }
        }
        // Para gestor/admin ou corretor já com agenda definida: buscar eventos normalmente
        await fetchAgendaEvents(currentMonth);
      } catch (e) {
        console.warn('⚠️ Falha ao processar carregamento da agenda:', e);
      }
    })();
  }, [currentMonth, selectedAgenda, profile?.role]);

  // Atualização automática a cada 3 segundos enquanto a Agenda estiver aberta
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      fetchAgendaEvents(currentMonth, true);
    }, 3000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentMonth, selectedAgenda]);

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

  // Atualização manual solicitada por filhos (ex.: após editar/deletar/criar)
  const refreshEvents = () => {
    fetchAgendaEvents(currentMonth, true);
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

      // Preparar payload para o webhook
      const webhookPayload = {
        calendar_id: selectedAgenda !== 'Todos' ? selectedAgenda : undefined,
        summary: `${eventData.type} ao ${propertyTitle}`,
        description: `${eventData.type} agendada para o imóvel ${propertyTitle} (${propertyAddress}) com o cliente ${client.name}. Corretor responsável: ${corretorAssignado}`,
        start: {
          dateTime: eventData.date.toISOString(),
          timeZone: 'America/Sao_Paulo'
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'America/Sao_Paulo'
        },
        attendees: [
          {
            email: eventData.email,
            displayName: client.name
          }
        ],
        location: propertyAddress,
        // Dados adicionais para contexto
        imovel: {
          id: eventData.listingId || eventData.propertyId,
          titulo: propertyTitle,
          endereco: propertyAddress,
          preco: property?.price || 0,
          listing_id: eventData.listingId
        },
        cliente: {
          id: client.id,
          nome: client.name,
          email: eventData.email,
          telefone: client.phone
        },
        corretor: {
          nome: corretorAssignado,
          selecionado_como: eventData.corretor, // "aleatorio", "Isis", ou "Arthur"
          atribuido_automaticamente: eventData.corretor === 'aleatorio'
        },
        tipo_evento: eventData.type,
        data_evento: eventData.date.toISOString(),
        hora_evento: eventData.time
      };

      console.log('📤 ENVIANDO EVENTO PARA WEBHOOK');
      console.log('🌐 URL:', 'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/criar_evento');
      console.log('📝 Method: POST');
      console.log('📋 Payload:', JSON.stringify(webhookPayload, null, 2));

      // Chamar o webhook para criar o evento
      const response = await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/criar_evento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload)
      });

      console.log('📡 RESPOSTA DO WEBHOOK');
      console.log('✅ Status:', response.status);
      console.log('✅ Status Text:', response.statusText);

      if (!response.ok) {
        throw new Error(`Erro ao criar evento: ${response.status} - ${response.statusText}`);
      }

      // Verificar se há conteúdo na resposta antes de tentar fazer parse JSON
      let responseData = null;
      const responseText = await response.text();

      if (responseText && responseText.trim().length > 0) {
        try {
          responseData = JSON.parse(responseText);
          console.log('📊 Resposta do webhook:', JSON.stringify(responseData, null, 2));
        } catch (parseError) {
          console.log('⚠️ Resposta não é JSON válido:', responseText);
          // Continuar mesmo assim, pois status 200 indica sucesso
        }
      } else {
        console.log('⚠️ Webhook retornou resposta vazia, mas status 200 - considerando sucesso');
      }

      // Gerar ID do evento para audit log
      const eventId = responseData?.id || `local_${Date.now()}`;

      // Salvar evento no banco local para persistência
      try {
        await saveEventToDatabase({
          event_id: eventId,
          summary: webhookPayload.summary,
          description: webhookPayload.description,
          start_time: webhookPayload.start.dateTime,
          end_time: webhookPayload.end.dateTime,
          location: webhookPayload.location,
          attendee_email: webhookPayload.attendees[0]?.email,
          attendee_name: webhookPayload.attendees[0]?.displayName,
          property_id: webhookPayload.imovel.id,
          property_title: webhookPayload.imovel.titulo,
          client_id: webhookPayload.cliente.id,
          client_name: webhookPayload.cliente.nome,
          corretor_name: webhookPayload.corretor.nome,
          event_type: webhookPayload.tipo_evento,
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
            summary: webhookPayload.summary,
            date: webhookPayload.start.dateTime,
            property: webhookPayload.imovel.titulo,
            client: webhookPayload.cliente.nome,
            corretor: webhookPayload.corretor.nome
          }
        });
      } catch (auditError) {
        console.error('❌ Erro ao registrar audit log:', auditError);
      }
      console.log('✅ EVENTO CRIADO COM SUCESSO NO GOOGLE CALENDAR');

      // Criar o evento localmente após sucesso do webhook
      const newEvent: AgendaEvent = {
        id: responseData?.id || Date.now(), // Usar ID do Google Calendar se disponível
        date: eventData.date,
        client: client.name,
        property: propertyTitle,
        address: propertyAddress,
        type: eventData.type,
        status: 'confirmada', // Confirmada porque foi criada no Google Calendar
        corretor: corretorAssignado, // Usar o corretor efetivamente atribuído
        calendarId: selectedAgenda !== 'Todos' ? selectedAgenda : undefined
      };

      // Adicionar o evento localmente
      setEvents(prevEvents => [...prevEvents, newEvent]);

      console.log('✅ Evento adicionado à agenda local:', newEvent);

    } catch (error) {
      console.error('❌ Erro ao criar evento:', error);

      // Se o webhook falhar, ainda assim criar localmente como backup
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

  // Sempre mostrar a agenda, mesmo com erro ou carregando

  // Função para calcular estatísticas
  const getEventStats = () => {
    const today = new Date();
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayEvents = events.filter(e => e.date.toDateString() === today.toDateString());
    const weekEvents = events.filter(e => e.date >= thisWeek);
    const monthEvents = events.filter(e => e.date >= thisMonth);
    const confirmedEvents = events.filter(e => e.status === 'confirmada' || e.status === 'Confirmado');

    return {
      today: todayEvents.length,
      thisWeek: weekEvents.length,
      thisMonth: monthEvents.length,
      confirmed: confirmedEvents.length,
      total: events.length
    };
  };

  const stats = getEventStats();

  return (
    <div className="space-y-8">
      {/* Header Modernizado */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-6 border border-blue-500/20">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-500/20 p-2 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-400" />
              </div>
              <h1 className="text-3xl font-bold text-white">
                Agenda Inteligente
              </h1>
              {loading && (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              )}
            </div>

            <p className="text-gray-300 mb-4">
              Gerencie seus agendamentos e compromissos de forma inteligente
            </p>

            {/* Status da conexão */}
            <div className="flex items-center gap-4 text-sm">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                }`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-orange-400'
                  } animate-pulse`}></div>
                {isConnected ? 'Online' : 'Offline'}
              </div>

              {lastUpdate && (
                <span className="text-gray-400">
                  Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
                </span>
              )}
            </div>
          </div>

          <Button
            onClick={() => setIsAddEventModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white flex items-center gap-2 px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="h-5 w-5" />
            Novo Evento
          </Button>
        </div>
      </div>

      {/* Dashboard de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <span className="text-2xl">📅</span>
            </div>
            <div>
              <p className="text-blue-300 text-sm font-medium">Hoje</p>
              <p className="text-2xl font-bold text-white">{stats.today}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-500/20 p-2 rounded-lg">
              <span className="text-2xl">📊</span>
            </div>
            <div>
              <p className="text-green-300 text-sm font-medium">Esta Semana</p>
              <p className="text-2xl font-bold text-white">{stats.thisWeek}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/20 p-2 rounded-lg">
              <span className="text-2xl">🗓️</span>
            </div>
            <div>
              <p className="text-purple-300 text-sm font-medium">Este Mês</p>
              <p className="text-2xl font-bold text-white">{stats.thisMonth}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-2 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
            <div>
              <p className="text-emerald-300 text-sm font-medium">Confirmados</p>
              <p className="text-2xl font-bold text-white">{stats.confirmed}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500/20 p-2 rounded-lg">
              <span className="text-2xl">🎯</span>
            </div>
            <div>
              <p className="text-orange-300 text-sm font-medium">Total</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros Modernizados */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="text-2xl">🎛️</span>
            Filtros da Agenda
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchAgendaEvents(currentMonth)}
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
          >
            🔄 Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Seletor de Calendário (desabilitado para corretor) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Corretor</label>
            <Select value={selectedAgenda} disabled={profile?.role === 'corretor'} onValueChange={(val) => {
              setSelectedAgenda(val);
              if (val === 'Todos') {
                setSelectedAgendaName('Todos os calendários');
              } else {
                const found = corretores.find(c => c.id === val);
                setSelectedAgendaName(found?.full_name || 'Calendário');
              }
            }}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 transition-colors">
                <SelectValue placeholder={loadingCorretores ? "Carregando calendários..." : "Selecione o calendário"} />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="Todos" className="text-white hover:bg-gray-700 focus:bg-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📋</span>
                    <span>Todos os calendários</span>
                  </div>
                </SelectItem>
                {loadingCorretores ? (
                  <SelectItem value="loading" disabled className="text-gray-400">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      <span>Carregando calendários...</span>
                    </div>
                  </SelectItem>
                ) : corretores.length === 0 ? (
                  <SelectItem value="no-corretores" disabled className="text-gray-400">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚠️</span>
                      <span>Nenhum calendário encontrado</span>
                    </div>
                  </SelectItem>
                ) : (
                  corretores.map((corretor) => (
                    <SelectItem
                      key={corretor.id}
                      value={corretor.id}
                      className="text-white hover:bg-gray-700 focus:bg-gray-700"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👤</span>
                        <span>{corretor.full_name}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Indicador visual */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Status</label>
            <div className="flex items-center gap-2 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
              <div className={`w-3 h-3 rounded-full animate-pulse ${selectedAgenda === 'Todos' ? 'bg-blue-500' : 'bg-green-500'
                }`}></div>
              <span className="text-sm text-gray-300">
                {selectedAgenda === 'Todos'
                  ? `Visualizando todos os calendários (${events.length} eventos)`
                  : `Calendário: ${selectedAgendaName} (${events.length} eventos)`
                }
              </span>
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Ações Rápidas</label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
                className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 flex-1"
              >
                🌅 Hoje
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setSelectedDate(tomorrow);
                }}
                className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 flex-1"
              >
                🌄 Amanhã
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendário Principal */}
      <AppointmentCalendar
        appointments={events}
        onDateChange={handleDateChange}
        onMonthChange={handleMonthChange}
        onRefreshRequested={refreshEvents}
        selectedDate={selectedDate}
        currentMonth={currentMonth}
        selectedAgenda={selectedAgenda}
        selectedAgendaName={selectedAgendaName}
      />

      {/* Modal de Adicionar Evento */}
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