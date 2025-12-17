// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export type DeleteUserPayload = {
  user_id: string;
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

    // Verificar permissões: admin e gestor podem deletar usuários
    if (requesterProfile.role !== "admin" && requesterProfile.role !== "gestor") {
      return jsonResponse({ error: "Forbidden: only admin or gestor can delete users" }, 403);
    }

    const payload = (await req.json()) as DeleteUserPayload;
    if (!payload?.user_id) {
      return jsonResponse({ error: "Missing user_id" }, 400);
    }

    // Buscar o usuário alvo para validar se está inativo
    const { data: targetProfile, error: targetErr } = await adminClient
      .from("user_profiles")
      .select("id, full_name, email, is_active")
      .eq("id", payload.user_id)
      .single();

    if (targetErr || !targetProfile) {
      return jsonResponse({ error: "Target user not found" }, 404);
    }

    // Verificar se o usuário está inativo (condição obrigatória para exclusão)
    if (targetProfile.is_active) {
      return jsonResponse({ 
        error: "Cannot delete active user. User must be deactivated first." 
      }, 400);
    }

    // Evitar auto-exclusão
    if (payload.user_id === requesterId) {
      return jsonResponse({ error: "Cannot delete your own account" }, 400);
    }

    // TRANSAÇÃO: Executar todas as operações de exclusão
    try {
      // 1. Desvincular leads (definir corretor responsável como NULL)
      const { error: leadsUpdateErr } = await adminClient
        .from("leads")
        .update({ 
          id_corretor_responsavel: null,
          assigned_user_id: null
        })
        .eq("id_corretor_responsavel", payload.user_id);

      if (leadsUpdateErr) {
        console.warn("Erro ao desvincular leads:", leadsUpdateErr);
        // Não falhar a operação por isso
      }

      // 2. Remover de user_profiles
      const { error: profileDeleteErr } = await adminClient
        .from("user_profiles")
        .delete()
        .eq("id", payload.user_id);

      if (profileDeleteErr) {
        throw new Error(`Erro ao deletar user_profiles: ${profileDeleteErr.message}`);
      }

      // 3. Remover de auth.users
      const { error: authDeleteErr } = await adminClient.auth.admin.deleteUser(payload.user_id);

      if (authDeleteErr) {
        // Se falhar aqui, user_profiles já foi deletado, mas registramos o erro
        console.error("Erro ao deletar auth.users:", authDeleteErr);
        throw new Error(`Erro ao deletar auth.users: ${authDeleteErr.message}`);
      }

      return jsonResponse({ 
        success: true, 
        message: `User ${targetProfile.full_name} (${targetProfile.email}) deleted successfully`,
        deleted_user_id: payload.user_id,
        leads_unlinked: true
      });

    } catch (deleteError: any) {
      return jsonResponse({ 
        error: `Delete operation failed: ${deleteError.message}` 
      }, 500);
    }

  } catch (e: any) {
    return jsonResponse({ 
      error: e?.message || "Internal error" 
    }, 500);
  }
});
