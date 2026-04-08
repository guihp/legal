-- API keys por empresa para integrações externas (n8n)
CREATE TABLE IF NOT EXISTS public.company_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL DEFAULT 'n8n',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_api_keys_company_active
  ON public.company_api_keys(company_id, is_active, created_at DESC);

ALTER TABLE public.company_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_api_keys_select_company ON public.company_api_keys;
CREATE POLICY company_api_keys_select_company
  ON public.company_api_keys
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT up.company_id FROM public.user_profiles up WHERE up.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS company_api_keys_insert_company_admin_gestor ON public.company_api_keys;
CREATE POLICY company_api_keys_insert_company_admin_gestor
  ON public.company_api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      SELECT up.company_id FROM public.user_profiles up WHERE up.id = auth.uid()
    )
    AND (
      SELECT up.role FROM public.user_profiles up WHERE up.id = auth.uid()
    ) IN ('admin', 'gestor')
  );

DROP POLICY IF EXISTS company_api_keys_update_company_admin_gestor ON public.company_api_keys;
CREATE POLICY company_api_keys_update_company_admin_gestor
  ON public.company_api_keys
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      SELECT up.company_id FROM public.user_profiles up WHERE up.id = auth.uid()
    )
    AND (
      SELECT up.role FROM public.user_profiles up WHERE up.id = auth.uid()
    ) IN ('admin', 'gestor')
  )
  WITH CHECK (
    company_id = (
      SELECT up.company_id FROM public.user_profiles up WHERE up.id = auth.uid()
    )
  );

COMMENT ON TABLE public.company_api_keys IS 'Chaves de API por empresa para integrações externas (n8n)';
