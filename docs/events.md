# Events catalog (n8n / edge / integrations)

Versioned catalog of domain events emitted by the platform.

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
| **When** | User clicks **Gerar resumo** in conversation actions menu |
| **URL** | `…/webhook/resumo_conversa` |

### Body

| Field | Type | Notes |
|-------|------|--------|
| `session_id` | string | Phone / conversation key |
| `instancia` | string | WhatsApp/IG instance |
| `company_id` | string (uuid) | Tenant company id |
| `user_email` | string | Actor email |
| `role` | string | Actor role |
| `plataforma` | string | `WhatsApp` ou `Instagram` |
| `rota` | string | `whatsapp` ou `instagram` (canal da UI) |

---

## conversation.follow_up.request

| Field | Value |
|-------|--------|
| **Name** | `conversation.follow_up.request` |
| **Channel** | n8n webhook `follow-up-chats` |
| **When** | User clicks **Fazer follow up** in conversation actions menu |
| **URL** | `…/webhook/follow-up-chats` |

### Body

| Field | Type | Notes |
|-------|------|--------|
| `session_id` | string | Phone / conversation key |
| `instancia` | string | WhatsApp/IG instance |
| `company_id` | string (uuid) | Tenant company id |
| `user_email` | string | Actor email |
| `role` | string | Actor role |
| `plataforma` | string | `WhatsApp` ou `Instagram` |
| `rota` | string | `whatsapp` ou `instagram` (canal da UI) |

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
| `set_label` | Upsert em `conversation_contact_labels`; `status` deve existir em `company_ai_labels.slug` da empresa |
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
