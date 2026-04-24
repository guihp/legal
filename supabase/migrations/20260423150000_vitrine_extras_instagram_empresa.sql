-- Textos/cores extras do site vitrine (JSON) + handle Instagram da empresa

ALTER TABLE public.company_websites
  ADD COLUMN IF NOT EXISTS vitrine_extras jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.company_websites.vitrine_extras IS
  'Opcional: header_bg, header_fg, header_muted, header_tagline, use_company_display_font, textos da seção Sobre/Contato (about_*, contact_*).';

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS arroba_instagram_empresa text NULL;

COMMENT ON COLUMN public.companies.arroba_instagram_empresa IS
  'Handle ou nome de exibição do Instagram da empresa. No vitrine público aparece quando id_instagram está preenchido; @ é prefixado só se ainda não existir.';
