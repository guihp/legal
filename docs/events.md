# Events catalog (n8n / edge / integrations)

Versioned catalog of domain events emitted by the platform.

---

## in_app.lead_stage_changed

| Field | Value |
|-------|--------|
| **Name** | `in_app.lead_stage_changed` |
| **Channel** | In-app (`user_notifications`) |
| **When** | `leads.stage` changes (Kanban/pipeline move), except when transitioning *into* visit-scheduled (that emits `appointment`) |
| **Recipients** | Assigned broker (`id_corretor_responsavel` or `user_id`) + active `gestor`/`admin` of the company |
| **Emitter** | DB trigger `trg_notify_lead_stage_change` on `public.leads` |

### Payload (`meta` jsonb)

- `lead_id`, `lead_name`
- `from_stage` / `to_stage` (+ `*_label` PT)
- `route`: `/clients` (pipeline Kanban; `lead_id` in meta for deep context)

---

## in_app.appointment

| Field | Value |
|-------|--------|
| **Name** | `in_app.appointment` |
| **Channel** | In-app (`user_notifications`) |
| **When** | Lead stage changes **to** visita agendada (`visita-agendada` / `Visita Agendada`), including `schedule-api` `book_visit` and CRM Kanban; **also** CRM Agenda `google-calendar-api` `create_event` when a broker calendar is matched (no stage change) |
| **Recipients** | Same as stage-changed |
| **Emitter** | DB trigger (typed as `appointment` when entering visit stage); Edge `google-calendar-api` `create_event` via `_shared/userNotifications.notifyAppointmentBooked` |
| **Note** | Pipeline stages (order): Novo Lead → Qualificado → Visita Agendada → **Visita Realizada** (`visita-realizada`) → Visita Cancelada → Em Negociação → Documentação → Contrato → Fechamento. Moving to `visita-realizada` emits `lead_stage_changed`, not `appointment`. |
| **Copy** | Title `Visita Agendada`. Body `Visita agendada Para "{lead}" Corretor responsável "{corretor}"`. iOS may still show OS subtitle "from {manifest name}" (not suppressible via Web Notification options). |

### Payload (`meta` jsonb)

- Same as stage-changed when from trigger; CRM create_event adds `event_id`
- `route`: `/agenda`
- Appointment also includes `lead_name`, `broker_id`, `broker_name`

---

## in_app.chat_human_reply

| Field | Value |
|-------|--------|
| **Name** | `in_app.chat_human_reply` |
| **Channel** | In-app (`user_notifications`) — outbox for Web Push |
| **When** | Client inbound message (`type` lead/cliente/…) while session has attendance label `humano` or `humano_solicitado` |
| **Recipients** | Lead broker (`id_corretor_responsavel` or `user_id`) + active `gestor`/`admin` |
| **Emitter** | Edge `mensagem-ingest` / `mensagem-media-ingest` via `_shared/userNotifications.notifyChatHumanReply` |
| **Dedupe** | Skip if `meta.mensagem_id` already notified for the company |

### Payload (`meta` jsonb)

- `route`: `/conversas`
- `session_id`, `channel` (`whatsapp` \| `instagram`)
- `lead_id`, `lead_name`, `mensagem_id` (optional)

---

## in_app.chat_human_requested

| Field | Value |
|-------|--------|
| **Name** | `in_app.chat_human_requested` |
| **Channel** | In-app (`user_notifications`) |
| **When** | `conversation-label-api` `set_label` applies status `humano_solicitado` (first time for that session) |
| **Recipients** | Same as chat_human_reply |
| **Emitter** | Edge `conversation-label-api` via `_shared/userNotifications.notifyChatHumanRequested` |

### Payload (`meta` jsonb)

- `route`: `/conversas`
- `session_id`, `channel`, `lead_id`, `lead_name`

---

## in_app.agenda_reminder

| Field | Value |
|-------|--------|
| **Name** | `in_app.agenda_reminder` |
| **Channel** | In-app (`user_notifications`) |
| **When** | `visit-reminder-dispatch` successfully sends a pending reminder job (1 day / 3 hours) to n8n |
| **Recipients** | Broker from job payload + active `gestor`/`admin` |
| **Emitter** | Edge `visit-reminder-dispatch` via `_shared/userNotifications.notifyAgendaReminder` |
| **Dedupe** | Skip if `meta.job_id` already notified |

