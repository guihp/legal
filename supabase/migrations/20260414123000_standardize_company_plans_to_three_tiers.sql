-- Padroniza os planos do sistema para:
-- essential, growth, professional
-- Inclui migração de legados e validação no banco.

-- 1) Migrar valores legados existentes
UPDATE public.companies
SET plan = CASE
  WHEN lower(plan) IN ('basic', 'basico', 'essentials') THEN 'essential'
  WHEN lower(plan) IN ('enterprise', 'pro', 'profissional') THEN 'professional'
  WHEN lower(plan) = 'growth' THEN 'growth'
  WHEN lower(plan) = 'professional' THEN 'professional'
  ELSE 'essential'
END
WHERE plan IS NOT NULL;

-- 2) Garantir default oficial
ALTER TABLE public.companies
ALTER COLUMN plan SET DEFAULT 'essential';

-- 3) Restringir domínio de planos válidos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'companies'
      AND c.conname = 'companies_plan_check'
  ) THEN
    ALTER TABLE public.companies DROP CONSTRAINT companies_plan_check;
  END IF;
END $$;

ALTER TABLE public.companies
ADD CONSTRAINT companies_plan_check
CHECK (plan IN ('essential', 'growth', 'professional'));

-- 4) Normalizar criação automática de empresas
CREATE OR REPLACE FUNCTION public.create_company_with_trial(
  p_name text,
  p_whatsapp_ai_phone text,
  p_email text DEFAULT NULL::text,
  p_cnpj text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_address text DEFAULT NULL::text,
  p_plan text DEFAULT 'essential'::text,
  p_trial_days integer DEFAULT 14,
  p_max_users integer DEFAULT 10
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_company_id UUID;
  v_phone_clean text;
  v_plan text;
BEGIN
  -- Validações
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Apenas super_admin pode criar empresas';
  END IF;

  IF p_whatsapp_ai_phone IS NULL OR length(trim(p_whatsapp_ai_phone)) < 10 THEN
    RAISE EXCEPTION 'Telefone do WhatsApp e obrigatorio';
  END IF;

  -- Limpar telefone (apenas números)
  v_phone_clean := regexp_replace(p_whatsapp_ai_phone, '[^0-9]', '', 'g');

  -- Normalização de plano (compatibilidade com legados)
  v_plan := CASE
    WHEN lower(coalesce(p_plan, 'essential')) IN ('basic', 'basico', 'essentials') THEN 'essential'
    WHEN lower(coalesce(p_plan, 'essential')) IN ('enterprise', 'pro', 'profissional') THEN 'professional'
    WHEN lower(coalesce(p_plan, 'essential')) = 'growth' THEN 'growth'
    WHEN lower(coalesce(p_plan, 'essential')) = 'professional' THEN 'professional'
    ELSE 'essential'
  END;

  -- Criar empresa
  INSERT INTO public.companies (
    name, phone, email, cnpj, address,
    plan, max_users, is_active, subscription_status,
    trial_ends_at, grace_period_days
  ) VALUES (
    COALESCE(p_name, 'Empresa ' || v_phone_clean),
    v_phone_clean,
    p_email,
    p_cnpj,
    p_address,
    v_plan,
    COALESCE(p_max_users, 10),
    true,
    'trial',
    now() + (p_trial_days || ' days')::INTERVAL,
    7
  ) RETURNING id INTO v_company_id;

  -- Registrar no log
  INSERT INTO public.company_access_logs (
    company_id,
    action,
    performed_by,
    new_status,
    reason,
    meta
  ) VALUES (
    v_company_id,
    'created',
    auth.uid(),
    'trial',
    'Empresa criada via painel admin',
    jsonb_build_object(
      'plan', v_plan,
      'trial_days', p_trial_days,
      'phone', v_phone_clean
    )
  );

  RETURN v_company_id;
END;
$function$;
