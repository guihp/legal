-- Schedule follow-up-dispatch every minute via pg_cron → pg_net.
-- Auth: edge accepts open calls unless FOLLOW_UP_CRON_SECRET / VISIT_REMINDER_CRON_SECRET is set.
-- Ops: ensure vault secret `supabase_anon_key` exists (anon JWT). Optional: `follow_up_cron_secret`
-- and add header x-cron-secret once the Edge Function secret is configured.
--
-- Applied remotely via MCP on project bfcssdogttmqeujgmxdf (2026-07-31).
-- Do NOT commit real anon keys here — create/update vault secrets in Dashboard or SQL ops.

-- Example (run once in SQL editor / ops, not as committed secret):
--   SELECT vault.create_secret('<ANON_KEY>', 'supabase_anon_key', 'Anon key for pg_cron HTTP');
-- Optional cron secret:
--   SELECT vault.create_secret('<SECRET>', 'follow_up_cron_secret', 'x-cron-secret for follow-up-dispatch');

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'follow-up-dispatch';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'follow-up-dispatch',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfcssdogttmqeujgmxdf.supabase.co/functions/v1/follow-up-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1),
      'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1)
      -- When Edge FOLLOW_UP_CRON_SECRET is set, also add:
      -- ,'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'follow_up_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);
