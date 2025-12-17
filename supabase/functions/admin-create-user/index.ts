// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  console.log('🚀 Edge Function admin-create-user chamada');
  console.log('📝 Método:', req.method);
  console.log('🔗 URL:', req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Respondendo preflight CORS');
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    })
  }

  try {
    console.log('🔐 Iniciando autenticação...');
    
    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    console.log('🔑 Verificando JWT...');
    
    // Get the user from the JWT token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      console.error('❌ Erro na autenticação:', userError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized: ' + (userError?.message || 'No user found')
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    console.log('✅ Usuário autenticado:', user.id, user.email);

    // Get request body
    const body = await req.json();
    console.log('📦 Request body:', body);
    
    const { email, role = 'corretor', full_name, phone, department } = body

    if (!email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email is required'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    if (!full_name) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Full name is required'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Verificar se já existe um perfil com este email
    console.log('🔍 Verificando se email já existe...');
    const { data: existingProfile, error: existingProfileError } = await supabaseClient
      .from('user_profiles')
      .select('id, email, role')
      .eq('email', email)
      .single()

    if (existingProfileError && existingProfileError.code !== 'PGRST116') {
      console.error('❌ Erro ao verificar email existente:', existingProfileError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao verificar email: ${existingProfileError.message}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    if (existingProfile) {
      console.log('⚠️ Email já existe, retornando erro');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email já existe no sistema'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Criar novo perfil
    console.log('💾 Criando novo perfil...');
    
    // Gerar UUID para o novo perfil
    const newProfileId = crypto.randomUUID();
    
    const { data: profileData, error: insertError } = await supabaseClient
      .from('user_profiles')
      .insert({
        id: newProfileId,
        email: email,
        full_name: full_name,
        role: role,
        company_id: '047e534b-5212-43c5-b704-94fe6007775f', // Company ID fixo para teste
        phone: phone || null,
        department: department || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Erro ao inserir perfil:', insertError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create user profile: ${insertError.message}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log('✅ Perfil criado com sucesso:', profileData);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User profile created successfully',
        data: profileData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('❌ Edge Function Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})


