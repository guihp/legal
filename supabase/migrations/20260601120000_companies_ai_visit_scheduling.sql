-- Configuração por empresa: como a IA escolhe o corretor ao agendar visitas

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ai_visit_broker_mode text NOT NULL DEFAULT 'queue',
  ADD COLUMN IF NOT EXISTS ai_visit_priority_criterion text NOT NULL DEFAULT 'numeric',
  ADD COLUMN IF NOT EXISTS ai_visit_broker_priorities jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_ai_visit_broker_mode_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_ai_visit_broker_mode_check
  CHECK (ai_visit_broker_mode IN ('queue', 'priority', 'manual'));

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_ai_visit_priority_criterion_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_ai_visit_priority_criterion_check
  CHECK (ai_visit_priority_criterion IN ('numeric', 'plantao_order', 'least_busy'));

COMMENT ON COLUMN public.companies.ai_visit_broker_mode IS 'queue | priority | manual — atribuição de corretor em visitas da IA.';
COMMENT ON COLUMN public.companies.ai_visit_priority_criterion IS 'Critério quando mode=priority: numeric | plantao_order | least_busy.';
COMMENT ON COLUMN public.companies.ai_visit_broker_priorities IS 'Mapa user_id (uuid) -> score 0-100 para prioridade numérica.';

