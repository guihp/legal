# Database schema notes (incremental)

Documentação parcial das tabelas adicionadas/alteradas por migrations recentes. Não substitui o dump completo em `supabase/migrations/`.

## Storage bucket `avatars` (20260810170000)

| Campo | Valor |
|-------|--------|
| `id` / `name` | `avatars` |
| `public` | `true` |
| `file_size_limit` | 2MB |
| MIME | jpeg/jpg/png/webp/gif |

Path: `{user_id}/{timestamp}.{ext}` (front: `UserProfileView`).

Policies em `storage.objects`:
- `avatars_public_read` — SELECT anon + authenticated
- `avatars_owner_insert/update/delete` — authenticated, pasta `(storage.foldername(name))[1] = auth.uid()::text`

Outros buckets: `company-assets` (site/chat), `property-images`.

## `push_subscriptions` (20260810150000)

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK → `user_profiles` | CASCADE |
| `company_id` | uuid FK → `companies` | CASCADE |
| `endpoint` | text UNIQUE | Web Push endpoint |
| `p256dh` | text | client public key |
| `auth` | text | auth secret |
| `user_agent` | text nullable | |
| `platform` | text | CHECK `ios` \| `android` \| `desktop` |
| `created_at` | timestamptz | default `now()` |
| `last_seen_at` | timestamptz | default `now()` |

Índices: `user_id`, `company_id`, `(user_id, last_seen_at DESC)`.

RLS: CRUD apenas `user_id = auth.uid()` com `company_id` ∈ perfil ativo.

## `user_notification_preferences` (20260810150000)

| Coluna | Tipo | Default |
|--------|------|---------|
| `user_id` | uuid PK FK → `user_profiles` | — |
| `company_id` | uuid FK → `companies` | — |
| `push_enabled` | boolean | `true` |
| `agenda` | boolean | `true` |
| `pipeline` | boolean | `true` |
| `chat_human` | boolean | `true` |
| `connections` | boolean | `true` |
| `system` | boolean | `true` |
| `created_at` / `updated_at` | timestamptz | `now()` (`updated_at` via trigger) |

RLS: SELECT/INSERT/UPDATE own-row + company scope. Helper: `ensure_user_notification_preferences()`.

## `user_notifications.type` (estendido em 20260810150000)

Tipos existentes + `chat_human_reply`, `chat_human_requested`, `agenda_reminder`.

## Push fan-out trigger (20260810160000)

- RPC `enqueue_push_for_notification(uuid)` → `extensions.net.http_post` → Edge `push-dispatch`.
- Trigger `trg_user_notifications_enqueue_push` **AFTER INSERT** on `user_notifications` (best-effort; errors viram WARNING, não falham o INSERT).
- Vault: `supabase_anon_key` (obrigatório para o POST); opcional `push_dispatch_secret`.
- Alternativa Dashboard: Database Webhook INSERT → mesmo endpoint.
- Ops/secrets: `supabase/functions/push-dispatch/ENVIRONMENT.md`. Catálogo: `docs/events.md` → `push.fanout`.
