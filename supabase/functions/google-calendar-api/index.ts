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
      } catch (refreshError) {
        // Mantém token atual para tentar uma chamada direta e retornar erro mais claro
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
        const json = await res.json().catch(() => ({}));
        return { res, json };
      };

      let { res, json } = await run(accessToken);

      // Retry once on unauthorized by forcing refresh
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
          // keep original error flow below
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

    if (action === "create_calendar") {
      if (!["admin", "gestor", "super_admin"].includes(profile.role)) {
        return new Response(JSON.stringify({ success: false, error: "Sem permissão para criar calendário" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const name = String(body?.name || "").trim();
      if (!name) {
        return new Response(JSON.stringify({ success: false, error: "Nome do calendário é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const json = await gFetch("https://www.googleapis.com/calendar/v3/calendars", {
        method: "POST",
        body: JSON.stringify({
          summary: name,
          description: `Calendário de ${name}`,
          timeZone: "America/Sao_Paulo",
        }),
      });
      return new Response(JSON.stringify({ success: true, calendar: json }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_calendar") {
      if (!["admin", "gestor", "super_admin"].includes(profile.role)) {
        return new Response(JSON.stringify({ success: false, error: "Sem permissão para excluir calendário" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const calendarId = String(body?.calendar_id || "");
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
      const calendarId = String(body?.calendar_id || "");
      if (!calendarId) {
        return new Response(JSON.stringify({ success: false, error: "calendar_id é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const startDateTime = String(body?.start || "").trim();
      const endDateTime = String(body?.end || "").trim();
      const summary = String(body?.summary || "Visita").trim();
      const description = String(body?.description || "").trim();
      const location = String(body?.location || "").trim();
      const useDefaultReminders = Boolean(body?.use_default_reminders ?? false);
      const attendeeEmails = Array.isArray(body?.attendees) ? body.attendees : [];
      const reminders = Array.isArray(body?.reminders) ? body.reminders : [];

      if (!startDateTime || !endDateTime) {
        return new Response(JSON.stringify({ success: false, error: "start e end são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const attendees = attendeeEmails
        .map((email: any) => String(email || "").trim())
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

      const created = await gFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: "POST",
        body: JSON.stringify(eventBody),
      });

      return new Response(JSON.stringify(created), {
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
      const json = await gFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: "POST",
        body: JSON.stringify(eventBody),
      });
      return new Response(JSON.stringify({ success: true, event: json }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_event") {
      const calendarId = String(body?.calendar_id || "");
      const eventId = String(body?.evento_id || body?.event_id || "");
      const update = body?.update || {};
      if (!calendarId || !eventId) {
        return new Response(JSON.stringify({ success: false, error: "calendar_id e evento_id são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const json = await gFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        body: JSON.stringify(update),
      });
      return new Response(JSON.stringify({ success: true, event: json }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_event") {
      const calendarId = String(body?.calendar_id || "");
      const eventId = String(body?.evento_id || body?.event_id || "");
      if (!calendarId || !eventId) {
        return new Response(JSON.stringify({ success: false, error: "calendar_id e evento_id são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await gFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
        method: "DELETE",
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_event_status") {
      const calendarId = String(body?.calendar_id || "");
      const eventId = String(body?.evento_id || body?.event_id || "");
      const responseStatus = String(body?.response_status || "needsAction");
      if (!calendarId || !eventId) {
        return new Response(JSON.stringify({ success: false, error: "calendar_id e evento_id são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Atualiza status no attendee principal (owner)
      const event = await gFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
      const attendees = Array.isArray(event?.attendees) ? event.attendees : [];
      const ownerEmail = integration.google_email ? String(integration.google_email).toLowerCase() : "";
      const updatedAttendees = attendees.map((a: any) => {
        const email = String(a?.email || "").toLowerCase();
        if (ownerEmail && email === ownerEmail) {
          return { ...a, responseStatus };
        }
        return a;
      });

      const json = await gFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        body: JSON.stringify({ attendees: updatedAttendees }),
      });
      return new Response(JSON.stringify({ success: true, event: json }), {
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
