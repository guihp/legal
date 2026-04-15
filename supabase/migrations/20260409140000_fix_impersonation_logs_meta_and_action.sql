-- Impersonação falhava ao inserir em company_access_logs: coluna correta é "meta", não "metadata".
-- Ações impersonation_* não estavam no CHECK de company_access_logs.

ALTER TABLE public.company_access_logs
  DROP CONSTRAINT IF EXISTS company_access_logs_action_check;

ALTER TABLE public.company_access_logs
  ADD CONSTRAINT company_access_logs_action_check
  CHECK (
    action = ANY (
      ARRAY[
        'blocked',
        'unblocked',
        'subscription_changed',
        'plan_changed',
        'created',
        'grace_period_started',
        'expired',
        'impersonation_started',
        'impersonation_ended'
      ]::text[]
    )
  );

CREATE OR REPLACE FUNCTION public.start_impersonation(p_user_id uuid, p_reason text DEFAULT NULL::text)
RETURNS TABLE(
  success boolean,
  message text,
  user_email text,
  user_name text,
  company_name text,
  session_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_super_admin_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
  v_company_id UUID;
  v_company_name TEXT;
  v_session_id UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN QUERY SELECT false, 'Apenas super_admin pode impersonar usuarios'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  v_super_admin_id := auth.uid();

  SELECT up.email, up.full_name, up.company_id
  INTO v_user_email, v_user_name, v_company_id
  FROM public.user_profiles up
  WHERE up.id = p_user_id;

  IF v_user_email IS NULL THEN
    RETURN QUERY SELECT false, 'Usuario nao encontrado'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id AND role = 'super_admin') THEN
    RETURN QUERY SELECT false, 'Nao e possivel impersonar outro super_admin'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_company_id IS NOT NULL THEN
    SELECT name INTO v_company_name FROM public.companies WHERE id = v_company_id;
  END IF;

  UPDATE public.impersonation_sessions
  SET is_active = false, ended_at = now()
  WHERE super_admin_id = v_super_admin_id AND is_active = true;

  INSERT INTO public.impersonation_sessions (
    super_admin_id,
    impersonated_user_id,
    impersonated_email,
    impersonated_company_id,
    reason
  ) VALUES (
    v_super_admin_id,
    p_user_id,
    v_user_email,
    v_company_id,
    p_reason
  ) RETURNING id INTO v_session_id;

  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.company_access_logs (
      company_id,
      action,
      performed_by,
      reason,
      meta
    ) VALUES (
      v_company_id,
      'impersonation_started',
      v_super_admin_id,
      COALESCE(p_reason, 'Acesso administrativo'),
      jsonb_build_object(
        'impersonated_user_id', p_user_id,
        'impersonated_email', v_user_email,
        'session_id', v_session_id
      )
    );
  END IF;

  RETURN QUERY SELECT true, 'Impersonacao iniciada'::TEXT, v_user_email, v_user_name, v_company_name, v_session_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.end_impersonation()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_session RECORD;
BEGIN
  SELECT * INTO v_session
  FROM public.impersonation_sessions
  WHERE super_admin_id = auth.uid() AND is_active = true
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_session IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.impersonation_sessions
  SET is_active = false, ended_at = now()
  WHERE id = v_session.id;

  IF v_session.impersonated_company_id IS NOT NULL THEN
    INSERT INTO public.company_access_logs (
      company_id,
      action,
      performed_by,
      reason,
      meta
    ) VALUES (
      v_session.impersonated_company_id,
      'impersonation_ended',
      auth.uid(),
      'Sessao encerrada',
      jsonb_build_object(
        'session_id', v_session.id,
        'duration_minutes', EXTRACT(EPOCH FROM (now() - v_session.started_at)) / 60
      )
    );
  END IF;

  RETURN true;
END;
$function$;
