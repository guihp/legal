-- Totais do painel admin alinhados às contagens por empresa (list_all_companies):
-- apenas imóveis/leads com company_id referenciando uma empresa existente.

CREATE OR REPLACE FUNCTION public.get_admin_metrics()
RETURNS TABLE (
  total_companies bigint,
  active_companies bigint,
  trial_companies bigint,
  blocked_companies bigint,
  expired_companies bigint,
  grace_companies bigint,
  total_users bigint,
  active_users bigint,
  total_properties bigint,
  total_leads bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.companies)::BIGINT AS total_companies,
    (SELECT COUNT(*) FROM public.companies WHERE is_active = true AND subscription_status = 'active')::BIGINT AS active_companies,
    (SELECT COUNT(*) FROM public.companies WHERE subscription_status = 'trial')::BIGINT AS trial_companies,
    (SELECT COUNT(*) FROM public.companies WHERE subscription_status = 'blocked')::BIGINT AS blocked_companies,
    (SELECT COUNT(*) FROM public.companies WHERE subscription_status = 'expired')::BIGINT AS expired_companies,
    (SELECT COUNT(*) FROM public.companies WHERE subscription_status = 'grace')::BIGINT AS grace_companies,
    (SELECT COUNT(*) FROM public.user_profiles WHERE role != 'super_admin')::BIGINT AS total_users,
    (SELECT COUNT(*) FROM public.user_profiles WHERE is_active = true AND role != 'super_admin')::BIGINT AS active_users,
    (
      SELECT COUNT(*)::BIGINT
      FROM public.imoveisvivareal i
      WHERE i.company_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = i.company_id)
    ) AS total_properties,
    (
      SELECT COUNT(*)::BIGINT
      FROM public.leads l
      WHERE l.company_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = l.company_id)
    ) AS total_leads;
END;
$function$;

COMMENT ON FUNCTION public.get_admin_metrics() IS
  'Métricas globais para super_admin; imóveis/leads apenas com company_id de empresa existente (consistente com list_all_companies).';
