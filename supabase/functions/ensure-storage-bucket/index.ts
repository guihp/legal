import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { bucketName } = await req.json();

    if (!bucketName) {
      return new Response(
        JSON.stringify({ error: 'bucketName é obrigatório' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Criar cliente Supabase com SERVICE_ROLE para ter permissão de criar buckets
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verificar se o bucket já existe
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error('Erro ao listar buckets:', listError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar buckets', details: listError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const bucketExists = buckets?.some(b => b.name === bucketName);

    if (bucketExists) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Bucket ${bucketName} já existe`,
          created: false 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Criar o bucket
    console.log(`Criando bucket ${bucketName}...`);
    const { data: bucket, error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png', 'image/jpg'],
      fileSizeLimit: 5242880 // 5MB
    });

    if (createError) {
      console.error('Erro ao criar bucket:', createError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao criar bucket', 
          details: createError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Bucket ${bucketName} criado com sucesso`,
        created: true,
        bucket 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