CREATE OR REPLACE FUNCTION public.sanitize_ai_visit_broker_priorities(p_priorities jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb := '{}'::jsonb;
  r record;
  score numeric;
BEGIN
  IF p_priorities IS NULL OR jsonb_typeof(p_priorities) <> 'object' THEN
    RETURN '{}'::jsonb;
  END IF;

  FOR r IN SELECT key, value FROM jsonb_each(p_priorities)
  LOOP
    IF r.key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      BEGIN
        score := LEAST(100::numeric, GREATEST(0::numeric, (p_priorities->>r.key)::numeric));
        result := result || jsonb_build_object(r.key, score);
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    END IF;
  END LOOP;

  RETURN result;
END;
$function$;

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
  ai_rules text,
  ai_additional_info text,
  ai_visit_broker_mode text,
  ai_visit_priority_criterion text,
  ai_visit_broker_priorities jsonb,
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
    c.ai_rules,
    c.ai_additional_info,
    c.ai_visit_broker_mode,
    c.ai_visit_priority_criterion,
    c.ai_visit_broker_priorities,
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

DO $drop_overloads$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT pg_catalog.format('%I.%I(%s)',
      n.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    ) AS fq
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_own_company'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fq;
  END LOOP;
END
$drop_overloads$;

CREATE OR REPLACE FUNCTION public.update_own_company(
  p_name text DEFAULT NULL::text,
  p_contact_name text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_cnpj text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_address text DEFAULT NULL::text,
  p_address_number text DEFAULT NULL::text,
  p_address_complement text DEFAULT NULL::text,
  p_address_neighborhood text DEFAULT NULL::text,
  p_address_city text DEFAULT NULL::text,
  p_address_state text DEFAULT NULL::text,
  p_address_zip_code text DEFAULT NULL::text,
  p_business_hours text DEFAULT NULL::text,
  p_ai_initial_message text DEFAULT NULL::text,
  p_ai_assistant_name text DEFAULT NULL::text,
  p_ai_unknown_info_message text DEFAULT NULL::text,
  p_ai_company_mission text DEFAULT NULL::text,
  p_ai_tone text DEFAULT NULL::text,
  p_ai_payment_methods text DEFAULT NULL::text,
  p_ai_visit_policy text DEFAULT NULL::text,
  p_ai_target_audience text DEFAULT NULL::text,
  p_ai_rules text DEFAULT NULL::text,
  p_ai_additional_info text DEFAULT NULL::text,
  p_ai_visit_broker_mode text DEFAULT NULL::text,
  p_ai_visit_priority_criterion text DEFAULT NULL::text,
  p_ai_visit_broker_priorities jsonb DEFAULT NULL::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_role text;
  v_company_id uuid;
  v_mode text;
  v_criterion text;
BEGIN
  SELECT role, company_id INTO v_user_role, v_company_id
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF v_user_role NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Apenas admin ou gestor podem editar dados da empresa';
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada';
  END IF;

  IF p_ai_visit_broker_mode IS NOT NULL
     AND p_ai_visit_broker_mode NOT IN ('queue', 'priority', 'manual') THEN
    RAISE EXCEPTION 'Modo de agendamento de visita inválido. Use: queue, priority ou manual.';
  END IF;

  IF p_ai_visit_priority_criterion IS NOT NULL
     AND p_ai_visit_priority_criterion NOT IN ('numeric', 'plantao_order', 'least_busy') THEN
    RAISE EXCEPTION 'Critério de prioridade inválido.';
  END IF;

  v_mode := COALESCE(p_ai_visit_broker_mode, (
    SELECT ai_visit_broker_mode FROM public.companies WHERE id = v_company_id
  ));

  IF v_mode = 'priority' THEN
    v_criterion := COALESCE(p_ai_visit_priority_criterion, (
      SELECT ai_visit_priority_criterion FROM public.companies WHERE id = v_company_id
    ));
    IF v_criterion = 'least_busy' THEN
      -- permitido; implementado na schedule-api
      NULL;
    END IF;
  END IF;

  UPDATE public.companies
  SET
    name = COALESCE(p_name, name),
    contact_name = COALESCE(p_contact_name, contact_name),
    email = COALESCE(p_email, email),
    cnpj = COALESCE(p_cnpj, cnpj),
    phone = COALESCE(p_phone, phone),
    address = COALESCE(p_address, address),
    address_number = COALESCE(p_address_number, address_number),
    address_complement = COALESCE(p_address_complement, address_complement),
    address_neighborhood = COALESCE(p_address_neighborhood, address_neighborhood),
    address_city = COALESCE(p_address_city, address_city),
    address_state = COALESCE(p_address_state, address_state),
    address_zip_code = COALESCE(p_address_zip_code, address_zip_code),
    business_hours = COALESCE(p_business_hours, business_hours),
    ai_initial_message = COALESCE(p_ai_initial_message, ai_initial_message),
    ai_assistant_name = COALESCE(p_ai_assistant_name, ai_assistant_name),
    ai_unknown_info_message = COALESCE(p_ai_unknown_info_message, ai_unknown_info_message),
    ai_company_mission = COALESCE(p_ai_company_mission, ai_company_mission),
    ai_tone = COALESCE(p_ai_tone, ai_tone),
    ai_payment_methods = COALESCE(p_ai_payment_methods, ai_payment_methods),
    ai_visit_policy = COALESCE(p_ai_visit_policy, ai_visit_policy),
    ai_target_audience = COALESCE(p_ai_target_audience, ai_target_audience),
    ai_rules = COALESCE(p_ai_rules, ai_rules),
    ai_additional_info = COALESCE(p_ai_additional_info, ai_additional_info),
    ai_visit_broker_mode = COALESCE(p_ai_visit_broker_mode, ai_visit_broker_mode),
    ai_visit_priority_criterion = COALESCE(p_ai_visit_priority_criterion, ai_visit_priority_criterion),
    ai_visit_broker_priorities = CASE
      WHEN p_ai_visit_broker_priorities IS NOT NULL THEN
        public.sanitize_ai_visit_broker_priorities(p_ai_visit_broker_priorities)
      ELSE ai_visit_broker_priorities
    END,
    updated_at = now()
  WHERE id = v_company_id;

  RETURN TRUE;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_own_company() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_company() TO service_role;
GRANT EXECUTE ON FUNCTION public.sanitize_ai_visit_broker_priorities(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sanitize_ai_visit_broker_priorities(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_own_company(
  text, text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, text, text, jsonb
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
