-- ID do Instagram na empresa (Graph / legado Imobi) + RPCs que leem
-- public.imobipro_messages_{id_limpo}_instagram (mesmo padrão do WhatsApp com telefone).

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS id_instagram text NULL;

COMMENT ON COLUMN public.companies.id_instagram IS
  'ID numérico da conta Instagram (Graph). Usado na tabela imobipro_messages_{id}_instagram.';

-- Lista última mensagem por sessão na tabela dinâmica legada.
CREATE OR REPLACE FUNCTION public.list_conversations_by_instagram_company(
  p_company_id uuid,
  p_instancia text DEFAULT NULL
)
RETURNS TABLE (
  session_id text,
  instancia text,
  message jsonb,
  data timestamptz,
  media text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_suffix text;
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

  SELECT NULLIF(
    trim(regexp_replace(trim(c.id_instagram::text), '[[:cntrl:]]', '', 'g')),
    ''
  ) INTO v_raw
  FROM public.companies c
  WHERE c.id = p_company_id
  LIMIT 1;

  IF v_raw IS NULL THEN
    RETURN;
  END IF;

  v_suffix := regexp_replace(v_raw, '[^0-9]', '', 'g');
  IF v_suffix IS NULL OR v_suffix = '' THEN
    v_suffix := lower(regexp_replace(v_raw, '[^a-zA-Z0-9]', '', 'g'));
  END IF;
  IF v_suffix IS NULL OR v_suffix = '' THEN
    RETURN;
  END IF;

  v_table := 'imobipro_messages_' || v_suffix || '_instagram';

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
      m.data::timestamptz,
      m.media
    FROM public.%I m
    WHERE 1=1
    $q$,
    v_table
  );

  IF p_instancia IS NOT NULL AND trim(p_instancia) <> '' THEN
    sql_query := sql_query || format(' AND lower(trim(m.instancia::text)) = lower(trim(%L::text))', p_instancia);
  END IF;

  sql_query := sql_query || ' ORDER BY m.session_id, m.data DESC';

  RETURN QUERY EXECUTE sql_query;
END;
$$;

COMMENT ON FUNCTION public.list_conversations_by_instagram_company(uuid, text) IS
  'Lista conversas na tabela imobipro_messages_{id_instagram}_instagram da empresa.';

GRANT EXECUTE ON FUNCTION public.list_conversations_by_instagram_company(uuid, text) TO authenticated;

-- Mensagens de uma sessão (handoff por chat_instance, alinhado ao WhatsApp).
CREATE OR REPLACE FUNCTION public.conversation_for_session_instagram_legacy(
  p_company_id uuid,
  p_session_id text,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id bigint,
  session_id text,
  message jsonb,
  data timestamptz,
  media text,
  instancia text,
  before_handoff boolean,
  handoff_ts timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_suffix text;
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

  SELECT NULLIF(
    trim(regexp_replace(trim(c.id_instagram::text), '[[:cntrl:]]', '', 'g')),
    ''
  ) INTO v_raw
  FROM public.companies c
  WHERE c.id = p_company_id
  LIMIT 1;

  IF v_raw IS NULL THEN
    RETURN;
  END IF;

  v_suffix := regexp_replace(v_raw, '[^0-9]', '', 'g');
  IF v_suffix IS NULL OR v_suffix = '' THEN
    v_suffix := lower(regexp_replace(v_raw, '[^a-zA-Z0-9]', '', 'g'));
  END IF;
  IF v_suffix IS NULL OR v_suffix = '' THEN
    RETURN;
  END IF;

  v_table := 'imobipro_messages_' || v_suffix || '_instagram';

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name = v_table
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY EXECUTE format(
    $q$
    WITH me AS (
      SELECT id AS uid,
        NULLIF(trim(up.chat_instance::text), '') AS inst_scope
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
      LIMIT 1
    ),
    handoff AS (
      SELECT min(m.data)::timestamptz AS ts
      FROM public.%I m
      CROSS JOIN me
      WHERE m.session_id::text = $1
        AND me.inst_scope IS NOT NULL
        AND lower(trim(m.instancia::text)) = lower(trim(me.inst_scope::text))
    )
    SELECT
      m.id,
      m.session_id::text,
      m.message,
      m.data::timestamptz,
      m.media,
      m.instancia,
      (handoff.ts IS NOT NULL AND m.data::timestamptz < handoff.ts) AS before_handoff,
      handoff.ts AS handoff_ts
    FROM public.%I m
    CROSS JOIN me
    LEFT JOIN handoff ON true
    WHERE m.session_id::text = $1
    ORDER BY m.data ASC
    LIMIT $2 OFFSET $3
    $q$,
    v_table,
    v_table
  )
  USING p_session_id, p_limit, p_offset;
END;
$$;

COMMENT ON FUNCTION public.conversation_for_session_instagram_legacy(uuid, text, integer, integer) IS
  'Mensagens de uma sessão na tabela imobipro_messages_{id_instagram}_instagram (legado Imobi).';

GRANT EXECUTE ON FUNCTION public.conversation_for_session_instagram_legacy(uuid, text, integer, integer) TO authenticated;
