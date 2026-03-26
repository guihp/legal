-- Branding visual do site vitrine público
ALTER TABLE public.company_websites
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS title_color TEXT DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS hero_images JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.company_websites.logo_url IS 'URL opcional da logo da imobiliária para o site público';
COMMENT ON COLUMN public.company_websites.title_color IS 'Cor do título principal (hero) do site público';
COMMENT ON COLUMN public.company_websites.hero_images IS 'Lista (até 3 URLs) de imagens de capa do hero';
