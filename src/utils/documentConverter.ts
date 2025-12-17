import mammoth from 'mammoth';
import html2pdf from 'html2pdf.js';

export interface ConversionResult {
  success: boolean;
  pdfBlob?: Blob;
  pdfUrl?: string;
  error?: string;
}

export const convertWordToPDF = async (fileUrl: string, fileName: string): Promise<ConversionResult> => {
  try {
    console.log('📝 Iniciando conversão Word → PDF para:', fileName);

    // 1. Baixar o arquivo Word
    console.log('⬇️ Baixando arquivo Word...');
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Erro ao baixar arquivo: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log('✅ Arquivo baixado, tamanho:', arrayBuffer.byteLength, 'bytes');

    // 2. Converter Word para HTML usando mammoth (SEM modificações)
    console.log('🔄 Convertendo Word para HTML...');
    const result = await mammoth.convertToHtml({ 
      arrayBuffer: arrayBuffer,
      // Configurações para conversão limpa
      includeDefaultStyleMap: true,
      includeEmbeddedStyleMap: true,
      ignoreEmptyParagraphs: false
    });

    if (result.messages && result.messages.length > 0) {
      console.log('⚠️ Mensagens da conversão:', result.messages);
    }

    // 3. HTML limpo - apenas o conteúdo convertido
    const cleanHtml = result.value;
    console.log('✅ HTML gerado, tamanho:', cleanHtml.length, 'caracteres');

    // 4. Estruturar HTML para PDF (sem adicionar informações extras)
    const styledHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Times New Roman', Times, serif;
              line-height: 1.6;
              margin: 0;
              padding: 20px;
              color: #333;
              background: white;
            }
            
            /* Estilos para preservar formatação original */
            p { 
              margin: 6px 0; 
              text-align: justify;
            }
            
            h1, h2, h3, h4, h5, h6 { 
              margin: 12px 0 6px 0; 
              font-weight: bold;
            }
            
            h1 { font-size: 18px; }
            h2 { font-size: 16px; }
            h3 { font-size: 14px; }
            h4, h5, h6 { font-size: 12px; }
            
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 10px 0;
            }
            
            td, th { 
              border: 1px solid #ccc; 
              padding: 8px; 
              text-align: left;
            }
            
            th { 
              background-color: #f5f5f5; 
              font-weight: bold;
            }
            
            ul, ol { 
              margin: 6px 0; 
              padding-left: 20px;
            }
            
            li { 
              margin: 3px 0; 
            }
            
            strong, b { 
              font-weight: bold; 
            }
            
            em, i { 
              font-style: italic; 
            }
            
            u { 
              text-decoration: underline; 
            }
            
            /* Quebras de página */
            .page-break { 
              page-break-before: always; 
            }
            
            @media print {
              body { 
                margin: 0; 
                padding: 15px;
              }
            }
          </style>
        </head>
        <body>
          ${cleanHtml}
        </body>
      </html>
    `;

    // 5. Configurar opções do PDF (otimizadas)
    const pdfOptions = {
      margin: [10, 10, 10, 10], // margens em mm
      filename: fileName.replace(/\.(docx?|rtf)$/i, '.pdf'),
      image: { 
        type: 'jpeg', 
        quality: 0.95 
      },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true,
        allowTaint: false,
        width: 794, // A4 width in pixels at 96 DPI
        height: 1123 // A4 height in pixels at 96 DPI
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { 
        mode: ['avoid-all', 'css', 'legacy'],
        before: '.page-break'
      }
    };

    // 6. Converter HTML para PDF
    console.log('📄 Gerando PDF...');
    const pdfBlob = await html2pdf()
      .set(pdfOptions)
      .from(styledHtml)
      .outputPdf('blob');

    console.log('✅ PDF gerado com sucesso, tamanho:', pdfBlob.size, 'bytes');

    // 7. Criar URL para o PDF
    const pdfUrl = URL.createObjectURL(pdfBlob);

    return {
      success: true,
      pdfBlob,
      pdfUrl
    };

  } catch (error) {
    console.error('❌ Erro na conversão Word → PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido na conversão'
    };
  }
};

export const isWordDocument = (fileName: string, fileType?: string): boolean => {
  const wordExtensions = ['.doc', '.docx', '.rtf'];
  const wordMimeTypes = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/rtf',
    'text/rtf'
  ];

  const hasWordExtension = wordExtensions.some(ext => 
    fileName.toLowerCase().endsWith(ext)
  );

  const hasWordMimeType = fileType && wordMimeTypes.some(type => 
    fileType.includes(type) || fileType.includes('word')
  );

  return hasWordExtension || hasWordMimeType;
};

export const cleanupPdfUrl = (url: string): void => {
  try {
    URL.revokeObjectURL(url);
    console.log('🧹 URL do PDF limpa da memória');
  } catch (error) {
    console.warn('⚠️ Erro ao limpar URL do PDF:', error);
  }
}; 