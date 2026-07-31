import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_COLORS = new Set(["emerald", "amber", "orange", "sky", "violet", "rose", "slate"]);
const SLUG_RE = /^[a-z][a-z0-9_]*$/;

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

function isManagerRole(role: string): boolean {
  return ["admin", "gestor", "super_admin", "system"].includes(role);
}

function normalizeSlug(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
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

    if (action === "list_catalog") {
      const { data, error } = await service
        .from("company_ai_labels")
        .select("id, company_id, slug, name, color, is_system, sort_order, created_at, updated_at")
        .eq("company_id", profile.company_id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true, labels: data || [] });
    }

    if (action === "upsert_catalog") {
      if (!isManagerRole(profile.role)) {
        return json({ success: false, error: "Apenas gestor/admin podem gerenciar o catálogo" }, 403);
      }

      const id = body?.id ? String(body.id).trim() : "";
      const name = String(body?.name || "").trim();
      let slug = normalizeSlug(String(body?.slug || name));
      const color = String(body?.color || "slate").trim().toLowerCase();
      const sortOrder = Number.isFinite(Number(body?.sort_order))
        ? Number(body.sort_order)
        : 100;

      if (!name) return json({ success: false, error: "name é obrigatório" }, 400);
      if (!slug || !SLUG_RE.test(slug)) {
        return json({ success: false, error: "slug inválido (snake_case, começa com letra)" }, 400);
      }
      if (!ALLOWED_COLORS.has(color)) {
        return json({
          success: false,
          error: "color inválida (emerald|amber|orange|sky|violet|rose|slate)",
        }, 400);
      }

      if (id) {
        const { data: existing, error: existingError } = await service
          .from("company_ai_labels")
          .select("id, is_system, slug, name")
          .eq("id", id)
          .eq("company_id", profile.company_id)
          .maybeSingle();

        if (existingError) return json({ success: false, error: existingError.message }, 400);
        if (!existing) return json({ success: false, error: "Etiqueta não encontrada" }, 404);

        // Sistema: só cor (e sort_order). Nome/slug fixos no banco.
        const patch: Record<string, unknown> = existing.is_system
          ? { color, sort_order: sortOrder }
          : { name, color, slug, sort_order: sortOrder };

        const { data, error } = await service
          .from("company_ai_labels")
          .update(patch)
          .eq("id", id)
          .eq("company_id", profile.company_id)
          .select("id, company_id, slug, name, color, is_system, sort_order, created_at, updated_at")
          .single();

        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true, data });
      }

      const { data, error } = await service
        .from("company_ai_labels")
        .insert({
          company_id: profile.company_id,
          slug,
          name,
          color,
          is_system: false,
          sort_order: sortOrder,
        })
        .select("id, company_id, slug, name, color, is_system, sort_order, created_at, updated_at")
        .single();

      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true, data });
    }

    if (action === "delete_catalog") {
      if (!isManagerRole(profile.role)) {
        return json({ success: false, error: "Apenas gestor/admin podem gerenciar o catálogo" }, 403);
      }

      const id = String(body?.id || "").trim();
      const slug = normalizeSlug(String(body?.slug || ""));
      if (!id && !slug) return json({ success: false, error: "id ou slug é obrigatório" }, 400);

      let query = service
        .from("company_ai_labels")
        .select("id, is_system, slug")
        .eq("company_id", profile.company_id);

      if (id) query = query.eq("id", id);
      else query = query.eq("slug", slug);

      const { data: existing, error: existingError } = await query.maybeSingle();
      if (existingError) return json({ success: false, error: existingError.message }, 400);
      if (!existing) return json({ success: false, error: "Etiqueta não encontrada" }, 404);
      if (existing.is_system) {
        return json({ success: false, error: "Etiquetas de sistema não podem ser excluídas" }, 400);
      }

      const { error } = await service
        .from("company_ai_labels")
        .delete()
        .eq("id", existing.id)
        .eq("company_id", profile.company_id);

      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true, deleted: existing.id });
    }

    if (action === "set_label") {
      const channel = String(body?.channel || "").trim().toLowerCase();
      const sessionId = String(body?.session_id || "").trim();
      const status = normalizeSlug(String(body?.status || ""));

      if (!["whatsapp", "instagram"].includes(channel)) {
        return json({ success: false, error: "channel inválido (whatsapp|instagram)" }, 400);
      }
      if (!sessionId) return json({ success: false, error: "session_id é obrigatório" }, 400);
      if (!status) return json({ success: false, error: "status é obrigatório" }, 400);

      const { data: catalogRow, error: catalogError } = await service
        .from("company_ai_labels")
        .select("slug")
        .eq("company_id", profile.company_id)
        .eq("slug", status)
        .maybeSingle();

      if (catalogError) return json({ success: false, error: catalogError.message }, 400);
      if (!catalogRow) {
        return json({
          success: false,
          error: `status '${status}' não existe no catálogo da empresa`,
        }, 400);
      }

      const payload = {
        company_id: profile.company_id,
        channel,
        session_id: sessionId,
        status,
        updated_by: profile.id,
      };

      // Atendimento: exclusivos entre si; tags (follow_up_*, custom) são aditivas.
      const attendance = new Set(["ai_ativa", "humano", "humano_solicitado"]);
      if (attendance.has(status)) {
        await service
          .from("conversation_contact_labels")
          .delete()
          .eq("company_id", profile.company_id)
          .eq("channel", channel)
          .eq("session_id", sessionId)
          .in("status", [...attendance].filter((s) => s !== status));
      }

      const { data, error } = await service
        .from("conversation_contact_labels")
        .upsert(payload, { onConflict: "company_id,channel,session_id,status" })
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
