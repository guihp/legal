import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function env(name: string, fallback?: string) {
  return Deno.env.get(name) ?? fallback ?? "";
}

function getBearerToken(req: Request): string {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

function getJwtRole(token: string): string {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return "";
    const payload = JSON.parse(atob(parts[1]));
    return String(payload?.role || "");
  } catch {
    return "";
  }
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.access_token) {
    throw new Error(json?.error_description || "Falha ao renovar token Google");
  }
  return {
    accessToken: json.access_token as string,
    expiresIn: Number(json.expires_in || 3600),
    tokenType: String(json.token_type || "Bearer"),
  };
}

// Resolve nome de exibição do lead, com fallback Instagram.
// Retorna { displayName, handle, phone, email, raw } onde:
//  - displayName: leads.name OU leads.nome_instagram_cliente (sem @)
//  - handle:      leads.arroba_instagram_cliente (com @ se existir)
async function resolveLeadInfo(
  service: ReturnType<typeof createClient>,
  leadId: string,
  companyId: string,
) {
  const empty = { displayName: "", handle: "", phone: "", email: "", raw: null as any };
  if (!leadId) return empty;

  const { data, error } = await service
    .from("leads")
    .select("id, name, phone, email, nome_instagram_cliente, arroba_instagram_cliente, company_id")
    .eq("id", leadId)
    .maybeSingle();

  if (error || !data) {
    console.warn("resolveLeadInfo: lead não encontrado", { leadId, error: error?.message });
    return empty;
  }

  // Guard: lead precisa pertencer à mesma empresa do agendamento
  if (companyId && (data as any).company_id && (data as any).company_id !== companyId) {
    console.warn("resolveLeadInfo: lead de outra empresa", { leadId, companyId, lead_company: (data as any).company_id });
    return empty;
  }

  const nameRaw = String((data as any).name || "").trim();
  const igName = String((data as any).nome_instagram_cliente || "").trim();
  const igHandleRaw = String((data as any).arroba_instagram_cliente || "").trim();
  const phone = String((data as any).phone || "").trim();
  const email = String((data as any).email || "").trim();

  const displayName = nameRaw || igName || "";
  const handle = igHandleRaw
    ? (igHandleRaw.startsWith("@") ? igHandleRaw : `@${igHandleRaw}`)
    : "";

  return { displayName, handle, phone, email, raw: data };
}

type QueueBroker = {
  broker_id: string;
  broker_name: string;
  calendar_id: string;
};

