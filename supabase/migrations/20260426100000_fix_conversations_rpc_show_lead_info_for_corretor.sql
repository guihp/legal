-- Fix duplo:
--
-- 1) Lista de conversas (WhatsApp + Instagram) não mostrava nome/foto do lead
--    para o corretor quando o lead não estava atribuído a ele (`l.user_id = auth.uid()`).
--    Regra antiga era restritiva demais: o corretor VIA a conversa mas não via nome/foto,
--    porque um LEFT JOIN + CASE retornava NULL se o lead pertencesse a outro corretor ou
--    estivesse sem dono. Agora mostra pra qualquer usuário ativo da mesma empresa do lead.
--    (Visibilidade da entidade LEAD no CRM continua governada pelo RLS da tabela `leads`.)
--
-- 2) RPC `list_conversations_by_phone` procurava `crm_whatsapp_messages_{phone}`, mas o
--    banco atual de produção ainda tem os nomes legados `imobipro_messages_{phone}` — a
--    rename (migration 20260325150000) não foi aplicada. Agora a RPC tenta as duas
--    variantes e usa a que existir (com preferência ao nome novo).

-- =============================================================================
-- 1) WhatsApp — suporta BOTH crm_whatsapp_messages_{phone} E imobipro_messages_{phone}
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
  phone_clean text;
  t_new text;
  t_legacy text;
  v_table text;
  sql_query text;
BEGIN
  phone_clean := regexp_replace(p_phone, '[^0-9]', '', 'g');
  t_new    := 'crm_whatsapp_messages_' || phone_clean;
  t_legacy := 'imobipro_messages_'     || phone_clean;

  -- Prefere a tabela nova; cai pro nome legado se a nova não existir.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = t_new
  ) THEN
    v_table := t_new;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = t_legacy
  ) THEN
    v_table := t_legacy;
  ELSE
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
          -- super_admin / admin / gestor: sempre veem
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upx
            WHERE upx.id = auth.uid()
              AND COALESCE(upx.is_active, true)
              AND upx.role::text IN ('admin', 'gestor', 'super_admin')
          ) THEN COALESCE(
            NULLIF(trim(l.name), ''),
            NULLIF(trim(l.phone::text), '')
          )
          -- corretor ativo da mesma empresa do lead: vê nome
          WHEN EXISTS (
            SELECT 1 FROM public.user_profiles upc
            WHERE upc.id = auth.uid()
              AND COALESCE(upc.is_active, true)
              AND upc.role::text = 'corretor'
              AND l.company_id IS NOT DISTINCT FROM upc.company_id
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
    v_table
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
  'Lista última mensagem por sessão em crm_whatsapp_messages_{phone} (ou imobipro_messages_{phone} legado); exibe lead_display_name pra qualquer usuário ativo da empresa do lead.';

-- =============================================================================
-- 2) Instagram — CRM unificado (crm_instagram_messages)
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
  -- Só libera se o usuário está ativo na empresa consultada
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = p_company_id
      AND up.is_active = true
  ) THEN
    RETURN;
  END IF;

  -- Se a tabela não existe (instalações que ainda não rodaram a migration unificada),
  -- simplesmente retorna vazio — sem erro.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'crm_instagram_messages'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      m.session_id,
      m.instancia,
      m.message,
      m.media,
      m.data,
      CASE
        WHEN l.id IS NULL THEN NULL::text
        WHEN l.company_id IS NOT DISTINCT FROM p_company_id THEN COALESCE(
          NULLIF(trim(l.nome_instagram_cliente), ''),
          NULLIF(trim(l.name), ''),
          NULLIF(trim(l.arroba_instagram_cliente), '')
        )
        ELSE NULL::text
      END AS lead_display_name,
      CASE
        WHEN l.id IS NULL THEN NULL::text
        WHEN l.company_id IS NOT DISTINCT FROM p_company_id
          THEN NULLIF(trim(l.profile_pic_url_instagram), '')
        ELSE NULL::text
      END AS lead_profile_pic_url,
      CASE
        WHEN l.id IS NULL THEN NULL::timestamptz
        WHEN l.company_id IS NOT DISTINCT FROM p_company_id
          THEN l.last_profile_sync_instagram
        ELSE NULL::timestamptz
      END AS lead_last_profile_sync,
      CASE
        WHEN l.id IS NULL THEN NULL::text
        WHEN l.company_id IS NOT DISTINCT FROM p_company_id
          THEN NULLIF(trim(l.arroba_instagram_cliente), '')
        ELSE NULL::text
      END AS lead_arroba_instagram,
      CASE
        WHEN l.id IS NULL THEN NULL::text
        WHEN l.company_id IS NOT DISTINCT FROM p_company_id
          THEN NULLIF(trim(l.instagram_id_cliente), '')
        ELSE NULL::text
      END AS lead_instagram_id_cliente,
      ROW_NUMBER() OVER (PARTITION BY m.session_id ORDER BY m.data DESC) AS rn
    FROM public.crm_instagram_messages m
    LEFT JOIN public.leads l ON l.id::text = trim(both from m.session_id::text)
    WHERE m.company_id = p_company_id
      AND (p_instancia IS NULL OR lower(trim(m.instancia)) = lower(trim(p_instancia)))
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

COMMENT ON FUNCTION public.list_instagram_conversations(uuid, text) IS
  'Lista última mensagem por sessão em crm_instagram_messages; exibe nome/foto do lead pra qualquer usuário ativo da empresa.';

-- =============================================================================
-- 3) Instagram legado — imobipro_messages_{id_instagram}_instagram
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
      CASE
        WHEN l.id IS NULL THEN NULL::text
        WHEN l.company_id IS NOT DISTINCT FROM %L::uuid THEN COALESCE(
          NULLIF(trim(l.nome_instagram_cliente), ''),
          NULLIF(trim(l.name), ''),
          NULLIF(trim(l.arroba_instagram_cliente), '')
        )
        ELSE NULL::text
      END AS lead_display_name,
      CASE
        WHEN l.id IS NULL THEN NULL::text
        WHEN l.company_id IS NOT DISTINCT FROM %L::uuid
          THEN NULLIF(trim(l.profile_pic_url_instagram), '')
        ELSE NULL::text
      END AS lead_profile_pic_url,
      CASE
        WHEN l.id IS NULL THEN NULL::timestamptz
        WHEN l.company_id IS NOT DISTINCT FROM %L::uuid
          THEN l.last_profile_sync_instagram
        ELSE NULL::timestamptz
      END AS lead_last_profile_sync,
      CASE
        WHEN l.id IS NULL THEN NULL::text
        WHEN l.company_id IS NOT DISTINCT FROM %L::uuid
          THEN NULLIF(trim(l.arroba_instagram_cliente), '')
        ELSE NULL::text
      END AS lead_arroba_instagram,
      CASE
        WHEN l.id IS NULL THEN NULL::text
        WHEN l.company_id IS NOT DISTINCT FROM %L::uuid
          THEN NULLIF(trim(l.instagram_id_cliente), '')
        ELSE NULL::text
      END AS lead_instagram_id_cliente
    FROM public.%I m
    LEFT JOIN public.leads l ON l.id::text = trim(both from m.session_id::text)
    WHERE 1=1
    $q$,
    p_company_id, p_company_id, p_company_id, p_company_id, p_company_id,
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

COMMENT ON FUNCTION public.list_conversations_by_instagram_company(uuid, text) IS
  'Lista última mensagem por sessão em imobipro_messages_{id}_instagram (legado); exibe nome/foto do lead pra qualquer usuário ativo da empresa.';
