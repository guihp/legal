import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordPayload {
  user_id?: string;
  email?: string;
  new_password: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar autenticação do solicitante
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente admin com SERVICE_ROLE
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verificar se o solicitante é admin ou gestor
    const token = authHeader.replace('Bearer ', '');
    const { data: authUserData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    
    if (authErr || !authUserData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar perfil do solicitante
    const { data: requesterProfile, error: profileErr } = await supabaseAdmin
      .from('user_profiles')
      .select('id, role')
      .eq('id', authUserData.user.id)
      .single();

    if (profileErr || !requesterProfile) {
      return new Response(
        JSON.stringify({ error: 'Requester profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Apenas admin pode resetar senhas
    if (requesterProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: only admin can reset passwords' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter payload
    const payload: ResetPasswordPayload = await req.json();
    
    if (!payload.new_password || payload.new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.user_id && !payload.email) {
      return new Response(
        JSON.stringify({ error: 'Either user_id or email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Encontrar o usuário alvo
    let targetUserId: string | null = null;

    if (payload.user_id) {
      targetUserId = payload.user_id;
    } else if (payload.email) {
      // Buscar usuário por email
      const { data: userByEmail, error: emailErr } = await supabaseAdmin.auth.admin.listUsers();
      
      if (emailErr) {
        return new Response(
          JSON.stringify({ error: `Error finding user: ${emailErr.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const foundUser = userByEmail.users.find(u => u.email === payload.email);
      if (!foundUser) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetUserId = foundUser.id;
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Could not determine target user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resetar senha usando admin API
    const { data: updatedUser, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      {
        password: payload.new_password
      }
    );

    if (updateErr) {
      return new Response(
        JSON.stringify({ 
          error: `Failed to reset password: ${updateErr.message}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar informações do perfil para resposta
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name, role')
      .eq('id', targetUserId)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset successfully',
        user: {
          id: targetUserId,
          email: updatedUser.user?.email || userProfile?.email,
          full_name: userProfile?.full_name,
          role: userProfile?.role
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Edge Function Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});








