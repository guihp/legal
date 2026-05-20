-- Corretor em /conversas: mesma regra do CRM (/clients).
-- Só vê conversas cujo session_id = lead.id E id_corretor_responsavel = auth.uid().
-- Gestor/admin/super_admin continuam vendo todas da empresa.

-- =============================================================================
-- 1) WhatsApp — lista de conversas
-- =============================================================================
CREATE OR REPLACE FUNCTION public.list_conversations_by_phone(
  p_phone text,
  p_instancia text DEFAULT NULL
)
RETURNS TABLE(
  session_id text,
  instancia text,
  message jsonb,
  data timestamp with time zone,
  media text,
  lead_display_name text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_name text;
  phone_clean text;
  sql_query text;
BEGIN
  phone_clean := regexp_replace(p_phone, '[^0-9]', '', 'g');

  v_table_name := 'crm_whatsapp_messages_' || phone_clean;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = v_table_name
  ) THEN
    v_table_name := 'imobipro_messages_' || phone_clean;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_name = v_table_name
    ) THEN
      RETURN;
    END IF;
  END IF;

  sql_query := format(
    '
    WITH upc AS (
      SELECT id AS uid, role::text AS role, company_id
      FROM public.user_profiles
      WHERE id = auth.uid()
        AND COALESCE(is_active, true)
      LIMIT 1
    )
    SELECT DISTINCT ON (m.session_id)
      m.session_id::text,
      m.instancia,
      m.message,
      m.data::timestamp with time zone,
      m.media,
      (
        CASE
          WHEN EXISTS (
            SELECT 1 FROM upc
            WHERE upc.role IN (''admin'', ''gestor'', ''super_admin'')
          ) THEN COALESCE(NULLIF(trim(l.name), ''''), NULLIF(trim(l.phone::text), ''''))
          WHEN l.id_corretor_responsavel = (SELECT uid FROM upc)
            AND l.company_id IS NOT DISTINCT FROM (SELECT company_id FROM upc)
          THEN COALESCE(NULLIF(trim(l.name), ''''), NULLIF(trim(l.phone::text), ''''))
          ELSE NULL::text
        END
      ) AS lead_display_name
    FROM public.%I m
    LEFT JOIN public.leads l ON l.id::text = trim(both from m.session_id::text)
    WHERE (
      EXISTS (SELECT 1 FROM upc WHERE upc.role IN (''admin'', ''gestor'', ''super_admin''))
      OR EXISTS (
        SELECT 1
        FROM public.leads l_vis
        CROSS JOIN upc
        WHERE l_vis.id::text = trim(both from m.session_id::text)
          AND l_vis.company_id IS NOT DISTINCT FROM upc.company_id
          AND upc.role = ''corretor''
          AND l_vis.id_corretor_responsavel = upc.uid
      )
    )
  ',
    v_table_name
  );

  IF p_instancia IS NOT NULL AND p_instancia != '' THEN
    sql_query := sql_query || format(' AND m.instancia = %L', p_instancia);
  END IF;

  sql_query := sql_query || ' ORDER BY m.session_id, m.data DESC, m.id DESC';

  RETURN QUERY EXECUTE sql_query;
END;
$$;

COMMENT ON FUNCTION public.list_conversations_by_phone(text, text) IS
  'Última mensagem por sessão (WhatsApp). Corretor: só leads com id_corretor_responsavel = auth.uid().';

-- =============================================================================
-- 2) WhatsApp — thread de mensagens
-- =============================================================================
CREATE OR REPLACE FUNCTION public.conversation_for_user_by_phone(
  p_session_id text,
  p_phone text,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id bigint,
  session_id text,
  message jsonb,
  data timestamp with time zone,
  media text,
  instancia text,
  before_handoff boolean,
  handoff_ts timestamp with time zone
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_name text;
  phone_clean text;
BEGIN
  phone_clean := regexp_replace(p_phone, '[^0-9]', '', 'g');

  v_table_name := 'crm_whatsapp_messages_' || phone_clean;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = v_table_name
  ) THEN
    v_table_name := 'imobipro_messages_' || phone_clean;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_name = v_table_name
    ) THEN
      RETURN;
    END IF;
  END IF;

  -- Corretor sem lead atribuído: não expõe mensagens
  IF EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.role::text = 'corretor'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.leads l
    INNER JOIN public.user_profiles up ON up.id = auth.uid()
    WHERE l.id::text = trim(both from p_session_id)
      AND l.company_id IS NOT DISTINCT FROM up.company_id
      AND l.id_corretor_responsavel = up.id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY EXECUTE format(
    '
    WITH me AS (
      SELECT id AS uid, role::text AS role, company_id, chat_instance
      FROM public.user_profiles
      WHERE id = auth.uid()
      LIMIT 1
    ),
    handoff AS (
      SELECT min(m.data)::timestamp with time zone AS ts
      FROM public.%I m
      CROSS JOIN me
      WHERE m.session_id = $1
        AND me.chat_instance IS NOT NULL
        AND m.instancia = me.chat_instance
    ),
    dedup AS (
      SELECT DISTINCT ON (m.session_id, m.message->>''type'', m.message->>''content'', m.data)
        m.id, m.session_id, m.message, m.data, m.media, m.instancia
      FROM public.%I m
      WHERE m.session_id::text = $1
      ORDER BY m.session_id, m.message->>''type'', m.message->>''content'', m.data, m.id ASC
    )
    SELECT
      d.id,
      d.session_id::text,
      d.message,
      d.data::timestamp with time zone,
      d.media,
      d.instancia,
      (handoff.ts IS NOT NULL AND d.data::timestamp with time zone < handoff.ts) AS before_handoff,
      handoff.ts AS handoff_ts
    FROM dedup d
    CROSS JOIN me
    LEFT JOIN handoff ON true
    ORDER BY d.data ASC, d.id ASC
    LIMIT $2 OFFSET $3
  ',
    v_table_name,
    v_table_name
  )
  USING p_session_id, p_limit, p_offset;
END;
$$;

COMMENT ON FUNCTION public.conversation_for_user_by_phone IS
  'Mensagens de uma sessão WhatsApp. Corretor: só se lead.id_corretor_responsavel = auth.uid().';

-- =============================================================================
-- 3) Instagram — CRM unificado
-- =============================================================================
CREATE OR REPLACE FUNCTION public.list_instagram_conversations(
  p_company_id uuid,
  p_instancia text DEFAULT NULL
)
RETURNS TABLE (
  session_id text,
  instancia text,
  message jsonb,
  media text,
  data timestamptz,
  lead_display_name text,
  lead_profile_pic_url text,
  lead_last_profile_sync timestamptz,
  lead_arroba_instagram text,
  lead_instagram_id_cliente text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = p_company_id
      AND COALESCE(up.is_active, true)
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'crm_instagram_messages'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH upc AS (
    SELECT id AS uid, role::text AS role, company_id
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND company_id = p_company_id
      AND COALESCE(is_active, true)
    LIMIT 1
  ),
  ranked AS (
    SELECT
      m.session_id,
      m.instancia,
      m.message,
      m.media,
      m.data,
      CASE
        WHEN EXISTS (SELECT 1 FROM upc WHERE upc.role IN ('admin', 'gestor', 'super_admin'))
          AND l.company_id IS NOT DISTINCT FROM p_company_id
        THEN COALESCE(
          NULLIF(trim(l.nome_instagram_cliente), ''),
          NULLIF(trim(l.name), ''),
          NULLIF(trim(l.arroba_instagram_cliente), '')
        )
        WHEN l.id_corretor_responsavel = (SELECT uid FROM upc)
          AND l.company_id IS NOT DISTINCT FROM p_company_id
        THEN COALESCE(
          NULLIF(trim(l.nome_instagram_cliente), ''),
          NULLIF(trim(l.name), ''),
          NULLIF(trim(l.arroba_instagram_cliente), '')
        )
        ELSE NULL::text
      END AS lead_display_name,
      CASE
        WHEN (
          EXISTS (SELECT 1 FROM upc WHERE upc.role IN ('admin', 'gestor', 'super_admin'))
          OR l.id_corretor_responsavel = (SELECT uid FROM upc)
        ) AND l.company_id IS NOT DISTINCT FROM p_company_id
        THEN NULLIF(trim(l.profile_pic_url_instagram), '')
        ELSE NULL::text
      END AS lead_profile_pic_url,
      CASE
        WHEN (
          EXISTS (SELECT 1 FROM upc WHERE upc.role IN ('admin', 'gestor', 'super_admin'))
          OR l.id_corretor_responsavel = (SELECT uid FROM upc)
        ) AND l.company_id IS NOT DISTINCT FROM p_company_id
        THEN l.last_profile_sync_instagram
        ELSE NULL::timestamptz
      END AS lead_last_profile_sync,
      CASE
        WHEN (
          EXISTS (SELECT 1 FROM upc WHERE upc.role IN ('admin', 'gestor', 'super_admin'))
          OR l.id_corretor_responsavel = (SELECT uid FROM upc)
        ) AND l.company_id IS NOT DISTINCT FROM p_company_id
        THEN NULLIF(trim(l.arroba_instagram_cliente), '')
        ELSE NULL::text
      END AS lead_arroba_instagram,
      CASE
        WHEN (
          EXISTS (SELECT 1 FROM upc WHERE upc.role IN ('admin', 'gestor', 'super_admin'))
          OR l.id_corretor_responsavel = (SELECT uid FROM upc)
        ) AND l.company_id IS NOT DISTINCT FROM p_company_id
        THEN NULLIF(trim(l.instagram_id_cliente), '')
        ELSE NULL::text
      END AS lead_instagram_id_cliente,
      ROW_NUMBER() OVER (PARTITION BY m.session_id ORDER BY m.data DESC, m.id DESC) AS rn
    FROM public.crm_instagram_messages m
    LEFT JOIN public.leads l ON l.id::text = trim(both from m.session_id::text)
    WHERE m.company_id = p_company_id
      AND (p_instancia IS NULL OR lower(trim(m.instancia)) = lower(trim(p_instancia)))
      AND (
        EXISTS (SELECT 1 FROM upc WHERE upc.role IN ('admin', 'gestor', 'super_admin'))
        OR EXISTS (
          SELECT 1
          FROM public.leads l_vis
          CROSS JOIN upc
          WHERE l_vis.id::text = trim(both from m.session_id::text)
            AND l_vis.company_id = p_company_id
            AND upc.role = 'corretor'
            AND l_vis.id_corretor_responsavel = upc.uid
        )
      )
  )
  SELECT
    r.session_id,
    r.instancia,
    r.message,
    r.media,
    r.data,
    r.lead_display_name,
    r.lead_profile_pic_url,
    r.lead_last_profile_sync,
    r.lead_arroba_instagram,
    r.lead_instagram_id_cliente
  FROM ranked r
  WHERE r.rn = 1
  ORDER BY r.data DESC;
END;
$$;

COMMENT ON FUNCTION public.list_instagram_conversations(uuid, text) IS
  'Lista conversas Instagram (CRM). Corretor: só leads atribuídos (id_corretor_responsavel).';

-- =============================================================================
-- 4) Instagram — tabela legada imobipro_messages_{id}_instagram
-- =============================================================================
CREATE OR REPLACE FUNCTION public.list_conversations_by_instagram_company(
  p_company_id uuid,
  p_instancia text DEFAULT NULL
)
RETURNS TABLE (
  session_id text,
  instancia text,
  message jsonb,
  data timestamptz,
  media text,
  lead_display_name text,
  lead_profile_pic_url text,
  lead_last_profile_sync timestamptz,
  lead_arroba_instagram text,
  lead_instagram_id_cliente text
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
      AND COALESCE(up.is_active, true)
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
    WITH upc AS (
      SELECT id AS uid, role::text AS role, company_id
      FROM public.user_profiles
      WHERE id = auth.uid()
        AND company_id = %L::uuid
        AND COALESCE(is_active, true)
      LIMIT 1
    )
    SELECT DISTINCT ON (m.session_id)
      m.session_id::text,
      m.instancia,
      m.message,
      m.data::timestamptz,
      m.media,
      CASE
        WHEN EXISTS (SELECT 1 FROM upc WHERE upc.role IN ('admin', 'gestor', 'super_admin'))
          AND l.company_id IS NOT DISTINCT FROM %L::uuid
        THEN COALESCE(
          NULLIF(trim(l.nome_instagram_cliente), ''),
          NULLIF(trim(l.name), ''),
          NULLIF(trim(l.arroba_instagram_cliente), '')
        )
        WHEN l.id_corretor_responsavel = (SELECT uid FROM upc)
          AND l.company_id IS NOT DISTINCT FROM %L::uuid
        THEN COALESCE(
          NULLIF(trim(l.nome_instagram_cliente), ''),
          NULLIF(trim(l.name), ''),
          NULLIF(trim(l.arroba_instagram_cliente), '')
        )
        ELSE NULL::text
      END AS lead_display_name,
      CASE
        WHEN (
          EXISTS (SELECT 1 FROM upc WHERE upc.role IN ('admin', 'gestor', 'super_admin'))
          OR l.id_corretor_responsavel = (SELECT uid FROM upc)
        ) AND l.company_id IS NOT DISTINCT FROM %L::uuid
        THEN NULLIF(trim(l.profile_pic_url_instagram), '')
        ELSE NULL::text
      END AS lead_profile_pic_url,
      CASE
        WHEN (
          EXISTS (SELECT 1 FROM upc WHERE upc.role IN ('admin', 'gestor', 'super_admin'))
          OR l.id_corretor_responsavel = (SELECT uid FROM upc)
        ) AND l.company_id IS NOT DISTINCT FROM %L::uuid
        THEN l.last_profile_sync_instagram
        ELSE NULL::timestamptz
      END AS lead_last_profile_sync,
      CASE
        WHEN (
          EXISTS (SELECT 1 FROM upc WHERE upc.role IN ('admin', 'gestor', 'super_admin'))
          OR l.id_corretor_responsavel = (SELECT uid FROM upc)
        ) AND l.company_id IS NOT DISTINCT FROM %L::uuid
        THEN NULLIF(trim(l.arroba_instagram_cliente), '')
        ELSE NULL::text
      END AS lead_arroba_instagram,
      CASE
        WHEN (
          EXISTS (SELECT 1 FROM upc WHERE upc.role IN ('admin', 'gestor', 'super_admin'))
          OR l.id_corretor_responsavel = (SELECT uid FROM upc)
        ) AND l.company_id IS NOT DISTINCT FROM %L::uuid
        THEN NULLIF(trim(l.instagram_id_cliente), '')
        ELSE NULL::text
      END AS lead_instagram_id_cliente
    FROM public.%I m
    LEFT JOIN public.leads l ON l.id::text = trim(both from m.session_id::text)
    WHERE (
      EXISTS (SELECT 1 FROM upc WHERE upc.role IN ('admin', 'gestor', 'super_admin'))
      OR EXISTS (
        SELECT 1
        FROM public.leads l_vis
        CROSS JOIN upc
        WHERE l_vis.id::text = trim(both from m.session_id::text)
          AND l_vis.company_id = %L::uuid
          AND upc.role = 'corretor'
          AND l_vis.id_corretor_responsavel = upc.uid
      )
    )
    $q$,
    p_company_id,
    p_company_id, p_company_id,
    p_company_id, p_company_id, p_company_id, p_company_id,
    v_table,
    p_company_id
  );

  IF p_instancia IS NOT NULL AND trim(p_instancia) <> '' THEN
    sql_query := sql_query || format(' AND lower(trim(m.instancia::text)) = lower(trim(%L::text))', p_instancia);
  END IF;

  sql_query := sql_query || ' ORDER BY m.session_id, m.data DESC';

  RETURN QUERY EXECUTE sql_query;
END;
$$;

COMMENT ON FUNCTION public.list_conversations_by_instagram_company(uuid, text) IS
  'Lista conversas Instagram (legado). Corretor: só leads atribuídos (id_corretor_responsavel).';

GRANT EXECUTE ON FUNCTION public.list_conversations_by_phone(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_conversations_by_phone(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.conversation_for_user_by_phone(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conversation_for_user_by_phone(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_instagram_conversations(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_conversations_by_instagram_company(uuid, text) TO authenticated;
