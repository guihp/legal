import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Verifica se a resposta é uma imagem ou uma página HTML de erro
 */
function isImageResponse(contentType: string | null, body: ArrayBuffer): boolean {
  if (!contentType) return false;
  
  // Verificar pelo content-type
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (imageTypes.some(type => contentType.toLowerCase().includes(type))) {
    return true;
  }
  
  // Verificar pelos primeiros bytes (magic numbers)
  const bytes = new Uint8Array(body.slice(0, 4));
  
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
  
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
  
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;
  
  // WebP: RIFF...WEBP (verificar primeiros 4 bytes e depois procurar WEBP)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    const textDecoder = new TextDecoder();
    const bodyText = textDecoder.decode(body.slice(0, 20));
    if (bodyText.includes('WEBP')) return true;
  }
  
  return false;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const fileId = url.searchParams.get('id');

    if (!fileId) {
      console.error('❌ ID do arquivo não fornecido');
      return new Response(
        JSON.stringify({ error: 'ID do arquivo é obrigatório' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Converter para link direto de download do Google Drive (mesmo formato do n8n)
    const driveUrl = `https://drive.usercontent.google.com/uc?id=${fileId}&export=download`;
    
    console.log(`📥 Fazendo proxy para Google Drive - File ID: ${fileId}`);
    console.log(`🔗 URL: ${driveUrl}`);

    // Fazer fetch da imagem do Google Drive
    const response = await fetch(driveUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/*,*/*;q=0.8',
      },
      redirect: 'follow', // Seguir redirecionamentos
    });

    console.log(`📊 Resposta do Google Drive - Status: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      console.error(`❌ Erro ao buscar imagem do Google Drive: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao buscar imagem do Google Drive', 
          status: response.status,
          fileId 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Obter o conteúdo da resposta
    const responseData = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Verificar se a resposta é realmente uma imagem
    if (!isImageResponse(contentType, responseData)) {
      console.warn(`⚠️ Resposta não parece ser uma imagem. Content-Type: ${contentType}`);
      
      // Tentar decodificar como texto para ver se é uma página de erro HTML
      try {
        const textDecoder = new TextDecoder();
        const bodyText = textDecoder.decode(responseData.slice(0, 500));
        if (bodyText.includes('<html') || bodyText.includes('<!DOCTYPE')) {
          console.error('❌ Google Drive retornou uma página HTML (possivelmente erro ou arquivo não público)');
          return new Response(
            JSON.stringify({ 
              error: 'Arquivo não encontrado ou não está público no Google Drive',
              fileId,
              hint: 'Certifique-se de que o arquivo está compartilhado publicamente'
            }),
            { 
              status: 404, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
      } catch (e) {
        // Ignorar erro de decodificação
      }
    }

    // Determinar content-type correto baseado no conteúdo se necessário
    let finalContentType = contentType;
    if (contentType === 'application/octet-stream' || !contentType.includes('image/')) {
      // Tentar detectar pelo conteúdo
      const bytes = new Uint8Array(responseData.slice(0, 4));
      if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
        finalContentType = 'image/jpeg';
      } else if (bytes[0] === 0x89 && bytes[1] === 0x50) {
        finalContentType = 'image/png';
      } else if (bytes[0] === 0x47 && bytes[1] === 0x49) {
        finalContentType = 'image/gif';
      } else {
        finalContentType = 'image/jpeg'; // Default
      }
      console.log(`🔍 Content-type detectado: ${finalContentType}`);
    }

    console.log(`✅ Retornando imagem - Size: ${responseData.byteLength} bytes, Type: ${finalContentType}`);

    // Retornar a imagem com headers CORS apropriados
    return new Response(responseData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': finalContentType,
        'Cache-Control': 'public, max-age=31536000', // Cache por 1 ano
        'Content-Length': responseData.byteLength.toString(),
      },
    });

  } catch (error: any) {
    console.error('💥 Erro na função google-drive-proxy:', error);
    console.error('Stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno ao processar requisição', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