### Payload (`meta` jsonb)

- `route`: `/agenda`
- `lead_id`, `event_id`, `job_id`, `reminder_type`, `lead_name`

---

## push.fanout (Web Push)

| Field | Value |
|-------|--------|
| **Name** | `push.fanout` |
| **Channel** | Web Push (PWA) via Edge `push-dispatch` |
| **When** | `AFTER INSERT` on `user_notifications` (any type) |
| **Emitter** | SQL trigger `trg_user_notifications_enqueue_push` → RPC `enqueue_push_for_notification` → `pg_net` → `POST /functions/v1/push-dispatch` |
| **Alt** | Dashboard Database Webhook on `user_notifications` INSERT (same payload shapes accepted) |
| **Gate** | `user_notification_preferences`: `push_enabled` + category (`pipeline` / `agenda` / `chat_human` / `connections` / `system`) |
| **Targets** | Rows in `push_subscriptions` for `user_id`; stale endpoints (404/410) deleted |

### Type → preference category

| `user_notifications.type` | Pref column |
|---------------------------|-------------|
| `lead_stage_changed` | `pipeline` |
| `appointment`, `agenda_reminder` | `agenda` |
| `chat_human_reply`, `chat_human_requested` | `chat_human` |
| `connection_request`, `connection_approved`, `connection_rejected` | `connections` |
| `general` (+ unknown) | `system` |

### Edge payload

```json
{ "notification_id": "<uuid>" }
```

Also accepts `{ "notification_ids": ["…"] }` or Supabase webhook `{ "record": { "id": "…" } }`.

### Secrets (Edge Functions Dashboard)

| Secret | Notes |
|--------|--------|
| `VAPID_PUBLIC_KEY` | Classic base64url (same as `VITE_VAPID_PUBLIC_KEY`) |
| `VAPID_PRIVATE_KEY` | Classic base64url **or** JSON JWK / exported `@negrel/webpush` keys |
| `VAPID_SUBJECT` | `mailto:ops@…` |
| `PUSH_DISPATCH_SECRET` | Optional; if set, require `x-push-secret` (vault `push_dispatch_secret`) |

Vault for trigger: `supabase_anon_key` (required for `pg_net`); optional `push_dispatch_secret`.

---

## visit.booked.email_broker

| Field | Value |
|-------|--------|
| **Name** | `visit.booked.email_broker` |
| **Channel** | Resend (transactional email) |
| **When** | Immediate alert when a visit is booked **with a broker assigned**, or when a broker is later assigned |
| **Recipient** | `user_profiles.email` of the responsible broker |
| **Not emitted when** | `book_visit` in manual mode (`broker_pending_assignment` / `assignBrokerLater`) — waits for `assign_visit_broker` |

### Emitters

1. **`schedule-api` / `book_visit`** — only if a broker was assigned (`assignBrokerLater = false`)
2. **`schedule-api` / `assign_visit_broker`** — after CRM assigns broker in manual mode
3. **`google-calendar-api` / `create_event`** — CRM Agenda path, when `calendar_id` maps to an `oncall_schedules.assigned_user_id`

### Payload (email HTML)

- Client name
- Client phone (when available)
- Visit datetime (America/Sao_Paulo)
- Property label / address (when available)
- Optional app link (`PUBLIC_APP_URL`)

### Behavior

- **Best-effort:** failures or missing Resend config never fail booking/calendar flows
- No-op (logged) when `RESEND_ENABLED≠true`, missing `RESEND_API_KEY`, or broker has no email

### Secrets (Supabase Edge Functions Dashboard)

Must be set for the project (cannot be set by deploy scripts alone):

| Secret | Example / notes |
|--------|------------------|
| `RESEND_ENABLED` | `true` |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Verified domain sender, e.g. `onboarding@iafeimobi.com.br` |
| `RESEND_API_BASE_URL` | Optional; default `https://api.resend.com` |
| `PUBLIC_APP_URL` | Optional; default `https://app.iafeimobi.com.br` |

### Related (unchanged)

WhatsApp visit reminders (1 day / 3 hours) via n8n remain separate (`visit_reminder_jobs` / `visit-reminder-dispatch`).

---

