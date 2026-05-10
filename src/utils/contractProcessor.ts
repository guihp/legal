import { supabase } from '@/integrations/supabase/client';
import { convertWordToPDF } from './documentConverter';
// `mammoth` (~619KB) e `html2pdf.js` (~250KB) são usados apenas em fluxos de
// geração de contrato (raros). Importamos dinamicamente dentro das funções pra
// não inflar o bundle inicial — o code-splitting do Vite gera chunks separados
// que carregam só quando o usuário acessa esses fluxos.
type MammothModule = typeof import('mammoth');
type Html2PdfModule = typeof import('html2pdf.js');
let _mammothPromise: Promise<MammothModule> | null = null;
let _html2pdfPromise: Promise<Html2PdfModule> | null = null;
const loadMammoth = (): Promise<MammothModule> => {
  if (!_mammothPromise) _mammothPromise = import('mammoth');
  return _mammothPromise;
};
const loadHtml2Pdf = (): Promise<Html2PdfModule> => {
  if (!_html2pdfPromise) _html2pdfPromise = import('html2pdf.js');
  return _html2pdfPromise;
};

// Tipos para os dados do contrato
interface ClientData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  cpf?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  nationality?: string;
  marital_status?: string;
}

interface PropertyData {
  id: string;
  title: string;
  address: string;
  city?: string;
  state?: string;
  zip_code?: string;
  property_type: string;
  area: number;
  bedrooms?: number;
  bathrooms?: number;
  price: number;
  description?: string;
}

interface TemplateData {
  id: string;
  name: string;
  file_name: string;
  file_path: string;
  file_type: string;
}

interface ContractData {
  client: ClientData;
  property: PropertyData;
  template: TemplateData;
  contractDate?: Date;
  contractDuration?: string;
  paymentDay?: string;
  paymentMethod?: string;
  contractCity?: string;
  landlord?: ClientData;
  guarantor?: ClientData;
}

