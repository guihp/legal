// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const [type, token] = h.split(" ");
  if (!type || !token) return null;
  if (type.toLowerCase() !== "bearer") return null;
  return token;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(size = 40): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type ApiKeyRow = {
  id: string;
  company_id: string;
  is_active: boolean;
};

async function resolveCompanyFromApiKey(rawKey: string): Promise<ApiKeyRow | null> {
  const hash = await sha256Hex(rawKey);
  const { data } = await supabaseAdmin
    .from("company_api_keys")
    .select("id, company_id, is_active")
    .eq("key_hash", hash)
    .eq("is_active", true)
    .maybeSingle();
  return (data as ApiKeyRow | null) ?? null;
}

async function getAuthenticatedProfile(req: Request) {
  const token = getBearerToken(req);
  if (!token) return { error: "Token ausente" } as const;
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return { error: "Token inválido" } as const;

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id, role, company_id, is_active")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) return { error: "Perfil inativo ou inexistente" } as const;
  return { profile } as const;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    const apiKey = req.headers.get("x-api-key")?.trim();

    // Modo n8n externo: autenticação por API key da empresa
    if (apiKey) {
      const keyRow = await resolveCompanyFromApiKey(apiKey);
      if (!keyRow) return json({ success: false, error: "API key inválida" }, 401);

      await supabaseAdmin
        .from("company_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", keyRow.id);

      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const name = (body?.name || "").toString().trim();
        const email = body?.email ? String(body.email).trim() : null;
        const phone = body?.phone ? String(body.phone).trim() : null;

        if (!name || (!email && !phone)) {
          return json({ success: false, error: "Campos obrigatórios: name e (email ou phone)" }, 400);
        }

        // Garantir atribuição para aparecer no Pipeline/Clientes (corretores veem apenas leads atribuídos)
        let ownerId: string | null = body?.id_corretor_responsavel ? String(body.id_corretor_responsavel) : null;
        if (!ownerId) {
          const { data: defaultOwner } = await supabaseAdmin
            .from("user_profiles")
            .select("id, role, is_active")
            .eq("company_id", keyRow.company_id)
            .eq("is_active", true)
            .in("role", ["admin", "gestor", "corretor"])
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          ownerId = (defaultOwner as any)?.id || null;
        }

        const payload = {
          company_id: keyRow.company_id,
          name,
          email,
          phone,
          source: body?.source ? String(body.source).trim() : "n8n",
          message: body?.message ? String(body.message).trim() : null,
          stage: body?.stage ? String(body.stage).trim() : "Novo Lead",
          interest: body?.interest ? String(body.interest).trim() : "",
          estimated_value: typeof body?.estimated_value === "number" ? body.estimated_value : 0,
          notes: body?.notes ? String(body.notes).trim() : "",
          cpf: body?.cpf ? String(body.cpf).trim() : null,
          endereco: body?.endereco ? String(body.endereco).trim() : null,
          estado_civil: body?.estado_civil ? String(body.estado_civil).trim() : null,
          imovel_interesse: body?.imovel_interesse ? String(body.imovel_interesse).trim() : null,
          id_corretor_responsavel: ownerId,
          user_id: ownerId,
        };

        const { data, error } = await supabaseAdmin.from("leads").insert(payload).select().single();
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true, data }, 201);
      }

      if (req.method === "GET") {
        const url = new URL(req.url);
        const limitRaw = Number(url.searchParams.get("limit") || "50");
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 50;
        const stage = url.searchParams.get("stage");

        let q = supabaseAdmin
          .from("leads")
          .select("id,name,email,phone,source,stage,created_at,message,imovel_interesse")
          .eq("company_id", keyRow.company_id)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (stage) q = q.eq("stage", stage);

        const { data, error } = await q;
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true, data });
      }

      return json({ success: false, error: "Método não suportado" }, 405);
    }

    // Modo gerenciamento interno: usa JWT do usuário logado
    const auth = await getAuthenticatedProfile(req);
    if ("error" in auth) return json({ success: false, error: auth.error }, 401);
    const { profile } = auth;
    if (!profile.company_id) return json({ success: false, error: "Usuário sem company_id" }, 400);

    const role = String(profile.role || "");
    if (!["admin", "gestor", "super_admin"].includes(role)) {
      return json({ success: false, error: "Sem permissão para gerenciar API keys" }, 403);
    }

    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("company_api_keys")
        .select("id,key_name,key_prefix,is_active,created_at,last_used_at,revoked_at")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });

      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true, data });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const keyName = (body?.name || "n8n").toString().trim().slice(0, 80);
      const raw = `imobi_${profile.company_id.replaceAll("-", "").slice(0, 8)}_${randomToken(20)}`;
      const hash = await sha256Hex(raw);
      const prefix = raw.slice(0, 18);

      const { data, error } = await supabaseAdmin
        .from("company_api_keys")
        .insert({
          company_id: profile.company_id,
          key_name: keyName || "n8n",
          key_prefix: prefix,
          key_hash: hash,
          created_by: profile.id,
          is_active: true,
        })
        .select("id,key_name,key_prefix,is_active,created_at")
        .single();

      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true, data: { ...data, raw_key: raw } }, 201);
    }

    if (req.method === "DELETE") {
      const body = await req.json().catch(() => ({}));
      const id = String(body?.id || "").trim();
      if (!id) return json({ success: false, error: "Informe o id da chave para revogar" }, 400);

      const { error } = await supabaseAdmin
        .from("company_api_keys")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("company_id", profile.company_id);
      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true });
    }

    return json({ success: false, error: "Método não suportado" }, 405);
  } catch (e: any) {
    return json({ success: false, error: e?.message || "Erro interno" }, 500);
  }
});

