-- Permite várias etiquetas por conversa (ex.: ai_ativa + follow_up_7m).
-- Antes de atendimento (ai_ativa / humano / humano_solicitado) continuam mutuamente
-- exclusivas na API; tags (follow_up_*, custom) são aditivas.

ALTER TABLE public.conversation_contact_labels
  DROP CONSTRAINT IF EXISTS conversation_contact_labels_company_id_channel_session_id_key;

-- Nome legado possível do UNIQUE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.conversation_contact_labels'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%company_id%channel%session_id%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%status%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.conversation_contact_labels DROP CONSTRAINT ' || quote_ident(conname)
      FROM pg_constraint
      WHERE conrelid = 'public.conversation_contact_labels'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) ILIKE '%company_id%channel%session_id%'
        AND pg_get_constraintdef(oid) NOT ILIKE '%status%'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE public.conversation_contact_labels
  DROP CONSTRAINT IF EXISTS conversation_contact_labels_company_channel_session_status_key;

ALTER TABLE public.conversation_contact_labels
  ADD CONSTRAINT conversation_contact_labels_company_channel_session_status_key
  UNIQUE (company_id, channel, session_id, status);

CREATE INDEX IF NOT EXISTS idx_conversation_contact_labels_session_lookup
  ON public.conversation_contact_labels (company_id, channel, session_id);

COMMENT ON TABLE public.conversation_contact_labels IS
  'Etiquetas de contato por conversa. Múltiplas por sessão; atendimento (ai_ativa/humano/humano_solicitado) exclusivas via API.';

-- Sessões que só têm follow_up_* (sem etiqueta de atendimento): restaura ai_ativa ao lado
INSERT INTO public.conversation_contact_labels (company_id, channel, session_id, status, updated_by)
SELECT l.company_id, l.channel, l.session_id, 'ai_ativa', NULL
FROM public.conversation_contact_labels l
WHERE l.status ILIKE 'follow_up%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.conversation_contact_labels a
    WHERE a.company_id = l.company_id
      AND a.channel = l.channel
      AND a.session_id = l.session_id
      AND a.status IN ('ai_ativa', 'humano', 'humano_solicitado')
  )
ON CONFLICT (company_id, channel, session_id, status) DO NOTHING;
