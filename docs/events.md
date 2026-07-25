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
