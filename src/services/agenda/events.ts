import { z } from "zod";
import { invokeEdge } from "@/integrations/supabase/invoke";
import { supabase } from "@/integrations/supabase/client";

// Tipagem compartilhada com AgendaView
export interface AgendaEvent {
	id: string | number;
	date: Date;
	client: string;
	property: string;
	address: string;
	type: string;
	status: string;
	corretor?: string;
}

const WebhookResponseSchema = z.any();

async function resolveCalendarIds(selectedAgenda: string): Promise<string[]> {
	if (selectedAgenda !== "Todos") return [selectedAgenda];

	try {
		const { data: edgeData, error: edgeError } = await invokeEdge<any, any>("google-calendar-api", {
			body: { action: "list_calendars" },
		});
		if (!edgeError) {
			const list = Array.isArray(edgeData?.calendars) ? edgeData.calendars : [];
			return list.map((c: any) => c.id).filter(Boolean);
		}
	} catch {}

	// fallback local
	const { data: schedules } = await supabase
		.from("oncall_schedules")
		.select("calendar_id");
	return (schedules || []).map((s: any) => s.calendar_id).filter(Boolean);
}

function toLocalMonthRange(reference: Date) {
	const year = reference.getFullYear();
	const month = reference.getMonth();
	const start = new Date(year, month, 1, 0, 1, 0, 0);
	const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

	const startIso = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString();
	const endIso = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString();

	return { start, end, startIso, endIso };
}

function parseGoogleDate(event: any): Date | null {
	try {
		if (event?.start?.dateTime) {
			return new Date(event.start.dateTime);
		}
		if (event?.start?.date) {
			return new Date(event.start.date + "T09:00:00");
		}
		return null;
	} catch {
		return null;
	}
}

function normalizeStatus(googleStatus: string | undefined): string {
	switch (googleStatus) {
		case "accepted":
			return "Confirmado";
		case "declined":
			return "Cancelado";
		case "tentative":
			return "Talvez";
		case "needsAction":
		default:
			return "Aguardando confirmação";
	}
}

function inferCorretor(event: any, fallbackAgenda?: string): string {
	let corretor = "Não informado";
	const sum = (event?.summary || "") as string;
	const desc = (event?.description || "") as string;
	const organizer = (event?.organizer?.displayName || "") as string;
	const all = `${sum} ${desc} ${organizer}`.toLowerCase();

	if (all.includes("isis")) corretor = "Isis";
	else if (all.includes("arthur")) corretor = "Arthur";
	else if (fallbackAgenda && fallbackAgenda !== "Todos") corretor = fallbackAgenda;

	return corretor;
}

// Converte um item do Google Calendar no nosso modelo de AgendaEvent
function mapWebhookItemToAgendaEvent(event: any, index: number, selectedAgenda?: string): AgendaEvent | null {
	const date = parseGoogleDate(event);
	if (!date) return null;

	const attendeeStatus: string | undefined = event?.attendees?.[0]?.responseStatus;
	const status = normalizeStatus(attendeeStatus);

	const location = (event?.location as string) || "Local não informado";
	const summary = (event?.summary as string) || "Compromisso";

	// Heurísticas simples para cliente e tipo
	let client = "Cliente não informado";
	let type = "Evento";

	const sumLower = summary.toLowerCase();
	if (sumLower.includes("visita")) type = "Visita";
	else if (sumLower.includes("avalia")) type = "Avaliação";
	else if (sumLower.includes("apresenta")) type = "Apresentação";
	else if (sumLower.includes("vistoria")) type = "Vistoria";

	// Cliente (heurística: depois de " - " ou entre parênteses)
	const dashIdx = summary.indexOf(" - ");
	if (dashIdx >= 0 && dashIdx < summary.length - 3) {
		client = summary.substring(dashIdx + 3).trim() || client;
	}

	const corretor = inferCorretor(event, selectedAgenda);

	return {
		id: event?.id || `event_${index + 1}`,
		date,
		client,
		property: summary,
		address: location,
		type,
		status,
		corretor: corretor === "Não informado" ? undefined : corretor
	};
}

export async function fetchAgendaMonth(reference: Date, selectedAgenda: string = "Todos"): Promise<AgendaEvent[]> {
	const { startIso, endIso } = toLocalMonthRange(reference);
	const calendar_ids = await resolveCalendarIds(selectedAgenda);
	const { data: edgeData, error } = await invokeEdge<any, any>("google-calendar-api", {
		body: {
			action: "list_events",
			calendar_ids,
			time_min: startIso,
			time_max: endIso,
		},
	});
	if (error) throw new Error(error.message || "Erro ao buscar agenda");
	const data = Array.isArray(edgeData?.events) ? edgeData.events : [];
	const processed: AgendaEvent[] = data
		.map((item, idx) => mapWebhookItemToAgendaEvent(item, idx, selectedAgenda))
		.filter((e): e is AgendaEvent => Boolean(e));

	// validar campos essenciais
	return processed.filter(e => e.id && e.date && e.property);
}

