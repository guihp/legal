-- Migration: Função para listar conversas da tabela dinâmica imobipro_messages_{phone}
-- Permite listar conversas da tabela específica da empresa baseada no whatsapp_ai_phone
-- Retorna a última mensagem de cada sessão agrupada por session_id

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
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
  v_table_name text;
  phone_clean text;
  sql_query text;
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
  
  -- Construir query dinâmica com agrupamento por session_id
  sql_query := format('
    SELECT DISTINCT ON (m.session_id)
      m.session_id::text,
      m.instancia,
      m.message,
      m.data::timestamp with time zone,
      m.media
    FROM public.%I m
    WHERE 1=1
  ', v_table_name);
  
  -- Adicionar filtro por instância se fornecido
  IF p_instancia IS NOT NULL AND p_instancia != '' THEN
    sql_query := sql_query || format(' AND m.instancia = %L', p_instancia);
  END IF;
  
  sql_query := sql_query || ' ORDER BY m.session_id, m.data DESC';
  
  -- Executar query dinâmica
  RETURN QUERY EXECUTE sql_query;
END;
$$;

COMMENT ON FUNCTION public.list_conversations_by_phone IS 'Lista última mensagem de cada sessão da tabela dinâmica imobipro_messages_{phone} para uma empresa específica';
