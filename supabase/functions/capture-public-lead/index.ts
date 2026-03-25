// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  console.log('🚀 Edge Function capture-public-lead chamada');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    })
  }

  try {
    // Create a Supabase client with the Service Role Key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get request body
    const body = await req.json();
    console.log('📦 Request body:', body);
    
    const { name, email, phone, imovel_interesse, company_id, source = 'Landing Page', message = '' } = body

    if (!name || (!email && !phone)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Name and either Email or Phone are required'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    if (!company_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Company ID is required'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Criar novo lead
    console.log('💾 Inserindo lead no CRM...');
    
    // O ID sera gerado via uuid_generate_v4() pelo banco
    const { data: leadData, error: insertError } = await supabaseAdmin
      .from('leads')
      .insert({
        name,
        email,
        phone,
        source,
        message,
        stage: 'Novo Lead',
        imovel_interesse,
        company_id
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Erro ao inserir lead:', insertError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create lead: ${insertError.message}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log('✅ Lead capturado e salvo no CRM com sucesso:', leadData.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Lead captured successfully',
        data: leadData
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
