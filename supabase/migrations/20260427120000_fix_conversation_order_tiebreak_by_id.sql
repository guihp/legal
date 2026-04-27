-- Ordenação determinística das conversas: desempate por `id`.
--
-- Sintoma corrigido: quando o n8n insere 2+ mensagens da mesma sessão dentro do
-- mesmo instante (Postgres `now()` retorna o mesmo valor para inserts próximos),
-- todas ficavam com `data` idêntico (ex.: `2026-04-26 17:10:35.036`). O
-- `ORDER BY m.data ASC` sozinho é não-determinístico nesse cenário, então a
-- ordem das mensagens em /conversas mudava entre reloads ("uma hora aparece
-- antes, outra hora depois").
--
-- Correção: incluir o `id` (auto-increment, sempre monotônico) como
-- desempate. Vale tanto para a thread (data ASC, id ASC) quanto para a
-- "última mensagem por sessão" da listagem (data DESC, id DESC).

-- 1) WhatsApp — thread completa de uma sessão (ASC)
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
AS $$
DECLARE
  v_table_name text;
  phone_clean text;
BEGIN
  phone_clean := regexp_replace(p_phone, '[^0-9]', '', 'g');

  -- Preferimos a tabela nova `crm_whatsapp_messages_{phone}`; se não existir,
  -- caímos no nome legado `imobipro_messages_{phone}` (instalações antigas).
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

  RETURN QUERY EXECUTE format(
    '
    WITH me AS (
      SELECT id as uid, role, company_id, chat_instance
      FROM public.user_profiles
      WHERE id = auth.uid()
      LIMIT 1
    ),
    handoff AS (
      SELECT min(m.data)::timestamp with time zone as ts
      FROM public.%I m
      CROSS JOIN me
      WHERE m.session_id = $1
        AND me.chat_instance IS NOT NULL
        AND m.instancia = me.chat_instance
    )
    SELECT
      m.id,
      m.session_id::text,
      m.message,
      m.data::timestamp with time zone,
      m.media,
      m.instancia,
      (handoff.ts IS NOT NULL AND m.data::timestamp with time zone < handoff.ts) as before_handoff,
      handoff.ts as handoff_ts
    FROM public.%I m
    CROSS JOIN me
    LEFT JOIN handoff ON true
    WHERE m.session_id::text = $1
    ORDER BY m.data ASC, m.id ASC
    LIMIT $2 OFFSET $3
  ',
    v_table_name,
    v_table_name
  )
  USING p_session_id, p_limit, p_offset;
END;
$$;

COMMENT ON FUNCTION public.conversation_for_user_by_phone IS
  'Mensagens de uma sessão na tabela crm_whatsapp_messages_{phone} (fallback imobipro_messages_{phone}). Ordem: data ASC, id ASC (id desempata timestamps colidentes do n8n).';

-- 2) WhatsApp — última mensagem por sessão (DESC)
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
      SELECT id as uid, role, company_id
      FROM public.user_profiles
      WHERE id = auth.uid()
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
            WHERE upc.role IN (''admin'',''gestor'',''super_admin'')
          ) THEN COALESCE(l.name, l.phone::text)
          WHEN EXISTS (
            SELECT 1 FROM public.leads l2 CROSS JOIN upc
            WHERE l2.id::text = m.session_id::text
              AND l2.company_id = upc.company_id
              AND upc.role = ''corretor''
          ) THEN COALESCE(l.name, l.phone::text)
          ELSE NULL
        END
      ) AS lead_display_name
    FROM public.%I m
    LEFT JOIN public.leads l ON l.id::text = m.session_id::text
    WHERE 1=1
  ',
    v_table_name
  );

  IF p_instancia IS NOT NULL AND p_instancia != '' THEN
    sql_query := sql_query || format(' AND m.instancia = %L', p_instancia);
  END IF;

  -- Última mensagem por sessão. data DESC primeiro; id DESC desempata.
  sql_query := sql_query || ' ORDER BY m.session_id, m.data DESC, m.id DESC';

  RETURN QUERY EXECUTE sql_query;
END;
$$;

COMMENT ON FUNCTION public.list_conversations_by_phone IS
  'Última mensagem por sessão em crm_whatsapp_messages_{phone} (fallback imobipro_messages_{phone}) + lead_display_name. Ordem: data DESC, id DESC.';

-- Nota: list_conversations_by_instagram_company NÃO foi alterada aqui porque
-- em produção ela tem signature com colunas extras (lead_profile_pic_url,
-- lead_last_profile_sync, lead_arroba_instagram, lead_instagram_id_cliente)
-- que pertencem a outro fluxo de migration. O mesmo desempate por id pode
-- ser aplicado num fix futuro preservando aquela signature.
