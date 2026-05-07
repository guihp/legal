-- Corrige "Could not find the function public.update_own_company(...)" no PostgREST quando
-- o banco remoto ainda tinha só assinaturas antigas (ex.: 13 args) e o app envia 21 args.
-- Idempotente: garante colunas, remove TODAS as overloads de update_own_company no schema public e recria.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ai_initial_message text,
  ADD COLUMN IF NOT EXISTS ai_assistant_name text,
  ADD COLUMN IF NOT EXISTS ai_unknown_info_message text,
  ADD COLUMN IF NOT EXISTS ai_company_mission text,
  ADD COLUMN IF NOT EXISTS ai_tone text,
  ADD COLUMN IF NOT EXISTS ai_payment_methods text,
  ADD COLUMN IF NOT EXISTS ai_visit_policy text,
  ADD COLUMN IF NOT EXISTS ai_target_audience text;

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
  p_ai_target_audience text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_role text;
  v_company_id uuid;
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
    updated_at = now()
  WHERE id = v_company_id;

  RETURN TRUE;
END;
$function$;

-- Permissões alinhadas ao padrão Supabase para RPC com JWT
GRANT EXECUTE ON FUNCTION public.get_own_company() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_company() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_own_company(
  text, text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_company(
  text, text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) TO service_role;

-- Ajuda o PostgREST a enxergar a nova assinatura (Supabase)
NOTIFY pgrst, 'reload schema';
