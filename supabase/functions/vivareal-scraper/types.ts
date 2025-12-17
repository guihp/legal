export interface ScrapingRequest {
  url: string;
  imobiliaria_id?: string;
  user_id: string;
  company_id: string;
}

export interface PropertyData {
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

export interface ScrapingProgress {
  total: number;
  processed: number;
  current: string;
  status: 'starting' | 'scraping' | 'processing' | 'completed' | 'error';
  message?: string;
}

export interface ScrapingResponse {
  success: boolean;
  message: string;
  total_found?: number;
  total_imported?: number;
  errors?: string[];
  job_id?: string;
  preview_only?: boolean; // Se true, apenas busca sem importar
}

