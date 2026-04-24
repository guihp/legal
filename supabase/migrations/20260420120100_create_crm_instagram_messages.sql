-- Tabela única (não-dinâmica) de mensagens do Instagram.
-- Diferente do WhatsApp (que usa crm_whatsapp_messages_{phone}), aqui consolidamos
-- todas as mensagens IG em uma única tabela, filtrando por company_id.
-- Isso simplifica a integração e é adequado ao volume típico do canal.

CREATE TABLE IF NOT EXISTS public.crm_instagram_messages (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  instancia text NOT NULL,               -- handle da conta IG (@empresa)
  session_id text NOT NULL,              -- ID/handle do contato (lead/cliente)
  message jsonb NOT NULL,                -- { type: 'human'|'ai', content: '...' }
  media text NULL,                       -- base64 ou URL (mídia opcional)
  data timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_instagram_messages_company_id
  ON public.crm_instagram_messages(company_id);

CREATE INDEX IF NOT EXISTS idx_crm_instagram_messages_session_id
  ON public.crm_instagram_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_crm_instagram_messages_instancia
  ON public.crm_instagram_messages(instancia);

CREATE INDEX IF NOT EXISTS idx_crm_instagram_messages_data_desc
  ON public.crm_instagram_messages(data DESC);

-- Índice composto útil para listagem "última mensagem por sessão"
CREATE INDEX IF NOT EXISTS idx_crm_instagram_messages_company_session_data
  ON public.crm_instagram_messages(company_id, session_id, data DESC);

ALTER TABLE public.crm_instagram_messages ENABLE ROW LEVEL SECURITY;

-- RLS: mesma empresa
DROP POLICY IF EXISTS "crm_instagram_messages_select_same_company"
  ON public.crm_instagram_messages;
CREATE POLICY "crm_instagram_messages_select_same_company"
ON public.crm_instagram_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = crm_instagram_messages.company_id
      AND up.is_active = true
  )
);

DROP POLICY IF EXISTS "crm_instagram_messages_insert_same_company"
  ON public.crm_instagram_messages;
CREATE POLICY "crm_instagram_messages_insert_same_company"
ON public.crm_instagram_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = crm_instagram_messages.company_id
      AND up.is_active = true
  )
);

DROP POLICY IF EXISTS "crm_instagram_messages_update_same_company"
  ON public.crm_instagram_messages;
CREATE POLICY "crm_instagram_messages_update_same_company"
ON public.crm_instagram_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = crm_instagram_messages.company_id
      AND up.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = crm_instagram_messages.company_id
      AND up.is_active = true
  )
);

DROP POLICY IF EXISTS "crm_instagram_messages_delete_same_company"
  ON public.crm_instagram_messages;
CREATE POLICY "crm_instagram_messages_delete_same_company"
ON public.crm_instagram_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = crm_instagram_messages.company_id
      AND up.is_active = true
  )
);
