# push-dispatch — secrets & ops

## Edge secrets (Dashboard → Edge Functions → Secrets)

```bash
# Classic pair (recommended — same public key as Vite):
npx web-push generate-vapid-keys

supabase secrets set VAPID_PUBLIC_KEY='B…'
supabase secrets set VAPID_PRIVATE_KEY='…'   # base64url OR JSON JWK / @negrel export
supabase secrets set VAPID_SUBJECT='mailto:ops@iafeimobi.com.br'

# Optional: require x-push-secret on every call
supabase secrets set PUSH_DISPATCH_SECRET='…'
```

Front (later UI): `VITE_VAPID_PUBLIC_KEY` must equal `VAPID_PUBLIC_KEY`.

## Vault (for pg_net trigger)

Same as follow-up cron:

```sql
-- Once (ops / SQL editor) — do not commit real values
SELECT vault.create_secret('<ANON_KEY>', 'supabase_anon_key', 'Anon key for pg_net HTTP');
-- Optional, if PUSH_DISPATCH_SECRET is set on the Edge:
SELECT vault.create_secret('<SECRET>', 'push_dispatch_secret', 'x-push-secret for push-dispatch');
```

## Deploy

```bash
supabase functions deploy push-dispatch
# Then apply migration 20260810160000_push_dispatch_trigger_pg_net.sql
```

## Manual test

```bash
curl -X POST "$SUPABASE_URL/functions/v1/push-dispatch" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"notification_id":"<uuid>"}'
```

Or: `SELECT public.enqueue_push_for_notification('<uuid>');`
