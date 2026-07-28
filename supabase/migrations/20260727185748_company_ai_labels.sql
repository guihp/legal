-- Catálogo de etiquetas da IA por empresa + relaxa CHECK em conversation_contact_labels.status

CREATE TABLE IF NOT EXISTS public.company_ai_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'slate'
    CHECK (color IN ('emerald', 'amber', 'orange', 'sky', 'violet', 'rose', 'slate')),
  is_system boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug),
  CONSTRAINT company_ai_labels_slug_format
    CHECK (slug ~ '^[a-z][a-z0-9_]*$')
);

CREATE INDEX IF NOT EXISTS idx_company_ai_labels_company_id
  ON public.company_ai_labels (company_id);

CREATE INDEX IF NOT EXISTS idx_company_ai_labels_company_sort
  ON public.company_ai_labels (company_id, sort_order);

COMMENT ON TABLE public.company_ai_labels IS
  'Catálogo de etiquetas da IA por empresa (system + custom). status em conversation_contact_labels referencia slug.';

DROP TRIGGER IF EXISTS update_company_ai_labels_updated_at ON public.company_ai_labels;
CREATE TRIGGER update_company_ai_labels_updated_at
BEFORE UPDATE ON public.company_ai_labels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed helper: 3 etiquetas de sistema
CREATE OR REPLACE FUNCTION public.seed_company_ai_system_labels(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_ai_labels (company_id, slug, name, color, is_system, sort_order)
  VALUES
    (p_company_id, 'ai_ativa', 'AI ATIVA', 'emerald', true, 10),
    (p_company_id, 'humano', 'Humano', 'amber', true, 20),
    (p_company_id, 'humano_solicitado', 'Humano solicitado', 'orange', true, 30)
  ON CONFLICT (company_id, slug) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.seed_company_ai_system_labels IS
  'Insere as 3 etiquetas de sistema (ai_ativa, humano, humano_solicitado) para uma empresa.';

-- Backfill empresas existentes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_company_ai_system_labels(r.id);
  END LOOP;
END;
$$;

-- Trigger: seed ao criar empresa
CREATE OR REPLACE FUNCTION public.trigger_seed_company_ai_labels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_company_ai_system_labels(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_company_ai_labels_on_insert ON public.companies;
CREATE TRIGGER seed_company_ai_labels_on_insert
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_seed_company_ai_labels();

-- Bloqueia DELETE de etiquetas is_system
CREATE OR REPLACE FUNCTION public.prevent_delete_system_ai_labels()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_system IS TRUE THEN
    RAISE EXCEPTION 'Etiquetas de sistema não podem ser excluídas';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_delete_system_ai_labels ON public.company_ai_labels;
CREATE TRIGGER prevent_delete_system_ai_labels
  BEFORE DELETE ON public.company_ai_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_delete_system_ai_labels();

-- Bloqueia mudar is_system / slug de system
CREATE OR REPLACE FUNCTION public.protect_system_ai_labels()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_system IS TRUE THEN
    IF NEW.is_system IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Não é permitido alterar is_system de etiquetas de sistema';
    END IF;
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION 'Não é permitido alterar o slug de etiquetas de sistema';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_system_ai_labels ON public.company_ai_labels;
CREATE TRIGGER protect_system_ai_labels
  BEFORE UPDATE ON public.company_ai_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_system_ai_labels();

-- RLS
ALTER TABLE public.company_ai_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_ai_labels_select ON public.company_ai_labels;
CREATE POLICY company_ai_labels_select
ON public.company_ai_labels
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = company_ai_labels.company_id
  )
);

DROP POLICY IF EXISTS company_ai_labels_insert ON public.company_ai_labels;
CREATE POLICY company_ai_labels_insert
ON public.company_ai_labels
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = company_ai_labels.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
  AND is_system IS NOT TRUE
);

DROP POLICY IF EXISTS company_ai_labels_update ON public.company_ai_labels;
CREATE POLICY company_ai_labels_update
ON public.company_ai_labels
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = company_ai_labels.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = company_ai_labels.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
);

DROP POLICY IF EXISTS company_ai_labels_delete ON public.company_ai_labels;
CREATE POLICY company_ai_labels_delete
ON public.company_ai_labels
FOR DELETE
USING (
  is_system IS NOT TRUE
  AND EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = company_ai_labels.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
);

-- Relaxa enum rígido em conversation_contact_labels.status (validação no app/edge)
ALTER TABLE public.conversation_contact_labels
  DROP CONSTRAINT IF EXISTS conversation_contact_labels_status_check;