## conversation.summary.request

| Field | Value |
|-------|--------|
| **Name** | `conversation.summary.request` |
| **Channel** | n8n webhook `resumo_conversa` |
| **When** | User clicks **Gerar resumo** in conversation actions menu **or** in **LeadViewModal** (seção Contato) |
| **URL** | `…/webhook/resumo_conversa` |

### Body

| Field | Type | Notes |
|-------|------|--------|
| `session_id` | string | Phone / conversation key (IG: `leads.id`) |
| `instancia` | string | WhatsApp/IG instance |
| `company_id` | string (uuid) | Tenant company id |
| `user_email` | string | Actor email |
| `role` | string | Actor role |
| `plataforma` | string | `WhatsApp` ou `Instagram` |
| `rota` | string | `whatsapp` ou `instagram` (canal da UI) |
| `lead_id` | string (uuid) | Opcional — enviado pelo LeadViewModal |
| `phone` | string | Opcional — telefone do lead |
| `email` | string | Opcional — e-mail do lead |
| `name` | string | Opcional — nome do lead |

### Response (n8n — formas comuns)

| Shape | Notes |
|-------|--------|
| `{ resumo_conversa: string }` | Principal (SummaryModalAnimated) |
| `{ resumo }` / `{ summary }` / `{ message }` | Alternativas |
| `[{ output: string \| object }]` | Array n8n com JSON em `output` |
| `{ data: { resumo } }` | Wrapper aninhado |
| plain text | Fallback |

Persistência (LeadViewModal): `leads.conversation_summary` (text).

---

## conversation.follow_up.request

| Field | Value |
|-------|--------|
| **Name** | `conversation.follow_up.request` |
| **Channel** | n8n webhook `follow-up-chats` |
| **When** | (1) User clicks **Fazer follow up** (manual); (2) Edge `follow-up-dispatch` when a timed job fires (auto) |
| **URL** | `…/webhook/follow-up-chats` |
| **Related tables** | `company_follow_up_settings`, `company_follow_up_schedules`, `conversation_follow_up_jobs` |
| **Stage gate** | Only when linked lead `leads.stage` is **Novo Lead** or **Qualificado** (slug `novo-lead` / `qualificado`; accents/case ignored). Else: RPC does not schedule; dispatch cancels with `last_error=stage_not_allowed`; manual UI toasts and blocks webhook. Stage leave → trigger cancels pending jobs. |
| **Sequence** | Cycle start queues **only the first** enabled schedule (lowest `delay_minutes`). Next step is created via `enqueue_next_follow_up_job` **only after** previous job is `sent` (webhook OK). Client reply still cancels all pending. |
| **Quiet hours** | Global window **07:00–21:00** `America/Sao_Paulo`. Outside window: dispatch **defers** (`trigger_at` → next open via `clamp_to_follow_up_window`, `last_error=deferred_quiet_hours`) — does **not** cancel or call n8n. Jobs also get `cycle_anchor_at` at cycle start. |
| **Cron** | **Live (pg_cron + pg_net):** job `follow-up-dispatch` a cada 1 min → `POST /functions/v1/follow-up-dispatch`. Vault `supabase_anon_key`. Opcional: `x-cron-secret` (= `FOLLOW_UP_CRON_SECRET` ou `VISIT_REMINDER_CRON_SECRET`) quando o secret estiver setado na Edge |

### Body

| Field | Type | Notes |
|-------|------|--------|
| `session_id` | string | Phone / conversation key |
| `instancia` | string | WhatsApp/IG instance |
| `company_id` | string (uuid) | Tenant company id |
| `user_email` | string | Actor email (`system@follow-up-dispatch` no auto) |
| `role` | string | Actor role (`system` no auto) |
| `plataforma` | string | `WhatsApp` ou `Instagram` |
| `rota` | string | `whatsapp` ou `instagram` (canal da UI) |
| `source` | string | **`manual`** (menu) ou **`auto`** (dispatch) |
| `delay_minutes` | number | (auto) atraso do horário que disparou |
| `label_slug` | string | (auto) slug sugerido no payload (`follow_up_15m`, …); **etiqueta no chat é aplicada pelo n8n/API do cliente** (não pelo dispatch, para não sobrescrever `ai_ativa`) |
| **Client reply** | — | Ingest chama `handle_client_reply_follow_up`: cancela pending (`last_error=client_replied`), grava `recovered_at` nos jobs `sent`, e **remove** labels `follow_up` / `follow_up_*` da sessão. Histórico no painel do lead (Conversas). |
| **Sequence guard** | — | Após `sent` + `enqueue_next`, se o ingest da resposta IA **não** mandar `from_follow_up`, o `start_or_refresh` **não** reinicia no 1º step (evita loop de 7m). n8n ainda deve enviar `from_follow_up: true`. |
| `ai_description` | string | (auto) orientação configurada no horário — **n8n deve usar como prompt/contexto da IA** |
| `cycle_id` | string (uuid) | (auto) ciclo de silêncio |
| `schedule_id` | string (uuid) | (auto) id do schedule |
| `job_id` | string (uuid) | (auto) id do job |

