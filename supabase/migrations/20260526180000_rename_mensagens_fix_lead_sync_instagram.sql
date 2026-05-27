-- Renomeia Mensagens_Whatsapp → mensagens (unificado WhatsApp + Instagram)
-- Corrige lead_id no INSERT (phone_norm generated não existe no BEFORE trigger)
-- contact_norm: dígitos (WhatsApp) ou lower(trim) (Instagram)

-- ---------------------------------------------------------------------------
-- 1) Policies antigas (referenciam phone_norm) — remover antes de dropar coluna
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS mensagens_whatsapp_select_company ON public."Mensagens_Whatsapp";
DROP POLICY IF EXISTS mensagens_whatsapp_insert_company ON public."Mensagens_Whatsapp";

-- ---------------------------------------------------------------------------
-- 2) Renomear tabela
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public."Mensagens_Whatsapp" RENAME TO mensagens;

-- ---------------------------------------------------------------------------
-- 3) contact_norm (substitui phone_norm generated)
-- ---------------------------------------------------------------------------
ALTER TABLE public.mensagens DROP COLUMN IF EXISTS phone_norm;

ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS contact_norm text;

-- Dedup por id externo (wamid / ig message id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mensagens_company_mensagem_id
  ON public.mensagens (company_id, mensagem_id)
  WHERE mensagem_id IS NOT NULL AND trim(mensagem_id) <> '';

-- ---------------------------------------------------------------------------
-- 4) Resolver chave de contato + lead_id (BEFORE INSERT/UPDATE)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_mensagens_contact_norm(
  p_phone text,
  p_plataforma text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN lower(trim(coalesce(p_plataforma, 'WhatsApp'))) = 'instagram' THEN
      NULLIF(lower(trim(coalesce(p_phone, ''))), '')
    ELSE
      public.normalize_phone_digits(p_phone)
  END;
$$;

CREATE OR REPLACE FUNCTION public.trg_mensagens_before_save()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_lead_id uuid;
  v_norm text;
  v_plat text;
BEGIN
  v_plat := lower(trim(coalesce(NEW.plataforma, 'WhatsApp')));
  v_norm := public.resolve_mensagens_contact_norm(NEW.phone, NEW.plataforma);

  IF v_norm IS NOT NULL AND v_norm <> '' THEN
    NEW.contact_norm := v_norm;
    IF v_plat = 'instagram' THEN
      NEW.phone := v_norm;
    ELSE
      NEW.phone := v_norm;
    END IF;
  ELSE
    NEW.contact_norm := NULL;
  END IF;

  IF NEW.lead_id IS NOT NULL OR NEW.company_id IS NULL OR NEW.contact_norm IS NULL OR NEW.contact_norm = '' THEN
    RETURN NEW;
  END IF;

  IF v_plat = 'instagram' THEN
    SELECT l.id INTO v_lead_id
    FROM public.leads l
    WHERE l.company_id = NEW.company_id
      AND lower(trim(coalesce(l.instagram_id_cliente, ''))) = NEW.contact_norm
    ORDER BY l.updated_at DESC NULLS LAST, l.created_at DESC NULLS LAST
    LIMIT 1;
  ELSE
    SELECT l.id INTO v_lead_id
    FROM public.leads l
    WHERE l.company_id = NEW.company_id
      AND public.normalize_phone_digits(l.phone) = NEW.contact_norm
    ORDER BY l.updated_at DESC NULLS LAST, l.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_lead_id IS NOT NULL THEN
    NEW.lead_id := v_lead_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mensagens_whatsapp_sync_lead_id ON public.mensagens;
DROP TRIGGER IF EXISTS mensagens_before_save ON public.mensagens;
CREATE TRIGGER mensagens_before_save
  BEFORE INSERT OR UPDATE OF phone, company_id, lead_id, plataforma, contact_norm
  ON public.mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_mensagens_before_save();

-- Backfill contact_norm + lead_id em linhas antigas
UPDATE public.mensagens m
SET
  contact_norm = public.resolve_mensagens_contact_norm(m.phone, m.plataforma),
  phone = public.resolve_mensagens_contact_norm(m.phone, m.plataforma)
WHERE m.contact_norm IS NULL OR m.contact_norm = '';

UPDATE public.mensagens m
SET lead_id = l.id
FROM public.leads l
WHERE m.lead_id IS NULL
  AND m.company_id = l.company_id
  AND m.contact_norm IS NOT NULL
  AND m.contact_norm <> ''
  AND (
    (
      lower(trim(coalesce(m.plataforma, 'WhatsApp'))) <> 'instagram'
      AND public.normalize_phone_digits(l.phone) = m.contact_norm
    )
    OR (
      lower(trim(coalesce(m.plataforma, 'WhatsApp'))) = 'instagram'
      AND lower(trim(coalesce(l.instagram_id_cliente, ''))) = m.contact_norm
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Índices
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_mensagens_whatsapp_company_plat_phone_norm_created;
DROP INDEX IF EXISTS idx_mensagens_whatsapp_company_phone_norm;

CREATE INDEX IF NOT EXISTS idx_mensagens_company_plat_contact_created
  ON public.mensagens (company_id, plataforma, contact_norm, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mensagens_company_contact
  ON public.mensagens (company_id, contact_norm);

CREATE INDEX IF NOT EXISTS idx_leads_company_instagram_id
  ON public.leads (company_id, (lower(trim(instagram_id_cliente))))
  WHERE instagram_id_cliente IS NOT NULL AND trim(instagram_id_cliente) <> '';

-- ---------------------------------------------------------------------------
-- 6) RLS (recriar nomes na tabela mensagens)
-- ---------------------------------------------------------------------------
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mensagens_whatsapp_select_company ON public.mensagens;
DROP POLICY IF EXISTS mensagens_whatsapp_insert_company ON public.mensagens;
DROP POLICY IF EXISTS mensagens_select_company ON public.mensagens;
DROP POLICY IF EXISTS mensagens_insert_company ON public.mensagens;

CREATE POLICY mensagens_select_company
ON public.mensagens
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = mensagens.company_id
      AND (
        up.role::text IN ('admin', 'gestor', 'super_admin')
        OR (
          up.role::text = 'corretor'
          AND (
            (
              lower(trim(coalesce(mensagens.plataforma, 'WhatsApp'))) <> 'instagram'
              AND EXISTS (
                SELECT 1 FROM public.leads l
                WHERE l.company_id = mensagens.company_id
                  AND public.normalize_phone_digits(l.phone) = mensagens.contact_norm
                  AND l.id_corretor_responsavel = up.id
              )
            )
            OR (
              lower(trim(coalesce(mensagens.plataforma, 'WhatsApp'))) = 'instagram'
              AND EXISTS (
                SELECT 1 FROM public.leads l
                WHERE l.company_id = mensagens.company_id
                  AND lower(trim(coalesce(l.instagram_id_cliente, ''))) = mensagens.contact_norm
                  AND l.id_corretor_responsavel = up.id
              )
            )
          )
        )
      )
  )
);

CREATE POLICY mensagens_insert_company
ON public.mensagens
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = mensagens.company_id
  )
);

-- service_role / n8n bypass RLS

-- ---------------------------------------------------------------------------
-- 7) RPCs (mensagens unificada)
-- ---------------------------------------------------------------------------
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

-- Compat: wrappers antigos (WhatsApp)
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    phone,
    contact_norm AS phone_norm,
    instancia,
    last_message_at,
    last_text,
    last_sender_type,
    last_mensage_type,
    last_media,
    lead_id,
    lead_name,
    lead_stage,
    lead_phone
  FROM public.list_mensagens_conversations(p_company_id, p_plataforma, p_instancia);
$$;

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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id,
    phone,
    contact_norm AS phone_norm,
    company_id,
    instancia,
    type,
    text,
    conteudo_media,
    mensage_type,
    plataforma,
    user_id,
    lead_id,
    created_at
  FROM public.mensagens_thread(p_company_id, p_phone, p_plataforma, p_limit, p_offset);
$$;

GRANT EXECUTE ON FUNCTION public.list_mensagens_conversations(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mensagens_thread(uuid, text, text, integer, integer) TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.mensagens TO authenticated;
GRANT ALL ON public.mensagens TO service_role;

-- Realtime publication (se ainda não estiver)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mensagens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
