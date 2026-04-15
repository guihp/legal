-- Garantir coluna usada pelo admin / triggers (pode já existir em produção)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS whatsapp_ai_phone TEXT;

-- Retorno da função mudou: substituir função existente
DROP FUNCTION IF EXISTS public.list_all_companies(text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.list_all_companies(
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  cnpj text,
  phone text,
  whatsapp_ai_phone text,
  plan text,
  is_active boolean,
  subscription_status text,
  subscription_expires_at timestamptz,
  trial_ends_at timestamptz,
  blocked_at timestamptz,
  block_reason text,
  max_users integer,
  user_count bigint,
  property_count bigint,
  lead_count bigint,
  created_at timestamptz,
  last_activity_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.email,
    c.cnpj,
    c.phone,
    c.whatsapp_ai_phone,
    c.plan,
    c.is_active,
    c.subscription_status,
    c.subscription_expires_at,
    c.trial_ends_at,
    c.blocked_at,
    c.block_reason,
    c.max_users,
    (SELECT COUNT(*)::bigint FROM public.user_profiles up WHERE up.company_id = c.id AND up.role IS DISTINCT FROM 'super_admin') AS user_count,
    (SELECT COUNT(*)::bigint FROM public.imoveisvivareal i WHERE i.company_id = c.id) AS property_count,
    (SELECT COUNT(*)::bigint FROM public.leads l WHERE l.company_id = c.id) AS lead_count,
    c.created_at,
    c.last_activity_at
  FROM public.companies c
  WHERE
    (
      p_status IS NULL
      OR lower(trim(p_status)) = 'all'
      OR (
        p_status = 'active'
        AND c.subscription_status = 'active'
        AND c.blocked_at IS NULL
      )
      OR (p_status = 'trial' AND c.subscription_status = 'trial')
      OR (p_status = 'grace' AND c.subscription_status = 'grace')
      OR (
        p_status = 'blocked'
        AND (
          c.blocked_at IS NOT NULL
          OR c.subscription_status = 'blocked'
        )
      )
      OR (p_status = 'expired' AND c.subscription_status = 'expired')
    )
    AND (
      p_search IS NULL
      OR trim(p_search) = ''
      OR c.name ILIKE '%' || p_search || '%'
      OR c.email ILIKE '%' || p_search || '%'
      OR COALESCE(c.cnpj, '') ILIKE '%' || p_search || '%'
    )
  ORDER BY c.created_at DESC
  LIMIT COALESCE(p_limit, 50)
  OFFSET COALESCE(p_offset, 0);
END;
$$;

COMMENT ON FUNCTION public.list_all_companies(text, text, integer, integer) IS
  'Lista empresas para super_admin com contagens de usuários, imóveis (imoveisvivareal) e leads por empresa.';

GRANT EXECUTE ON FUNCTION public.list_all_companies(text, text, integer, integer) TO authenticated;
