// Parser para extrair dados do HTML do VivaReal

export interface ParsedProperty {
  listing_id: string;
  url: string;
  title?: string;
}

export interface PropertyDetails {
  listing_id: string;
  tipo_imovel: string | null;
  tipo_categoria: string | null;
  descricao: string | null;
  preco: number | null;
  tamanho_m2: number | null;
  quartos: number | null;
  banheiros: number | null;
  garagem: number | null;
  suite: number | null;
  andar: number | null;
  ano_construcao: number | null;
  cidade: string | null;
  bairro: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  cep: string | null;
  modalidade: string | null;
  imagens: string[];
  features: string[];
}

/**
 * Extrai links de imóveis da página principal da imobiliária
 */
export function extractPropertyLinks(html: string, baseUrl: string): ParsedProperty[] {
  const properties: ParsedProperty[] = [];
  
  // Múltiplos padrões para encontrar links de imóveis no VivaReal
  // Padrão 1: /imovel/12345678/
  const pattern1 = /href=["'](\/imovel\/\d+\/)["']/g;
  // Padrão 2: href="/imovel/12345678"
  const pattern2 = /href=["'](\/imovel\/\d+)["']/g;
  // Padrão 3: data-id="12345678" ou listing-id="12345678"
  const pattern3 = /(?:data-id|listing-id)=["'](\d+)["']/g;
  // Padrão 4: URLs completas https://www.vivareal.com.br/imovel/...
  const pattern4 = /https?:\/\/[^"'\s]*vivareal\.com\.br\/imovel\/(\d+)[\/"']?/g;
  
  // Tentar todos os padrões
  const allMatches: Array<{ listing_id: string; url: string }> = [];
  
  // Padrão 1 e 2: links relativos
  for (const pattern of [pattern1, pattern2]) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const relativePath = match[1];
      const listingIdMatch = relativePath.match(/\/imovel\/(\d+)/);
      if (listingIdMatch && listingIdMatch[1]) {
        const listingId = listingIdMatch[1];
        const fullUrl = `https://www.vivareal.com.br/imovel/${listingId}/`;
        allMatches.push({ listing_id: listingId, url: fullUrl });
      }
    }
  }
  
  // Padrão 3: data attributes
  const dataMatches = html.matchAll(pattern3);
  for (const match of dataMatches) {
    const listingId = match[1];
    if (listingId && listingId.length >= 6) { // IDs geralmente têm pelo menos 6 dígitos
      allMatches.push({
        listing_id: listingId,
        url: `https://www.vivareal.com.br/imovel/${listingId}/`,
      });
    }
  }
  
  // Padrão 4: URLs completas
  const urlMatches = html.matchAll(pattern4);
  for (const match of urlMatches) {
    const listingId = match[1];
    const fullUrl = match[0].replace(/["']$/, ''); // Remove aspas no final
    allMatches.push({ listing_id: listingId, url: fullUrl });
  }
  
  // Remover duplicatas
  const unique = Array.from(
    new Map(allMatches.map(p => [p.listing_id, p])).values()
  );
  
  console.log(`📊 Extraídos ${unique.length} imóveis únicos de ${allMatches.length} matches`);
  
  return unique;
}

/**
 * Extrai informações completas de um imóvel da página individual
 */
export function parsePropertyDetails(html: string, listingId: string): PropertyDetails {
  const details: PropertyDetails = {
    listing_id: listingId,
    tipo_imovel: null,
    tipo_categoria: null,
    descricao: null,
    preco: null,
    tamanho_m2: null,
    quartos: null,
    banheiros: null,
    garagem: null,
    suite: null,
    andar: null,
    ano_construcao: null,
    cidade: null,
    bairro: null,
    endereco: null,
    numero: null,
    complemento: null,
    cep: null,
    modalidade: null,
    imagens: [],
    features: [],
  };

  try {
    // Extrair preço
    const precoMatch = html.match(/R\$\s*([\d.]+)/);
    if (precoMatch) {
      const precoStr = precoMatch[1].replace(/\./g, '');
      details.preco = parseFloat(precoStr);
    }

    // Extrair tipo de imóvel (Apartamento, Casa, etc.)
    const tipoMatch = html.match(/<span[^>]*class="[^"]*property-type[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                     html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (tipoMatch) {
      details.tipo_imovel = tipoMatch[1].trim();
    }

    // Extrair descrição
    const descMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      html.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    if (descMatch) {
      details.descricao = descMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // Extrair características (quartos, banheiros, etc.)
    const quartosMatch = html.match(/(\d+)\s*(?:quarto|dormitório)/i);
    if (quartosMatch) {
      details.quartos = parseInt(quartosMatch[1]);
    }

    const banheirosMatch = html.match(/(\d+)\s*(?:banheiro|wc)/i);
    if (banheirosMatch) {
      details.banheiros = parseInt(banheirosMatch[1]);
    }

    const garagemMatch = html.match(/(\d+)\s*(?:vaga|garagem)/i);
    if (garagemMatch) {
      details.garagem = parseInt(garagemMatch[1]);
    }

    const suiteMatch = html.match(/(\d+)\s*suíte/i);
    if (suiteMatch) {
      details.suite = parseInt(suiteMatch[1]);
    }

    // Extrair metragem
    const areaMatch = html.match(/(\d+(?:[.,]\d+)?)\s*m²/i);
    if (areaMatch) {
      details.tamanho_m2 = parseFloat(areaMatch[1].replace(',', '.'));
    }

    // Extrair endereço
    const enderecoMatch = html.match(/<span[^>]*class="[^"]*address[^"]*"[^>]*>([^<]+)<\/span>/i);
    if (enderecoMatch) {
      const endereco = enderecoMatch[1].trim();
      // Tentar separar endereço, número, bairro, cidade
      const parts = endereco.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        details.endereco = parts[0];
        details.bairro = parts[1];
        if (parts.length >= 3) {
          details.cidade = parts[2];
        }
      } else {
        details.endereco = endereco;
      }
    }

    // Extrair CEP
    const cepMatch = html.match(/\b(\d{5}-?\d{3})\b/);
    if (cepMatch) {
      details.cep = cepMatch[1].replace('-', '');
    }

    // Extrair imagens
    const imageRegex = /<img[^>]*src=["']([^"']+\.(jpg|jpeg|png|webp))["'][^>]*>/gi;
    const imageMatches = html.matchAll(imageRegex);
    for (const match of imageMatches) {
      let imgUrl = match[1];
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        imgUrl = 'https://www.vivareal.com.br' + imgUrl;
      }
      if (!details.imagens.includes(imgUrl)) {
        details.imagens.push(imgUrl);
      }
    }

    // Extrair modalidade (Venda/Aluguel)
    if (html.match(/venda/i)) {
      details.modalidade = 'Venda';
    } else if (html.match(/aluguel|locacao/i)) {
      details.modalidade = 'Aluguel';
    }

    // Extrair features/características extras
    const featuresRegex = /<li[^>]*class="[^"]*feature[^"]*"[^>]*>([^<]+)<\/li>/gi;
    const featureMatches = html.matchAll(featuresRegex);
    for (const match of featureMatches) {
      const feature = match[1].trim();
      if (feature && !details.features.includes(feature)) {
        details.features.push(feature);
      }
    }

  } catch (error) {
    console.error('Erro ao fazer parse do HTML:', error);
  }

  return details;
}

/**
 * Identifica se há paginação e quantas páginas existem
 */
export function extractPaginationInfo(html: string): { totalPages: number; currentPage: number } {
  let totalPages = 1;
  let currentPage = 1;

  // Tentar encontrar informações de paginação
  const paginationMatch = html.match(/página\s+(\d+)\s+de\s+(\d+)/i) ||
                         html.match(/page\s+(\d+)\s+of\s+(\d+)/i);
  
  if (paginationMatch) {
    currentPage = parseInt(paginationMatch[1]);
    totalPages = parseInt(paginationMatch[2]);
  }

  return { totalPages, currentPage };
}

