// deno-lint-ignore-file no-explicit-any
// Edge function: remove-custom-domain
//
// Remove um domínio customizado:
// 1. Remove o domínio do Coolify (via API)
// 2. Deleta o registro de company_custom_domains
// 3. Restart do app pra o proxy parar de servir aquele hostname
//
// Exige autenticação — só usuários da mesma empresa ou super_admin.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// =======================================================================
// Coolify API helpers
// =======================================================================
const COOLIFY_API_URL = Deno.env.get("COOLIFY_API_URL") ?? "";
const COOLIFY_API_TOKEN = Deno.env.get("COOLIFY_API_TOKEN") ?? "";
const COOLIFY_APP_UUID = Deno.env.get("COOLIFY_APP_UUID") ?? "";

function hasCoolifyConfig(): boolean {
  return !!(COOLIFY_API_URL && COOLIFY_API_TOKEN && COOLIFY_APP_UUID);
}

async function coolifyGetDomains(): Promise<string> {
  const res = await fetch(`${COOLIFY_API_URL}/api/v1/applications/${COOLIFY_APP_UUID}`, {
    headers: {
      Authorization: `Bearer ${COOLIFY_API_TOKEN}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Coolify GET falhou (${res.status}): ${body}`);
  }
  const data = await res.json();
  return String(data.fqdn || "");
}

async function coolifySetDomains(domains: string): Promise<void> {
  const res = await fetch(`${COOLIFY_API_URL}/api/v1/applications/${COOLIFY_APP_UUID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${COOLIFY_API_TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ domains }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Coolify PATCH falhou (${res.status}): ${body}`);
  }
}

async function coolifyRestart(): Promise<void> {
  const res = await fetch(
    `${COOLIFY_API_URL}/api/v1/applications/${COOLIFY_APP_UUID}/restart`,
    {
      headers: {
        Authorization: `Bearer ${COOLIFY_API_TOKEN}`,
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Coolify restart falhou (${res.status}): ${body}`);
  }
}

/**
 * Remove um hostname do campo domains do app no Coolify.
 */
async function coolifyRemoveDomain(hostname: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const currentDomains = await coolifyGetDomains();

    const targetDomain = `https://${hostname}`.toLowerCase();

    // Parse dos domínios atuais
    const domainList = currentDomains
      .split(",")
      .map((d: string) => d.trim())
      .filter(Boolean);

    // Filtra removendo o domínio
    const updatedList = domainList.filter(
      (d: string) => d.toLowerCase() !== targetDomain,
    );

    // Se não mudou nada, já foi removido antes
    if (updatedList.length === domainList.length) {
      console.log(`Domínio ${hostname} não estava no Coolify, pulando.`);
      return { ok: true };
    }

    // Garante que pelo menos o domínio principal permanece
    if (updatedList.length === 0) {
      console.warn("Não é possível remover todos os domínios do Coolify.");
      return { ok: false, error: "Não é possível remover o último domínio do Coolify." };
    }

    const updatedDomains = updatedList.join(",");
    console.log(`Atualizando Coolify domains: ${updatedDomains}`);
    await coolifySetDomains(updatedDomains);

    console.log("Reiniciando app no Coolify...");
    await coolifyRestart();

    return { ok: true };
  } catch (e: any) {
    console.error("Erro ao remover domínio no Coolify:", e.message);
    return { ok: false, error: e.message };
  }
}

// =======================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_auth" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 },
      );
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userData } = await supabaseUser.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: "invalid_session" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const domainId = body?.domain_id as string | undefined;
    if (!domainId) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_domain_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    // Busca domain com service role
    const { data: domain, error: qErr } = await supabaseAdmin
      .from("company_custom_domains")
      .select("id, company_id, hostname, status")
      .eq("id", domainId)
      .maybeSingle();

    if (qErr || !domain) {
      return new Response(
        JSON.stringify({ ok: false, error: "domain_not_found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
      );
    }

    // Confere permissão
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .maybeSingle();
    const isSuperAdmin = profile?.role === "super_admin";
    if (!isSuperAdmin && profile?.company_id !== domain.company_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "forbidden" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 },
      );
    }

    const hostname = String(domain.hostname).toLowerCase().trim();

    // Remove do Coolify (se estava verificado/ativo)
    let coolifyResult = { ok: true, error: undefined as string | undefined };
    if (
      hasCoolifyConfig() &&
      (domain.status === "verified" || domain.status === "active")
    ) {
      coolifyResult = await coolifyRemoveDomain(hostname);
    }

    // Deleta do banco (mesmo se Coolify falhou — o admin pode limpar depois)
    const { error: deleteError } = await supabaseAdmin
      .from("company_custom_domains")
      .delete()
      .eq("id", domainId);

    if (deleteError) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Erro ao deletar registro: ${deleteError.message}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        hostname,
        coolify_removed: coolifyResult.ok,
        coolify_error: coolifyResult.error || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err: any) {
    console.error("remove-custom-domain erro:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || "internal_error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
