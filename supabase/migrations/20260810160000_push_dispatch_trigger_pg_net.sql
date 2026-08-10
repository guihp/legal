-- Fase 3: AFTER INSERT on user_notifications → Edge push-dispatch via pg_net.
-- Requires: extensions.pg_net (enabled in 20260731155808), vault secret `supabase_anon_key`
-- (same as follow-up-dispatch cron). Optional: vault `push_dispatch_secret` + Edge PUSH_DISPATCH_SECRET.
--
-- Do NOT commit real keys. Ops (SQL editor once):
--   SELECT vault.create_secret('<ANON_KEY>', 'supabase_anon_key', 'Anon key for pg_net HTTP');
-- Optional:
--   SELECT vault.create_secret('<SECRET>', 'push_dispatch_secret', 'x-push-secret for push-dispatch');
--
-- Alternative (Dashboard): Database Webhook on public.user_notifications INSERT →
--   POST https://bfcssdogttmqeujgmxdf.supabase.co/functions/v1/push-dispatch
--   Body: { "record": { "id": ... } }  (Supabase webhook shape is accepted)
--
-- Migration is local-only until applied; prefer reviewing before MCP apply_migration.

-- ---------------------------------------------------------------------------
-- Helper RPC: enqueue HTTP call to push-dispatch for one notification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_push_for_notification(p_notification_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_request_id bigint;
  v_anon text;
  v_push_secret text;
  v_headers jsonb;
  v_url text := 'https://bfcssdogttmqeujgmxdf.supabase.co/functions/v1/push-dispatch';
BEGIN
  IF p_notification_id IS NULL THEN
    RAISE EXCEPTION 'p_notification_id required';
  END IF;

  SELECT decrypted_secret
  INTO v_anon
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_anon_key'
  LIMIT 1;

  IF v_anon IS NULL OR length(trim(v_anon)) = 0 THEN
    RAISE WARNING 'enqueue_push_for_notification: vault secret supabase_anon_key missing — skip push';
    RETURN NULL;
  END IF;

  SELECT decrypted_secret
  INTO v_push_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_dispatch_secret'
  LIMIT 1;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_anon,
    'apikey', v_anon
  );

  IF v_push_secret IS NOT NULL AND length(trim(v_push_secret)) > 0 THEN
    v_headers := v_headers || jsonb_build_object('x-push-secret', v_push_secret);
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := v_headers,
    body := jsonb_build_object('notification_id', p_notification_id),
    timeout_milliseconds := 15000
  )
  INTO v_request_id;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.enqueue_push_for_notification(uuid) IS
  'Fan-out Web Push: pg_net POST to Edge push-dispatch for a user_notifications id. Uses vault supabase_anon_key (+ optional push_dispatch_secret).';

-- service_role / triggers; authenticated callers that insert notifications may also enqueue.
GRANT EXECUTE ON FUNCTION public.enqueue_push_for_notification(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_push_for_notification(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: AFTER INSERT user_notifications
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_user_notifications_enqueue_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Best-effort: never fail the inbox INSERT if push enqueue errors.
  BEGIN
    PERFORM public.enqueue_push_for_notification(NEW.id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'trg_user_notifications_enqueue_push: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_notifications_enqueue_push ON public.user_notifications;
CREATE TRIGGER trg_user_notifications_enqueue_push
  AFTER INSERT ON public.user_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_user_notifications_enqueue_push();

COMMENT ON FUNCTION public.trg_user_notifications_enqueue_push() IS
  'AFTER INSERT user_notifications → enqueue_push_for_notification (pg_net → Edge push-dispatch).';