### Notas para integradores n8n

1. Ler `source` / `ai_description` / `label_slug` / `delay_minutes` no workflow `follow-up-chats`.
2. No auto-disparo, ao gravar a resposta da IA via `mensagem-ingest` / `mensagem-media-ingest`, enviar `from_follow_up: true` (ou `source: auto`) para **não** reiniciar o ciclo de jobs. Mensagens IA **só de mídia** (image/audio/video/document/sticker) também **não** reiniciam o timer de silêncio — só texto/conversation.
3. Manual: o painel aplica etiqueta `follow_up` e cancela jobs `pending` da sessão após o webhook.
4. Stage gate (Novo Lead / Qualificado): se o lead saiu dessas colunas, jobs são cancelados (`stage_not_allowed`) e o webhook **não** deve ser esperado; n8n não precisa tratar o gate — o painel/dispatch já bloqueiam.
5. Sequência + quiet hours: n8n recebe **um** disparo por vez; o próximo horário só é enfileirado após `sent`. Fora de 07–21 BRT o cron **adia** (sem POST).

---

## conversation.label.set

| Field | Value |
|-------|--------|
| **Name** | `conversation.label.set` |
| **Channel** | Edge Function `conversation-label-api` |
| **When** | n8n / automação aplica etiqueta de contato, ou UI de Conversas (upsert direto na tabela) |
| **Auth** | JWT do usuário **ou** `Authorization: Bearer <service_role>` **ou** header `x-n8n-secret` (= `N8N_INTERNAL_API_KEY`) |

### Actions

| `action` | Descrição |
|----------|-----------|
| `set_label` | Upsert aditivo em `conversation_contact_labels` (unique por session+status). Tags (`follow_up_*`, custom) **não** removem `ai_ativa`. Modos `ai_ativa`/`humano`/`humano_solicitado` são exclusivos entre si. Ao aplicar `humano_solicitado` (primeira vez), emite `in_app.chat_human_requested`. |
| `get_labels` | Lista `{ session_id, status }` por canal + `session_ids[]` |
| `list_catalog` | Lista catálogo `company_ai_labels` da empresa |
| `upsert_catalog` | Cria/edita etiqueta (gestor/admin/service_role); system: não altera slug/`is_system` |
| `delete_catalog` | Remove etiqueta custom (`id` ou `slug`); system bloqueado |

### Body — `set_label`

| Field | Type | Notes |
|-------|------|--------|
| `action` | string | `set_label` |
| `company_id` | uuid | Obrigatório em auth interna / service_role |
| `channel` | string | `whatsapp` \| `instagram` |
| `session_id` | string | Chave da conversa |
| `status` | string | Slug do catálogo (ex.: `ai_ativa`, `humano`, `visita_agendada`) |

### Body — `upsert_catalog`

| Field | Type | Notes |
|-------|------|--------|
| `action` | string | `upsert_catalog` |
| `company_id` | uuid | Auth interna |
| `id` | uuid | Opcional; se omitido, cria |
| `name` | string | Nome de exibição |
| `slug` | string | snake_case; auto a partir do nome se omitido |
| `color` | string | `emerald` \| `amber` \| `orange` \| `sky` \| `violet` \| `rose` \| `slate` |
| `sort_order` | number | Opcional |

### System labels (seed por empresa)

`ai_ativa` (emerald), `humano` (amber), `humano_solicitado` (orange) — não deletáveis.
