-- Migration: Simplificar função conversation_for_user_by_phone - versão simples
-- Como cada empresa tem sua própria tabela, não precisa validar allowed_sessions

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
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
  v_table_name text;
  phone_clean text;
BEGIN
  -- Limpar o número do telefone (apenas números)
  phone_clean := regexp_replace(p_phone, '[^0-9]', '', 'g');
  
  -- Construir nome da tabela (usar prefixo v_ para evitar ambiguidade)
  v_table_name := 'imobipro_messages_' || phone_clean;
  
  -- Verificar se a tabela existe (usar alias para evitar ambiguidade)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' 
    AND t.table_name = v_table_name
  ) THEN
    -- Se a tabela não existir, retornar vazio
    RETURN;
  END IF;
  
  -- Executar query dinâmica na tabela específica
  -- Simplificado: como cada empresa tem sua própria tabela, busca diretamente
  RETURN QUERY EXECUTE format('
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
  ', v_table_name, v_table_name)
  USING p_session_id, p_limit, p_offset;
END;
$$;

COMMENT ON FUNCTION public.conversation_for_user_by_phone IS 'Busca mensagens da tabela dinâmica imobipro_messages_{phone} para uma sessão específica';
