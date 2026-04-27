-- Corrige GRANT em list_conversations_by_phone após DROP/CREATE e alinha CASE do corretor
-- (leads sem user_id na mesma empresa + leads atribuídos ao corretor).

-- 1) WhatsApp: última mensagem por sessão + lead_display_name
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
    WHERE t.table_schema = 'public'
      AND t.table_name = v_table_name
  ) THEN
    RETURN;
  END IF;

  sql_query := format(
    $fmt$
    SELECT DISTINCT ON (m.session_id)
      m.session_id::text,
      m.instancia,
      m.message,
      m.data::timestamptz,
      m.media,
      (
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upx
            WHERE upx.id = auth.uid()
              AND COALESCE(upx.is_active, true)
              AND upx.role::text IN ('admin', 'gestor', 'super_admin')
          ) THEN COALESCE(
            NULLIF(trim(l.name), ''),
            NULLIF(trim(l.phone::text), '')
          )
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upc
            WHERE upc.id = auth.uid()
              AND COALESCE(upc.is_active, true)
              AND upc.role::text = 'corretor'
              AND l.company_id IS NOT DISTINCT FROM upc.company_id
              AND (l.user_id IS NULL OR l.user_id = auth.uid())
          ) THEN COALESCE(
            NULLIF(trim(l.name), ''),
            NULLIF(trim(l.phone::text), '')
          )
          ELSE NULL::text
        END
      ) AS lead_display_name
    FROM public.%I m
    LEFT JOIN public.leads l ON l.id::text = trim(both from m.session_id::text)
    WHERE 1=1
    $fmt$,
    v_table_name
  );

  IF p_instancia IS NOT NULL AND p_instancia != '' THEN
    sql_query := sql_query || format(' AND m.instancia = %L', p_instancia);
  END IF;

  sql_query := sql_query || ' ORDER BY m.session_id, m.data DESC';

  RETURN QUERY EXECUTE sql_query;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_conversations_by_phone(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_conversations_by_phone(text, text) TO service_role;

COMMENT ON FUNCTION public.list_conversations_by_phone(text, text) IS
  'Lista última mensagem por sessão em crm_whatsapp_messages_{telefone}; inclui lead_display_name respeitando visibilidade por role.';

-- 2) Instagram (CRM unificado)
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
  RETURN QUERY
  WITH ranked AS (
    SELECT
      m.session_id,
      m.instancia,
      m.message,
      m.media,
      m.data,
      (
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upx
            WHERE upx.id = auth.uid()
              AND COALESCE(upx.is_active, true)
              AND upx.role::text IN ('admin', 'gestor', 'super_admin')
          ) THEN COALESCE(
            NULLIF(trim(l.nome_instagram_cliente), ''),
            NULLIF(trim(l.name), ''),
            NULLIF(trim(l.arroba_instagram_cliente), '')
          )
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upc
            WHERE upc.id = auth.uid()
              AND COALESCE(upc.is_active, true)
              AND upc.role::text = 'corretor'
              AND l.company_id IS NOT DISTINCT FROM upc.company_id
              AND (l.user_id IS NULL OR l.user_id = auth.uid())
          ) THEN COALESCE(
            NULLIF(trim(l.nome_instagram_cliente), ''),
            NULLIF(trim(l.name), ''),
            NULLIF(trim(l.arroba_instagram_cliente), '')
          )
          ELSE NULL::text
        END
      ) AS lead_display_name,
      (
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upx
            WHERE upx.id = auth.uid()
              AND COALESCE(upx.is_active, true)
              AND upx.role::text IN ('admin', 'gestor', 'super_admin')
          ) THEN NULLIF(trim(l.profile_pic_url_instagram), '')
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upc
            WHERE upc.id = auth.uid()
              AND COALESCE(upc.is_active, true)
              AND upc.role::text = 'corretor'
              AND l.company_id IS NOT DISTINCT FROM upc.company_id
              AND (l.user_id IS NULL OR l.user_id = auth.uid())
          ) THEN NULLIF(trim(l.profile_pic_url_instagram), '')
          ELSE NULL::text
        END
      ) AS lead_profile_pic_url,
      (
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upx
            WHERE upx.id = auth.uid()
              AND COALESCE(upx.is_active, true)
              AND upx.role::text IN ('admin', 'gestor', 'super_admin')
          ) THEN l.last_profile_sync_instagram
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upc
            WHERE upc.id = auth.uid()
              AND COALESCE(upc.is_active, true)
              AND upc.role::text = 'corretor'
              AND l.company_id IS NOT DISTINCT FROM upc.company_id
              AND (l.user_id IS NULL OR l.user_id = auth.uid())
          ) THEN l.last_profile_sync_instagram
          ELSE NULL::timestamptz
        END
      ) AS lead_last_profile_sync,
      (
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upx
            WHERE upx.id = auth.uid()
              AND COALESCE(upx.is_active, true)
              AND upx.role::text IN ('admin', 'gestor', 'super_admin')
          ) THEN NULLIF(trim(l.arroba_instagram_cliente), '')
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upc
            WHERE upc.id = auth.uid()
              AND COALESCE(upc.is_active, true)
              AND upc.role::text = 'corretor'
              AND l.company_id IS NOT DISTINCT FROM upc.company_id
              AND (l.user_id IS NULL OR l.user_id = auth.uid())
          ) THEN NULLIF(trim(l.arroba_instagram_cliente), '')
          ELSE NULL::text
        END
      ) AS lead_arroba_instagram,
      (
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upx
            WHERE upx.id = auth.uid()
              AND COALESCE(upx.is_active, true)
              AND upx.role::text IN ('admin', 'gestor', 'super_admin')
          ) THEN NULLIF(trim(l.instagram_id_cliente), '')
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upc
            WHERE upc.id = auth.uid()
              AND COALESCE(upc.is_active, true)
              AND upc.role::text = 'corretor'
              AND l.company_id IS NOT DISTINCT FROM upc.company_id
              AND (l.user_id IS NULL OR l.user_id = auth.uid())
          ) THEN NULLIF(trim(l.instagram_id_cliente), '')
          ELSE NULL::text
        END
      ) AS lead_instagram_id_cliente,
      ROW_NUMBER() OVER (PARTITION BY m.session_id ORDER BY m.data DESC) AS rn
    FROM public.crm_instagram_messages m
    LEFT JOIN public.leads l ON l.id::text = trim(both from m.session_id::text)
    WHERE m.company_id = p_company_id
      AND (p_instancia IS NULL OR lower(trim(m.instancia)) = lower(trim(p_instancia)))
      AND EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.company_id = p_company_id
          AND up.is_active = true
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

