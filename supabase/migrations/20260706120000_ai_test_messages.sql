-- Mensagens do simulador "Testar IA" (isoladas de public.mensagens).
CREATE TABLE IF NOT EXISTS public.ai_test_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image')),
  content text NULL,
  media_url text NULL,
  mime_type text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_test_messages_company_session_created
  ON public.ai_test_messages (company_id, session_id, created_at);

ALTER TABLE public.ai_test_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_test_messages_select ON public.ai_test_messages;
CREATE POLICY ai_test_messages_select
ON public.ai_test_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = ai_test_messages.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
);

DROP POLICY IF EXISTS ai_test_messages_insert_user ON public.ai_test_messages;
CREATE POLICY ai_test_messages_insert_user
ON public.ai_test_messages
FOR INSERT
WITH CHECK (
  role = 'user'
  AND message_type = 'text'
  AND EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = ai_test_messages.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
);

DROP POLICY IF EXISTS ai_test_messages_delete ON public.ai_test_messages;
CREATE POLICY ai_test_messages_delete
ON public.ai_test_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = ai_test_messages.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'ai_test_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_test_messages;
  END IF;
END $$;
