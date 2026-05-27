/**
 * mensagem-ingest — INSERT idempotente em public.mensagens via RPC upsert_mensagem.
 * Evita 409 quando o n8n reprocessa o mesmo wamid / mensagem_id.
 *
 * POST JSON:
 * {
 *   "company_id": "uuid",
 *   "phone": "5511999999999",
 *   "mensagem_id": "wamid....",
 *   "mensage_type": "conversation",
 *   "text": "olá",
 *   "type": "lead",
 *   "plataforma": "WhatsApp",
 *   "instancia": "opcional"
 * }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-n8n-secret",
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

function getJwtPayload(token: string): { role?: string; ref?: string } {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    return JSON.parse(atob(parts[1]));
  } catch {
    return {};
  }
}

function getBearerToken(req: Request): string {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return h.replace(/^Bearer\s+/i, "").trim();
}

function getApiKeyHeader(req: Request): string {
  const raw = req.headers.get("apikey") || req.headers.get("x-api-key") || "";
  return raw.replace(/^Bearer\s+/i, "").trim();
}

function projectRefFromUrl(): string {
  const m = env("SUPABASE_URL").match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? "";
}

function assertServiceRoleAuth(req: Request): Response | null {
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    return json({ ok: false, error: "server_misconfigured_missing_service_role" }, 500);
  }

  const apikey = getApiKeyHeader(req);
  const bearer = getBearerToken(req);
  const token = bearer || apikey;
  const keyMatch = (t: string) => t.length > 0 && t === serviceKey;
  const jwt = getJwtPayload(token);
  const ref = projectRefFromUrl();
  const jwtServiceRole =
    jwt.role === "service_role" && (!jwt.ref || !ref || jwt.ref === ref);
  const internalKey = (req.headers.get("x-n8n-secret") || "").trim();
  const internalOk =
    !!internalKey && internalKey === env("N8N_INTERNAL_API_KEY", "");

  if (keyMatch(apikey) || keyMatch(bearer) || jwtServiceRole || internalOk) {
    return null;
  }

  return json(
    {
      ok: false,
      error: "unauthorized",
      hint:
        "Headers: apikey + Authorization: Bearer <service_role> (Supabase → Settings → API).",
    },
    401,
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const authErr = assertServiceRoleAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const companyId = String(body.company_id ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const mensagemId = String(body.mensagem_id ?? "").trim();

    if (!companyId) return json({ ok: false, error: "company_id_required" }, 400);
    if (!phone) return json({ ok: false, error: "phone_required" }, 400);

    const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });

    const { data, error } = await service.rpc("upsert_mensagem", {
      p_company_id: companyId,
      p_phone: phone,
      p_mensagem_id: mensagemId || null,
      p_mensage_type: body.mensage_type != null ? String(body.mensage_type) : null,
      p_text: body.text != null ? String(body.text) : null,
      p_type: body.type != null ? String(body.type) : "lead",
      p_plataforma: body.plataforma != null ? String(body.plataforma) : "WhatsApp",
      p_instancia: body.instancia != null ? String(body.instancia) : null,
      p_conteudo_media:
        body.conteudo_media != null ? String(body.conteudo_media) : null,
    });

    if (error) {
      console.error("[mensagem-ingest]", error.message);
      return json({ ok: false, error: error.message, code: error.code }, 400);
    }

    return json({ ok: true, row: data, duplicate_handled: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[mensagem-ingest]", msg);
    return json({ ok: false, error: msg }, 500);
  }
});