async function pickNextBrokerFromQueue(
  service: ReturnType<typeof createClient>,
  companyId: string,
  fallbackCalendarId?: string,
): Promise<QueueBroker | null> {
  const { data: schedules, error: schedulesError } = await service
    .from("oncall_schedules")
    .select("assigned_user_id, calendar_id, assigned_user_profile:assigned_user_id(full_name, email, role, is_active)")
    .eq("company_id", companyId)
    .not("assigned_user_id", "is", null);

  if (schedulesError) {
    throw new Error(`Falha ao carregar fila de corretores: ${schedulesError.message}`);
  }

  const rows = Array.isArray(schedules) ? schedules : [];
  const candidates = rows
    .map((row: any) => {
      const profile = row?.assigned_user_profile;
      const role = String(profile?.role || "");
      const isActive = profile?.is_active ?? true;
      if (!row?.assigned_user_id || !row?.calendar_id) return null;
      if (!isActive) return null;
      if (!["corretor", "gestor"].includes(role)) return null;

      return {
        broker_id: String(row.assigned_user_id),
        broker_name: String(profile?.full_name || profile?.email || row.assigned_user_id),
        calendar_id: String(row.calendar_id),
      } satisfies QueueBroker;
    })
    .filter(Boolean) as QueueBroker[];

  if (!candidates.length) return null;

  // Ordenação estável para round-robin previsível.
  candidates.sort((a, b) => {
    const byName = a.broker_name.localeCompare(b.broker_name, "pt-BR");
    if (byName !== 0) return byName;
    return a.broker_id.localeCompare(b.broker_id);
  });

  // Se calendar_id já veio no request e estiver vinculado, respeitamos e retornamos esse corretor.
  if (fallbackCalendarId) {
    const byCalendar = candidates.find((c) => c.calendar_id === fallbackCalendarId);
    if (byCalendar) return byCalendar;
  }

  const { data: queueState } = await service
    .from("broker_queue_state")
    .select("last_index")
    .eq("company_id", companyId)
    .maybeSingle();

  const lastIndex = Number(queueState?.last_index ?? -1);
  const nextIndex = (lastIndex + 1) % candidates.length;
  const chosen = candidates[nextIndex];

  await service
    .from("broker_queue_state")
    .upsert({
      company_id: companyId,
      last_index: nextIndex,
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id" });

  return chosen;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

    const bearerToken = getBearerToken(req);
    const jwtRole = getJwtRole(bearerToken);
    const isServiceRoleRequest = jwtRole === "service_role";
    const internalKey = req.headers.get("x-n8n-secret") || "";
    const isInternalRequest = !!internalKey && internalKey === env("N8N_INTERNAL_API_KEY");
    const isInternalAllowed = isInternalRequest || isServiceRoleRequest;

    let profile: { id: string | null; role: string; company_id: string } | null = null;

    if (isInternalAllowed) {
      const companyId = String(body?.company_id || "").trim();
      if (!companyId) {
        return new Response(JSON.stringify({ success: false, error: "company_id é obrigatório para chamadas internas/server-to-server" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      profile = { id: null, role: "system", company_id: companyId };
    } else {
      const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
        global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      });
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: userProfile, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, role, company_id")
        .eq("id", authData.user.id)
        .single();
      if (profileError || !userProfile?.company_id) {
        return new Response(JSON.stringify({ success: false, error: "Perfil sem empresa" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      profile = userProfile;
    }

    const { data: integration, error: integrationError } = await service
      .from("company_google_calendar_integrations")
      .select("*")
      .eq("company_id", profile.company_id)
      .single();

    if (integrationError || !integration) {
      return new Response(JSON.stringify({ success: false, error: "Google Calendar não conectado para esta empresa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = integration.access_token as string;
    const refreshToken = integration.refresh_token as string;
    const expiresAt = integration.expires_at ? new Date(integration.expires_at).getTime() : 0;
    const isExpired = !expiresAt || Date.now() > expiresAt - 60_000;

    if (isExpired && refreshToken) {
      try {
        const refreshed = await refreshGoogleAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        await service
          .from("company_google_calendar_integrations")
          .update({
            access_token: refreshed.accessToken,
            token_type: refreshed.tokenType,
            expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
          })
          .eq("company_id", profile.company_id);
      } catch {
        console.warn("Falha ao renovar token Google, tentando token atual");
      }
    }

    const gFetch = async (url: string, init?: RequestInit) => {
      const run = async (token: string) => {
        const res = await fetch(url, {
          ...init,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(init?.headers || {}),
          },
        });
        // DELETE retorna 204 No Content; não forçar parse JSON
        const text = await res.text().catch(() => "");
        let json: any = {};
        if (text) {
          try { json = JSON.parse(text); } catch { json = { raw: text }; }
        }
        return { res, json };
      };

      let { res, json } = await run(accessToken);
      if (res.status === 401 && refreshToken) {
        try {
          const refreshed = await refreshGoogleAccessToken(refreshToken);
          accessToken = refreshed.accessToken;
          await service
            .from("company_google_calendar_integrations")
            .update({
              access_token: refreshed.accessToken,
              token_type: refreshed.tokenType,
              expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
            })
            .eq("company_id", profile.company_id);
          ({ res, json } = await run(accessToken));
        } catch {
          // mantém erro original
        }
      }

      if (!res.ok) {
        throw new Error(json?.error?.message || `Erro Google API (${res.status})`);
      }
      return json;
    };

    if (action === "list_calendars") {
      const json = await gFetch("https://www.googleapis.com/calendar/v3/users/me/calendarList");
      const items = Array.isArray(json?.items) ? json.items : [];
      const calendars = items
        .filter((e: any) => e.id !== "en.brazilian#holiday@group.v.calendar.google.com")
        .map((e: any) => ({
          id: e.id,
          name: e.summaryOverride || e.summary || "Sem nome",
          timeZone: e.timeZone || "America/Sao_Paulo",
          accessRole: e.accessRole || "",
          color: e.backgroundColor || "#6b7280",
          primary: !!e.primary,
        }));

      return new Response(JSON.stringify({ success: true, calendars, google_email: integration.google_email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cria uma nova agenda SECUNDÁRIA na conta Google conectada.
    // Google retorna o calendário criado, e o calendarList é automaticamente
    // atualizado para a conta dona — após o next list_calendars a agenda aparece.
    // Só admin/gestor/super_admin podem criar.
    if (action === "create_calendar") {
      if (profile.role !== "system" && !["admin", "gestor", "super_admin"].includes(profile.role)) {
        return new Response(JSON.stringify({ success: false, error: "Sem permissão para criar agenda" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const name = String(body?.name || "").trim();
      if (!name) {
        return new Response(JSON.stringify({ success: false, error: "name é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const timeZone = String(body?.timeZone || body?.time_zone || "America/Sao_Paulo");

      // 1) Cria o calendário secundário (dono = conta Google conectada da empresa)
      const created = await gFetch("https://www.googleapis.com/calendar/v3/calendars", {
        method: "POST",
        body: JSON.stringify({ summary: name, timeZone }),
      });
      const calendarId = String(created?.id || "");

      // 2) Garante que já apareça no "Minhas agendas" do dono (calendarList.insert).
      //    Para o dono, calendars.insert já adiciona automaticamente; mas fazemos isso
      //    de forma idempotente para evitar cenário de propagação atrasada.
      if (calendarId) {
        try {
          await gFetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
            method: "POST",
            body: JSON.stringify({ id: calendarId }),
          });
        } catch (e) {
          // Se já estiver na lista, o Google devolve 409 — tudo bem, seguimos.
          console.warn("calendarList.insert retornou erro (provavelmente já existe):", (e as Error).message);
        }
      }

      return new Response(JSON.stringify({ success: true, calendar: { id: calendarId, name, timeZone } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Remove uma agenda SECUNDÁRIA da conta Google conectada.
    // Não é possível deletar calendário primário; Google retorna 403/400.
    if (action === "delete_calendar") {
      if (profile.role !== "system" && !["admin", "gestor", "super_admin"].includes(profile.role)) {
        return new Response(JSON.stringify({ success: false, error: "Sem permissão para remover agenda" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const calendarId = String(body?.calendar_id || "").trim();
      if (!calendarId) {
        return new Response(JSON.stringify({ success: false, error: "calendar_id é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await gFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`, {
        method: "DELETE",
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_events") {
      const calendarIds: string[] = Array.isArray(body?.calendar_ids) ? body.calendar_ids : [];
      const timeMin = String(body?.time_min || "");
      const timeMax = String(body?.time_max || "");
      if (!calendarIds.length) {
        return new Response(JSON.stringify({ success: true, events: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const allEvents: any[] = [];
      for (const calendarId of calendarIds) {
        const u = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
        if (timeMin) u.searchParams.set("timeMin", timeMin);
        if (timeMax) u.searchParams.set("timeMax", timeMax);
        u.searchParams.set("singleEvents", "true");
        u.searchParams.set("orderBy", "startTime");
        const json = await gFetch(u.toString());
        const items = Array.isArray(json?.items) ? json.items : [];
        items.forEach((evt: any) => allEvents.push({ ...evt, calendarId }));
      }

      return new Response(JSON.stringify({ success: true, events: allEvents }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_availability") {
      const calendarId = String(body?.calendar_id || "");
      const timeMin = String(body?.time_min || body?.busca_inicio || "");
      const timeMax = String(body?.time_max || body?.busca_final || "");

      if (!calendarId) {
        return new Response(JSON.stringify({ success: false, error: "calendar_id é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!timeMin || !timeMax) {
        return new Response(JSON.stringify({ success: false, error: "time_min e time_max são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const json = await gFetch("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        body: JSON.stringify({
          timeMin,
          timeMax,
          items: [{ id: calendarId }],
        }),
      });

      const busy = Array.isArray(json?.calendars?.[calendarId]?.busy)
        ? json.calendars[calendarId].busy
        : [];

      return new Response(JSON.stringify({
        success: true,
        calendar_id: calendarId,
        time_min: timeMin,
        time_max: timeMax,
        busy,
        raw: json,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_event_from_n8n") {
      let calendarId = String(body?.calendar_id || "").trim();

      const startDateTime = String(body?.start || "").trim();
      const endDateTime = String(body?.end || "").trim();
      const summary = String(body?.summary || "Visita").trim();
      const descriptionRaw = String(body?.description || "").trim();
      const location = String(body?.location || "").trim();
      const useDefaultReminders = Boolean(body?.use_default_reminders ?? false);
      let brokerId = String(
        body?.broker_id ||
        body?.corretor_id ||
        body?.realtor_id ||
        body?.agent_id ||
        "",
      ).trim();
      let brokerName = String(
        body?.broker_name ||
        body?.corretor_nome ||
        "",
      ).trim();
      const useBrokerQueue = Boolean(body?.use_broker_queue ?? !brokerId);

      if (useBrokerQueue && (!brokerId || !calendarId)) {
        const queuePick = await pickNextBrokerFromQueue(service, profile.company_id, calendarId || undefined);
        if (queuePick) {
          if (!brokerId) brokerId = queuePick.broker_id;
          if (!brokerName) brokerName = queuePick.broker_name;
          if (!calendarId) calendarId = queuePick.calendar_id;
        }
      }

      if (!calendarId) {
        return new Response(JSON.stringify({
          success: false,
          error: "calendar_id é obrigatório (ou use_broker_queue=true com fila configurada)",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // attendees pode chegar como array ou string (n8n às vezes manda string)
      let attendeeEmails: string[] = [];
      const rawAttendees = body?.attendees;
      if (Array.isArray(rawAttendees)) {
        attendeeEmails = rawAttendees.map((e: any) => String(e || "").trim()).filter(Boolean);
      } else if (typeof rawAttendees === "string" && rawAttendees.trim()) {
        attendeeEmails = rawAttendees.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
      }

      const reminders = Array.isArray(body?.reminders) ? body.reminders : [];

      if (!startDateTime || !endDateTime) {
        return new Response(JSON.stringify({ success: false, error: "start e end são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ⚡ Lookup do lead via lead_id (também aceita session_id como alias).
      // Se o nome estiver vazio, cai no nome_instagram_cliente; o @arroba vai como sufixo "(@handle)".
      const leadId = String(body?.lead_id || body?.session_id || "").trim();
      const leadInfo = await resolveLeadInfo(service, leadId, profile.company_id);

      // Prefixa "Cliente: NOME (@handle)\nTelefone: XXX" no description para os
      // parsers do front (services/agenda/events.ts e AgendaView/AppointmentCalendar)
      // capturarem o nome via Strategy 2 do regex.
      let description = descriptionRaw;
      if (leadInfo.displayName) {
        const handlePart = leadInfo.handle ? ` (${leadInfo.handle})` : "";
        const phonePart = leadInfo.phone ? `\nTelefone: ${leadInfo.phone}` : "";
        const clientHeader = `Cliente: ${leadInfo.displayName}${handlePart}${phonePart}`;
        description = description
          ? `${clientHeader}\n\n${description}`
          : clientHeader;
      }

      // Se nenhum attendee veio do n8n, mas o lead tem email, convidamos o lead automaticamente
      if (attendeeEmails.length === 0 && leadInfo.email && /@/.test(leadInfo.email)) {
        attendeeEmails = [leadInfo.email];
      }

      const attendees = attendeeEmails
        .filter(Boolean)
        .map((email: string) => ({ email }));

      const overrides = reminders
        .map((r: any) => ({
          method: String(r?.method || "").trim(),
          minutes: Number(r?.minutes),
        }))
        .filter((r: any) => ["email", "popup"].includes(r.method) && Number.isFinite(r.minutes) && r.minutes >= 0);

      const eventBody: any = {
        summary,
        start: { dateTime: startDateTime, timeZone: "America/Sao_Paulo" },
        end: { dateTime: endDateTime, timeZone: "America/Sao_Paulo" },
      };
      if (description) eventBody.description = description;
      if (location) eventBody.location = location;
      if (attendees.length) eventBody.attendees = attendees;
      eventBody.reminders = useDefaultReminders
        ? { useDefault: true }
        : (overrides.length ? { useDefault: false, overrides } : { useDefault: false });

      // ⚡ Persiste metadados do lead em extendedProperties.private — fonte canônica
      // para quando o front quiser ler o lead vinculado sem depender do regex do description.
      if (leadInfo.displayName || leadId || brokerId || brokerName) {
        const priv: Record<string, string> = {};
        if (leadId) priv.lead_id = leadId;
        if (leadInfo.displayName) priv.client_name = leadInfo.displayName;
        if (leadInfo.handle) priv.client_handle = leadInfo.handle;
        if (leadInfo.phone) priv.client_phone = leadInfo.phone;
        if (leadInfo.email) priv.client_email = leadInfo.email;
        if (brokerId) priv.broker_id = brokerId;
        if (brokerName) priv.broker_name = brokerName;
        eventBody.extendedProperties = { private: priv };
      }

      const created = await gFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: "POST",
        body: JSON.stringify(eventBody),
      });

      // Mirror em oncall_events (best-effort; tabela é opcional, hoje pode não existir)
      try {
        await service.from("oncall_events").insert({
          company_id: profile.company_id,
          calendar_id: calendarId,
          google_event_id: created?.id || null,
          title: summary,
          description,
          starts_at: startDateTime,
          ends_at: endDateTime,
          client_name: leadInfo.displayName || null,
          client_email: leadInfo.email || (attendeeEmails[0] || null),
          client_phone: leadInfo.phone || null,
          client_handle: leadInfo.handle || null,
          lead_id: leadId || null,
          property_title: summary,
          address: location || null,
          type: "Visita",
          status: "Agendado",
        });
      } catch (e) {
        // silencioso: schema pode não ter todas as colunas / tabela pode não existir
        console.warn("oncall_events insert (não-fatal):", (e as Error).message);
      }

      return new Response(JSON.stringify({
        ...created,
        success: true,
        broker_id: brokerId || null,
        broker_name: brokerName || null,
        client_resolved: leadInfo.displayName ? {
          name: leadInfo.displayName,
          handle: leadInfo.handle || null,
          phone: leadInfo.phone || null,
          email: leadInfo.email || null,
        } : null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel_event_from_n8n") {
      const calendarId = String(body?.calendar_id || "").trim();
      const eventId = String(body?.event_id || body?.google_event_id || "").trim();
      const leadId = String(body?.lead_id || body?.session_id || "").trim();

      if (!calendarId || !eventId) {
        return new Response(JSON.stringify({
          success: false,
          error: "calendar_id e event_id são obrigatórios",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Remove o evento no Google Calendar.
      await gFetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE" },
      );

      // Atualiza mirror local do evento (best-effort).
      let oncallUpdated = false;
      try {
        const { error } = await service
          .from("oncall_events")
          .update({
            status: "Cancelado",
            updated_at: new Date().toISOString(),
          })
          .eq("company_id", profile.company_id)
          .eq("google_event_id", eventId);
        oncallUpdated = !error;
      } catch {
        oncallUpdated = false;
      }

      // Move lead para estágio "Visita Cancelada" no CRM (best-effort).
      let leadUpdated = false;
      if (leadId) {
        try {
          const { error } = await service
            .from("leads")
            .update({
              stage: "Visita Cancelada",
              updated_at: new Date().toISOString(),
            })
            .eq("id", leadId)
            .eq("company_id", profile.company_id);
          leadUpdated = !error;
        } catch {
          leadUpdated = false;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        calendar_id: calendarId,
        event_id: eventId,
        lead_id: leadId || null,
        lead_stage_updated: leadUpdated,
        oncall_event_updated: oncallUpdated,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "pick_broker_queue") {
      const queuePick = await pickNextBrokerFromQueue(
        service,
        profile.company_id,
        String(body?.calendar_id || "").trim() || undefined,
      );

      if (!queuePick) {
        return new Response(JSON.stringify({
          success: false,
          error: "Nenhum corretor elegível encontrado na fila (verifique oncall_schedules.assigned_user_id)",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        broker_id: queuePick.broker_id,
        broker_name: queuePick.broker_name,
        calendar_id: queuePick.calendar_id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_event") {
      const calendarId = String(body?.calendar_id || "");
      if (!calendarId) {
        return new Response(JSON.stringify({ success: false, error: "calendar_id é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const eventBody = body?.event || {};
      const created = await gFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: "POST",
        body: JSON.stringify(eventBody),
      });
      return new Response(JSON.stringify({ success: true, event: created }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "action inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
