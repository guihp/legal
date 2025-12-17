// Processador de imagens: baixa do VivaReal e faz upload para Supabase Storage

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Baixa uma imagem da URL e faz upload para Supabase Storage
 */
export async function processImage(
  imageUrl: string,
  listingId: string,
  index: number
): Promise<string | null> {
  try {
    // Baixar imagem
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      console.warn(`⚠️ Não foi possível baixar imagem ${imageUrl}: ${imageResponse.status}`);
      return null;
    }

    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const imageBytes = new Uint8Array(imageArrayBuffer);

    // Determinar extensão do arquivo
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const extension = contentType.includes('png') ? 'png' : 
                     contentType.includes('webp') ? 'webp' : 'jpg';

    // Nome do arquivo no storage
    const fileName = `vivareal/${listingId}/${index}.${extension}`;

    // Criar cliente Supabase com SERVICE_ROLE
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fazer upload para o bucket 'property-images'
    const { data, error } = await supabase.storage
      .from('property-images')
      .upload(fileName, imageBytes, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error(`❌ Erro ao fazer upload da imagem ${imageUrl}:`, error);
      return null;
    }

    // Obter URL pública
    const { data: urlData } = supabase.storage
      .from('property-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error(`❌ Erro ao processar imagem ${imageUrl}:`, error);
    return null;
  }
}

/**
 * Processa múltiplas imagens em paralelo (limitado)
 */
export async function processImages(
  imageUrls: string[],
  listingId: string
): Promise<string[]> {
  const processedUrls: string[] = [];
  const maxConcurrent = 3; // Processar 3 imagens por vez

  for (let i = 0; i < imageUrls.length; i += maxConcurrent) {
    const batch = imageUrls.slice(i, i + maxConcurrent);
    const promises = batch.map((url, idx) => 
      processImage(url, listingId, i + idx)
    );
    
    const results = await Promise.all(promises);
    processedUrls.push(...results.filter((url): url is string => url !== null));
    
    // Delay entre lotes para evitar sobrecarga
    if (i + maxConcurrent < imageUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return processedUrls;
}

