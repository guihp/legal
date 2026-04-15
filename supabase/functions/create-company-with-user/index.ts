// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

/** Plano com vitrine pública automática (site em /s/{slug}) */
const PLANS_WITH_PUBLIC_SITE = new Set(['professional'])

type SignupPaymentPayload = {
  cardNumber: string
  cardHolderName: string
  cardExpiry: string // MM/YY
  cardCvv: string
  billingCycle: 'monthly' | 'annual'
  valueMonthly: number
  valueTotal: number
  cpfCnpj?: string | null
  email?: string | null
  phone?: string | null
  postalCode?: string | null
  addressNumber?: string | null
}

function getTrialDueDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + Math.max(1, days))
  return d.toISOString().slice(0, 10)
}

function parseExpiry(expiry: string): { month: string; year: string } {
  const clean = String(expiry || '').replace(/\s/g, '')
  const [mm = '', yy = ''] = clean.split('/')
  const month = mm.padStart(2, '0').slice(0, 2)
  const year = `20${yy.padStart(2, '0').slice(-2)}`
  return { month, year }
}

async function callAsaas(path: string, payload: Record<string, any>) {
  const baseUrl = (Deno.env.get('ASAAS_API_BASE_URL') || 'https://api-sandbox.asaas.com').replace(/\/$/, '')
  const apiKey = Deno.env.get('ASAAS_API_KEY')
  if (!apiKey) throw new Error('ASAAS_API_KEY não configurada')

  const res = await fetch(`${baseUrl}/v3${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
    },
    body: JSON.stringify(payload),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.errors?.[0]?.description || json?.message || `Erro ASAAS (${res.status})`
    throw new Error(msg)
  }
  return json
}

async function sendWelcomeEmailWithResend(params: {
  to: string
  companyName: string
  loginEmail: string
  temporaryPassword: string
}) {
  const enabled = String(Deno.env.get('RESEND_ENABLED') || 'false').toLowerCase() === 'true'
  if (!enabled) return { sent: false, reason: 'RESEND_ENABLED=false' }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@iafeimobi.com.br'
  const appUrl = Deno.env.get('PUBLIC_APP_URL') || 'https://app.iafeimobi.com.br'
  const apiBase = (Deno.env.get('RESEND_API_BASE_URL') || 'https://api.resend.com').replace(/\/$/, '')

  if (!apiKey) {
    throw new Error('RESEND_API_KEY não configurada')
  }

  const subject = 'Bem-vindo(a) ao IAFÉ IMOBI - Credenciais de acesso'
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin-bottom: 8px;">Cadastro concluído com sucesso</h2>
      <p>Olá, <strong>${params.companyName}</strong>!</p>
      <p>Sua conta foi criada e já está pronta para uso.</p>
      <p><strong>Email de acesso:</strong> ${params.loginEmail}</p>
      <p><strong>Senha temporária:</strong> ${params.temporaryPassword}</p>
      <p>Acesse a plataforma em: <a href="${appUrl}">${appUrl}</a></p>
      <p style="margin-top: 18px; font-size: 12px; color: #6b7280;">
        Por segurança, altere sua senha no primeiro acesso.
      </p>
    </div>
  `

  const res = await fetch(`${apiBase}/emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject,
      html,
    }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.message || json?.error || `Erro ao enviar email (${res.status})`
    throw new Error(msg)
  }

  return { sent: true, id: json?.id || null }
}

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
    // Create Supabase client with user's auth token (quando existir)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Usuário autenticado é opcional (fluxo público por token também é aceito)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (!userError && user) {
      console.log('✅ Usuário autenticado:', user.id, user.email);
    }

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

    let {
      name,
      whatsapp_ai_phone,
      login_email,
      email,
      cnpj,
      phone,
      address,
      plan = 'essential',
      trial_days = 14,
      max_users = 10,
      payment = null,
      signup_token = null,
    } = body;

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

    // Fluxo A: autenticado (super_admin). Fluxo B: público via signup_token.
    if (user) {
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
    } else {
      if (!signup_token) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Token de cadastro obrigatório'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          }
        )
      }

      const { data: linkData, error: linkError } = await supabaseAdmin
        .from('signup_links')
        .select('*')
        .eq('token', signup_token)
        .single()

      if (linkError || !linkData) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Link de cadastro inválido'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
      }

      if (linkData.status !== 'pending') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Link de cadastro já utilizado ou expirado'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
      }

      if (new Date(linkData.expires_at).getTime() < Date.now()) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Link de cadastro expirado'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
      }

      // No fluxo público, forçar dados de plano/limites vindos do link gerado pelo admin.
      plan = linkData.plan || plan
      max_users = Number(linkData.max_users || max_users)
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
    // Compatibilidade com legados e aliases de plano
    const normalizedPlan = String(plan || 'essential').toLowerCase();
    const finalPlan =
      normalizedPlan === 'basic' || normalizedPlan === 'basico' || normalizedPlan === 'essentials'
        ? 'essential'
        : normalizedPlan === 'enterprise' || normalizedPlan === 'pro' || normalizedPlan === 'profissional'
          ? 'professional'
          : normalizedPlan === 'growth'
            ? 'growth'
            : normalizedPlan === 'professional'
              ? 'professional'
              : 'essential';

    if (finalPlan) rpcParams.p_plan = finalPlan;
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
          performed_by: user?.id || null,
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

    // 6. Processar cobrança no ASAAS (opcional por env)
    const asaasEnabled = String(Deno.env.get('ASAAS_ENABLED') || 'false').toLowerCase() === 'true'
    const paymentPayload = payment as SignupPaymentPayload | null
    let asaasResult: { customerId?: string; subscriptionId?: string } | null = null

    if (asaasEnabled && paymentPayload) {
      try {
        const customer = await callAsaas('/customers', {
          name: name || `Empresa ${phoneClean}`,
          email: login_email?.trim()?.toLowerCase() || null,
          mobilePhone: String(whatsapp_ai_phone || '').replace(/\D/g, ''),
          cpfCnpj: String(cnpj || paymentPayload.cpfCnpj || '').replace(/\D/g, '') || undefined,
          postalCode: String(paymentPayload.postalCode || '').replace(/\D/g, '') || undefined,
          addressNumber: paymentPayload.addressNumber || undefined,
          address: address || undefined,
          notificationDisabled: false,
        })

        const { month, year } = parseExpiry(paymentPayload.cardExpiry)
        const chargeValue =
          paymentPayload.billingCycle === 'annual'
            ? Number(paymentPayload.valueTotal || 0)
            : Number(paymentPayload.valueMonthly || 0)

        const subscription = await callAsaas('/subscriptions', {
          customer: customer.id,
          billingType: 'CREDIT_CARD',
          value: chargeValue,
          nextDueDate: getTrialDueDate(Number(trial_days || 7)),
          cycle: paymentPayload.billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY',
          description: `Plano ${finalPlan} - IAFÉ IMOBI`,
          creditCard: {
            holderName: paymentPayload.cardHolderName,
            number: String(paymentPayload.cardNumber || '').replace(/\D/g, ''),
            expiryMonth: month,
            expiryYear: year,
            ccv: String(paymentPayload.cardCvv || '').replace(/\D/g, ''),
          },
          creditCardHolderInfo: {
            name: paymentPayload.cardHolderName,
            email: paymentPayload.email || login_email,
            cpfCnpj: String(cnpj || paymentPayload.cpfCnpj || '').replace(/\D/g, '') || undefined,
            postalCode: String(paymentPayload.postalCode || '').replace(/\D/g, '') || undefined,
            addressNumber: paymentPayload.addressNumber || undefined,
            phone: String(paymentPayload.phone || whatsapp_ai_phone || '').replace(/\D/g, ''),
          },
          remoteIp: req.headers.get('x-forwarded-for') || '127.0.0.1',
        })

        asaasResult = { customerId: customer.id, subscriptionId: subscription.id }
      } catch (asaasError: any) {
        console.error('❌ Erro ao processar cobrança ASAAS:', asaasError)
        return new Response(
          JSON.stringify({
            success: false,
            error: asaasError?.message || 'Falha ao processar pagamento no ASAAS'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
      }
    }

    // 7. Enviar email de boas-vindas com credenciais (opcional por env)
    let resendStatus: { sent: boolean; id?: string | null; reason?: string } | null = null
    try {
      resendStatus = await sendWelcomeEmailWithResend({
        to: login_email.trim().toLowerCase(),
        companyName: name || 'Gestor da Empresa',
        loginEmail: login_email.trim().toLowerCase(),
        temporaryPassword: generatedPassword,
      })
    } catch (emailErr: any) {
      console.error('⚠️ Falha ao enviar email de boas-vindas:', emailErr)
      resendStatus = { sent: false, reason: emailErr?.message || 'erro_desconhecido' }
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
        asaas: asaasResult,
        email_delivery: resendStatus,
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
