-- ID do Instagram na empresa (imobi) + RPCs para tabela legada
-- imobipro_messages_{id_instagram}_instagram (espelhando o padrão do WhatsApp por telefone).

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS id_instagram text;

COMMENT ON COLUMN public.companies.id_instagram IS
  'ID numérico da conta Instagram (Graph/imobi). Mensagens históricas: public.imobipro_messages_{apenas dígitos}_instagram';

CREATE OR REPLACE FUNCTION public.list_conversations_by_instagram_company(
  p_company_id uuid,
  p_instancia text DEFAULT NULL
)
RETURNS TABLE (
  session_id text,
  instancia text,
  message jsonb,
  media text,
  data timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_clean text;
  v_table text;
  sql_query text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = p_company_id
      AND up.is_active = true
  ) THEN
    RETURN;
  END IF;

  SELECT c.id_instagram INTO v_raw
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_raw IS NULL OR trim(v_raw) = '' THEN
    RETURN;
  END IF;

  v_clean := regexp_replace(trim(v_raw), '[^0-9]', '', 'g');
  IF v_clean = '' THEN
    RETURN;
  END IF;

  v_table := 'imobipro_messages_' || v_clean || '_instagram';

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name = v_table
  ) THEN
    RETURN;
  END IF;

  sql_query := format(
    $q$
    SELECT DISTINCT ON (m.session_id)
      m.session_id::text,
      m.instancia,
      m.message,
      m.media,
      m.data::timestamptz
    FROM public.%I m
    WHERE 1=1
    $q$,
    v_table
  );

  IF p_instancia IS NOT NULL AND trim(p_instancia) <> '' THEN
    sql_query := sql_query || format(' AND lower(trim(m.instancia)) = lower(trim(%L))', p_instancia);
  END IF;

  sql_query := sql_query || ' ORDER BY m.session_id, m.data DESC';

  RETURN QUERY EXECUTE sql_query;
END;
$$;

COMMENT ON FUNCTION public.list_conversations_by_instagram_company(uuid, text) IS
  'Última mensagem por session_id na tabela imobipro_messages_{id_instagram}_instagram; id_instagram vem de companies.';

CREATE OR REPLACE FUNCTION public.conversation_for_session_by_instagram_company(
  p_company_id uuid,
  p_session_id text,
  p_limit int DEFAULT 500,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id bigint,
  session_id text,
  instancia text,
  message jsonb,
  media text,
  data timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_clean text;
  v_table text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = p_company_id
      AND up.is_active = true
  ) THEN
    RETURN;
  END IF;

  SELECT c.id_instagram INTO v_raw
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_raw IS NULL OR trim(v_raw) = '' THEN
    RETURN;
  END IF;

  v_clean := regexp_replace(trim(v_raw), '[^0-9]', '', 'g');
  IF v_clean = '' THEN
    RETURN;
  END IF;

  v_table := 'imobipro_messages_' || v_clean || '_instagram';

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name = v_table
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY EXECUTE format(
    $q$
    SELECT
      m.id,
      m.session_id::text,
      m.instancia,
      m.message,
      m.media,
      m.data::timestamptz
    FROM public.%I m
    WHERE m.session_id::text = $1
    ORDER BY m.data ASC
    LIMIT $2 OFFSET $3
    $q$,
    v_table
  )
  USING p_session_id, p_limit, p_offset;
END;
$$;

COMMENT ON FUNCTION public.conversation_for_session_by_instagram_company(uuid, text, int, int) IS
  'Mensagens de uma sessão na tabela imobipro_messages_{id_instagram}_instagram.';

GRANT EXECUTE ON FUNCTION public.list_conversations_by_instagram_company(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conversation_for_session_by_instagram_company(uuid, text, int, int) TO authenticated;
