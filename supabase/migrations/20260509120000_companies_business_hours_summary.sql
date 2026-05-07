-- Texto enxuto derivado de business_hours (JSON) para uso em prompts de IA / n8n
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS business_hours_summary text;

COMMENT ON COLUMN public.companies.business_hours_summary IS 'Resumo legível dos horários (gerado a partir de business_hours) para injeção em prompts.';

CREATE OR REPLACE FUNCTION public.format_business_hours_summary(p_bh text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $fn$
DECLARE
  j jsonb;
  day_j jsonb;
  parts text[] := '{}';
  line text;
  short_label text;
  closed_v boolean;
  ot text;
  lst text;
  len text;
  ct text;
BEGIN
  IF p_bh IS NULL OR btrim(p_bh) = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    j := p_bh::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF NOT (j ? 'days') THEN
    RETURN NULL;
  END IF;

  FOR day_j IN SELECT jsonb_array_elements(j->'days')
  LOOP
    short_label := CASE day_j->>'dayKey'
      WHEN 'monday' THEN 'Seg'
      WHEN 'tuesday' THEN 'Ter'
      WHEN 'wednesday' THEN 'Qua'
      WHEN 'thursday' THEN 'Qui'
      WHEN 'friday' THEN 'Sex'
      WHEN 'saturday' THEN 'Sab'
      WHEN 'sunday' THEN 'Dom'
      ELSE left(COALESCE(day_j->>'label', '?'), 3)
    END;

    closed_v := COALESCE((day_j->>'closed')::boolean, false);
    IF closed_v THEN
      line := short_label || ' fechado';
    ELSE
      ot := nullif(day_j->>'openTime', '');
      lst := nullif(day_j->>'lunchStart', '');
      len := nullif(day_j->>'lunchEnd', '');
      ct := nullif(day_j->>'closeTime', '');
      IF lst IS NOT NULL AND len IS NOT NULL THEN
        line := short_label || ' ' || COALESCE(ot, '?') || '–' || lst || ', ' || len || '–' || COALESCE(ct, '?');
      ELSE
        line := short_label || ' ' || COALESCE(ot, '?') || '–' || COALESCE(ct, '?');
      END IF;
    END IF;
    parts := array_append(parts, line);
  END LOOP;

  IF coalesce(array_length(parts, 1), 0) = 0 THEN
    RETURN NULL;
  END IF;
  RETURN array_to_string(parts, ' | ');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trg_sync_business_hours_summary()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $tg$
BEGIN
  NEW.business_hours_summary := public.format_business_hours_summary(NEW.business_hours);
  RETURN NEW;
END;
$tg$;

DROP TRIGGER IF EXISTS trg_companies_business_hours_summary ON public.companies;
CREATE TRIGGER trg_companies_business_hours_summary
  BEFORE INSERT OR UPDATE OF business_hours ON public.companies
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_sync_business_hours_summary();

UPDATE public.companies
SET business_hours_summary = public.format_business_hours_summary(business_hours)
WHERE business_hours IS NOT NULL AND btrim(business_hours) <> '';

DROP FUNCTION IF EXISTS public.get_own_company();

CREATE OR REPLACE FUNCTION public.get_own_company()
RETURNS TABLE(
  id uuid,
  name text,
  contact_name text,
  email text,
  cnpj text,
  phone text,
  address text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text,
  address_state text,
  address_zip_code text,
  business_hours text,
  business_hours_summary text,
  ai_initial_message text,
  ai_assistant_name text,
  ai_unknown_info_message text,
  ai_company_mission text,
  ai_tone text,
  ai_payment_methods text,
  ai_visit_policy text,
  ai_target_audience text,
  logo_url text,
  plan text,
  max_users integer,
  is_active boolean,
  subscription_status text,
  subscription_expires_at timestamp with time zone,
  trial_ends_at timestamp with time zone,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT up.company_id INTO v_company_id
  FROM public.user_profiles up
  WHERE up.id = auth.uid();

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.contact_name,
    c.email,
    c.cnpj,
    c.phone,
    c.address,
    c.address_number,
    c.address_complement,
    c.address_neighborhood,
    c.address_city,
    c.address_state,
    c.address_zip_code,
    c.business_hours,
    c.business_hours_summary,
    c.ai_initial_message,
    c.ai_assistant_name,
    c.ai_unknown_info_message,
    c.ai_company_mission,
    c.ai_tone,
    c.ai_payment_methods,
    c.ai_visit_policy,
    c.ai_target_audience,
    c.logo_url,
    c.plan,
    c.max_users,
    c.is_active,
    c.subscription_status,
    c.subscription_expires_at,
    c.trial_ends_at,
    c.created_at
  FROM public.companies c
  WHERE c.id = v_company_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_own_company() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_company() TO service_role;

NOTIFY pgrst, 'reload schema';
