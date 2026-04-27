// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const accessToken = authHeader.replace(/^Bearer\s+/i, "");
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: authUserData, error: authErr } = await adminClient.auth.getUser(accessToken);
    if (authErr || !authUserData.user) {
      return jsonResponse({ success: false, error: "Invalid token" }, 401);
    }

    const body = await req.json();
    const {
      email,
      password,
      role = "corretor",
      full_name,
      phone,
      department,
      company_id,
    } = body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return jsonResponse({ success: false, error: "Email is required" }, 400);
    }
    if (!full_name || typeof full_name !== "string" || !full_name.trim()) {
      return jsonResponse({ success: false, error: "Full name is required" }, 400);
    }
    const pwd = typeof password === "string" ? password : "";
    if (!pwd.trim()) {
      return jsonResponse({ success: false, error: "Password is required" }, 400);
    }
    if (pwd.length < 6) {
      return jsonResponse({ success: false, error: "Password must be at least 6 characters" }, 400);
    }

    const { data: requesterProfile, error: requesterProfileError } = await adminClient
      .from("user_profiles")
      .select("id, role, company_id")
      .eq("id", authUserData.user.id)
      .single();

    if (requesterProfileError || !requesterProfile) {
      return jsonResponse({ success: false, error: "Perfil do solicitante não encontrado" }, 403);
    }

    if (!["gestor", "admin", "super_admin"].includes(requesterProfile.role)) {
      return jsonResponse({ success: false, error: "Sem permissão para criar usuários" }, 403);
    }

    if (requesterProfile.role === "gestor" && role !== "corretor") {
      return jsonResponse(
        { success: false, error: "Gestor pode criar apenas usuários com role corretor" },
        403
      );
    }

    if (requesterProfile.role === "admin" && role === "super_admin") {
      return jsonResponse({ success: false, error: "Admin não pode criar super_admin" }, 403);
    }

    const targetCompanyId =
      requesterProfile.role === "super_admin"
        ? (company_id || requesterProfile.company_id || null)
        : requesterProfile.company_id;

    if (!targetCompanyId) {
      return jsonResponse(
        { success: false, error: "Company ID não definido para criação do usuário" },
        400
      );
    }

    const emailNorm = email.trim().toLowerCase();

    const { data: existingProfile } = await adminClient
      .from("user_profiles")
      .select("id, email, role")
      .eq("email", emailNorm)
      .maybeSingle();

    if (existingProfile) {
      return jsonResponse({ success: false, error: "Email já existe no sistema" }, 400);
    }

    const { data: authUser, error: createAuthError } = await adminClient.auth.admin.createUser({
      email: emailNorm,
      password: pwd,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
    });

    if (createAuthError || !authUser?.user?.id) {
      const msg = createAuthError?.message || "Erro ao criar usuário de autenticação";
      return jsonResponse({ success: false, error: msg }, 400);
    }

    const userId = authUser.user.id;

    const { data: profileData, error: insertError } = await adminClient
      .from("user_profiles")
      .insert({
        id: userId,
        email: emailNorm,
        full_name: full_name.trim(),
        role,
        company_id: targetCompanyId,
        phone: phone ? String(phone).trim() || null : null,
        department: department ? String(department).trim() || null : null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      try {
        await adminClient.auth.admin.deleteUser(userId);
      } catch {
        // best effort rollback
      }
      return jsonResponse(
        {
          success: false,
          error: insertError.message || "Failed to create user profile",
        },
        400
      );
    }

    return jsonResponse({
      success: true,
      message: "User created successfully",
      data: profileData,
    });
  } catch (error: any) {
    console.error("admin-create-user:", error);
    return jsonResponse(
      { success: false, error: error?.message || "Internal server error" },
      500
    );
  }
});
