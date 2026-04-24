-- Token da Graph API na empresa (n8n atualizar-foto-instagram)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS token_instagram text NULL;

COMMENT ON COLUMN public.companies.token_instagram IS
  'Token de acesso Instagram Graph (long-lived); usado pelo n8n para renovar fotos de perfil dos leads.';

-- Identificador do cliente no Instagram + cache de foto (URLs expiram ~5 dias)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS instagram_id_cliente text NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS profile_pic_url_instagram text NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_profile_sync_instagram timestamptz NULL;

COMMENT ON COLUMN public.leads.instagram_id_cliente IS 'ID do usuário na Instagram Graph (PSID / IGSID conforme integração).';
COMMENT ON COLUMN public.leads.profile_pic_url_instagram IS 'URL da foto de perfil retornada pela Graph API (renovar antes de expirar).';
COMMENT ON COLUMN public.leads.last_profile_sync_instagram IS 'Última vez que a foto IG foi sincronizada via n8n/Graph.';
