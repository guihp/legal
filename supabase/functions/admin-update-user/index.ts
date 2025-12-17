// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export type UpdateUserPayload = {
  user_id: string;
  email?: string;
  full_name?: string;
  phone?: string;
  role?: "corretor" | "gestor" | "admin";
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const accessToken = authHeader.replace("Bearer ", "");
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Identificar o solicitante
    const { data: authUserData, error: authErr } = await adminClient.auth.getUser(accessToken);
    if (authErr || !authUserData.user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const requesterId = authUserData.user.id;

    // Buscar perfil do solicitante para validar role
    const { data: requesterProfile, error: profileErr } = await adminClient
      .from("user_profiles")
      .select("id, role")
      .eq("id", requesterId)
      .single();

    if (profileErr || !requesterProfile) {
      return jsonResponse({ error: "Requester profile not found" }, 403);
    }

    // Verificar permissões: admin pode editar qualquer um, gestor pode editar corretores
    if (!["admin", "gestor"].includes(requesterProfile.role)) {
      return jsonResponse({ error: "Forbidden: insufficient permissions" }, 403);
    }

    const payload = (await req.json()) as UpdateUserPayload;
    if (!payload?.user_id) {
      return jsonResponse({ error: "Missing user_id" }, 400);
    }

    // Buscar o usuário alvo para validar se gestor pode editá-lo
    const { data: targetProfile, error: targetErr } = await adminClient
      .from("user_profiles")
      .select("id, role")
      .eq("id", payload.user_id)
      .single();

    if (targetErr || !targetProfile) {
      return jsonResponse({ error: "Target user not found" }, 404);
    }

    // Gestor só pode editar corretores
    if (requesterProfile.role === "gestor" && targetProfile.role !== "corretor") {
      return jsonResponse({ error: "Gestor pode editar apenas corretores" }, 403);
    }

    // Preparar atualizações para auth.users (apenas campos permitidos)
    const authUpdates: any = {};
    if (payload.email) {
      authUpdates.email = payload.email;
    }

    // Preparar atualizações para user_profiles
    const profileUpdates: any = {};
    if (payload.full_name !== undefined) profileUpdates.full_name = payload.full_name;
    if (payload.phone !== undefined) profileUpdates.phone = payload.phone;
    if (payload.email !== undefined) profileUpdates.email = payload.email;
    
    // Apenas admin pode alterar role
    if (payload.role !== undefined && requesterProfile.role === "admin") {
      profileUpdates.role = payload.role;
    }

    // 1. Atualizar auth.users com sincronização completa
    const authUpdatePayload: any = {};
    if (payload.email) authUpdatePayload.email = payload.email;
    if (payload.phone !== undefined) authUpdatePayload.phone = payload.phone;
    
    // Atualizar user_metadata para sincronização
    if (payload.full_name || payload.role) {
      // Buscar metadata atual
      const { data: currentUser } = await adminClient.auth.admin.getUserById(payload.user_id);
      const currentMetadata = currentUser.user?.user_metadata || {};
      
      authUpdatePayload.user_metadata = {
        ...currentMetadata,
        ...(payload.full_name && { full_name: payload.full_name }),
        ...(payload.role && { role: payload.role })
      };
    }

    if (Object.keys(authUpdatePayload).length > 0) {
      const { error: authUpdateErr } = await adminClient.auth.admin.updateUserById(
        payload.user_id,
        authUpdatePayload
      );

      if (authUpdateErr) {
        return jsonResponse({ 
          error: `Erro ao atualizar auth.users: ${authUpdateErr.message}` 
        }, 400);
      }
    }

    // 2. Atualizar user_profiles (triggers automáticos cuidarão da sincronização)
    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileUpdateErr } = await adminClient
        .from("user_profiles")
        .update(profileUpdates)
        .eq("id", payload.user_id);

      if (profileUpdateErr) {
        return jsonResponse({ 
          error: `Erro ao atualizar user_profiles: ${profileUpdateErr.message}` 
        }, 400);
      }
    }

    return jsonResponse({ 
      success: true, 
      user_id: payload.user_id,
      updated_auth: Object.keys(authUpdatePayload),
      updated_profile: Object.keys(profileUpdates)
    });

  } catch (e: any) {
    return jsonResponse({ 
      error: e?.message || "Internal error" 
    }, 500);
  }
});