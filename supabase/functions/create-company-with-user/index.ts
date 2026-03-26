// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

/** Planos com vitrine pública automática (site em /s/{slug}) */
const PLANS_WITH_PUBLIC_SITE = new Set(['professional', 'enterprise'])

function slugifyCompanySite(input: string): string {
  const s = String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return s || 'imobiliaria'
}

serve(async (req) => {
  console.log('🚀 Edge Function create-company-with-user chamada');
  console.log('📝 Método:', req.method);
  console.log('🔗 URL:', req.url);
  console.log('📋 Headers:', Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200
    })
  }

  try {
    // Create Supabase client with user's auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

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

    // Verificar perfil do usuário antes de continuar
    const { data: userProfileCheck, error: profileCheckError } = await supabaseClient
      .from('user_profiles')
      .select('id, role, company_id')
      .eq('id', user.id)
      .single();

    console.log('👤 Perfil do usuário:', { userProfileCheck, profileCheckError });

    // Get request body
    let body: any;
    try {
      // Tentar primeiro com req.json() que é o método padrão
      body = await req.json();
      console.log('📦 Request body recebido:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      // Se falhar, tentar com req.text() e fazer parse manual
      try {
        const bodyText = await req.text();
        console.log('📦 Request body raw (text):', bodyText);
        if (bodyText) {
          body = JSON.parse(bodyText);
          console.log('📦 Request body parsed:', JSON.stringify(body, null, 2));
        } else {
          throw new Error('Body vazio');
        }
      } catch (secondError) {
        console.error('❌ Erro ao fazer parse do body:', parseError, secondError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao processar dados da requisição. Verifique se os dados estão no formato JSON correto.'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
      }
    }

    const {
      name,
      whatsapp_ai_phone,
      login_email,
      email,
      cnpj,
      phone,
      address,
      plan = 'essential',
      trial_days = 14,
      max_users = 10
    } = body;

    // Validações
    if (!whatsapp_ai_phone || whatsapp_ai_phone.replace(/\D/g, '').length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Telefone do WhatsApp é obrigatório e deve ter pelo menos 10 dígitos'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    if (!login_email || !login_email.includes('@')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email para login é obrigatório'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Verificar se é super_admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'super_admin') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Apenas super_admin pode criar empresas'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      )
    }

    // Limpar telefone (apenas números)
    const phoneClean = whatsapp_ai_phone.replace(/\D/g, '');

    // Gerar senha baseada no nome da empresa + telefone
    let generatedPassword = (name || 'Empresa').toLowerCase().replace(/[^a-z0-9]/g, '') + phoneClean;

    // Garantir mínimo de 8 caracteres
    if (generatedPassword.length < 8) {
      generatedPassword = generatedPassword + '123';
    }

    // Limitar a 20 caracteres
    generatedPassword = generatedPassword.substring(0, 20);

    // Garantir que tenha pelo menos um número
    if (!/\d/.test(generatedPassword)) {
      generatedPassword = generatedPassword + '123';
    }

    console.log('📞 Criando empresa...');

    // Preparar parâmetros para o RPC (omitir null/undefined para usar defaults da função)
    const rpcParams: any = {
      p_name: name || `Empresa ${phoneClean}`,
      p_whatsapp_ai_phone: phoneClean,
    };

    // Adicionar apenas parâmetros que têm valor (não null/undefined)
    if (email) rpcParams.p_email = email;
    if (cnpj) rpcParams.p_cnpj = cnpj;
    if (phone) rpcParams.p_phone = phone;
    if (address) rpcParams.p_address = address;
    if (plan) rpcParams.p_plan = plan;
    if (trial_days) rpcParams.p_trial_days = trial_days;
    if (max_users) rpcParams.p_max_users = max_users;

    console.log('📋 Parâmetros para RPC:', rpcParams);

    // 1. Criar empresa via RPC
    const { data: companyId, error: companyError } = await supabaseClient.rpc('create_company_with_trial', rpcParams);

    console.log('📥 Resposta do RPC:', { companyId, companyError });

    if (companyError) {
      console.error('❌ Erro ao criar empresa via RPC:', {
        message: companyError.message,
        details: companyError.details,
        hint: companyError.hint,
        code: companyError.code,
        fullError: companyError
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: companyError.message || companyError.details || 'Erro ao criar empresa'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    if (!companyId) {
      console.error('❌ RPC retornou sem erro mas sem companyId');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao criar empresa: ID não retornado'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log('✅ Empresa criada:', companyId);

    // 2. Criar usuário usando Admin API (service_role)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY não configurada');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configuração do servidor incompleta'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
    )

    console.log('👤 Criando usuário em auth.users...');

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: login_email.trim().toLowerCase(),
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        full_name: name || 'Gestor da Empresa'
      }
    });

    if (authError || !authUser?.user) {
      console.error('❌ Erro ao criar usuário:', authError);

      // Se falhar, tentar deletar a empresa criada (rollback)
      try {
        await supabaseClient
          .from('companies')
          .delete()
          .eq('id', companyId);
      } catch (rollbackError) {
        console.error('❌ Erro ao fazer rollback da empresa:', rollbackError);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: authError?.message || 'Erro ao criar usuário'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log('✅ Usuário criado em auth.users:', authUser.user.id);

    // 3. Criar perfil em user_profiles
    const { data: userProfile, error: profileInsertError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authUser.user.id,
        company_id: companyId,
        full_name: name || 'Gestor da Empresa',
        email: login_email.trim().toLowerCase(),
        phone: phone || null,
        role: 'gestor',
        is_active: true,
      })
      .select()
      .single();

    if (profileInsertError) {
      console.error('❌ Erro ao criar perfil:', profileInsertError);

      // Rollback: deletar usuário e empresa
      try {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        await supabaseClient
          .from('companies')
          .delete()
          .eq('id', companyId);
      } catch (rollbackError) {
        console.error('❌ Erro ao fazer rollback:', rollbackError);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: profileInsertError.message || 'Erro ao criar perfil do usuário'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log('✅ Perfil criado:', userProfile);

    // 4. Vitrine pública (company_websites) — planos Professional / Enterprise
    let site_slug: string | null = null
    const displayName = (name || `Empresa ${phoneClean}`).trim()
    if (PLANS_WITH_PUBLIC_SITE.has(String(plan || '').toLowerCase())) {
      const { data: already } = await supabaseAdmin
        .from('company_websites')
        .select('id, slug')
        .eq('company_id', companyId)
        .maybeSingle()

      if (!already) {
        const base = slugifyCompanySite(displayName)
        const shortId = String(companyId).replace(/-/g, '').slice(0, 8)
        const candidates = [base, `${base}-${shortId}`]
        for (let i = 2; i < 60; i++) candidates.push(`${base}-${i}`)

        let chosen = base
        for (const slug of candidates) {
          const { data: clash } = await supabaseAdmin
            .from('company_websites')
            .select('id')
            .eq('slug', slug)
            .maybeSingle()
          if (!clash) {
            chosen = slug
            break
          }
        }

        const { error: siteError } = await supabaseAdmin.from('company_websites').insert({
          company_id: companyId,
          slug: chosen,
          title: displayName,
          description:
            'Confira nossos imóveis e fale com nossa equipe. Conteúdo editável pelo painel em Marketing.',
          is_published: true,
          theme_color: '#3B82F6',
        })

        if (siteError) {
          console.error('⚠️ Erro ao criar company_websites (não bloqueia criação da empresa):', siteError)
        } else {
          site_slug = chosen
          console.log('✅ Vitrine criada:', chosen)
        }
      } else {
        site_slug = already.slug
        console.log('ℹ️ Empresa já possui company_websites:', site_slug)
      }
    }

    // 5. Registrar no log de acesso
    try {
      await supabaseClient
        .from('company_access_logs')
        .insert({
          company_id: companyId,
          action: 'created',
          performed_by: user.id,
          new_status: 'trial',
          reason: 'Usuário gestor criado junto com a empresa',
          meta: {
            user_email: login_email,
            user_id: authUser.user.id
          }
        });
    } catch (logError) {
      console.warn('⚠️ Erro ao registrar log (não crítico):', logError);
    }

    // Retornar sucesso com credenciais
    return new Response(
      JSON.stringify({
        success: true,
        company_id: companyId,
        user_id: authUser.user.id,
        email: login_email.trim().toLowerCase(),
        password: generatedPassword,
        site_slug,
        plan,
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
