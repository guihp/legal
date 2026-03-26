-- Upgrade: bancos criados antes da padronização ainda podem ter nomes legados abaixo.
-- Instalações novas (migrations atuais) já usam crm_whatsapp_* — estes passos viram no-op.
-- Após aplicar: atualizar integrações (n8n, REST) e o campo source dos webhooks se ainda referenciarem o nome antigo.
-- Realtime: no Supabase, publicar crm_whatsapp_messages (e shards crm_whatsapp_messages_*) se necessário.

-- 1) Shards por telefone
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'imobipro_messages\_%' ESCAPE '\'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I RENAME TO %I',
      r.tablename,
      replace(r.tablename, 'imobipro_messages_', 'crm_whatsapp_messages_')
    );
  END LOOP;
END $$;

-- 2) Tabela principal
ALTER TABLE IF EXISTS public.imobipro_messages RENAME TO crm_whatsapp_messages;

-- 3) Sequence
ALTER SEQUENCE IF EXISTS public.imobipro_messages1_id_seq RENAME TO crm_whatsapp_messages_id_seq;

-- 4) Defaults de id (após rename da sequence, nextval com nome antigo quebra)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND (
        tablename = 'crm_whatsapp_messages'
        OR tablename LIKE 'crm_whatsapp_messages\_%' ESCAPE '\'
      )
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT nextval(''public.crm_whatsapp_messages_id_seq''::regclass)',
        r.tablename
      );
    EXCEPTION
      WHEN undefined_column THEN NULL;
    END;
  END LOOP;
END $$;

-- 5) PK da tabela principal
DO $$
BEGIN
  ALTER TABLE public.crm_whatsapp_messages
    RENAME CONSTRAINT imobipro_messages1_pkey TO crm_whatsapp_messages_pkey;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- 6) Índice de heatmap
DO $$
BEGIN
  ALTER INDEX public.idx_imobipro_messages_heatmap RENAME TO idx_crm_whatsapp_messages_heatmap;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- 7) Views (best-effort)
DO $$
BEGIN
  ALTER VIEW public.vw_imobipro_instances RENAME TO vw_crm_whatsapp_instances;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER VIEW public.vw_imobipro_conversas RENAME TO vw_crm_whatsapp_conversas;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER VIEW public.vw_imobipro_messages RENAME TO vw_crm_whatsapp_messages;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- 8) create_company_messages_table
CREATE OR REPLACE FUNCTION public.create_company_messages_table(p_whatsapp_ai_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  t_name text;
  phone_clean text;
BEGIN
  phone_clean := regexp_replace(p_whatsapp_ai_phone, '[^0-9]', '', 'g');
  t_name := 'crm_whatsapp_messages_' || phone_clean;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = t_name
  ) THEN
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS data TIMESTAMP DEFAULT now()', t_name);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS media TEXT', t_name);
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS instancia TEXT DEFAULT ''sdr''::text',
      t_name
    );
    RETURN;
  END IF;

  EXECUTE format(
    '
    CREATE TABLE public.%I (
      id INTEGER NOT NULL DEFAULT nextval(''public.crm_whatsapp_messages_id_seq''::regclass),
      session_id VARCHAR(255) NOT NULL,
      message JSONB NOT NULL,
      data TIMESTAMP DEFAULT now(),
      media TEXT,
      instancia TEXT DEFAULT ''sdr''::text,
      CONSTRAINT %I PRIMARY KEY (id)
    )
  ',
    t_name,
    t_name || '_pkey'
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I_session_id_idx ON public.%I(session_id)',
    t_name || '_session_id',
    t_name
  );
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I_data_idx ON public.%I(data)', t_name || '_data', t_name);
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I_instancia_idx ON public.%I(instancia)',
    t_name || '_instancia',
    t_name
  );
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_name);
END;
$$;

COMMENT ON FUNCTION public.create_company_messages_table IS
  'Cria a tabela crm_whatsapp_messages_{telefone} para a empresa quando necessário.';

-- 9) list_conversations_by_phone
CREATE OR REPLACE FUNCTION public.list_conversations_by_phone(
  p_phone text,
  p_instancia text DEFAULT NULL
)
RETURNS TABLE(
  session_id text,
  instancia text,
  message jsonb,
  data timestamp with time zone,
  media text
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
    WHERE t.table_schema = 'public'
      AND t.table_name = v_table_name
  ) THEN
    RETURN;
  END IF;

  sql_query := format(
    '
    SELECT DISTINCT ON (m.session_id)
      m.session_id::text,
      m.instancia,
      m.message,
      m.data::timestamp with time zone,
      m.media
    FROM public.%I m
    WHERE 1=1
  ',
    v_table_name
  );

  IF p_instancia IS NOT NULL AND p_instancia != '' THEN
    sql_query := sql_query || format(' AND m.instancia = %L', p_instancia);
  END IF;

  sql_query := sql_query || ' ORDER BY m.session_id, m.data DESC';

  RETURN QUERY EXECUTE sql_query;
END;
$$;

COMMENT ON FUNCTION public.list_conversations_by_phone IS
  'Lista última mensagem por sessão na tabela crm_whatsapp_messages_{telefone}.';

-- 10) conversation_for_user_by_phone
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
  v_table_name := 'crm_whatsapp_messages_' || phone_clean;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name = v_table_name
  ) THEN
    RETURN;
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
    ORDER BY m.data ASC
    LIMIT $2 OFFSET $3
  ',
    v_table_name,
    v_table_name
  )
  USING p_session_id, p_limit, p_offset;
END;
$$;

COMMENT ON FUNCTION public.conversation_for_user_by_phone IS
  'Busca mensagens na tabela crm_whatsapp_messages_{telefone} para uma sessão.';

-- 11) Remover marca legada do default / dados em company_settings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_settings'
  ) THEN
    UPDATE public.company_settings
    SET display_name = 'IAFÉ IMOBI'
    WHERE lower(trim(display_name)) = 'imobipro';

    EXECUTE
      'ALTER TABLE public.company_settings ALTER COLUMN display_name SET DEFAULT ''IAFÉ IMOBI''';
  END IF;
END $$;
