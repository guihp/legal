-- RPC que retorna a última mensagem por session_id para a tabela unificada
-- crm_instagram_messages, filtrando por company_id e (opcionalmente) por instancia.

CREATE OR REPLACE FUNCTION public.list_instagram_conversations(
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
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      m.session_id,
      m.instancia,
      m.message,
      m.media,
      m.data,
      ROW_NUMBER() OVER (PARTITION BY m.session_id ORDER BY m.data DESC) AS rn
    FROM public.crm_instagram_messages m
    WHERE m.company_id = p_company_id
      AND (p_instancia IS NULL OR lower(trim(m.instancia)) = lower(trim(p_instancia)))
      -- Segurança adicional: o chamador precisa pertencer à empresa.
      AND EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.company_id = p_company_id
          AND up.is_active = true
      )
  )
  SELECT r.session_id, r.instancia, r.message, r.media, r.data
  FROM ranked r
  WHERE r.rn = 1
  ORDER BY r.data DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_instagram_conversations(uuid, text) TO authenticated;

-- RPC para abrir um chat: retorna todas as mensagens daquele session_id
CREATE OR REPLACE FUNCTION public.instagram_conversation_for_session(
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
BEGIN
  RETURN QUERY
  SELECT m.id, m.session_id, m.instancia, m.message, m.media, m.data
  FROM public.crm_instagram_messages m
  WHERE m.company_id = p_company_id
    AND m.session_id = p_session_id
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.company_id = p_company_id
        AND up.is_active = true
    )
  ORDER BY m.data ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.instagram_conversation_for_session(uuid, text, int, int) TO authenticated;
