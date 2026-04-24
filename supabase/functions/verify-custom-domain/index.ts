// deno-lint-ignore-file no-explicit-any
// Edge function: verify-custom-domain
//
// Recebe { domain_id } e verifica via DNS-over-HTTPS (Cloudflare 1.1.1.1):
//   1. Se existe um TXT em _iafe-verify.{hostname} contendo o verification_token
//   2. Se existe um CNAME ou A apontando pro target_cname configurado
//
// Se ambos OK → marca status='verified' via RPC mark_custom_domain_verified.
// Falhas atualizam last_error pra o usuário ver no painel.
//
// NOTA sobre SSL: a emissão de certificado é responsabilidade do proxy
// (Coolify/Traefik ou Caddy on_demand_tls à frente do Coolify). Essa função
// NÃO emite SSL — ela só libera o status pra o app aceitar o hostname como válido.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// DNS-over-HTTPS (Cloudflare). Retorna o JSON padrão RFC 8427.
async function dnsQuery(name: string, type: "TXT" | "CNAME" | "A"): Promise<string[]> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url, { headers: { Accept: "application/dns-json" } });
  if (!res.ok) throw new Error(`DNS lookup ${type} ${name} retornou ${res.status}`);
  const json = await res.json();
  const answers: any[] = Array.isArray(json?.Answer) ? json.Answer : [];
  return answers
    .filter((a) => a && typeof a.data === "string")
    .map((a) => String(a.data).trim().replace(/^"(.*)"$/, "$1")); // remove aspas do TXT
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Auth: exige bearer token do usuário pra garantir que é um autenticado da mesma empresa
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

    // Busca domain com service role (confere depois se o user é da mesma company)
    const { data: domain, error: qErr } = await supabaseAdmin
      .from("company_custom_domains")
      .select("id, company_id, hostname, verification_token, target_cname, status")
      .eq("id", domainId)
      .maybeSingle();

    if (qErr || !domain) {
      return new Response(
        JSON.stringify({ ok: false, error: "domain_not_found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
      );
    }

    // Confere se o user pertence à mesma company (ou é super_admin)
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
    const expectedToken = String(domain.verification_token);
    const expectedTarget = String(domain.target_cname || "").toLowerCase().trim();

    const errors: string[] = [];

    // 1. Verifica TXT de posse
    let txtOk = false;
    try {
      const txts = await dnsQuery(`_iafe-verify.${hostname}`, "TXT");
      txtOk = txts.some((t) => t.includes(expectedToken));
      if (!txtOk) {
        errors.push(
          `TXT record _iafe-verify.${hostname} não encontrado ou não contém o token de verificação.`,
        );
      }
    } catch (e) {
      errors.push(`Falha ao consultar TXT _iafe-verify.${hostname}: ${(e as Error).message}`);
    }

    // 2. Verifica CNAME ou A apontando pro target
    let pointOk = false;
    if (expectedTarget) {
      try {
        const cnames = await dnsQuery(hostname, "CNAME");
        // DoH retorna CNAME com ponto final: "sites.iafeoficial.com."
        pointOk = cnames.some((c) => {
          const normalized = c.replace(/\.$/, "").toLowerCase();
          return normalized === expectedTarget || normalized.endsWith("." + expectedTarget);
        });

        if (!pointOk) {
          // Tenta A record (caso apex com CNAME flattening ou A record manual)
          const targetIps = await dnsQuery(expectedTarget, "A");
          if (targetIps.length > 0) {
            const hostIps = await dnsQuery(hostname, "A");
            pointOk = hostIps.some((ip) => targetIps.includes(ip));
          }
        }

        if (!pointOk) {
          errors.push(
            `Não encontramos CNAME de ${hostname} apontando pra ${expectedTarget} nem A record compatível.`,
          );
        }
      } catch (e) {
        errors.push(`Falha ao consultar DNS de ${hostname}: ${(e as Error).message}`);
      }
    }

    const allOk = txtOk && pointOk;

    // Marca resultado no banco via RPC (service role)
    await supabaseAdmin.rpc("mark_custom_domain_verified", {
      p_domain_id: domainId,
      p_success: allOk,
      p_error: allOk ? null : errors.join(" | "),
    });

    return new Response(
      JSON.stringify({
        ok: allOk,
        hostname,
        checks: {
          txt: txtOk,
          dns_target: pointOk,
        },
        errors: allOk ? [] : errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err: any) {
    console.error("verify-custom-domain erro:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || "internal_error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
