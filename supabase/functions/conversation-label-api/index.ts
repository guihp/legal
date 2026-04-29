import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function env(name: string, fallback = "") {
  return Deno.env.get(name) ?? fallback;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
      if (!companyId) return json({ success: false, error: "company_id é obrigatório" }, 400);
      profile = { id: null, role: "system", company_id: companyId };
    } else {
      const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
        global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      });
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) return json({ success: false, error: "Unauthorized" }, 401);

      const { data: userProfile, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, role, company_id")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !userProfile?.company_id) {
        return json({ success: false, error: "Perfil sem empresa" }, 400);
      }
      profile = userProfile;
    }

    if (action === "set_label") {
      const channel = String(body?.channel || "").trim().toLowerCase();
      const sessionId = String(body?.session_id || "").trim();
      const status = String(body?.status || "").trim().toLowerCase();

      if (!["whatsapp", "instagram"].includes(channel)) {
        return json({ success: false, error: "channel inválido (whatsapp|instagram)" }, 400);
      }
      if (!sessionId) return json({ success: false, error: "session_id é obrigatório" }, 400);
      if (!["ai_ativa", "humano", "humano_solicitado"].includes(status)) {
        return json({ success: false, error: "status inválido (ai_ativa|humano|humano_solicitado)" }, 400);
      }

      const payload = {
        company_id: profile.company_id,
        channel,
        session_id: sessionId,
        status,
        updated_by: profile.id,
      };

      const { data, error } = await service
        .from("conversation_contact_labels")
        .upsert(payload, { onConflict: "company_id,channel,session_id" })
        .select("id, company_id, channel, session_id, status, updated_at")
        .single();

      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true, data });
    }

    if (action === "get_labels") {
      const channel = String(body?.channel || "").trim().toLowerCase();
      const sessionIds = Array.isArray(body?.session_ids)
        ? body.session_ids.map((s: unknown) => String(s || "").trim()).filter(Boolean)
        : [];

      if (!["whatsapp", "instagram"].includes(channel)) {
        return json({ success: false, error: "channel inválido (whatsapp|instagram)" }, 400);
      }

      if (!sessionIds.length) return json({ success: true, labels: [] });

      const { data, error } = await service
        .from("conversation_contact_labels")
        .select("session_id, status")
        .eq("company_id", profile.company_id)
        .eq("channel", channel)
        .in("session_id", sessionIds as string[]);

      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true, labels: data || [] });
    }

    return json({ success: false, error: "action inválida" }, 400);
  } catch (e: any) {
    return json({ success: false, error: e?.message || "Erro interno" }, 500);
  }
});
