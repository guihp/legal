/**
 * Sugere uma legenda curta a partir do nome do arquivo de imagem.
 *
 * Heurística:
 *  - Remove extensão
 *  - Substitui `_` `-` `.` por espaço
 *  - Colapsa whitespace
 *  - Trunca em `maxLen` chars
 *  - Retorna string vazia se o nome parece um padrão de câmera
 *    (IMG_..., DSC_..., DCIM, WhatsApp Image, ou só números)
 *    — nesse caso melhor deixar vazio do que sugerir lixo.
 *
 * Exemplos:
 *   "piscina.jpg"                       -> "piscina"
 *   "Sala-de-estar-01.png"              -> "Sala de estar 01"
 *   "IMG_20240315_142133.jpg"           -> ""           (padrão câmera)
 *   "DSC_0042.JPG"                      -> ""
 *   "WhatsApp Image 2024-08-12.jpeg"    -> ""
 *   "20240315142133.jpg"                -> ""           (só números)
 *
 * @param filename - File.name original
 * @param maxLen - Tamanho máximo (default 50, alinhado com IMAGE_CAPTION_MAX no app)
 */
export const captionFromFilename = (filename: string, maxLen = 50): string => {
  if (!filename) return '';
  // Remove extensão
  const noExt = filename.replace(/\.[^./\\]+$/, '');
  // Skip padrões de câmera comuns
  if (/^(IMG|DSC|DSCN|DCIM|PXL|MVIMG|PHOTO|FOTO|Screenshot|Captura)[_\-\s]/i.test(noExt)) return '';
  if (/^WhatsApp\s+Image/i.test(noExt)) return '';
  // Skip se for só dígitos (após remover separadores)
  if (/^\d+$/.test(noExt.replace(/[_\-\s.]/g, ''))) return '';
  // Limpa
  return noExt
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
};

/**
 * Converte uma imagem para formato JPEG com tamanho adequado para WhatsApp
 *
 * @param file - Arquivo de imagem original
 * @param targetMinSize - Tamanho mínimo em bytes (padrão 1MB = 1024*1024)
 * @param targetMaxSize - Tamanho máximo em bytes (padrão 5MB = 5*1024*1024)
 * @param maxWidth - Largura máxima (padrão 1920px - Full HD)
 * @param maxHeight - Altura máxima (padrão 1440px)
 * @returns Promise<File> - Arquivo convertido para JPEG
 */