GRANT EXECUTE ON FUNCTION public.list_instagram_conversations(uuid, text) TO authenticated;

-- 3) Instagram legado (tabela dinâmica imobipro_messages_*)
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
      m.media,
      (
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upx
            WHERE upx.id = auth.uid()
              AND COALESCE(upx.is_active, true)
              AND upx.role::text IN ('admin', 'gestor', 'super_admin')
          ) THEN COALESCE(
            NULLIF(trim(l.nome_instagram_cliente), ''),
            NULLIF(trim(l.name), ''),
            NULLIF(trim(l.arroba_instagram_cliente), '')
          )
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upc
            WHERE upc.id = auth.uid()
              AND COALESCE(upc.is_active, true)
              AND upc.role::text = 'corretor'
              AND l.company_id IS NOT DISTINCT FROM upc.company_id
              AND (l.user_id IS NULL OR l.user_id = auth.uid())
          ) THEN COALESCE(
            NULLIF(trim(l.nome_instagram_cliente), ''),
            NULLIF(trim(l.name), ''),
            NULLIF(trim(l.arroba_instagram_cliente), '')
          )
          ELSE NULL::text
        END
      ) AS lead_display_name,
      (
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upx
            WHERE upx.id = auth.uid()
              AND COALESCE(upx.is_active, true)
              AND upx.role::text IN ('admin', 'gestor', 'super_admin')
          ) THEN NULLIF(trim(l.profile_pic_url_instagram), '')
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upc
            WHERE upc.id = auth.uid()
              AND COALESCE(upc.is_active, true)
              AND upc.role::text = 'corretor'
              AND l.company_id IS NOT DISTINCT FROM upc.company_id
              AND (l.user_id IS NULL OR l.user_id = auth.uid())
          ) THEN NULLIF(trim(l.profile_pic_url_instagram), '')
          ELSE NULL::text
        END
      ) AS lead_profile_pic_url,
      (
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upx
            WHERE upx.id = auth.uid()
              AND COALESCE(upx.is_active, true)
              AND upx.role::text IN ('admin', 'gestor', 'super_admin')
          ) THEN l.last_profile_sync_instagram
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upc
            WHERE upc.id = auth.uid()
              AND COALESCE(upc.is_active, true)
              AND upc.role::text = 'corretor'
              AND l.company_id IS NOT DISTINCT FROM upc.company_id
              AND (l.user_id IS NULL OR l.user_id = auth.uid())
          ) THEN l.last_profile_sync_instagram
          ELSE NULL::timestamptz
        END
      ) AS lead_last_profile_sync,
      (
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upx
            WHERE upx.id = auth.uid()
              AND COALESCE(upx.is_active, true)
              AND upx.role::text IN ('admin', 'gestor', 'super_admin')
          ) THEN NULLIF(trim(l.arroba_instagram_cliente), '')
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upc
            WHERE upc.id = auth.uid()
              AND COALESCE(upc.is_active, true)
              AND upc.role::text = 'corretor'
              AND l.company_id IS NOT DISTINCT FROM upc.company_id
              AND (l.user_id IS NULL OR l.user_id = auth.uid())
          ) THEN NULLIF(trim(l.arroba_instagram_cliente), '')
          ELSE NULL::text
        END
      ) AS lead_arroba_instagram,
      (
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upx
            WHERE upx.id = auth.uid()
              AND COALESCE(upx.is_active, true)
              AND upx.role::text IN ('admin', 'gestor', 'super_admin')
          ) THEN NULLIF(trim(l.instagram_id_cliente), '')
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upc
            WHERE upc.id = auth.uid()
              AND COALESCE(upc.is_active, true)
              AND upc.role::text = 'corretor'
              AND l.company_id IS NOT DISTINCT FROM upc.company_id
              AND (l.user_id IS NULL OR l.user_id = auth.uid())
          ) THEN NULLIF(trim(l.instagram_id_cliente), '')
          ELSE NULL::text
        END
      ) AS lead_instagram_id_cliente
    FROM public.%I m
    LEFT JOIN public.leads l ON l.id::text = trim(both from m.session_id::text)
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

GRANT EXECUTE ON FUNCTION public.list_conversations_by_instagram_company(uuid, text) TO authenticated;
