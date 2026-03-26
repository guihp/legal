-- Título opcional na LP (para <title> / destaque na página pública)
ALTER TABLE public.property_landing_pages
  ADD COLUMN IF NOT EXISTS page_title TEXT;

COMMENT ON COLUMN public.property_landing_pages.page_title IS 'Título opcional da landing (SEO / destaque); o restante vem do imóvel.';

-- Página pública precisa chamar o RPC com cliente anon
GRANT EXECUTE ON FUNCTION public.increment_page_view(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_page_view(UUID) TO authenticated;
