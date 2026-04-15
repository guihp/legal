-- Normaliza o plano no update_company para o padrão de 3 planos oficiais
-- e evita inconsistências de nomenclatura em updates administrativos.

CREATE OR REPLACE FUNCTION public.update_company(
  p_company_id uuid,
  p_name text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_cnpj text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_address text DEFAULT NULL::text,
  p_plan text DEFAULT NULL::text,
  p_max_users integer DEFAULT NULL::integer,
  p_billing_email text DEFAULT NULL::text,
  p_admin_notes text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_plan text;
BEGIN
  -- Verificar se é super_admin
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Apenas super_admin pode atualizar empresas';
  END IF;

  -- Normalização de plano (mantém compatibilidade de aliases)
  v_plan := CASE
    WHEN p_plan IS NULL THEN NULL
    WHEN lower(p_plan) IN ('basic', 'basico', 'essentials', 'essential') THEN 'essential'
    WHEN lower(p_plan) IN ('growth') THEN 'growth'
    WHEN lower(p_plan) IN ('professional', 'pro', 'profissional', 'enterprise') THEN 'professional'
    ELSE p_plan
  END;

  UPDATE public.companies
  SET
    name = COALESCE(p_name, name),
    email = COALESCE(p_email, email),
    cnpj = COALESCE(p_cnpj, cnpj),
    phone = COALESCE(p_phone, phone),
    address = COALESCE(p_address, address),
    plan = COALESCE(v_plan, plan),
    max_users = COALESCE(p_max_users, max_users),
    billing_email = COALESCE(p_billing_email, billing_email),
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    updated_at = now()
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  RETURN TRUE;
END;
$function$;