export const convertToJPEG = (
  file: File,
  targetMinSize = 1024 * 1024, // 1MB
  targetMaxSize = 5 * 1024 * 1024, // 5MB
  maxWidth = 1920,
  maxHeight = 1440
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calcular novas dimensões mantendo proporção
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height;

        if (width > height) {
          width = Math.min(width, maxWidth);
          height = width / aspectRatio;
        } else {
          height = Math.min(height, maxHeight);
          width = height * aspectRatio;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (ctx) {
        // Desenhar a imagem redimensionada
        ctx.drawImage(img, 0, 0, width, height);

        // Função para tentar diferentes qualidades até atingir tamanho desejado
        const tryQuality = (quality: number, attempts: number = 0): void => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Falha ao converter imagem para JPEG'));
              return;
            }

            const size = blob.size;
            console.log(`📸 Tentativa ${attempts + 1}: qualidade ${(quality * 100).toFixed(0)}%, tamanho ${(size / 1024 / 1024).toFixed(2)}MB`);

            // Se o tamanho está dentro do range desejado ou já tentou muitas vezes
            if ((size >= targetMinSize && size <= targetMaxSize) || attempts >= 5) {
              const originalName = file.name.replace(/\.[^/.]+$/, '');
              const jpegFile = new File([blob], `${originalName}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              console.log(`✅ Imagem final: ${(size / 1024 / 1024).toFixed(2)}MB`);
              resolve(jpegFile);
              return;
            }

            // Ajustar qualidade baseado no tamanho atual
            if (size < targetMinSize) {
              // Muito pequeno, aumentar qualidade
              const newQuality = Math.min(1.0, quality + 0.1);
              if (newQuality === quality) {
                // Já está no máximo, aceitar o resultado
                const originalName = file.name.replace(/\.[^/.]+$/, '');
                const jpegFile = new File([blob], `${originalName}.jpg`, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(jpegFile);
                return;
              }
              tryQuality(newQuality, attempts + 1);
            } else if (size > targetMaxSize) {
              // Muito grande, diminuir qualidade
              const newQuality = Math.max(0.5, quality - 0.1);
              tryQuality(newQuality, attempts + 1);
            }
          }, 'image/jpeg', quality);
        };

        // Começar com qualidade alta (95%)
        tryQuality(0.95);
      } else {
        reject(new Error('Não foi possível obter contexto do canvas'));
      }
    };

    img.onerror = () => {
      reject(new Error('Falha ao carregar a imagem'));
    };

    img.src = URL.createObjectURL(file);
  });
};

/**
 * Processa múltiplas imagens convertendo-as para JPEG com tamanho adequado
 * 
 * @param files - Array de arquivos de imagem
 * @param targetMinSize - Tamanho mínimo em bytes (padrão 1MB)
 * @param targetMaxSize - Tamanho máximo em bytes (padrão 5MB)
 * @param maxWidth - Largura máxima (padrão 1920px)
 * @param maxHeight - Altura máxima (padrão 1440px)
 * @returns Promise<File[]> - Array de arquivos convertidos
 */
export const convertMultipleToJPEG = async (
  files: File[],
  targetMinSize = 1024 * 1024,
  targetMaxSize = 5 * 1024 * 1024,
  maxWidth = 1920,
  maxHeight = 1440
): Promise<File[]> => {
  const results: File[] = [];
  
  // Processar sequencialmente para não sobrecarregar
  for (const file of files) {
    const converted = await convertToJPEG(file, targetMinSize, targetMaxSize, maxWidth, maxHeight);
    results.push(converted);
  }
  
  return results;
};

/**
 * Baixa uma imagem do Google Drive via proxy e converte para JPEG
 * 
 * @param googleDriveUrl - URL do Google Drive (qualquer formato suportado)
 * @param targetMinSize - Tamanho mínimo em bytes (padrão 1MB)
 * @param targetMaxSize - Tamanho máximo em bytes (padrão 5MB)
 * @returns Promise<File> - Arquivo JPEG
 */
export const downloadGoogleDriveImage = async (
  googleDriveUrl: string,
  targetMinSize = 1024 * 1024,
  targetMaxSize = 5 * 1024 * 1024
): Promise<File> => {
  // Extrair file_id
  const fileId = extractGoogleDriveFileId(googleDriveUrl);
  
  if (!fileId) {
    throw new Error('URL do Google Drive inválida. Não foi possível extrair o ID do arquivo.');
  }
  
  console.log(`📥 Baixando imagem do Google Drive: ${fileId}`);
  
  // Usar proxy para baixar a imagem (resolve CORS)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const proxyUrl = supabaseUrl 
    ? `${supabaseUrl}/functions/v1/google-drive-proxy?id=${fileId}`
    : `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
  
  try {
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Erro ao baixar imagem: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // Verificar se é uma imagem
    if (!blob.type.startsWith('image/')) {
      throw new Error('O arquivo baixado não é uma imagem válida. Verifique se o link está correto e público.');
    }
    
    console.log(`✅ Imagem baixada: ${(blob.size / 1024 / 1024).toFixed(2)}MB, tipo: ${blob.type}`);
    
    // Criar um arquivo temporário
    const tempFile = new File([blob], `google-drive-${fileId}.jpg`, {
      type: blob.type,
      lastModified: Date.now(),
    });
    
    // Converter para JPEG com tamanho ideal
    const converted = await convertToJPEG(tempFile, targetMinSize, targetMaxSize, 1920, 1440);
    
    return converted;
  } catch (error: any) {
    console.error('❌ Erro ao baixar imagem do Google Drive:', error);
    throw new Error(`Falha ao baixar imagem: ${error.message}`);
  }
};

/**
 * Baixa múltiplas imagens do Google Drive via proxy
 * 
 * @param urls - Array de URLs do Google Drive
 * @param onProgress - Callback de progresso (opcional)
 * @returns Promise<File[]> - Array de arquivos JPEG
 */
export const downloadMultipleGoogleDriveImages = async (
  urls: string[],
  onProgress?: (current: number, total: number) => void
): Promise<File[]> => {
  const results: File[] = [];
  
  for (let i = 0; i < urls.length; i++) {
    try {
      if (onProgress) {
        onProgress(i + 1, urls.length);
      }
      
      const file = await downloadGoogleDriveImage(urls[i]);
      results.push(file);
    } catch (error) {
      console.error(`Erro ao baixar imagem ${i + 1}:`, error);
      // Continuar com as outras imagens
    }
  }
  
  return results;
};

/**
 * @deprecated Use convertToJPEG para melhor qualidade
 * Converte uma imagem para formato WebP (mantido para compatibilidade)
 */
export const convertToWebP = (
  file: File,
  quality = 0.8,
  maxWidth = 800,
  maxHeight = 600
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height;

        if (width > height) {
          width = Math.min(width, maxWidth);
          height = width / aspectRatio;
        } else {
          height = Math.min(height, maxHeight);
          width = height * aspectRatio;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            const originalName = file.name.replace(/\.[^/.]+$/, '');
            const webpFile = new File([blob], `${originalName}.webp`, {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(webpFile);
          } else {
            reject(new Error('Falha ao converter imagem para WebP'));
          }
        }, 'image/webp', quality);
      } else {
        reject(new Error('Não foi possível obter contexto do canvas'));
      }
    };

    img.onerror = () => {
      reject(new Error('Falha ao carregar a imagem'));
    };

    img.src = URL.createObjectURL(file);
  });
};

