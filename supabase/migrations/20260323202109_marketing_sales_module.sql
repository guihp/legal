-- Migration para o Módulo de Marketing e Vendas (Site Vitrine, LPs e Parcerias)

-- 1. Nova tabela: company_websites
CREATE TABLE IF NOT EXISTS public.company_websites (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    pixel_facebook TEXT,
    analytics_google TEXT,
    theme_color TEXT DEFAULT '#3B82F6',
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT company_websites_pkey PRIMARY KEY (id),
    CONSTRAINT company_websites_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE
);

-- 2. Nova tabela: property_landing_pages
CREATE TABLE IF NOT EXISTS public.property_landing_pages (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    property_id INTEGER NOT NULL,
    company_id UUID NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    is_published BOOLEAN DEFAULT false,
    views INTEGER DEFAULT 0,
    custom_color TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT property_landing_pages_pkey PRIMARY KEY (id),
    CONSTRAINT property_landing_pages_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.imoveisvivareal(id) ON DELETE CASCADE,
    CONSTRAINT property_landing_pages_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE
);

-- 3. Adicionar colunas de parceria na imoveisvivareal
ALTER TABLE public.imoveisvivareal 
ADD COLUMN IF NOT EXISTS accepts_partnership BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS partnership_notes TEXT;

-- 4. Triggers de updated_at
DROP TRIGGER IF EXISTS update_company_websites_updated_at ON public.company_websites;
CREATE TRIGGER update_company_websites_updated_at 
BEFORE UPDATE ON public.company_websites 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_property_landing_pages_updated_at ON public.property_landing_pages;
CREATE TRIGGER update_property_landing_pages_updated_at 
BEFORE UPDATE ON public.property_landing_pages 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Row Level Security (RLS)
ALTER TABLE public.company_websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_landing_pages ENABLE ROW LEVEL SECURITY;

-- company_websites Policies
-- Leitura pública para sites publicados
CREATE POLICY "company_websites_select_public" ON public.company_websites
FOR SELECT TO public USING (is_published = true);

-- Acesso total para usuários da mesma empresa
CREATE POLICY "company_websites_all_company" ON public.company_websites
FOR ALL TO public USING (
    company_id IN (
        SELECT up.company_id FROM public.user_profiles up WHERE up.id = auth.uid()
    )
);

-- property_landing_pages Policies
-- Leitura pública para LPs publicadas
CREATE POLICY "property_landing_pages_select_public" ON public.property_landing_pages
FOR SELECT TO public USING (is_published = true);

-- Acesso total para usuários da mesma empresa
CREATE POLICY "property_landing_pages_all_company" ON public.property_landing_pages
FOR ALL TO public USING (
    company_id IN (
        SELECT up.company_id FROM public.user_profiles up WHERE up.id = auth.uid()
    )
);

-- 6. RPC para incrementar visualizações
CREATE OR REPLACE FUNCTION public.increment_page_view(page_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.property_landing_pages
  SET views = views + 1
  WHERE id = page_id;
$$;
