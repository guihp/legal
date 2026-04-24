-- Registro local de contas Instagram por empresa (fonte de verdade da plataforma)
-- Espelha company_whatsapp_instances, adicionando canal Instagram à arquitetura de /conversas.

CREATE TABLE IF NOT EXISTS public.company_instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  handle text NOT NULL,                  -- @username público
  instagram_user_id text NULL,           -- ID numérico retornado pela Graph API
  display_name text NULL,                -- Nome de exibição público
  profile_pic_url text NULL,
  access_token text NULL,                -- Token de acesso (long-lived) opcional
  status text NOT NULL DEFAULT 'disconnected', -- connected | connecting | disconnected
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, handle)
);

CREATE INDEX IF NOT EXISTS idx_company_instagram_accounts_company_id
  ON public.company_instagram_accounts(company_id);

CREATE INDEX IF NOT EXISTS idx_company_instagram_accounts_user_id
  ON public.company_instagram_accounts(user_id);

CREATE OR REPLACE FUNCTION public.set_company_instagram_accounts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_instagram_accounts_updated_at
  ON public.company_instagram_accounts;

CREATE TRIGGER trg_company_instagram_accounts_updated_at
BEFORE UPDATE ON public.company_instagram_accounts
FOR EACH ROW
EXECUTE FUNCTION public.set_company_instagram_accounts_updated_at();

ALTER TABLE public.company_instagram_accounts ENABLE ROW LEVEL SECURITY;

-- RLS: mesma empresa pode ler/escrever
DROP POLICY IF EXISTS "company_instagram_accounts_select_same_company"
  ON public.company_instagram_accounts;
CREATE POLICY "company_instagram_accounts_select_same_company"
ON public.company_instagram_accounts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = company_instagram_accounts.company_id
      AND up.is_active = true
  )
);

DROP POLICY IF EXISTS "company_instagram_accounts_insert_same_company"
  ON public.company_instagram_accounts;
CREATE POLICY "company_instagram_accounts_insert_same_company"
ON public.company_instagram_accounts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = company_instagram_accounts.company_id
      AND up.is_active = true
  )
);

DROP POLICY IF EXISTS "company_instagram_accounts_update_same_company"
  ON public.company_instagram_accounts;
CREATE POLICY "company_instagram_accounts_update_same_company"
ON public.company_instagram_accounts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = company_instagram_accounts.company_id
      AND up.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = company_instagram_accounts.company_id
      AND up.is_active = true
  )
);

DROP POLICY IF EXISTS "company_instagram_accounts_delete_same_company"
  ON public.company_instagram_accounts;
CREATE POLICY "company_instagram_accounts_delete_same_company"
ON public.company_instagram_accounts
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = company_instagram_accounts.company_id
      AND up.is_active = true
  )
);
