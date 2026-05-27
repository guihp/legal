-- RPCs unificadas para listagem/thread Instagram (e demais plataformas) em public.mensagens.
-- Idempotente: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.list_mensagens_conversations(
  p_company_id uuid,
  p_plataforma text DEFAULT 'WhatsApp',
  p_instancia text DEFAULT NULL
)
RETURNS TABLE (
  phone text,
  contact_norm text,
  instancia text,
  last_message_at timestamptz,
  last_text text,
  last_sender_type text,
  last_mensage_type text,
  last_media text,
  lead_id uuid,
  lead_name text,
  lead_stage text,
  lead_phone text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plat text;
BEGIN
  v_plat := trim(coalesce(p_plataforma, 'WhatsApp'));

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = p_company_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      m.contact_norm AS cnorm,
      m.phone,
      m.instancia,
      m.text,
      m.type,
      m.mensage_type,
      m.conteudo_media,
      m.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY m.contact_norm
        ORDER BY m.created_at DESC, m.id DESC
      ) AS rn
    FROM public.mensagens m
    WHERE m.company_id = p_company_id
      AND m.plataforma = v_plat
      AND m.contact_norm IS NOT NULL
      AND m.contact_norm <> ''
      AND (
        p_instancia IS NULL
        OR trim(p_instancia) = ''
        OR lower(trim(m.instancia)) = lower(trim(p_instancia))
      )
  ),
  last_msg AS (
    SELECT * FROM ranked WHERE rn = 1
  ),
  scoped AS (
    SELECT lm.*
    FROM last_msg lm
    WHERE EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.company_id = p_company_id
        AND up.role::text IN ('admin', 'gestor', 'super_admin')
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.leads l ON l.company_id = up.company_id
      WHERE up.id = auth.uid()
        AND up.role::text = 'corretor'
        AND l.company_id = p_company_id
        AND l.id_corretor_responsavel = up.id
        AND (
          (
            lower(v_plat) <> 'instagram'
            AND public.normalize_phone_digits(l.phone) = lm.cnorm
          )
          OR (
            lower(v_plat) = 'instagram'
            AND lower(trim(coalesce(l.instagram_id_cliente, ''))) = lm.cnorm
          )
        )
    )
  )
  SELECT
    s.phone,
    s.cnorm,
    s.instancia,
    s.created_at,
    s.text,
    s.type,
    s.mensage_type,
    s.conteudo_media,
    l.id,
    l.name,
    l.stage,
    l.phone
  FROM scoped s
  LEFT JOIN LATERAL (
    SELECT ld.id, ld.name, ld.stage, ld.phone
    FROM public.leads ld
    WHERE ld.company_id = p_company_id
      AND (
        (
          lower(v_plat) <> 'instagram'
          AND public.normalize_phone_digits(ld.phone) = s.cnorm
        )
        OR (
          lower(v_plat) = 'instagram'
          AND lower(trim(coalesce(ld.instagram_id_cliente, ''))) = s.cnorm
        )
      )
    ORDER BY ld.updated_at DESC NULLS LAST, ld.created_at DESC NULLS LAST
    LIMIT 1
  ) l ON true
  ORDER BY s.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.mensagens_thread(
  p_company_id uuid,
  p_phone text,
  p_plataforma text DEFAULT 'WhatsApp',
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id bigint,
  phone text,
  contact_norm text,
  company_id uuid,
  instancia text,
  type text,
  text text,
  conteudo_media text,
  mensage_type text,
  mensagem_id text,
  plataforma text,
  user_id uuid,
  lead_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_plat text;
BEGIN
  v_plat := trim(coalesce(p_plataforma, 'WhatsApp'));
  v_norm := public.resolve_mensagens_contact_norm(p_phone, v_plat);
  IF v_norm IS NULL OR v_norm = '' THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = p_company_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.phone,
    m.contact_norm,
    m.company_id,
    m.instancia,
    m.type,
    m.text,
    m.conteudo_media,
    m.mensage_type,
    m.mensagem_id,
    m.plataforma,
    m.user_id,
    m.lead_id,
    m.created_at
  FROM public.mensagens m
  WHERE m.company_id = p_company_id
    AND m.plataforma = v_plat
    AND m.contact_norm = v_norm
    AND (
      EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.company_id = p_company_id
          AND up.role::text IN ('admin', 'gestor', 'super_admin')
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_profiles up
        JOIN public.leads l ON l.company_id = up.company_id
        WHERE up.id = auth.uid()
          AND up.role::text = 'corretor'
          AND l.company_id = p_company_id
          AND l.id_corretor_responsavel = up.id
          AND (
            (
              lower(v_plat) <> 'instagram'
              AND public.normalize_phone_digits(l.phone) = v_norm
            )
            OR (
              lower(v_plat) = 'instagram'
              AND lower(trim(coalesce(l.instagram_id_cliente, ''))) = v_norm
            )
          )
      )
    )
  ORDER BY m.created_at ASC, m.id ASC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_mensagens_conversations(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mensagens_thread(uuid, text, text, integer, integer) TO authenticated, service_role;
