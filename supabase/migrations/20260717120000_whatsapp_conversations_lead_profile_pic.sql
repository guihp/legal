-- Inclui foto de perfil WhatsApp do lead na listagem de conversas.
DROP FUNCTION IF EXISTS public.list_mensagens_whatsapp_conversations(uuid, text, text);

CREATE OR REPLACE FUNCTION public.list_mensagens_whatsapp_conversations(
  p_company_id uuid,
  p_plataforma text DEFAULT 'WhatsApp'::text,
  p_instancia text DEFAULT NULL::text
)
RETURNS TABLE(
  phone text,
  phone_norm text,
  instancia text,
  last_message_at timestamp with time zone,
  last_text text,
  last_sender_type text,
  last_mensage_type text,
  last_media text,
  lead_id uuid,
  lead_name text,
  lead_stage text,
  lead_phone text,
  lead_profile_pic_url_whatsapp text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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
      m.contact_norm AS pnorm,
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
      AND m.plataforma = p_plataforma
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
        AND public.normalize_phone_digits(l.phone) = lm.pnorm
        AND l.id_corretor_responsavel = up.id
    )
  )
  SELECT
    s.phone,
    s.pnorm,
    s.instancia,
    s.created_at,
    s.text,
    s.type,
    s.mensage_type,
    s.conteudo_media,
    l.id,
    l.name,
    l.stage,
    l.phone,
    l.profile_pic_url_whatsapp
  FROM scoped s
  LEFT JOIN LATERAL (
    SELECT ld.id, ld.name, ld.stage, ld.phone, ld.profile_pic_url_whatsapp
    FROM public.leads ld
    WHERE ld.company_id = p_company_id
      AND public.normalize_phone_digits(ld.phone) = s.pnorm
    ORDER BY ld.updated_at DESC NULLS LAST
    LIMIT 1
  ) l ON true
  ORDER BY s.created_at DESC;
END;
$function$;

COMMENT ON FUNCTION public.list_mensagens_whatsapp_conversations(uuid, text, text) IS
  'Lista conversas WhatsApp com lead + profile_pic_url_whatsapp.';

GRANT EXECUTE ON FUNCTION public.list_mensagens_whatsapp_conversations(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_mensagens_whatsapp_conversations(uuid, text, text) TO service_role;