// Função para buscar eventos da tabela oncall_events
async function fetchOncallEvents(startDate: Date, endDate: Date): Promise<AgendaEvent[]> {
	try {
		// Importar o cliente Supabase já configurado
		const { supabase } = await import('@/integrations/supabase/client');
		
		console.log('🔍 Buscando eventos da tabela oncall_events...');
		console.log('📅 Período:', startDate.toISOString(), 'até', endDate.toISOString());
		
		const { data: events, error } = await supabase
			.from('oncall_events')
			.select(`
				id,
				title,
				description,
				starts_at,
				ends_at,
				client_name,
				client_email,
				property_title,
				address,
				type,
				status,
				assigned_user_id,
				user_profiles!assigned_user_id (
					full_name
				)
			`)
			.gte('starts_at', startDate.toISOString())
			.lte('starts_at', endDate.toISOString())
			.order('starts_at', { ascending: true });
		
		if (error) {
			console.error('❌ Erro ao buscar eventos da oncall_events:', error);
			return [];
		}
		
		console.log(`✅ Encontrados ${events?.length || 0} eventos na tabela oncall_events`);
		
		const oncallEvents: AgendaEvent[] = events?.map(event => {
			// Extrair nome do corretor do relacionamento com user_profiles
			const corretor = (event as any).user_profiles?.full_name || 'Não informado';
			
			return {
				id: `oncall_${event.id}`, // Prefixo para evitar conflito com Google Calendar
				date: new Date(event.starts_at),
				client: event.client_name || 'Cliente não informado',
				property: event.property_title || event.title || 'Imóvel não informado',
				address: event.address || 'Local não informado',
				type: event.type || 'Evento',
				status: event.status || 'Agendado',
				corretor: corretor === 'Não informado' ? undefined : corretor
			};
		}) || [];
		
		console.log('📋 Eventos processados da oncall_events:', oncallEvents.map(e => ({
			id: e.id,
			date: e.date.toLocaleString('pt-BR'),
			client: e.client,
			corretor: e.corretor
		})));
		
		return oncallEvents;
	} catch (error) {
		console.error('❌ Erro ao carregar eventos da oncall_events:', error);
		return [];
	}
}

// Função para buscar eventos próximos direto da Edge Function
async function fetchAgendaFromEndpoint(startDate: Date, endDate: Date, selectedAgenda: string = "Todos"): Promise<AgendaEvent[]> {
	const startIso = startDate.toISOString();
	const endIso = endDate.toISOString();
	const calendar_ids = await resolveCalendarIds(selectedAgenda);
	const { data: edgeData, error } = await invokeEdge<any, any>("google-calendar-api", {
		body: {
			action: "list_events",
			calendar_ids,
			time_min: startIso,
			time_max: endIso,
		},
	});
	if (error) throw new Error(error.message || "Erro na API google-calendar-api");
	const data = Array.isArray(edgeData?.events) ? edgeData.events : [];
	const processed: AgendaEvent[] = data
		.map((item, idx) => mapWebhookItemToAgendaEvent(item, idx, selectedAgenda))
		.filter((e): e is AgendaEvent => Boolean(e));

	console.log(`📋 Eventos processados do endpoint: ${processed.length}`);
	processed.forEach((event, index) => {
		console.log(`${index + 1}. ${event.client} - ${event.date.toLocaleString('pt-BR')} - ${event.type}`);
	});

	// validar campos essenciais
	return processed.filter(e => e.id && e.date && e.property);
}

export async function fetchUpcomingFromAgenda(daysAhead: number = 7, limit: number = 5, selectedAgenda: string = "Todos"): Promise<AgendaEvent[]> {
	console.log(`🔍 Buscando próximos eventos (${daysAhead} dias, limite ${limit}, agenda: ${selectedAgenda})`);
	
	const now = new Date();
	const limitDate = new Date(now.getTime());
	limitDate.setDate(now.getDate() + daysAhead);

	console.log('📅 Filtro de período:', {
		agora: now.toLocaleString('pt-BR'),
		limite: limitDate.toLocaleString('pt-BR')
	});

	// Buscar eventos do endpoint ver-agenda como fonte principal
	let agendaEvents: AgendaEvent[] = [];
	try {
		agendaEvents = await fetchAgendaFromEndpoint(now, limitDate, selectedAgenda);
		console.log(`📊 Eventos encontrados no endpoint ver-agenda: ${agendaEvents.length}`);
	} catch (error) {
		console.warn('⚠️ Erro ao buscar endpoint ver-agenda:', error);
	}
	
	// FALLBACK: Buscar eventos locais da tabela oncall_events apenas se não houver eventos do endpoint
	if (agendaEvents.length === 0) {
		try {
			agendaEvents = await fetchOncallEvents(now, limitDate);
			console.log(`📊 Eventos encontrados na oncall_events (fallback): ${agendaEvents.length}`);
		} catch (error) {
			console.warn('⚠️ Erro ao buscar oncall_events:', error);
		}
	}

	// Filtrar apenas eventos futuros e ordenar por data
	const upcomingEvents = agendaEvents
		.filter(event => {
			const isFuture = event.date >= now;
			const isWithinRange = event.date <= limitDate;
			
			if (!isFuture) {
				console.log('⏰ Evento no passado ignorado:', {
					client: event.client,
					date: event.date.toLocaleString('pt-BR'),
					agora: now.toLocaleString('pt-BR')
				});
			}
			
			return isFuture && isWithinRange;
		})
		.sort((a, b) => a.date.getTime() - b.date.getTime())
		.slice(0, limit);

	console.log(`✅ Total de próximos eventos retornados: ${upcomingEvents.length}`);
	upcomingEvents.forEach((event, index) => {
		console.log(`${index + 1}. ${event.client} - ${event.date.toLocaleString('pt-BR')} - ${event.type} (endpoint)`);
	});

	return upcomingEvents;
}



