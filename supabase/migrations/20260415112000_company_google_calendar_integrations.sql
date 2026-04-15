-- Integração Google Calendar por empresa (Opção B sem n8n fixo)

CREATE TABLE IF NOT EXISTS public.company_google_calendar_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  google_email text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_type text DEFAULT 'Bearer',
  scope text,
  expires_at timestamptz,
  created_by uuid REFERENCES public.user_profiles(id),
  connected_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_google_calendar_integrations_company_id
  ON public.company_google_calendar_integrations(company_id);

ALTER TABLE public.company_google_calendar_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_google_calendar_integrations_select ON public.company_google_calendar_integrations;
DROP POLICY IF EXISTS company_google_calendar_integrations_modify ON public.company_google_calendar_integrations;

CREATE POLICY company_google_calendar_integrations_select
ON public.company_google_calendar_integrations
FOR SELECT
TO authenticated
USING (
  is_super_admin()
  OR company_id = get_user_company_id()
);

CREATE POLICY company_google_calendar_integrations_modify
ON public.company_google_calendar_integrations
FOR ALL
TO authenticated
USING (
  is_super_admin()
  OR (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'gestor'))
)
WITH CHECK (
  is_super_admin()
  OR (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'gestor'))
);

DROP TRIGGER IF EXISTS update_company_google_calendar_integrations_updated_at ON public.company_google_calendar_integrations;
CREATE TRIGGER update_company_google_calendar_integrations_updated_at
BEFORE UPDATE ON public.company_google_calendar_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
