/**
 * Converte uma imagem para formato WebP
 * @param file - Arquivo de imagem original
 * @param quality - Qualidade da compressão (0-1, padrão 0.8)
 * @param maxWidth - Largura máxima (padrão 800px)
 * @param maxHeight - Altura máxima (padrão 600px)
 * @returns Promise<File> - Arquivo convertido para WebP
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

        // Converter para WebP
        canvas.toBlob((blob) => {
          if (blob) {
            // Criar novo nome de arquivo com extensão .webp
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
 * Processa múltiplas imagens convertendo-as para WebP
 * @param files - Array de arquivos de imagem
 * @param quality - Qualidade da compressão (0-1, padrão 0.8)
 * @param maxWidth - Largura máxima (padrão 800px)
 * @param maxHeight - Altura máxima (padrão 600px)
 * @returns Promise<File[]> - Array de arquivos convertidos
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