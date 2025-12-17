-- Função RPC para admin acessar leads sem RLS
CREATE OR REPLACE FUNCTION admin_get_leads_by_period(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE(
  id UUID,
  created_at TIMESTAMPTZ,
  source TEXT,
  stage TEXT,
  company_id UUID
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_role TEXT;
BEGIN
  -- Verificar se o usuário é admin
  SELECT role INTO current_user_role 
  FROM user_profiles 
  WHERE id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied: only admin users can access this function';
  END IF;

  -- Log da função
  RAISE NOTICE 'admin_get_leads_by_period: start_date=%, end_date=%, user=%', start_date, end_date, auth.uid();
  
  -- Buscar leads sem RLS (SECURITY DEFINER)
  RETURN QUERY
  SELECT 
    l.id,
    l.created_at,
    l.source,
    l.stage,
    l.company_id
  FROM public.leads l
  WHERE l.created_at >= start_date
    AND l.created_at <= end_date
  ORDER BY l.created_at ASC;
END;
$$;

-- Dar permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION admin_get_leads_by_period TO authenticated;
