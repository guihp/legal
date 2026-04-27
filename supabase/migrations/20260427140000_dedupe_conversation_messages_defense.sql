-- Defesa contra duplicações vindas do n8n.
--
-- Sintoma: flow pai do n8n estava chamando `evo_saida_b` 2x para a mesma
-- mensagem, e o `Cria Histórico Supabase1` inseria human + ai duas vezes
-- com data IDÊNTICO (mesmo microssegundo). Resultado em /conversas: cada
-- balão aparecia 2x. Já limpamos as duplicatas existentes; a fix raiz é
-- no flow pai. Esta RPC fica como cinto de segurança caso volte a ocorrer.
--
-- Critério de dedup: (session_id, type, content, data) — bate só quando o
-- timestamp é EXATAMENTE o mesmo, então mensagens legítimas que o cliente
-- mandou iguais em horários diferentes (ex.: dois "ola") permanecem.

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
    ),
    -- Dedup defensivo: pares idênticos (mesmo content/type/data) viram 1.
    -- Mantém o id mais antigo. Tolera duplicatas geradas pelo n8n e oculta
    -- da UI sem precisar deletar do banco.
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
      (handoff.ts IS NOT NULL AND d.data::timestamp with time zone < handoff.ts) as before_handoff,
      handoff.ts as handoff_ts
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
  'Mensagens de uma sessão. Deduplica pares idênticos (session_id, type, content, data) — defesa contra n8n re-disparando o sub-workflow. Ordena por (data, id).';
