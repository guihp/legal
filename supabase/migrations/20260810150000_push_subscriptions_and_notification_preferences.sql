-- Fase 2: Web Push subscriptions + per-user notification preferences
-- Extends user_notifications.type for chat human + agenda reminder emitters

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  platform text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint),
  CONSTRAINT push_subscriptions_platform_check CHECK (
    platform = ANY (ARRAY['ios'::text, 'android'::text, 'desktop'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_company_id
  ON public.push_subscriptions (company_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_last_seen
  ON public.push_subscriptions (user_id, last_seen_at DESC);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own"
  ON public.push_subscriptions
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND company_id IN (
      SELECT up.company_id
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
    )
  );

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND company_id IN (
      SELECT up.company_id
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
    )
  );

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own"
  ON public.push_subscriptions
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND company_id IN (
      SELECT up.company_id
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND company_id IN (
      SELECT up.company_id
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
    )
  );

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own"
  ON public.push_subscriptions
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND company_id IN (
      SELECT up.company_id
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

COMMENT ON TABLE public.push_subscriptions IS
  'Web Push endpoint subscriptions per user/device (PWA). Own-row RLS; service_role bypasses for push-dispatch.';

-- ---------------------------------------------------------------------------
-- user_notification_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  agenda boolean NOT NULL DEFAULT true,
  pipeline boolean NOT NULL DEFAULT true,
  chat_human boolean NOT NULL DEFAULT true,
  connections boolean NOT NULL DEFAULT true,
  system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_company_id
  ON public.user_notification_preferences (company_id);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_notification_preferences_select_own" ON public.user_notification_preferences;
CREATE POLICY "user_notification_preferences_select_own"
  ON public.user_notification_preferences
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND company_id IN (
      SELECT up.company_id
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
    )
  );

DROP POLICY IF EXISTS "user_notification_preferences_insert_own" ON public.user_notification_preferences;
CREATE POLICY "user_notification_preferences_insert_own"
  ON public.user_notification_preferences
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND company_id IN (
      SELECT up.company_id
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
    )
  );

DROP POLICY IF EXISTS "user_notification_preferences_update_own" ON public.user_notification_preferences;
CREATE POLICY "user_notification_preferences_update_own"
  ON public.user_notification_preferences
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND company_id IN (
      SELECT up.company_id
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND company_id IN (
      SELECT up.company_id
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
    )
  );

-- No DELETE policy: row is per-user; soft-disable via push_enabled / category toggles.

GRANT SELECT, INSERT, UPDATE ON public.user_notification_preferences TO authenticated;

COMMENT ON TABLE public.user_notification_preferences IS
  'Per-user push category toggles (master push_enabled + agenda/pipeline/chat_human/connections/system).';

-- Upsert defaults on first access (does not overwrite existing prefs)
CREATE OR REPLACE FUNCTION public.ensure_user_notification_preferences()
RETURNS public.user_notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cid uuid;
  result public.user_notification_preferences;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT up.company_id
  INTO cid
  FROM public.user_profiles up
  WHERE up.id = uid
    AND up.is_active = true;

  IF cid IS NULL THEN
    RAISE EXCEPTION 'user profile not found or inactive';
  END IF;

  INSERT INTO public.user_notification_preferences (user_id, company_id)
  VALUES (uid, cid)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO result
  FROM public.user_notification_preferences
  WHERE user_id = uid;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_notification_preferences() TO authenticated;

COMMENT ON FUNCTION public.ensure_user_notification_preferences() IS
  'Creates user_notification_preferences with defaults for auth.uid() if missing; returns the row.';

-- Keep updated_at fresh on preference changes
CREATE OR REPLACE FUNCTION public.touch_user_notification_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_notification_preferences_updated_at
  ON public.user_notification_preferences;
CREATE TRIGGER trg_user_notification_preferences_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_user_notification_preferences_updated_at();

-- ---------------------------------------------------------------------------
-- Extend user_notifications.type CHECK
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_type_check;

ALTER TABLE public.user_notifications
  ADD CONSTRAINT user_notifications_type_check CHECK (
    type = ANY (ARRAY[
      'lead_stage_changed'::text,
      'appointment'::text,
      'connection_request'::text,
      'connection_approved'::text,
      'connection_rejected'::text,
      'general'::text,
      'chat_human_reply'::text,
      'chat_human_requested'::text,
      'agenda_reminder'::text
    ])
  );

COMMENT ON TABLE public.user_notifications IS
  'In-app notifications per user (pipeline, appointments, connections, chat human, agenda reminders). Outbox for Web Push fan-out.';