// Mapeamento de placeholders para substituição
const createPlaceholderMap = (data: ContractData): Record<string, string> => {
  const { client, property } = data;
  const contractDate = data.contractDate || new Date();
  
  return {
    // Dados do Cliente (Locatário)
    '{{NOME_CLIENTE}}': client.name || '',
    '{{EMAIL_CLIENTE}}': client.email || '',
    '{{TELEFONE_CLIENTE}}': client.phone || '',
    '{{CPF_CLIENTE}}': client.cpf || '',
    '{{ENDERECO_CLIENTE}}': client.address || '',
    '{{CIDADE_CLIENTE}}': client.city || '',
    '{{ESTADO_CLIENTE}}': client.state || '',
    '{{CEP_CLIENTE}}': client.zip_code || '',
    
    // Placeholders específicos do template de locação - Locatário
    '{{nome_locatario}}': client.name || '',
    '{{nacionalidade_locatario}}': client.nationality || 'Brasileira',
    '{{estado_civil_locatario}}': client.marital_status || '',
    '{{cpf_locatario}}': client.cpf || '',
    '{{endereço_locatario}}': client.address || '',
    '{{email_locatario}}': client.email || '',
    
    // Placeholders específicos do template de locação - Locador
    '{{nome_locador}}': data.landlord?.name || '',
    '{{nacionalidade_locador}}': data.landlord?.nationality || 'Brasileira',
    '{{estado_civil_locador}}': data.landlord?.marital_status || '',
    '{{cpf_locador}}': data.landlord?.cpf || '',
    '{{endereço_locador}}': data.landlord?.address || '',
    '{{email_locador}}': data.landlord?.email || '',
    
    // Placeholders específicos do template de locação - Fiador
    '{{nome_fiador}}': data.guarantor?.name || '',
    '{{nacionalidade_fiador}}': data.guarantor?.nationality || 'Brasileira',
    '{{estado_civil_fiador}}': data.guarantor?.marital_status || '',
    '{{cpf_fiador}}': data.guarantor?.cpf || '',
    '{{endereço_fiador}}': data.guarantor?.address || '',
    '{{email_fiador}}': data.guarantor?.email || '',
    
    // Dados da Propriedade
    '{{TITULO_IMOVEL}}': property.title || '',
    '{{ENDERECO_IMOVEL}}': property.address || '',
    '{{CIDADE_IMOVEL}}': property.city || '',
    '{{ESTADO_IMOVEL}}': property.state || '',
    '{{CEP_IMOVEL}}': property.zip_code || '',
    '{{TIPO_IMOVEL}}': getPropertyTypeLabel(property.property_type),
    '{{AREA_IMOVEL}}': property.area ? `${property.area}m²` : '',
    '{{QUARTOS_IMOVEL}}': property.bedrooms ? property.bedrooms.toString() : '',
    '{{BANHEIROS_IMOVEL}}': property.bathrooms ? property.bathrooms.toString() : '',
    '{{PRECO_IMOVEL}}': formatCurrency(property.price),
    '{{PRECO_IMOVEL_EXTENSO}}': numberToWords(property.price),
    '{{DESCRICAO_IMOVEL}}': property.description || '',
    
    // Placeholder específico do template - Imóvel
    '{{endereço_imovel}}': property.address || '',
    
    // Dados do Contrato
    '{{DATA_CONTRATO}}': contractDate.toLocaleDateString('pt-BR'),
    '{{DATA_CONTRATO_EXTENSO}}': formatDateExtensive(contractDate),
    '{{ANO_CONTRATO}}': contractDate.getFullYear().toString(),
    '{{MES_CONTRATO}}': (contractDate.getMonth() + 1).toString().padStart(2, '0'),
    '{{DIA_CONTRATO}}': contractDate.getDate().toString().padStart(2, '0'),
    
    // Placeholders específicos do template de locação - Contrato
    '{{tempo_contrato}}': data.contractDuration || '12 meses',
    '{{inicio_do_contrato}}': contractDate.toLocaleDateString('pt-BR'),
    '{{dia_pagamento_aluguel}}': data.paymentDay || '5',
    '{{valor_aluguel}}': formatCurrency(property.price),
    '{{forma_de_pagamento}}': data.paymentMethod || 'Transferência bancária',
    '{{cidade_contrato}}': property.city || data.contractCity || '',
    '{{data_assinatura_contrato}}': contractDate.toLocaleDateString('pt-BR'),
    
    // Dados Calculados
    '{{VALOR_ENTRADA}}': formatCurrency(property.price * 0.2), // 20% de entrada
    '{{VALOR_FINANCIAMENTO}}': formatCurrency(property.price * 0.8), // 80% financiamento
  };
};

// Utilitários de formatação
const getPropertyTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    house: 'Casa',
    apartment: 'Apartamento',
    commercial: 'Comercial',
    land: 'Terreno'
  };
  return labels[type] || type;
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const formatDateExtensive = (date: Date): string => {
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day} de ${month} de ${year}`;
};

// Função simples para converter números em palavras (valores básicos)
const numberToWords = (value: number): string => {
  // Implementação básica - você pode expandir conforme necessário
  const formatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
  
  return `${formatter.format(value)} (${value.toLocaleString('pt-BR')} reais)`;
};

// Função para baixar arquivo do Supabase
const downloadTemplateFile = async (filePath: string): Promise<Blob> => {
  try {
    console.log('📥 Baixando template:', filePath);
    
    const { data, error } = await supabase.storage
      .from('contract-templates')
      .download(filePath);
    
    if (error) {
      console.error('❌ Erro ao baixar template:', error);
      throw new Error(`Erro ao baixar template: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('Template não encontrado');
    }
    
    console.log('✅ Template baixado com sucesso');
    return data;
    
  } catch (error) {
    console.error('💥 Erro inesperado ao baixar template:', error);
    throw error;
  }
};

