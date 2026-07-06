/**
 * ai-test-api — ingestão de respostas da IA no simulador "Testar IA".
 *
 * POST JSON (service_role ou x-n8n-secret):
 * ingest_text:
 * {
 *   "action": "ingest_text",
 *   "company_id": "uuid",
 *   "session_id": "uuid",
 *   "mensagem": "resposta da IA"
 * }
 *
 * ingest_image:
 * {
 *   "action": "ingest_image",
 *   "company_id": "uuid",
 *   "session_id": "uuid",
 *   "media_url": "https://...",
 *   "mensagem": "legenda opcional",
 *   "mime_type": "image/jpeg"
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
    return json({ success: false, error: "server_misconfigured_missing_service_role" }, 500);
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
  const internalOk = !!internalKey && internalKey === env("N8N_INTERNAL_API_KEY", "");

  if (keyMatch(apikey) || keyMatch(bearer) || jwtServiceRole || internalOk) {
    return null;
  }

  return json(
    {
      success: false,
      error: "unauthorized",
      hint: "Headers: apikey + Authorization: Bearer <service_role>.",
    },
    401,
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const authErr = assertServiceRoleAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action || "").trim();
    const companyId = String(body.company_id || "").trim();
    const sessionId = String(body.session_id || "").trim();

    if (!companyId) return json({ success: false, error: "company_id é obrigatório" }, 400);
    if (!sessionId) return json({ success: false, error: "session_id é obrigatório" }, 400);
    if (!isUuid(sessionId)) {
      return json({ success: false, error: "session_id deve ser um UUID" }, 400);
    }

    const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });

    if (action === "ingest_text") {
      const mensagem = String(body.mensagem ?? body.message ?? body.text ?? "").trim();
      if (!mensagem) return json({ success: false, error: "mensagem é obrigatória" }, 400);

      const { data, error } = await service
        .from("ai_test_messages")
        .insert({
          company_id: companyId,
          session_id: sessionId,
          role: "assistant",
          message_type: "text",
          content: mensagem,
        })
        .select("id, company_id, session_id, role, message_type, content, media_url, created_at")
        .single();

      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true, data });
    }

    if (action === "ingest_image") {
      const mediaUrl = String(
        body.media_url ?? body.image_url ?? body.url ?? "",
      ).trim();
      if (!mediaUrl) return json({ success: false, error: "media_url é obrigatório" }, 400);

      const mensagem = String(body.mensagem ?? body.caption ?? body.message ?? "").trim() || null;
      const mimeType = String(body.mime_type ?? body.mimeType ?? "image/jpeg").trim() || null;

      const { data, error } = await service
        .from("ai_test_messages")
        .insert({
          company_id: companyId,
          session_id: sessionId,
          role: "assistant",
          message_type: "image",
          content: mensagem,
          media_url: mediaUrl,
          mime_type: mimeType,
        })
        .select("id, company_id, session_id, role, message_type, content, media_url, mime_type, created_at")
        .single();

      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true, data });
    }

    return json(
      {
        success: false,
        error: "action inválida (ingest_text|ingest_image)",
      },
      400,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ai-test-api]", msg);
    return json({ success: false, error: msg }, 500);
  }
});