/**
 * @deprecated Use convertMultipleToJPEG para melhor qualidade
 * Processa múltiplas imagens convertendo-as para WebP (mantido para compatibilidade)
 */
export const convertMultipleToWebP = async (
  files: File[],
  quality = 0.8,
  maxWidth = 800,
  maxHeight = 600
): Promise<File[]> => {
  const promises = files.map(file => convertToWebP(file, quality, maxWidth, maxHeight));
  return Promise.all(promises);
};

/**
 * Extrai o file_id de uma URL do Google Drive
 * Suporta múltiplos formatos de URL do Google Drive
 * 
 * @param url - URL do Google Drive (vários formatos suportados)
 * @returns file_id ou null se não encontrar
 */
export const extractGoogleDriveFileId = (url: string): string | null => {
  if (!url) return null;
  
  // Verificar se é uma URL do Google Drive (vários domínios)
  const isGoogleDrive = url.includes('drive.google.com') || 
                        url.includes('drive.usercontent.google.com') ||
                        url.includes('docs.google.com');
  
  if (!isGoogleDrive) {
    return null;
  }

  // Padrão 1: /d/FILE_ID/ (mais comum em links de compartilhamento)
  const match1 = url.match(/\/d\/([^/]+)\//);
  if (match1 && match1[1]) {
    return match1[1];
  }

  // Padrão 2: id=FILE_ID (em query params - usado em uc?export=download&id=)
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2 && match2[1]) {
    return match2[1];
  }

  // Padrão 3: /d/FILE_ID (sem barra final)
  const match3 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match3 && match3[1]) {
    return match3[1];
  }

  return null;
};

/**
 * Gera URLs alternativas para uma imagem do Google Drive
 * Retorna array com diferentes formatos para tentar em cascata
 * PRIORIZA THUMBNAILS para performance (carregam mais rápido)
 * 
 * @param fileId - ID do arquivo do Google Drive
 * @returns Array de URLs para tentar em ordem
 */
