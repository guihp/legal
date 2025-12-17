// Serviço para chamar a Edge Function de scraping do VivaReal

import { supabase } from '@/integrations/supabase/client';

export interface ScrapingResponse {
  success: boolean;
  message: string;
  total_found?: number;
  total_imported?: number;
  errors?: string[];
  job_id?: string;
  preview_only?: boolean;
}

/**
 * Busca apenas a quantidade de imóveis (sem importar)
 */
export async function previewVivaRealScraping(url: string): Promise<ScrapingResponse> {
  return startVivaRealScraping(url, true);
}

/**
 * Inicia o scraping de uma imobiliária do VivaReal
 */
export async function startVivaRealScraping(url: string, previewOnly: boolean = false): Promise<ScrapingResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Usuário não autenticado');
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      throw new Error('Perfil de usuário não encontrado');
    }

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/vivareal-scraper`;

    console.log('📡 Chamando Edge Function:', edgeFunctionUrl);
    console.log('🔑 Headers:', {
      hasAuth: !!session.access_token,
      hasAnonKey: !!SUPABASE_ANON_KEY,
    });

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
        'x-client-info': 'imobipro-web',
      },
      body: JSON.stringify({
        url,
        company_id: profile.company_id,
        preview_only: previewOnly,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Erro HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // Se não conseguir parsear JSON, usar texto da resposta
        const text = await response.text().catch(() => '');
        if (text) {
          errorMessage = text.substring(0, 200);
        }
      }
      
      // Mensagens mais amigáveis para erros comuns
      if (response.status === 403) {
        errorMessage = 'Acesso bloqueado pelo VivaReal. O site pode estar protegendo contra scraping automatizado. Tente novamente mais tarde ou use a opção de upload XML.';
      } else if (response.status === 500) {
        errorMessage = 'Erro interno do servidor. Verifique os logs da Edge Function ou tente novamente.';
      }
      
      throw new Error(errorMessage);
    }

    const result: ScrapingResponse = await response.json();
    return result;
  } catch (error: any) {
    console.error('Erro ao iniciar scraping:', error);
    throw error;
  }
}