// Função para processar arquivo Word
const processWordDocument = async (
  fileBlob: Blob, 
  placeholders: Record<string, string>
): Promise<{ html: string; fileName: string }> => {
  try {
    console.log('📄 Processando documento Word...');
    
    // Converter Word para HTML (mammoth carregado sob demanda)
    const mammothMod = (await loadMammoth()).default;
    const arrayBuffer = await fileBlob.arrayBuffer();
    const result = await mammothMod.convertToHtml({ arrayBuffer });

    let html = result.value;

    // Substituir placeholders
    console.log('🔄 Substituindo placeholders...');
    Object.entries(placeholders).forEach(([placeholder, value]) => {
      const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
      html = html.replace(regex, value);
      console.log(`   ✓ ${placeholder} → ${value}`);
    });
    
    // Estruturar HTML para PDF
    const structuredHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Times New Roman', serif;
              font-size: 12pt;
              line-height: 1.6;
              color: #000;
              max-width: 210mm;
              margin: 0 auto;
              padding: 20mm;
              background: white;
            }
            h1, h2, h3 {
              color: #000;
              margin: 20px 0 10px 0;
            }
            p {
              margin: 10px 0;
              text-align: justify;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            table, th, td {
              border: 1px solid #000;
            }
            th, td {
              padding: 8px;
              text-align: left;
            }
            .signature-section {
              margin-top: 50px;
              page-break-inside: avoid;
            }
            .signature-line {
              border-top: 1px solid #000;
              width: 300px;
              margin: 30px auto 10px auto;
              text-align: center;
            }
            @media print {
              body { margin: 0; padding: 15mm; }
              .page-break { page-break-before: always; }
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;
    
    console.log('✅ Documento Word processado com sucesso');
    return {
      html: structuredHtml,
      fileName: `contrato_${Date.now()}.pdf`
    };
    
  } catch (error) {
    console.error('❌ Erro ao processar documento Word:', error);
    throw error;
  }
};

// Função para processar arquivo PDF (apenas substituição de texto)
const processPdfDocument = async (
  fileBlob: Blob,
  placeholders: Record<string, string>
): Promise<{ blob: Blob; fileName: string }> => {
  try {
    console.log('📄 Processando documento PDF...');
    
    // Para PDFs, vamos criar uma versão HTML com os dados do contrato
    // já que é complexo editar PDFs diretamente
    const contractHtml = generateContractHtml(placeholders);
    
    const pdfOptions = {
      margin: [20, 15, 20, 15],
      filename: `contrato_${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true
      }
    };
    
    const html2pdfFn = (await loadHtml2Pdf()).default;
    const pdfBlob = await html2pdfFn().set(pdfOptions).from(contractHtml).outputPdf('blob');

    console.log('✅ Documento PDF processado com sucesso');
    return {
      blob: pdfBlob,
      fileName: `contrato_${Date.now()}.pdf`
    };

  } catch (error) {
    console.error('❌ Erro ao processar documento PDF:', error);
    throw error;
  }
};

// Função para gerar HTML de contrato (fallback para PDFs)
const generateContractHtml = (placeholders: Record<string, string>): string => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #000;
            max-width: 210mm;
            margin: 0 auto;
            padding: 20mm;
            background: white;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
          }
          .contract-info {
            margin: 20px 0;
          }
          .signature-section {
            margin-top: 50px;
            page-break-inside: avoid;
          }
          .signature-line {
            border-top: 1px solid #000;
            width: 300px;
            margin: 30px auto 10px auto;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CONTRATO DE COMPRA E VENDA</h1>
          <p><strong>Data:</strong> ${placeholders['{{DATA_CONTRATO_EXTENSO}}']}</p>
        </div>
        
        <div class="contract-info">
          <h2>DADOS DO COMPRADOR</h2>
          <p><strong>Nome:</strong> ${placeholders['{{NOME_CLIENTE}}']}</p>
          <p><strong>E-mail:</strong> ${placeholders['{{EMAIL_CLIENTE}}']}</p>
          <p><strong>Telefone:</strong> ${placeholders['{{TELEFONE_CLIENTE}}']}</p>
          <p><strong>Endereço:</strong> ${placeholders['{{ENDERECO_CLIENTE}}']}</p>
          
          <h2>DADOS DO IMÓVEL</h2>
          <p><strong>Título:</strong> ${placeholders['{{TITULO_IMOVEL}}']}</p>
          <p><strong>Endereço:</strong> ${placeholders['{{ENDERECO_IMOVEL}}']}</p>
          <p><strong>Tipo:</strong> ${placeholders['{{TIPO_IMOVEL}}']}</p>
          <p><strong>Área:</strong> ${placeholders['{{AREA_IMOVEL}}']}</p>
          <p><strong>Quartos:</strong> ${placeholders['{{QUARTOS_IMOVEL}}']}</p>
          <p><strong>Banheiros:</strong> ${placeholders['{{BANHEIROS_IMOVEL}}']}</p>
          <p><strong>Valor:</strong> ${placeholders['{{PRECO_IMOVEL}}']}</p>
        </div>
        
        <div class="signature-section">
          <div class="signature-line">
            <p>Comprador: ${placeholders['{{NOME_CLIENTE}}']}</p>
          </div>
          <div class="signature-line">
            <p>Vendedor</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

// Função principal para processar contrato
export const processContract = async (contractData: ContractData): Promise<{ blob: Blob; fileName: string }> => {
  try {
    console.log('🚀 Iniciando processamento do contrato...');
    console.log('📋 Dados do contrato:', {
      cliente: contractData.client.name,
      propriedade: contractData.property.title,
      template: contractData.template.name
    });
    
    // Criar mapa de placeholders
    const placeholders = createPlaceholderMap(contractData);
    console.log('🔧 Placeholders criados:', Object.keys(placeholders).length, 'itens');
    
    // Baixar template
    const templateBlob = await downloadTemplateFile(contractData.template.file_path);
    
    // Verificar tipo de arquivo e processar adequadamente
    const isWordDocument = contractData.template.file_type.includes('word') || 
                          contractData.template.file_type.includes('msword') ||
                          contractData.template.file_name.toLowerCase().endsWith('.doc') ||
                          contractData.template.file_name.toLowerCase().endsWith('.docx');
    
    if (isWordDocument) {
      console.log('📄 Processando como documento Word...');
      const { html, fileName } = await processWordDocument(templateBlob, placeholders);
      
      // Converter HTML para PDF
      const pdfOptions = {
        margin: [20, 15, 20, 15],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait',
          compress: true
        }
      };
      
      const html2pdfFn = (await loadHtml2Pdf()).default;
      const pdfBlob = await html2pdfFn().set(pdfOptions).from(html).outputPdf('blob');

      return {
        blob: pdfBlob,
        fileName
      };
      
    } else {
      console.log('📄 Processando como documento PDF...');
      return await processPdfDocument(templateBlob, placeholders);
    }
    
  } catch (error) {
    console.error('💥 Erro ao processar contrato:', error);
    throw error;
  }
};

// Função para baixar contrato processado
export const downloadProcessedContract = (blob: Blob, fileName: string): void => {
  try {
    console.log('📥 Iniciando download do contrato:', fileName);
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Limpar URL do objeto
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    
    console.log('✅ Download do contrato concluído');
    
  } catch (error) {
    console.error('❌ Erro ao fazer download do contrato:', error);
    throw error;
  }
};

// Função para detectar placeholders em um template
export const detectPlaceholders = async (templateBlob: Blob, fileName: string): Promise<string[]> => {
  try {
    let content = '';
    
    // Verificar se é Word document
    const isWordDocument = fileName.toLowerCase().endsWith('.doc') || 
                          fileName.toLowerCase().endsWith('.docx');
    
    if (isWordDocument) {
      // Extrair texto do Word (mammoth carregado sob demanda)
      const mammothMod = (await loadMammoth()).default;
      const arrayBuffer = await templateBlob.arrayBuffer();
      const result = await mammothMod.extractRawText({ arrayBuffer });
      content = result.value;
    } else {
      // Para PDF, vamos assumir que não conseguimos extrair texto facilmente
      // Retornar placeholders conhecidos como fallback
      console.warn('Detecção de placeholders em PDF não implementada. Usando placeholders padrão.');
      return [];
    }
    
    // Regex para encontrar placeholders no formato {{placeholder}}
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders = new Set<string>();
    let match;
    
    while ((match = placeholderRegex.exec(content)) !== null) {
      placeholders.add(`{{${match[1]}}}`);
    }
    
    return Array.from(placeholders);
    
  } catch (error) {
    console.error('Erro ao detectar placeholders:', error);
    return [];
  }
};

// Função para identificar dados faltantes baseado nos placeholders encontrados
export const identifyMissingData = (
  placeholders: string[], 
  contractData: ContractData
): { missingFields: string[]; missingData: Record<string, any> } => {
  const placeholderMap = createPlaceholderMap(contractData);
  const missingFields: string[] = [];
  const missingData: Record<string, any> = {};
  
  placeholders.forEach(placeholder => {
    const value = placeholderMap[placeholder];
    if (!value || value.trim() === '') {
      missingFields.push(placeholder);
      
      // Mapear placeholder para campos de dados necessários
      const fieldMapping = getFieldMapping(placeholder);
      if (fieldMapping) {
        missingData[fieldMapping.category] = missingData[fieldMapping.category] || {};
        missingData[fieldMapping.category][fieldMapping.field] = {
          placeholder,
          label: fieldMapping.label,
          type: fieldMapping.type || 'text',
          required: true
        };
      }
    }
  });
  
  return { missingFields, missingData };
};

// Mapeamento de placeholders para campos de dados
const getFieldMapping = (placeholder: string) => {
  const mappings: Record<string, { category: string; field: string; label: string; type?: string }> = {
    // Locatário
    '{{nome_locatario}}': { category: 'client', field: 'name', label: 'Nome do Locatário' },
    '{{nacionalidade_locatario}}': { category: 'client', field: 'nationality', label: 'Nacionalidade do Locatário' },
    '{{estado_civil_locatario}}': { category: 'client', field: 'marital_status', label: 'Estado Civil do Locatário', type: 'select' },
    '{{cpf_locatario}}': { category: 'client', field: 'cpf', label: 'CPF do Locatário' },
    '{{endereço_locatario}}': { category: 'client', field: 'address', label: 'Endereço do Locatário' },
    '{{email_locatario}}': { category: 'client', field: 'email', label: 'E-mail do Locatário', type: 'email' },
    
    // Locador
    '{{nome_locador}}': { category: 'landlord', field: 'name', label: 'Nome do Locador' },
    '{{nacionalidade_locador}}': { category: 'landlord', field: 'nationality', label: 'Nacionalidade do Locador' },
    '{{estado_civil_locador}}': { category: 'landlord', field: 'marital_status', label: 'Estado Civil do Locador', type: 'select' },
    '{{cpf_locador}}': { category: 'landlord', field: 'cpf', label: 'CPF do Locador' },
    '{{endereço_locador}}': { category: 'landlord', field: 'address', label: 'Endereço do Locador' },
    '{{email_locador}}': { category: 'landlord', field: 'email', label: 'E-mail do Locador', type: 'email' },
    
    // Fiador
    '{{nome_fiador}}': { category: 'guarantor', field: 'name', label: 'Nome do Fiador' },
    '{{nacionalidade_fiador}}': { category: 'guarantor', field: 'nationality', label: 'Nacionalidade do Fiador' },
    '{{estado_civil_fiador}}': { category: 'guarantor', field: 'marital_status', label: 'Estado Civil do Fiador', type: 'select' },
    '{{cpf_fiador}}': { category: 'guarantor', field: 'cpf', label: 'CPF do Fiador' },
    '{{endereço_fiador}}': { category: 'guarantor', field: 'address', label: 'Endereço do Fiador' },
    '{{email_fiador}}': { category: 'guarantor', field: 'email', label: 'E-mail do Fiador', type: 'email' },
    
    // Imóvel
    '{{endereço_imovel}}': { category: 'property', field: 'address', label: 'Endereço do Imóvel' },
    '{{cidade_imovel}}': { category: 'property', field: 'city', label: 'Cidade do Imóvel' },
    '{{estado_imovel}}': { category: 'property', field: 'state', label: 'Estado do Imóvel' },
    '{{cep_imovel}}': { category: 'property', field: 'zip_code', label: 'CEP do Imóvel' },
    
    // Contrato
    '{{tempo_contrato}}': { category: 'contract', field: 'contractDuration', label: 'Duração do Contrato' },
    '{{inicio_do_contrato}}': { category: 'contract', field: 'contractStartDate', label: 'Data de Início do Contrato', type: 'date' },
    '{{dia_pagamento_aluguel}}': { category: 'contract', field: 'paymentDay', label: 'Dia de Pagamento', type: 'number' },
    '{{valor_aluguel}}': { category: 'contract', field: 'rentValue', label: 'Valor do Aluguel', type: 'number' },
    '{{forma_de_pagamento}}': { category: 'contract', field: 'paymentMethod', label: 'Forma de Pagamento', type: 'select' },
    '{{cidade_contrato}}': { category: 'contract', field: 'contractCity', label: 'Cidade do Contrato' },
    '{{data_assinatura_contrato}}': { category: 'contract', field: 'signatureDate', label: 'Data de Assinatura', type: 'date' },
    
    // Placeholders genéricos (fallback para qualquer placeholder não mapeado)
  };
  
  // Se o placeholder não está mapeado, criar um mapeamento genérico
  if (!mappings[placeholder]) {
    const cleanPlaceholder = placeholder.replace(/[{}]/g, '').toLowerCase();
    
    // Tentar identificar a categoria baseada no nome do placeholder
    let category = 'contract'; // categoria padrão
    let label = cleanPlaceholder.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    if (cleanPlaceholder.includes('locatario') || cleanPlaceholder.includes('cliente')) {
      category = 'client';
    } else if (cleanPlaceholder.includes('locador') || cleanPlaceholder.includes('proprietario')) {
      category = 'landlord';
    } else if (cleanPlaceholder.includes('fiador') || cleanPlaceholder.includes('garantidor')) {
      category = 'guarantor';
    } else if (cleanPlaceholder.includes('imovel') || cleanPlaceholder.includes('propriedade')) {
      category = 'property';
    }
    
    return {
      category,
      field: cleanPlaceholder,
      label: `${label} (Campo Personalizado)`,
      type: 'text'
    };
  }
  
  return mappings[placeholder];
};

// Opções para campos select
export const getSelectOptions = (field: string) => {
  const options: Record<string, { value: string; label: string }[]> = {
    marital_status: [
      { value: 'solteiro', label: 'Solteiro(a)' },
      { value: 'casado', label: 'Casado(a)' },
      { value: 'divorciado', label: 'Divorciado(a)' },
      { value: 'viuvo', label: 'Viúvo(a)' },
      { value: 'uniao_estavel', label: 'União Estável' }
    ],
    paymentMethod: [
      { value: 'transferencia_bancaria', label: 'Transferência Bancária' },
      { value: 'pix', label: 'PIX' },
      { value: 'boleto', label: 'Boleto Bancário' },
      { value: 'dinheiro', label: 'Dinheiro' },
      { value: 'cheque', label: 'Cheque' }
    ]
  };
  
  return options[field] || [];
}; 