export const getGoogleDriveUrlVariants = (fileId: string): string[] => {
  const variants: string[] = [];
  
  // 1. Thumbnail pequeno (mais rápido, geralmente funciona)
  variants.push(`https://drive.google.com/thumbnail?id=${fileId}&sz=w400`);
  
  // 2. Thumbnail médio
  variants.push(`https://drive.google.com/thumbnail?id=${fileId}&sz=w800`);
  
  // 3. Thumbnail grande
  variants.push(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`);
  
  return variants;
};

/**
 * Tipo de imagem para otimização
 * - 'thumbnail': Usa thumbnail do Google Drive (rápido, sem proxy, ~400px)
 * - 'medium': Usa thumbnail maior (rápido, sem proxy, ~800px)
 * - 'full': Usa proxy para imagem completa (mais lento, mas qualidade total)
 */
export type ImageSize = 'thumbnail' | 'medium' | 'full';

/**
 * Converte links do Google Drive para o formato apropriado
 * 
 * OTIMIZAÇÃO DE PERFORMANCE:
 * - Para listagens, use 'thumbnail' (carrega direto do Google, ~400px, mais rápido)
 * - Para visualização, use 'full' (passa pelo proxy, qualidade total)
 * 
 * @param url - URL do Google Drive ou qualquer outra URL
 * @param size - Tamanho da imagem: 'thumbnail' (rápido), 'medium', ou 'full' (qualidade)
 * @returns URL convertida ou URL original se não for Google Drive
 */
export const convertGoogleDriveUrl = (
  url: string | null | undefined,
  size: ImageSize = 'thumbnail'
): string => {
  if (!url) return '';
  
  // Se já for um link do Supabase Storage ou outro serviço, retornar como está
  if (url.includes('supabase.co') || 
      url.includes('resizedimgs.vivareal.com')) {
    return url;
  }
  
  // Se já é uma URL de thumbnail do Google Drive, retornar como está
  if (url.includes('drive.google.com/thumbnail')) {
    return url;
  }
  
  // Extrair file_id
  const fileId = extractGoogleDriveFileId(url);
  
  if (fileId) {
    switch (size) {
      case 'thumbnail':
        // Thumbnail pequeno - direto do Google Drive, sem proxy (mais rápido)
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
      
      case 'medium':
        // Thumbnail médio - direto do Google Drive, sem proxy
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
      
      case 'full':
        // Imagem completa - usa proxy para resolver CORS
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        if (supabaseUrl) {
          return `${supabaseUrl}/functions/v1/google-drive-proxy?id=${fileId}`;
        }
        // Fallback para thumbnail grande se não tiver proxy
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
    }
  }
  
  // Se não for Google Drive, retornar URL original
  return url;
};

/**
 * Alias para compatibilidade - converte para thumbnail por padrão (mais rápido)
 */
export const getGoogleDriveThumbnail = (url: string | null | undefined): string => {
  return convertGoogleDriveUrl(url, 'thumbnail');
};

/**
 * Alias para obter imagem em tamanho completo (via proxy)
 */
export const getGoogleDriveFullImage = (url: string | null | undefined): string => {
  return convertGoogleDriveUrl(url, 'full');
};

/**
 * Extrai file_id de qualquer URL relacionada ao Google Drive
 * Inclui URLs já convertidas (proxy, usercontent, etc)
 */
const extractFileIdFromAnyUrl = (url: string): string | null => {
  if (!url) return null;
  
  // Primeiro tentar extrair de URLs do Google Drive
  const driveId = extractGoogleDriveFileId(url);
  if (driveId) return driveId;
  
  // Tentar extrair de URL do proxy (?id=...)
  const proxyMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (proxyMatch && proxyMatch[1]) {
    return proxyMatch[1];
  }
  
  return null;
};

/**
 * Handler de erro para tags <img> que tenta múltiplos formatos automaticamente
 * Implementa fallback em cascata: Edge Function → thumbnail → placeholder
 * 
 * @param e - Evento de erro da tag <img>
 * @param originalUrl - URL original que falhou
 * @param placeholderUrl - URL do placeholder (padrão: '/placeholder-property.jpg')
 * @returns void
 */
export const handleImageErrorWithFallback = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  originalUrl: string,
  placeholderUrl: string = '/placeholder-property.jpg'
): void => {
  const img = e.target as HTMLImageElement;
  const currentSrc = img.src;
  
  // Extrair file_id de qualquer formato de URL
  const fileId = extractFileIdFromAnyUrl(originalUrl) || extractFileIdFromAnyUrl(currentSrc);
  
  if (fileId) {
    const variants = getGoogleDriveUrlVariants(fileId);
    
    // Encontrar qual variante atual está sendo usada
    let currentIndex = -1;
    for (let i = 0; i < variants.length; i++) {
      if (currentSrc.includes(variants[i]) || currentSrc === variants[i] || 
          (variants[i].includes('google-drive-proxy') && currentSrc.includes('google-drive-proxy')) ||
          (variants[i].includes('thumbnail') && currentSrc.includes('thumbnail'))) {
        currentIndex = i;
        break;
      }
    }
    
    // Tentar próximo formato na lista
    if (currentIndex < variants.length - 1) {
      const nextUrl = variants[currentIndex + 1];
      console.log(`🔄 Tentando formato alternativo (${currentIndex + 2}/${variants.length}): ${nextUrl}`);
      img.src = nextUrl;
      return;
    }
    
    // Se já tentou todos os formatos, usar placeholder
    console.error('❌ Todos os formatos falharam para fileId:', fileId);
  }
  
  // Usar placeholder
  if (!currentSrc.includes(placeholderUrl)) {
    img.src = placeholderUrl;
  }
}; 