-- Registro local de instâncias WhatsApp por empresa (fonte de verdade da plataforma)
CREATE TABLE IF NOT EXISTS public.company_whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  instance_name text NOT NULL,
  phone_number text NULL,
  api_key text NULL,
  webhook_url text NULL,
  status text NOT NULL DEFAULT 'disconnected',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, instance_name)
);

CREATE INDEX IF NOT EXISTS idx_company_whatsapp_instances_company_id
  ON public.company_whatsapp_instances(company_id);

CREATE INDEX IF NOT EXISTS idx_company_whatsapp_instances_user_id
  ON public.company_whatsapp_instances(user_id);

CREATE OR REPLACE FUNCTION public.set_company_whatsapp_instances_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_whatsapp_instances_updated_at
  ON public.company_whatsapp_instances;

CREATE TRIGGER trg_company_whatsapp_instances_updated_at
BEFORE UPDATE ON public.company_whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.set_company_whatsapp_instances_updated_at();

ALTER TABLE public.company_whatsapp_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_whatsapp_instances_select_same_company"
  ON public.company_whatsapp_instances;
CREATE POLICY "company_whatsapp_instances_select_same_company"
ON public.company_whatsapp_instances
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = company_whatsapp_instances.company_id
      AND up.is_active = true
  )
);

DROP POLICY IF EXISTS "company_whatsapp_instances_insert_same_company"
  ON public.company_whatsapp_instances;
CREATE POLICY "company_whatsapp_instances_insert_same_company"
ON public.company_whatsapp_instances
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = company_whatsapp_instances.company_id
      AND up.is_active = true
  )
);

DROP POLICY IF EXISTS "company_whatsapp_instances_update_same_company"
  ON public.company_whatsapp_instances;
CREATE POLICY "company_whatsapp_instances_update_same_company"
ON public.company_whatsapp_instances
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = company_whatsapp_instances.company_id
      AND up.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = company_whatsapp_instances.company_id
      AND up.is_active = true
  )
);

DROP POLICY IF EXISTS "company_whatsapp_instances_delete_same_company"
  ON public.company_whatsapp_instances;
CREATE POLICY "company_whatsapp_instances_delete_same_company"
ON public.company_whatsapp_instances
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = company_whatsapp_instances.company_id
      AND up.is_active = true
  )
);
