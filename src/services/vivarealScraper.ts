// DESABILITADO — clientes cadastram imóveis manualmente pelo popup
// "Adicionar imóvel" (AddImovelModal) e edição inline em PropertyList.
// O scraper do VivaReal não é mais usado pelo front. A edge function
// `vivareal-scraper` continua deployada no Supabase, mas nenhum botão do
// produto chama essas funções.
//
// Mantido como stub para evitar quebrar imports antigos, mas qualquer
// chamada lança erro explícito para sinalizar uso indevido.

export interface ScrapingResponse {
  success: boolean;
  message: string;
  total_found?: number;
  total_imported?: number;
  errors?: string[];
  job_id?: string;
  preview_only?: boolean;
}

const DISABLED_MSG =
  'Importação automática do VivaReal foi desabilitada. Cadastre os imóveis manualmente em /properties → "Adicionar imóvel".';

export async function previewVivaRealScraping(_url: string): Promise<ScrapingResponse> {
  throw new Error(DISABLED_MSG);
}

export async function startVivaRealScraping(_url: string, _previewOnly: boolean = false): Promise<ScrapingResponse> {
  throw new Error(DISABLED_MSG);
}
