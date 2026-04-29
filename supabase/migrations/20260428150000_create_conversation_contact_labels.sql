CREATE TABLE IF NOT EXISTS public.conversation_contact_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'instagram')),
  session_id text NOT NULL,
  status text NOT NULL DEFAULT 'ai_ativa' CHECK (status IN ('ai_ativa', 'humano')),
  updated_by uuid NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, channel, session_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_contact_labels_company_channel
  ON public.conversation_contact_labels (company_id, channel);

CREATE INDEX IF NOT EXISTS idx_conversation_contact_labels_session
  ON public.conversation_contact_labels (session_id);

ALTER TABLE public.conversation_contact_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversation_contact_labels_select ON public.conversation_contact_labels;
CREATE POLICY conversation_contact_labels_select
ON public.conversation_contact_labels
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = conversation_contact_labels.company_id
  )
);

DROP POLICY IF EXISTS conversation_contact_labels_modify ON public.conversation_contact_labels;
CREATE POLICY conversation_contact_labels_modify
ON public.conversation_contact_labels
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = conversation_contact_labels.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = conversation_contact_labels.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
);

DROP TRIGGER IF EXISTS update_conversation_contact_labels_updated_at
  ON public.conversation_contact_labels;
CREATE TRIGGER update_conversation_contact_labels_updated_at
BEFORE UPDATE ON public.conversation_contact_labels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
