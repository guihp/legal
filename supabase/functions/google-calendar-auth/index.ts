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

function buildGoogleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set(
    "scope",
    [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "openid",
      "email",
      "profile",
    ].join(" "),
  );
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("state", params.state);
  return u.toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const user = authData.user;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, role, company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return new Response(JSON.stringify({ success: false, error: "Perfil sem empresa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
      const { data: integration } = await service
        .from("company_google_calendar_integrations")
        .select("google_email, connected_at, expires_at")
        .eq("company_id", profile.company_id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          connected: !!integration,
          google_email: integration?.google_email || null,
          connected_at: integration?.connected_at || null,
          expires_at: integration?.expires_at || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const googleClientId = env("GOOGLE_CLIENT_ID");
    const googleClientSecret = env("GOOGLE_CLIENT_SECRET");
    const defaultRedirect = env("GOOGLE_REDIRECT_URI");

    if (!googleClientId || !googleClientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Google OAuth não configurado no Supabase Secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "get_auth_url") {
      if (!["admin", "gestor", "super_admin"].includes(profile.role)) {
        return new Response(JSON.stringify({ success: false, error: "Sem permissão para conectar agenda" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const redirectUri = String(body?.redirect_uri || defaultRedirect || "");
      if (!redirectUri) {
        return new Response(
          JSON.stringify({ success: false, error: "redirect_uri ausente (envie no body ou configure GOOGLE_REDIRECT_URI)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const statePayload = {
        company_id: profile.company_id,
        user_id: user.id,
        t: Date.now(),
      };
      const state = btoa(JSON.stringify(statePayload));
      const authUrl = buildGoogleAuthUrl({
        clientId: googleClientId,
        redirectUri,
        state,
      });

      return new Response(JSON.stringify({ success: true, auth_url: authUrl, state }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "exchange_code") {
      if (!["admin", "gestor", "super_admin"].includes(profile.role)) {
        return new Response(JSON.stringify({ success: false, error: "Sem permissão para conectar agenda" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const code = String(body?.code || "");
      const redirectUri = String(body?.redirect_uri || defaultRedirect || "");
      if (!code) {
        return new Response(JSON.stringify({ success: false, error: "Código OAuth ausente" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!redirectUri) {
        return new Response(
          JSON.stringify({ success: false, error: "redirect_uri ausente (envie no body ou configure GOOGLE_REDIRECT_URI)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenJson = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenJson?.access_token) {
        return new Response(
          JSON.stringify({ success: false, error: tokenJson?.error_description || "Falha ao trocar code por token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const accessToken = tokenJson.access_token as string;
      const refreshToken = tokenJson.refresh_token as string;
      const expiresIn = Number(tokenJson.expires_in || 3600);
      const scope = String(tokenJson.scope || "");
      const tokenType = String(tokenJson.token_type || "Bearer");
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      const meRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const meJson = await meRes.json().catch(() => ({}));
      const googleEmail = String(meJson?.email || "");

      const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
      const { error: upsertError } = await service
        .from("company_google_calendar_integrations")
        .upsert({
          company_id: profile.company_id,
          google_email: googleEmail || null,
          access_token: accessToken,
          refresh_token: refreshToken || tokenJson.refresh_token || "",
          token_type: tokenType,
          scope,
          expires_at: expiresAt,
          created_by: user.id,
          connected_at: new Date().toISOString(),
        }, { onConflict: "company_id" });

      if (upsertError) {
        return new Response(JSON.stringify({ success: false, error: upsertError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, google_email: googleEmail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
      const { error: deleteError } = await service
        .from("company_google_calendar_integrations")
        .delete()
        .eq("company_id", profile.company_id);

      if (deleteError) {
        return new Response(JSON.stringify({ success: false, error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
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
