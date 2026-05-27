-- Mensagens_Whatsapp: leitura unificada por company_id + phone (join leads.stage)
-- Substitui list_conversations_by_phone / conversation_for_user_by_phone no fluxo /conversas WhatsApp.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_phone_digits(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(p, ''), '[^0-9]', '', 'g'), '');
$$;

COMMENT ON FUNCTION public.normalize_phone_digits(text) IS
  'Remove não-dígitos do telefone; usado para join Mensagens_Whatsapp ↔ leads.';

-- ---------------------------------------------------------------------------
-- Colunas auxiliares (n8n / painel)
-- ---------------------------------------------------------------------------
ALTER TABLE public."Mensagens_Whatsapp"
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instancia text,
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Mensagens_Whatsapp'
      AND column_name = 'phone_norm'
  ) THEN
    ALTER TABLE public."Mensagens_Whatsapp"
      ADD COLUMN phone_norm text GENERATED ALWAYS AS (
        regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
      ) STORED;
  END IF;
END $$;

-- Normalizar phone na origem quando vier formatado
UPDATE public."Mensagens_Whatsapp"
SET phone = phone_norm
WHERE phone IS NOT NULL
  AND phone_norm IS NOT NULL
  AND phone <> phone_norm;

-- Preencher lead_id existente
UPDATE public."Mensagens_Whatsapp" m
SET lead_id = l.id
FROM public.leads l
WHERE m.lead_id IS NULL
  AND m.company_id IS NOT NULL
  AND m.phone_norm IS NOT NULL
  AND m.phone_norm <> ''
  AND l.company_id = m.company_id
  AND public.normalize_phone_digits(l.phone) = m.phone_norm;

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mensagens_whatsapp_company_plat_phone_norm_created
  ON public."Mensagens_Whatsapp" (company_id, plataforma, phone_norm, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mensagens_whatsapp_company_phone_norm
  ON public."Mensagens_Whatsapp" (company_id, phone_norm);

CREATE INDEX IF NOT EXISTS idx_leads_company_phone_norm
  ON public.leads (company_id, (public.normalize_phone_digits(phone)))
  WHERE phone IS NOT NULL AND trim(phone) <> '';

-- ---------------------------------------------------------------------------
-- Trigger: manter lead_id ao inserir/atualizar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_mensagens_whatsapp_sync_lead_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  IF NEW.lead_id IS NOT NULL OR NEW.company_id IS NULL OR NEW.phone_norm IS NULL OR NEW.phone_norm = '' THEN
    RETURN NEW;
  END IF;

  SELECT l.id INTO v_lead_id
  FROM public.leads l
  WHERE l.company_id = NEW.company_id
    AND public.normalize_phone_digits(l.phone) = NEW.phone_norm
  ORDER BY l.updated_at DESC NULLS LAST, l.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_lead_id IS NOT NULL THEN
    NEW.lead_id := v_lead_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mensagens_whatsapp_sync_lead_id ON public."Mensagens_Whatsapp";
CREATE TRIGGER mensagens_whatsapp_sync_lead_id
  BEFORE INSERT OR UPDATE OF phone, company_id, lead_id ON public."Mensagens_Whatsapp"
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_mensagens_whatsapp_sync_lead_id();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public."Mensagens_Whatsapp" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mensagens_whatsapp_select_company ON public."Mensagens_Whatsapp";
CREATE POLICY mensagens_whatsapp_select_company
ON public."Mensagens_Whatsapp"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = "Mensagens_Whatsapp".company_id
      AND (
        up.role::text IN ('admin', 'gestor', 'super_admin')
        OR (
          up.role::text = 'corretor'
          AND EXISTS (
            SELECT 1
            FROM public.leads l
            WHERE l.company_id = "Mensagens_Whatsapp".company_id
              AND public.normalize_phone_digits(l.phone) = "Mensagens_Whatsapp".phone_norm
              AND l.id_corretor_responsavel = up.id
          )
        )
      )
  )
);

DROP POLICY IF EXISTS mensagens_whatsapp_insert_company ON public."Mensagens_Whatsapp";
CREATE POLICY mensagens_whatsapp_insert_company
ON public."Mensagens_Whatsapp"
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = "Mensagens_Whatsapp".company_id
  )
);

-- ---------------------------------------------------------------------------
-- RPC: lista de conversas (última mensagem + CRM)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_mensagens_whatsapp_conversations(
  p_company_id uuid,
  p_plataforma text DEFAULT 'WhatsApp',
  p_instancia text DEFAULT NULL
)
RETURNS TABLE (
  phone text,
  phone_norm text,
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
      m.phone_norm AS pnorm,
      m.phone,
      m.instancia,
      m.text,
      m.type,
      m.mensage_type,
      m.conteudo_media,
      m.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY m.phone_norm
        ORDER BY m.created_at DESC, m.id DESC
      ) AS rn
    FROM public."Mensagens_Whatsapp" m
    WHERE m.company_id = p_company_id
      AND m.plataforma = p_plataforma
      AND m.phone_norm IS NOT NULL
      AND m.phone_norm <> ''
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
    l.phone
  FROM scoped s
  LEFT JOIN LATERAL (
    SELECT ld.id, ld.name, ld.stage, ld.phone
    FROM public.leads ld
    WHERE ld.company_id = p_company_id
      AND public.normalize_phone_digits(ld.phone) = s.pnorm
    ORDER BY ld.updated_at DESC NULLS LAST, ld.created_at DESC NULLS LAST
    LIMIT 1
  ) l ON true
  ORDER BY s.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.list_mensagens_whatsapp_conversations(uuid, text, text) IS
  'Lista conversas (última msg por phone_norm) com join em leads (stage/nome). Corretor: só leads atribuídos.';

-- ---------------------------------------------------------------------------
-- RPC: thread de mensagens
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mensagens_whatsapp_thread(
  p_company_id uuid,
  p_phone text,
  p_plataforma text DEFAULT 'WhatsApp',
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id bigint,
  phone text,
  phone_norm text,
  company_id uuid,
  instancia text,
  type text,
  text text,
  conteudo_media text,
  mensage_type text,
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
  v_phone_norm text;
BEGIN
  v_phone_norm := public.normalize_phone_digits(p_phone);
  IF v_phone_norm IS NULL OR v_phone_norm = '' THEN
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
    m.phone_norm,
    m.company_id,
    m.instancia,
    m.type,
    m.text,
    m.conteudo_media,
    m.mensage_type,
    m.plataforma,
    m.user_id,
    m.lead_id,
    m.created_at
  FROM public."Mensagens_Whatsapp" m
  WHERE m.company_id = p_company_id
    AND m.plataforma = p_plataforma
    AND m.phone_norm = v_phone_norm
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
          AND public.normalize_phone_digits(l.phone) = v_phone_norm
          AND l.id_corretor_responsavel = up.id
      )
    )
  ORDER BY m.created_at ASC, m.id ASC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

COMMENT ON FUNCTION public.mensagens_whatsapp_thread(uuid, text, text, integer, integer) IS
  'Mensagens de uma conversa WhatsApp (phone + company_id + plataforma). Corretor: só se lead atribuído.';

GRANT EXECUTE ON FUNCTION public.list_mensagens_whatsapp_conversations(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_mensagens_whatsapp_conversations(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mensagens_whatsapp_thread(uuid, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mensagens_whatsapp_thread(uuid, text, text, integer, integer) TO service_role;

GRANT SELECT, INSERT ON public."Mensagens_Whatsapp" TO authenticated;
