# Progress Log — IAFÉ IMOBI

## 2026-08-10 — Fix upload avatar (bucket `avatars`)

### Root cause
`UserProfileView` faz upload em `supabase.storage.from('avatars')` com path `{user_id}/…`. No projeto remote só existiam `company-assets` e `property-images` → erro `Bucket not found` mapeado para "Bucket de avatars não configurado…".

### Fix
- Migration `20260810170000_storage_avatars_bucket_policies.sql`: cria bucket público `avatars` (2MB, MIME imagem) + policies public read / owner write na pasta `auth.uid()`.
- Aplicada no remote via Supabase MCP `user-imobi`.
- Front já alinhado (hardcode `avatars`); sem mudança de código.

### Próximos passos
- Smoke manual: Perfil → upload foto ≤2MB → URL pública em `avatar_url`.

## 2026-08-10 — PWA Push Fase 6: docs + deploy notes (SUMÁRIO)

### SUMÁRIO — PWA + Web Push (fases 1–6)

| Fase | Entrega |
|------|---------|
| 1 | PWA shell: `vite-plugin-pwa`, `sw.ts`, manifest, ícones, `.htaccess`, `versionChecker`, `usePwaInstall` |
| 2 | Schema: `push_subscriptions`, `user_notification_preferences`, novos `user_notifications.type` |
| 3 | Edge `push-dispatch` + trigger `pg_net` `AFTER INSERT` → fan-out VAPID |
| 4 | Emissores: `chat_human_reply` / `chat_human_requested` / `agenda_reminder` (+ appointment CRM) |
| 5 | UI Configurações → Aplicativo + espelho `/profile` (install + prefs + subscribe) |
| 6 | Docs (`events.md`, schema, hierarquia) + checklist QA/ops Hostinger |

### CI / Hostinger (PWA artifacts)

- GitHub Actions [`.github/workflows/ci.yml`](.github/workflows/ci.yml): `pnpm build` only — **não** há job SFTP Hostinger neste repo.
- `vite build` (`injectManifest`) emite em `dist/`: `sw.js` (Workbox **inline** no SW — sem `workbox-*.js` na raiz), `manifest.webmanifest`, `.htaccess` (de `public/`), ícones `pwa-*.png`; client usa `assets/workbox-window.prod.es5-*.js`.
- Deploy Hostinger (manual ou pipeline externo): enviar **todo** o `dist/` — não filtrar só `assets/`. `.htaccess` já protege `sw.js` / manifest / `workbox-*` de rewrite SPA.
- Workflow OK para PWA — sem mudança no CI. Build verificado (`npm run build`) nesta fase.

### QA checklist (manual)

- [ ] **Android Chrome:** instalar PWA → Ativar notificações → receber push de teste → click abre `meta.route` (ex. `/conversas`, `/agenda`, `/clients`).
- [ ] **iOS Safari ≥ 16.4:** Adicionar à Tela de Início → abrir pelo ícone (standalone) → Ativar notificações → receber push → click abre rota.
- [ ] **Prefs off:** `push_enabled=false` ou categoria off → INSERT em `user_notifications` **não** envia push (inbox in-app ainda aparece).
- [ ] **Stale sub:** endpoint 404/410 removido de `push_subscriptions` após dispatch.

### Ops restantes (humano — ainda não feitos no remote)

1. Aplicar migrations `20260810150000_…` e `20260810160000_…` no projeto Supabase.
2. Gerar VAPID: `npx web-push generate-vapid-keys`.
3. Edge secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (+ opcional `PUSH_DISPATCH_SECRET`).
4. Deploy: `supabase functions deploy push-dispatch` (e edges emissores se ainda não).
5. Front: `VITE_VAPID_PUBLIC_KEY` (= public key) no `.env` / Hostinger build env; rebuild + upload `dist/`.
6. Vault SQL: `supabase_anon_key` (obrigatório p/ `pg_net`); opcional `push_dispatch_secret`.
7. Smoke: `SELECT enqueue_push_for_notification('<uuid>');` ou curl documentado em `supabase/functions/push-dispatch/ENVIRONMENT.md`.

Refs: `docs/events.md` (`in_app.*` + `push.fanout`), `@docs/database-schema.md`, `@docs/hierarquia-usuarios.md`, `ENVIRONMENT.md`.

## 2026-08-10 — PWA Push Fase 5: UI Configurações → Aplicativo

- Nova seção **Aplicativo** (`?section=aplicativo`) em Configurações: Baixar o App (Android `beforeinstallprompt` / iOS A2HS) + Notificações pessoais.
- Hooks `usePushNotifications` (subscribe/list/remove + VAPID) e `useNotificationPreferences` (RPC `ensure_user_notification_preferences` + toggles).
- Componente compartilhado `PersonalAppSettings` também espelhado em `/profile` para quem não tem menu Configurações.
- Prefs pessoais (master + agenda/pipeline/chat_human/connections/system) salvam na hora — todos os roles; independente das Preferências da empresa (gestor).

## 2026-08-10 — PWA Push Fase 4: emissores `user_notifications`

- Shared helper `supabase/functions/_shared/userNotifications.ts`: recipients (corretor + gestores/admins), insert + dedupe, chat/agenda/appointment emitters.
- **chat_human_reply:** `mensagem-ingest` + `mensagem-media-ingest` quando inbound do cliente e label `humano` / `humano_solicitado` → inbox com `meta.route=/conversas`.
- **chat_human_requested:** `conversation-label-api` `set_label` → `humano_solicitado` (primeira vez).
- **agenda_reminder:** `visit-reminder-dispatch` após webhook n8n OK; `meta.route=/agenda`.
- **appointment (CRM):** `google-calendar-api` `create_event` quando há corretor no calendário (book_visit já cobre via trigger de stage).
- **pipeline:** trigger `notify_on_lead_stage_change` já emite `meta.route=/clients` (pipeline) + `lead_id` — sem alteração SQL.
- Docs: `docs/events.md` (`in_app.chat_human_*`, `in_app.agenda_reminder`); fallback de rota no `DashboardHeader`.
- Sem UI Config nesta fase. Sem commit.

## 2026-08-10 — PWA Push Fase 3: Edge push-dispatch + trigger pg_net

- Edge `supabase/functions/push-dispatch`: carrega `user_notifications`, aplica `user_notification_preferences` (master + categoria), envia Web Push (VAPID via `@negrel/webpush`), remove subs 404/410.
- Mapa de tipos → prefs: `lead_stage_changed`→pipeline; `appointment`/`agenda_reminder`→agenda; `chat_human_*`→chat_human; `connection_*`→connections; `general`→system.
- Migration `20260810160000_push_dispatch_trigger_pg_net`: `AFTER INSERT` em `user_notifications` → RPC `enqueue_push_for_notification(uuid)` → `pg_net.http_post` na Edge (vault `supabase_anon_key`; opcional `push_dispatch_secret`).
- Secrets documentados: `VAPID_*` (Edge) + `VITE_VAPID_PUBLIC_KEY` (`.env.example`). Migrations **não aplicadas** no remote nesta entrega.
- Próximo: Fase 5 (UI Configurações / subscribe) + emissores Fase 4 se faltarem.

## 2026-08-10 — PWA shell (Fase 1): app instalável

- `vite-plugin-pwa` (injectManifest) + `src/sw.ts`: precache Workbox, `navigateFallback` SPA, stubs `push` + `notificationclick` (`meta.route` ou `/`).
- Manifest **IAFÉ Imobi** (`standalone`, `start_url: /`, theme `#0a0a0a`), ícones 192/512 em `public/`, links em `index.html`.
- `public/.htaccess`: MIME de `.webmanifest`/SW; paths `sw.js` / workbox / manifest **não** reescritos para `index.html`.
- `versionChecker` alinhado ao Workbox: sem limpar caches nem reload automático; toast “Nova versão” + `skipWaiting` via `virtual:pwa-register`.
- Hook `usePwaInstall` (`beforeinstallprompt` + detecção iOS Safari / A2HS). UI Configurações e push real ficam nas fases seguintes.

## 2026-08-10 — PWA Push Fase 2: schema subscriptions + preferências

- Migration `20260810150000_push_subscriptions_and_notification_preferences`: tabelas `push_subscriptions` e `user_notification_preferences` com RLS own-row + company scope via `user_profiles`.
- Helper `ensure_user_notification_preferences()` cria defaults (todos `true`) no primeiro acesso sem sobrescrever prefs existentes.
- CHECK de `user_notifications.type` estendido com `chat_human_reply`, `chat_human_requested`, `agenda_reminder`.
- Stubs TS: `src/lib/push/` (types + mapper snake↔camel). Sem Edge push-dispatch / PWA UI nesta fase.
- Migration **não aplicada** no remote (arquivo local only).

## 2026-08-05 — Android: reload cancelava a seleção de arquivo

- **Causa:** abrir o seletor de arquivos no Android deixa a página `hidden`; ao voltar, o `visibilitychange` do `versionChecker` rodava `checkForUpdate()` e um hash novo disparava `location.reload()` no meio da seleção — o usuário voltava pra tela recarregada e repetia o ciclo.
- Check por visibilidade agora só roda se a aba ficou ≥ 5 min em segundo plano (o caso real de "deixei aberto por horas"), não em retorno rápido de seletor/troca de app.
- Novo `blockVersionReload()`: o reload por deploy fica pendente enquanto há anexo em preview, arquivo sendo processado ou upload em curso, e só acontece ao liberar.

## 2026-08-05 — Chat: upload de vídeo sempre com Content-Type video/mp4

- **Erro real da API:** `Invalid file format: 'video/quicktime'. Only 'video/mp4' are accepted` — o `.MOV` do iPhone subia com o MIME original e o n8n repassava o header do storage.
- `contentTypeForChatUpload` agora **força `video/mp4`** para qualquer vídeo, independente do `file.type`.
- Anexação e envio aplicam `ensureMp4FileMeta` em todo vídeo (nome `.mp4` + MIME correto). MOV e MP4 compartilham o container ISO-BMFF, então rotular basta e é instantâneo.
- Conversão via `ffmpeg.wasm` removida do fluxo de envio: nunca chegou a rodar no browser do usuário e era o que travava. Transcode real, se necessário, deve ser server-side.

## 2026-08-05 — Chat: todo vídeo enviado como MP4 real

- `prepareChatItemsForSend` agora converte todo vídeo não-MP4 antes do upload; saída sempre `.mp4` + `video/mp4`.
- `.MOV` do iPhone tenta primeiro **remux** (`-c copy`), rápido e sem perda de qualidade; se codec impedir, recodifica para H.264 + AAC.
- Worker principal do `@ffmpeg/ffmpeg` volta a ser servido pelo bundle Vite. O antigo `classWorkerURL` em blob quebrava imports relativos no Safari.
- Overlay mostra “Preparando conversor” / “Convertendo para MP4” com progresso. MP4 já pronto segue direto, sem conversão.

## 2026-08-05 — Chat mobile: corrige envio de mídia no iOS e Android

- **iOS não enviava vídeo:** bloquear `.MOV` barrava tudo, porque a câmera do iPhone grava sempre nesse container. `assertChatVideoAllowed` volta a validar **só tamanho** (16 MB) e o container original é preservado no upload.
- **Android não enviava nada:** `accept` com entradas por extensão (`.mp4`, `.m4a`) é ignorado pelo picker do Android e podia zerar a lista de arquivos. Agora só wildcards: `image/*,video/*,audio/*,application/pdf`.
- **Fotos de celular:** `convertImageFileToPng` reduz para no máximo 2048 px antes do canvas (iOS zera canvas acima de ~16.7 MP e PNG de 48 MP passava de 40 MB), usa `createImageBitmap` quando disponível e cai para JPEG se o PNG falhar.

## 2026-08-05 — Chat: rejeita .MOV/WebM e vídeos >16 MB (sem compressão)

- Compressão no browser com ffmpeg.wasm demorava demais / travava em .MOV.
- Painel agora **só aceita MP4 ≤ 16 MB**. `.MOV`/WebM e arquivos maiores são barrados na anexação com toast claro (“Formato não suportado” / “acima do limite”).
- `prepareChatItemsForSend` só valida — zero ffmpeg no fluxo de envio.
- `accept` do file picker limitado a `video/mp4,.mp4`.

## 2026-08-05 — Chat: vídeo enviado sem compressão até 16 MB

- **Causa do travamento em "Carregando compressor":** `@ffmpeg/core` não está no `package.json` e o `@ffmpeg/ffmpeg@0.12.15` sob Vite/ESM precisa de `classWorkerURL` — sem ele o worker não sobe e `load()` fica pendente para sempre.
- **Fix principal:** `needsChatVideoTranscode` agora só considera o tamanho. MOV/WebM dentro de 16 MB vão como estão, sem ffmpeg — era o caso da maioria dos envios.
- **Fix do ffmpeg (só > 16 MB):** `classWorkerURL` via CDN + timeout de 90 s no `load()` com `terminate()`, então falha com mensagem clara em vez de girar sem fim.
- Erro acima do limite agora informa o tamanho real do arquivo e o que fazer.

## 2026-08-05 — Chat: preview de mídia instantâneo + múltiplos anexos + legenda por item

- **Causa do "carregando infinito":** `buildChatPreviewItems` rodava `ffmpeg.wasm` (transcode de `.mov`) **antes** de abrir o preview. Vídeo de celular levava minutos.
- **Fix:** preview usa o arquivo original (`needsVideoPrepare`); transcode/compressão movidos para `prepareChatItemsForSend`, executados no clique de enviar com barra de progresso.
- **Múltiplos anexos:** `processFilesForPreview` agora **acrescenta** ao preview aberto (limite `MAX_PREVIEW_ITEMS = 10`); overlay ganhou botão “+”, remover item e thumb rail sempre visível.
- **Legenda por item:** input do overlay grava na thumb ativa; thumbs mostram a legenda salva.
- **Perf ffmpeg:** preset `veryfast` e escolha de pass inicial pelo tamanho (evita passes descartados).
- Fallback: `.mov` que o navegador não reproduz mostra card “será convertido para MP4 no envio”.

## 2026-07-31 — Follow-up: fix loop 7m (sequence cancelada pelo ingest)

- **Causa:** após `sent` do 7m + `enqueue_next` (15m), o n8n gravava a resposta da IA **sem** `from_follow_up` → `start_or_refresh` cancelava o 15m e recriava 7m (~a cada 7–8s pós-send).
- **Fix:** `start_or_refresh_follow_up_cycle` ignora refresh mid-sequence (pending next após sent recente) e tenta restaurar o próximo step se o race já cancelou. Migration `follow_up_skip_refresh_after_sent_sequence`.
- **Repair** sessão teste `5519981941604`: stray 7m cancelado; 15m restaurado no ciclo do último 7m `sent`.
- **Ops:** n8n `follow-up-chats` → ingest deve mandar `from_follow_up: true` (ainda recomendado).

## 2026-07-31 — Follow-up: limpar etiqueta na resposta + histórico no painel

- **Regra:** etiqueta timed continua via n8n/`set_label`; sistema **não** aplica label no dispatch.
- **Reply do cliente:** RPC `handle_client_reply_follow_up` — cancela pending, `recovered_at` nos `sent`, delete `follow_up`/`follow_up_*` em `conversation_contact_labels`. Stage gate também limpa labels.
- **UI:** seção **Histórico de Follow-up** no `ConversasLeadPanel` (enviado / recuperado / agendado / cancelado).
- Migration `follow_up_cancel_clear_labels_recovered`; edges `mensagem-ingest` / `mensagem-media-ingest` / `follow-up-dispatch` usam o novo RPC.

## 2026-07-31 — Etiquetas múltiplas: ai_ativa + follow_up_*

- UNIQUE `(company_id, channel, session_id, status)` — várias etiquetas por conversa.
- `set_label` / UI: tags aditivas; `ai_ativa`/`humano`/`humano_solicitado` exclusivos entre si.
- Lista Conversas renderiza `contactLabels[]` (AI ATIVA + FOLLOW-UP-7M + CRM).
- Backfill: sessões só com `follow_up_*` ganharam `ai_ativa` de novo.

## 2026-07-31 — Follow-up: não sobrescrever etiqueta ai_ativa

- `follow-up-dispatch` deixa de fazer upsert em `conversation_contact_labels` (etiqueta timed fica no n8n/API).
- Manual “Fazer follow up” (Premium/IG/legacy) também não seta mais `follow_up` no painel — preserva `ai_ativa`.
- Payload ainda envia `label_slug` para o n8n aplicar se quiser.
- **Cleanup:** 3 rows Jastelo com `follow_up_7m`/`follow_up_15m` revertidas para `ai_ativa`.

## 2026-07-31 — Follow-up: sequência + quiet hours 07–21 BRT

- **Sequência:** `start_or_refresh_follow_up_cycle` agenda só o 1º horário enabled; após `sent`, `enqueue_next_follow_up_job` cria o próximo (mesmo `cycle_id` / `cycle_anchor_at`). Reply do cliente continua cancelando pending.
- **Quiet hours:** `clamp_to_follow_up_window` (07:00–21:00 America/Sao_Paulo). Fora da janela o dispatch **adia** (`deferred_quiet_hours`) sem chamar n8n.
- **Migration** `follow_up_sequence_quiet_hours` + redeploy Edge `follow-up-dispatch` (count `deferred` + enqueue após sent).
- **UI/docs:** copy na seção Follow-up; `FOLLOW_UP_WINDOW` em `src/lib/followUp.ts`; `docs/events.md` sequence + quiet hours.

## 2026-07-31 — Follow-up Jastelo: webhook 7m disparou + fix media reset

- **Investigação (sessão `559885112445`):** zero `sent` até ~16:08 UTC porque IA enviou **8 imagens** (15:55:33–15:55:56) + textos em rajada — cada ingest IA chamava `start_or_refresh_follow_up_cycle` e cancelava o pending anterior (~ciclos a cada 3–4s). Relógio de 7m nunca maturava.
- **Disparo real:** ciclo `a1b8dc9c…` criado 16:00:59 (última msg texto IA); job `follow_up_7m` `trigger_at` 16:07:59 → cron 16:08 → Edge `sent:1` (`0705ab42…`, `sent_at` 16:08:01). pg_net HTTP 200 `{processed:1,sent:1}`. **n8n `follow-up-chats` recebeu POST** (res.ok exigido para marcar `sent`).
- **Settings OK** (enabled + whatsapp); cron a cada 1 min succeeded; invoke manual pós-send: `{processed:0,sent:0}`.
- **Fix:** `_shared/followUpCycle.ts` — `isMediaOnlyMensageType` → hook **não** reinicia ciclo em IA image/audio/video/document/sticker. `mensagem-ingest` + `mensagem-media-ingest` passam `mensageType`. Redeploy das duas edges.
- **Nota:** rajadas de **texto** IA ainda reiniciam (silêncio conta a partir da última fala). Próximo: `follow_up_15m` ~16:15:59 / `1h` ~17:00:59 no mesmo ciclo.

## 2026-07-31 — Follow-up: pg_cron live (root cause fix)

- **Root cause:** jobs `conversation_follow_up_jobs` eram criados, mas nada invocava `follow-up-dispatch` (mesmo gap documentado em visit-reminder).
- **Fix (user-imobi / `bfcssdogttmqeujgmxdf`):** habilitou `pg_cron` + `pg_net`; vault `supabase_anon_key`; cron job `follow-up-dispatch` a cada **1 min** → `POST /functions/v1/follow-up-dispatch`.
- **Smoke:** curl + pg_net → `200` `{success:true, processed:0, sent:0}` (0 due no momento; Jastelo tinha 3 pending futuros / muitos cancelled por refresh de ciclo, não por dispatch).
- **Auth:** sem `FOLLOW_UP_CRON_SECRET`/`VISIT_REMINDER_CRON_SECRET` na Edge, dispatch aceita open; se setar secret depois, adicionar vault `follow_up_cron_secret` + header `x-cron-secret` no cron SQL.
- **Repo:** migrations `enable_pg_cron_and_pg_net` + `schedule_follow_up_dispatch_cron` (SQL espelho; secret não commitado).
- **Ops next (opcional):** setar `FOLLOW_UP_CRON_SECRET` na Edge + vault; espelhar cron para `visit-reminder-dispatch`.

## 2026-07-31 — Follow-up: stage gate (Novo Lead / Qualificado)

- **Regra:** auto + manual follow-up só se `leads.stage` ∈ {Novo Lead, Qualificado} (slug `novo-lead`/`qualificado`, normalização accent/case).
- **SQL** `follow_up_stage_gate`: helpers `normalize_lead_stage_slug` / `is_follow_up_allowed_stage` / `resolve_follow_up_lead_stage`; gate em `start_or_refresh_follow_up_cycle` (cancela pending + não cria); `cancel_follow_up_jobs_for_lead` + trigger `trg_cancel_follow_up_on_lead_stage` ao sair das colunas permitidas.
- **Edge** `follow-up-dispatch`: revalida stage antes do webhook; cancela com `last_error=stage_not_allowed`.
- **UI:** Premium / IG / ConversasView — `resolveFollowUpStageGate` + toast bloqueia “Fazer follow up”. Shared: `src/lib/followUp.ts`.
- **Docs:** `docs/events.md` — nota stage gate em `conversation.follow_up.request`.

## 2026-07-31 — Follow-up: seção Config IA + agendador backend

- **Migration** `company_follow_up_system`: `company_follow_up_settings`, `company_follow_up_schedules`, `conversation_follow_up_jobs`; seed labels `follow_up` / `follow_up_15m` / `follow_up_1h` (system) + schedules 15m/1h; backfill; promoveu `follow_up` custom da Jastelo para `is_system`; RPCs `start_or_refresh_follow_up_cycle` / `cancel_follow_up_jobs`.
- **Hooks:** `mensagem-ingest` + `mensagem-media-ingest` iniciam ciclo em msg IA e cancelam em msg cliente (`from_follow_up`/`source:auto` não reinicia).
- **Edge** `follow-up-dispatch` (espelha visit-reminder): aplica etiqueta timed, POST n8n `follow-up-chats` com `source/ai_description/label_slug/…`. Cron: Dashboard (~1–2 min) + `FOLLOW_UP_CRON_SECRET`.
- **UI:** nav Config IA `followup` + `AiConfigFollowUpSection`; Etiquetas filtra sub-labels timed; Conversas (Premium/IG/legacy) em **Fazer follow up** → label `follow_up` + cancela jobs pending. Dialog atraso: row `flex-col sm:flex-row` + toggle `shrink-0` (min|h sem clip).
- **Docs:** `docs/events.md` — payload auto/manual + notas n8n.

## 2026-07-31 — Config IA: Etiquetas de volta no nav SEÇÃO

- `AI_CONFIG_NAV_SECTIONS` + `SECTION_NAV` incluem `etiquetas` (ícone Tags).
- Nav destaca a seção corretamente; removido hack que mapeava etiquetas→identidade e o aviso `?section=etiquetas`.
- `AiLabelsCard` no visual cream: `rounded-2xl` branco, ícone rose, CTA emerald, rows `#F7F5F0`, badge Sistema emerald.
- Sistema (`ai_ativa` / `humano` / `humano_solicitado`): fixas em todas as empresas; só cor editável. Migration `protect_system_ai_label_names` trava `name` no trigger; hook + `conversation-label-api` não enviam rename.

## 2026-07-31 — Remoção marca legada ImobiPro (PDFs / settings)

- **Banco:** `company_settings.display_name` da Jastelo Empreendimentos (`ImobiPro` → `Jastelo Empreendimentos`).
- **Front:** `useCompanySettings` sanitiza `display_name`/`display_subtitle` via `normalizeBrandDisplayName` (load/save/reset); PDFs de Relatórios (`ReportsView` + `exportReportPdf`) e Marketing Action Cards também normalizam.
- Contagem WhatsApp em conexões oficiais: tenta `crm_whatsapp_messages_{phone}` antes do shard legado.
- **Nota:** ainda existem tabelas físicas `imobipro_messages_*` (WhatsApp/Instagram legado) — renomear exige migration + alinhamento n8n; RPCs já fazem fallback.

## 2026-07-31 — Login: redesign cream (mockup split-screen)

- Split 50/50: painel forest `#0C2919` (logo iA, headline, stats decorativos, checks, footer v1.0.0) + cream `#F7F5F0` com card “Entrar na plataforma”.
- Form: e-mail/senha, Esqueci minha senha (dialog reset intacto), Mostrar, Manter conectado (localStorage e-mail), CTA `.btn-on-emerald` + `#ffffff` inline.
- Soft: Google Workspace / código de convite → toast “em breve”; “Fale com o administrador” → toast. Auth email/password + checks de perfil/empresa preservados. Mobile: form first + brand compacto.

## 2026-07-31 — Relatórios: fix load dead-state

- **Causa:** `fetchReportsBundle` perdeu `async` (StrReplace) → Vite `await isn't allowed in non-async function` → módulo não carrega → bundle null → “Não foi possível carregar os dados.”
- **Fix:** restaurar `export async function`; soft-catch por query; fallback `emptyDashboardBundle`/shell vazio; ReportsView mostra shell + banner parcial em vez de tela morta.

## 2026-07-31 — Relatórios: redesign cream (mockups) + dados reais

- Shell `#F7F5F0`: breadcrumb Analytics/Relatórios; título + subtítulo com range; pills 7d|30d|Trimestre|Ano; Agendar envio / Novo relatório (`.btn-on-emerald` + white inline).
- 4 KPIs: Relatórios disponíveis, Exportados no mês, Envios agendados, Última geração (catálogo real + histórico/agenda localStorage).
- Filtros CATEGORIA Todos|Portfólio|Comercial|Marketing|Operação + busca; grid de 8 cards com métricas company-scoped período-aware.
- Tipos: Portfólio (imoveisvivareal), Funil (leads/stages — GESTOR), Corretores, Mercado (canais), Presença digital (public_site_visits + LPs), Atendimento/IA (mensagens), Agenda/plantão (agenda + oncall_schedules), Auditoria (audit_logs — ADMIN).
- Exportar PDF real via jsPDF (+ autotable) para todos os tipos; pré-visualizar dialog; histórico/agendamentos localStorage; Destaques emerald `#0C2919`.
- Extraídos em `src/components/reports/*`; `ReportsView` reexporta. Soft: envio automático sem backend; tempo resposta IA `—`; “Novo relatório” toast; badges ocultam cards por role.

## 2026-07-31 — Painel: fix VGV do mês R$ 0 / -100%

- **Causa:** VGV usava só leads `Fechamento` + `estimated_value` + `updated_at`. Único fechamento na base (R$ 500k em 2026-06-12) cai no período *anterior* ao default 30d → KPI atual 0 e delta `-100%`.
- **Fix:** stages fechados ampliados (fechamento/fechado/ganho/won/closed/vendido); fallback estoque `indisponivel|vendido` → legado soma `preco` cadastro (adapter antigo); footer `sem fechamentos no período` quando VGV=0 (sem `-100%`); `formatDeltaPct` não emite ±100% com lado zerado.
- Arquivos: `dashboard/helpers.ts`, `dashboard/fetchDashboardData.ts`.

## 2026-07-31 — Painel (Dashboard): redesign cream (mockups)

- Shell `#F7F5F0`: breadcrumb Analytics/Painel; título + sync + range + atualizado às; filtros 7d|30d|Trimestre|Ano; Exportar / Ver relatórios (`.btn-on-emerald` + white inline).
- 6 KPIs com sparkline: VGV do mês, Imóveis vendidos, Disponíveis, Leads no período, Visitas agendadas, Ticket médio — período reativa aggregates.
- Charts/cards: VGV×vendidos 12m, Portfólio (Disponíveis/Reservados/Vendidos/Sem LP + Casas/Apts/Terrenos), Canais, Funil, Desempenho por corretor, Próximos compromissos, Atividade recente (card emerald `#0C2919`).
- Extraídos em `src/components/dashboard/*`; `DashboardContent` orquestra. Dados company-scoped (leads/imóveis/LPs/agenda/audit). Soft: VGV/vendidos via Fechamento (`estimated_value`+`updated_at`, sem `sold_at`); Reservados≈reforma / Vendidos≈indisponivel; visitas IA≈source WhatsApp/IA; meta mensal inexistente.

## 2026-07-31 — Permissões: alinhamento exacto ao mockup

- Shell `#F7F5F0`: breadcrumb Sistema/Permissões; subtítulo mockup; ações Ver auditoria / Restaurar padrão / Salvar permissões (`.btn-on-emerald` + white inline).
- 3 KPIs de perfil: Administrador (laranja 100% irrestrito), Gestor/Corretor (% + “N de M ativas” + contagem usuários).
- Matriz: título + “N permissões em N módulos”; busca; pills Todos|Imóveis|Leads e CRM|Menus|Administração; headers PERMISSÃO|GESTOR|CORRETOR|ADMINISTRADOR; badges ESCRITA/SENSÍVEL; bulk por coluna; Admin `sempre`.
- Seções mockup (Imóveis 2 / Leads 3 / Menus 11 / Admin 5). Save por toggle + confirm + audit intactos. Soft: auditoria/restaurar = toast; Salvar confirma persistência imediata.

## 2026-07-31 — Permissões: redesign cream (mockups) [superseded]

- Primeira passada: shell cream + matriz Gestor/Corretor; cards laterais usuários/atividade/práticas. Substituída pelo alinhamento exacto acima.

## 2026-07-31 — Configurações: redesign cream (mockups)

- Shell `#F7F5F0`: breadcrumb Sistema/Configurações; título + subtítulo (conta criada em); Descartar / Salvar alterações (`.btn-on-emerald` + white inline).
- 4 KPIs: Status da conta, Plano, Usuários, Cadastro % (dots + bars + hints).
- Nav SEÇÃO: Dados da empresa | Endereço | Plano e assinatura | Preferências + badge Tudo salvo; layout 2 col + sticky Conta ativa / Cadastro completo? / Últimas alterações.
- Empresa: logo Trocar (`uploadLogo`), nome, responsável, e-mail, CNPJ obrigatório, telefone, CRECI (localStorage soft). Endereço: CEP ViaCEP + campos. Plano: grid + uso + upgrade/NF/pagamento (toast soft). Preferências: toggles localStorage + timezone em `company_settings`.
- Extraídos em `src/components/configurations/*`; `ConfigurationsViewSimple` reexporta. Save/load `update_own_company` + logo preservados.

## 2026-07-31 — Configuração da IA: redesign cream (mockups)

- Shell `#F7F5F0`: breadcrumb Sistema/Configuração da IA; título + subtítulo WhatsApp; Ver histórico / Testar IA / Salvar alterações (`.btn-on-emerald` + white inline).
- Status bar: toggle Assistente IA ativa + pills Prompt/Modelo/Salvo em (soft `—` sem campos no schema) + badge Tudo salvo; blockers de ativação preservados.
- Nav SEÇÃO com ícones + Completo %: Identidade e mensagens | Contexto e regras | Horário de funcionamento | Agendamento de visitas. Layout 2 col (forms + preview/checklist/impacto sticky).
- Identidade: nome, tom Consultivo/Direto/Caloroso, mensagem inicial+vars, fallback, diretrizes de tom. Contexto: missão/pagamento/visita/público/regras/extras com badges preenchido|crítico|opcional. Horário: tabela DIA/ABRE/ALMOÇO/FECHA + aplicar 09–18. Visitas: radio cards + critério tabs + prioridade Alta/Média/Baixa.
- `asText()` evita `[object Object]` nos textareas. Etiquetas preservadas via `?section=etiquetas`. Soft gaps: Prompt v/modelo, impacto (placeholders mockup), histórico, teste handoff checklist.

## 2026-07-31 — Testar IA: redesign cream (mockups)

- Shell `#F7F5F0`: breadcrumb Sistema/Testar IA; título + subtítulo (sessão UUID, sem impacto no CRM); Configurar IA / Nova sessão / Salvar como cenário (`.btn-on-emerald` + white inline).
- Status bar: IA ativa · Instância · Sessão+copiar · Modelo/temperatura (soft `—` sem campo no schema).
- Chat card: avatar + stats + Debug/refresh; bolhas cliente esquerda / IA direita (forest `#0C2919` + texto branco); pills; composer Enter; tip isolamento CRM.
- Sidebar: Cenários (Lead frio/Preço/Agendamento/Fora do escopo), Diagnóstico (prompt/imóveis/agenda/handoff), card emerald “Base usada” (tokens/custo soft `—`).
- Extraídos em `src/components/ai-test/*`; lógica send/session/webhook/realtime preservada. Soft gaps: modelo/temp/tokens/custo/imóveis consultados; salvar cenário só localStorage.

## 2026-07-31 — Visitas ao site (marketing-visitas): redesign cream (mockups)

- Shell `#F7F5F0`: breadcrumb Presença digital/Visitas ao site; título + subtítulo com range; Abrir site / Atualizar / Exportar CSV (`.btn-on-emerald` + white inline).
- Filtros: PERÍODO 7/30/90/Personalizado, AGRUPAR Dia/Semana/Mês, PÁGINA Todas/Vitrine/LPs com counts; 5 KPIs (total, hoje, 7d, média, leads) com dots + bars + footers.
- Chart stacked Vitrine+LP; Origens; Top 5 páginas (SITE/LP); Comportamento emerald escuro (`#0C2919`, texto branco inline); tabela Últimas visitas (filtro, dispositivo/tempo soft) + footer rastreamento próprio.
- Extraídos em `src/components/marketing-visitas/*`; lógica `public_site_visits` + CSV + refresh preservada. Soft gaps: tempo/dispositivo/recorrentes (sem UA/duração no schema); canais UTM→mockup; leads via `source` ilike site/vitrine/lp.

## 2026-07-30 — Landing pages (marketing-lps): redesign cream (mockups)

- Shell `#F7F5F0`: breadcrumb Presença digital/Landing pages; título + subtítulo `/imovel/slug`; Atualizar / Exportar relatório CSV / Ir para Propriedades (`.btn-on-emerald`).
- 5 KPIs (Total, Publicadas, Rascunhos, Views 30d, Leads) com dots + progress; lista com busca, tabs status (Todas/Publicadas/Rascunhos/Despublicadas), ordenar Mais vistas|Mais recentes.
- Tabela: thumb + título + badge categoria + endereço + ID, slug, status pill, desempenho (views·leads + bar), atualização, ações (abrir/copiar/mais). Footer Exibindo N de M + legenda.
- 3 cards finais: melhor desempenho, precisam de atenção, tráfego 30d (card emerald escuro com texto branco inline). Extraídos em `src/components/marketing-lps/*`.
- Soft gaps: editor (sem `updated_by`); Despublicada≈unpublished+views; tráfego por fonte aproximado se `public_site_visits` fino; leads via `imovel_interesse`.

## 2026-07-30 — Site Vitrine: redesign cream (mockups)

- Shell `#F7F5F0`: breadcrumb Presença digital/Site vitrine; toolbar com status Publicado + URL + última publicação; Copiar link / Abrir site / Salvar e publicar (`.btn-on-emerald`).
- Banner amarelo “Como funciona”; nav de seções (Identidade | Aparência | Textos | Logo e capas | Rastreamento) com counts + Preenchimento %; layout 2 col (forms + preview/checklist/status sticky).
- Cards: identidade (slug `/s/` + Verificar), aparência (5 cores + AA/AAA + tipografia), textos (#sobre/#contato + destaques), assets (logo + 3 capas), rastreamento (Meta Pixel + GA).
- Extraídos em `src/components/site-vitrine/*`; `MarketingView` orquestra. Lógica de save/slug/upload/publish preservada. Soft gaps: dims/KB da logo e reorder real dos destaques.

## 2026-07-30 — Plantão: redesign cream finalizado (mockups)

- Shell `#F7F5F0`: breadcrumb Operação/Plantão; título + subtítulo com última atualização; tabs segmentadas abaixo do título (Calendários | Escala) + Atualizar / Adicionar agenda (visível nas duas abas para gestor).
- 4 KPIs com dot no canto direito, progress bars (cobertura = dias/7); tabela Calendários conectados (ID truncado, avatar pastel, footer cream “Google Calendar autorizado”).
- Escala: seletor de agenda + badge responsável clicável (config), “Escala salva” à direita, grid 4 colunas (4+3), toggle emerald, bulk 09:00–18:00 / desligar fim de semana.
- Componentes em `src/components/plantao/*`; Google Calendar create/delete/sync e `oncall_schedules` intactos. Escalas carregam também na aba Calendários (KPIs + Responsável).

## 2026-07-30 — Plantão: redesign cream + forest green

- `PlantaoView`: shell `#F7F5F0`, breadcrumb Operação/Plantão, toolbar com tabs segmentadas (Calendários | Escala do plantão), Atualizar + Adicionar agenda (`.btn-on-emerald`), 4 KPIs com progress bars.
- Extraídos componentes em `src/components/plantao/` (`TopBar`, `Toolbar`, `Kpis`, `CalendarsTable`, `EscalaPanel`, `TimePicker`, `helpers`).
- Tab Calendários: tabela conectados (status, responsável, sync relativa); tab Escala: seletor de agenda, grid 7 dias, bulk apply/desligar fim de semana, copiar de outro. Lógica Google Calendar + `oncall_schedules` preservada.

## 2026-07-30 — Conexões: redesign cream + forest green

- `ConnectionsViewSimplified`: shell `#F7F5F0`, breadcrumb Infraestrutura/Conexões, toolbar (Atualizar, Logs webhook via AlertDialog, Nova instância + badge LIMITE), banner sync amber, 5 KPIs com progress bars, layout 2 col (WhatsApp | Instagram).
- Extraídos componentes em `src/components/connections/`; `CompanyInstagramConnectionsSection` restyle cream/white; `OfficialApiConnectionsView` shell/header alinhados.
- Ver conversas → `navigate('/conversas')`; lógica QR/create/delete/config/pending requests preservada.

## 2026-07-30 — CRM Clientes: colunas da tabela restauradas

- `ClientsCrmTable`: colunas separadas **Valor**, **Origem**, **Corretor**, **Contato**, **Cadastro** (antes agrupadas em “Valor / origem” e “Corretor · contato”).
- Contato exibe telefone + e-mail; Cadastro usa `dataContato` + tempo relativo de `updatedAt`; Interesse com fallback em `message` quando vazio.

## 2026-07-30 — LeadViewModal: resumo estruturado (n8n)

- Parser `parseConversationSummaryResponse` atualizado: array → `output` (JSON string) → objeto estruturado; `parseStoredConversationSummary` aceita JSON ou texto legado.
- Persistência em `leads.conversation_summary` como JSON stringificado (reabrir modal restaura status, nota, ações, pendências, riscos, métricas/qualidade).
- UI cream card (`ConversationSummaryCard`) na seção Contato; botão **Gerar resumo** sem ícone (spinner no loading).

## 2026-07-30 — LeadViewModal: Gerar resumo da conversa (n8n)

- Botão **Gerar resumo** na seção Contato (`.btn-on-emerald`, loading state); chama webhook `resumo_conversa` direto (mesmo padrão Conversas/ChatsView).
- Payload: `lead_id`, `session_id` (telefone ou `leads.id` IG), `phone`, `email`, `name`, `company_id`, `user_email`, `role`, `instancia`, `plataforma`, `rota`.
- Resposta normalizada em `src/lib/parseConversationSummaryResponse.ts`; persistência em `leads.conversation_summary` (migration `20260730160000_leads_conversation_summary.sql`); exibição ao reabrir modal.
- Catálogo: `docs/events.md` — `conversation.summary.request` atualizado.

## 2026-07-30 — AddEventModal + EditEventModal: redesign cream + forest green

- Modais alinhados ao padrão AddLeadModal/AddImovelModal: header `#1a2e24` + ícone, body cream `#F7F5F0`, campos `bg-card rounded-xl`.
- Seção Data/Horário em card aninhado; chips outline com selected emerald (`.btn-on-emerald`); sugestão em amber suave; CTAs Cancel outline + primary emerald-800.
- Toda lógica preservada (Google Calendar, corretor/disponibilidade, imóvel Viva Real, validação).

## 2026-07-30 — LeadViewModal: redesign cream + forest green

- Modal alinhado ao padrão AddLeadModal/AddImovelModal: header `#1a2e24`, body cream `#F7F5F0`, cards `bg-card` com seções Contato | Imóvel & Interesse | Atividades.
- Badge de estágio humanizado (`visita-agendada` → Visita Agendada); footer Fechar outline + Editar `.btn-on-emerald`. Colunas empilham no mobile.

## 2026-07-30 — Editar Cliente (AddLeadModal): fix nome + redesign

- **Bug:** `updateLead` enviava coluna inexistente `property_id` na tabela `leads`, fazendo o UPDATE falhar por completo — nome e demais campos não persistiam; toast de sucesso aparecia mesmo com falha.
- **Fix:** removido `property_id` do payload de update/create; `nome` mapeia sempre para `leads.name` (`!== undefined`); placeholder CPF `000.000.000-00` não é salvo; retorno de `updateLead`/`createLead` checado antes do toast.
- **UI:** modal alinhado ao padrão cream `#F7F5F0` + header forest `#1a2e24` (AddImovelModal): seções Informações Básicas | Lead | Atribuição, grids 2 col, CTA `.btn-on-emerald`.
- `normalizeLeadStoredName` em `kanban.ts` trata placeholder WhatsApp `~` como vazio na exibição.

## 2026-07-30 — Agenda: botão Visitado + pipeline

- Botão **Visitado** (após 1h do horário): confirmação via `AlertDialog` antes de aplicar.
- Ao confirmar: status do evento → Visitado (Google sync preservado) + lead vinculado → estágio **Visita Realizada** (`leads.stage`).
- Eventos carregam `leadId` (extendedProperties ou match por e-mail). Sem lead: toast informativo; já em Visita Realizada: só atualiza agenda.

## 2026-07-30 — Agenda: redesign mockup cream + forest green

- Chrome cream `#F7F5F0`: breadcrumbs Operação/Agenda, título + status Google (email + sincronizado às HH:MM), toggle Mês|Semana|Lista, Sincronizar, CTA `+ Novo evento` (`.btn-on-emerald`).
- 5 KPIs reais: HOJE, ESTA SEMANA, ESTE MÊS, CONFIRMADOS, PENDENTES com hints e barras de progresso quando aplicável.
- Filtros: chips por corretor/calendário com counts, pills Todos os status|Confirmados|Pendentes, atalhos Ir para Hoje/Amanhã/Próxima semana.
- Calendário mês: células arredondadas, selecionado verde floresta, hoje wash pastel, dots + contagem; legenda agentes.
- Painel do dia: badge eventos/confirmados, cards com borda verde, badges tipo/status, avatar corretor, Confirmar/Reagendar/⋯; seção PRÓXIMOS COMPROMISSOS.
- Extraído `src/components/agenda/*`; Google sync, criar/editar/confirmar/reagendar/excluir, filtros por calendário e polling 30s preservados.

## 2026-07-30 — Ver ficha (PropertyDetailsPopup): redesign mockup

- Dialog `max-w-6xl`: header charcoal (#1a2e24) com código, título, badge DISPONÍVEL, endereço; Compartilhar / Editar imóvel / X (texto `#fff` / hatch).
- Body 2 colunas (stack no mobile): carousel + contador + GALERIA thumbs; preço (venda/aluguel), 4 stats, LOCALIZAÇÃO + Ver no mapa (Maps search), FICHA TÉCNICA de campos reais.
- Footer: LP / IG / PDF / Copiar link; Fechar; Alterar disponibilidade; Agendar visita → `/agenda` (`.btn-on-emerald`). Condo/IPTU/simulação omitidos (sem campos). Adapter propaga cep/bairro/andar/etc.

## 2026-07-30 — Imóveis / Properties: redesign mockup

- Chrome cream `#F7F5F0`: breadcrumbs Portfólio/Imóveis, título + subtítulo com contagem real (sem “sincronizado com site”), toggle Grade only (Lista/Mapa e Importar planilha omitidos — sem UI/backend), CTA `+ Adicionar imóvel` (`.btn-on-emerald`).
- 5 KPIs reais: total, disponíveis, indisponíveis, em reforma, ticket médio (AVG `preco`); mockup “Reservados/Vendidos” remapeados aos status do schema (`indisponivel`/`reforma`). Hints só com dados reais.
- Filtros: busca código/rua/bairro; abas Todos/Disponíveis/Venda/Aluguel com counts; sort Mais recentes/Valor/Área; filtros avançados preservados (cidade/bairro/área/preço/etc.).
- Cards: foto ou placeholder listrado, badge status, contagem fotos, código, título+preço, endereço, tags, área/dorm/suítes/vagas, Ver ficha / Editar / ⋮; footer corretor omitido (sem join de perfil). Paginação “Exibindo N de M”.
- Extraído `src/components/properties/*`; `useImoveisVivaReal` ganhou `modalidade`/`disponibilidade`; CRUD, galeria, edit VivaReal, disponibilidade e permissões corretor preservados.

## 2026-07-30 — CRM de Clientes: redesign mockup

- Chrome cream `#F7F5F0`: breadcrumbs Comercial/CRM, título + subtítulo com contagem real, toggle Tabela|Cards, Gestão em massa (gestor/admin), filtro corretores, CTA `+ Novo cliente` (`.btn-on-emerald`).
- 5 KPIs reais (total, carteira ativa, prospects + hint sem corretor, fechados ano, conversão); omitidos “última importação” e deltas inventados.
- Tabela (checkbox, cliente c/ avatar User, estágio, interesse, valor/origem, corretor·contato, ações) + cards no mobile/toggle; abas Todos/Ativos/Prospects/Negociação/Fechados/Perdidos mapeadas aos estágios atuais do pipeline.
- Widgets inferiores: distribuição por estágio, precisam de atenção, carteira por corretor (SLA inventado suavizado).
- Extraído `src/components/clients-crm/*`; CRUD (`AddLeadModal`/`LeadViewModal`), bulk assign, filtros e `useKanbanLeads` preservados.

## 2026-07-30 — Pipeline: estágio "Visita realizada"

- Novo estágio CRM `visita-realizada` / **Visita Realizada**, entre Visita Agendada e Visita Cancelada.
- UI: `PIPELINE_STAGES`, `LeadStage`, `CRM_KANBAN_STAGE_TITLES`, AddLeadModal, badges, métricas de agendamento.
- Migration `20260730150000_add_visita_realizada_stage`: `format_lead_stage_label` + CHECK `leads_stage_allowed` (slug/título, acentos normalizados).

## 2026-07-30 — Pipeline Kanban: colunas + cards (mockup)

- Coluna: container `rounded-2xl` muted; header (dot + nome | count), soma real em verde, barra accent por stage; body scroll + “Ver mais”; footer `+ Adicionar lead` branco. Sem ⋮ de coluna (sem ações). Omitidos SLA/conv inventados.
- Card: avatar com iniciais (User se vazio); nome + interesse; ⋮ Ver/Editar; valor; note com barra verde; telefone + “• há Xh”. Sem temperatura/visita/WhatsApp inventados. DnD + memo + cap 25 preservados.

## 2026-07-30 — Pipeline de Vendas: performance (coluna + cards)

- Causa: board sem max-height → página ~17k px montando todos os cards (ex. 95+199 por coluna).
- Colunas: `h-full min-h-0 overflow-y-auto` dentro de shell viewport (`h-[calc(100vh-8rem)] overflow-hidden`); scroll por coluna, não no documento.
- Cap de montagem: 25 cards/coluna + “Ver mais (N)” (`PIPELINE_COLUMN_PAGE_SIZE`); `@tanstack/react-virtual` não está nas deps.
- Memo: `React.memo` em `PipelineLeadCard`/`PipelineColumn`/KPIs/Conversion; `leadsByStage` em useMemo; callbacks estáveis; `DragOverlay` leve (`PipelineDragPreview`); sensor distance 10; edge-scroll via ref (sem re-render por frame).

## 2026-07-30 — Pipeline de Vendas: redesign mockup

- Chrome: breadcrumbs Comercial/Pipeline, busca (nome/telefone/interesse), refresh, título+subtítulo (funil · mês · atualizado), switcher Kanban|Lista (Lista → `/clients-crm`), filtro corretores, CTA `+ Novo lead` (`.btn-on-emerald`).
- KPIs reais (ativos, negociação, fechamentos mês, valor pipeline, ciclo médio) + barra “Conversão por etapa”; omitidos Previsão, settings, temperatura, SLA/meta inventados.
- Kanban: colunas com accent/count/soma, cards com avatar User (não iniciais), valor, origem, telefone, tempo relativo, notes; `+ Adicionar lead` por coluna (`defaultStage` no modal).
- Extraído `src/components/pipeline/*`; DnD/filtros/modais/`useKanbanLeads` preservados; fundo cream light.

## 2026-07-30 — Conversas: responsivo mobile/tablet

- Breakpoints: `<md` 1 painel (lista↔chat); `md–lg` lista+chat, lead em Sheet; `xl+` 3 colunas.
- Lead Sheet em todo viewport `<xl` (antes só mobile — tablet com toggle quebrado); auto-open docked só em xl+.
- Top bar compacta (breadcrumb some &lt;md; unread sempre; tabs WA/IG sem overflow); composer/inbox/header com padding menor; altura `dvh` + padding main reduzido só em Conversas.
- Mesmo shell em WA (`ConversasViewPremium`) e IG (`ConversasViewInstagram`).

## 2026-07-30 — Conversas: redesign 3 colunas (mockup)

- Shell compartilhado: top bar (breadcrumbs Atendimento/Conversas + tabs WA/IG/Site·Chat), inbox com chips Todas/Não lidas/IA/Corretor, chat header Assumir + Agendar visita, painel Lead (desktop) / Sheet (mobile).
- Evoluiu `ConversasPage`, `ConversasViewPremium`, `ConversasViewInstagram`, `ChatComposer` + `src/components/conversas/*`; tokens light `--cv-*` forest green / fundo chat cinza claro.
- Assumir → label `humano`; Agendar → `/agenda`; Ver ficha → `LeadViewModal`; quick chips = templates WA. Site/Chat e Transferir omitidos (sem backend / fluxo chat).
- Lógica WA/IG preservada (realtime, mídia, labels, webhooks); só um canal montado por vez.

## 2026-07-30 — Notificação: nome real do lead (não `~`)

- **Causa:** trigger lia só `leads.name`; WhatsApp grava `~` como placeholder → body `~ movido de ...`.
- Migration `20260730140000_fix_notify_lead_stage_display_name`: `lead_display_name()` ignora `~`/vazio e cai em `nome_instagram_cliente` → `@arroba` → `phone`; copy `"Nome" foi movido de "X" para "Y".`; backfill das notificações com `~`.

## 2026-07-30 — Sidebar light mode + notificações in-app

- Sidebar: tokens `bg-sidebar` / `text-sidebar-foreground` (light legível); dark mantém charcoal/verde; logo IAFÉ light/dark preservada.
- `user_notifications` (migration `20260730120000`): RLS por destinatário; trigger em `leads.stage` notifica corretor + gestores (pipeline + visita agendada); view compat `notifications`.
- Header: tokens de tema; sino com popover (lista, badge, marcar lidas, navegar `/clients` ou `/agenda`).
- User Management: avatar padrão lucide `User` (sem iniciais); chips de filtro com texto/badge brancos quando ativos.

## 2026-07-30 — UI mockup: sidebar + User Management

- Sidebar: charcoal `#1A1A1A`, seções Operação / Presença digital / Analytics / Sistema; item ativo verde escuro; footer com avatar+role, Tema/Sair lado a lado. Logo da empresa / IAFÉ preservada (sem square "IA" genérico).
- User Management: 4 metric cards (total / ativos / inativos / admin|gestores), CTA verde escuro "+ Novo usuário", painel com busca + chips, tabela desktop (Membro/Cargo/Status/Telefone/Criado em/Ações) e cards no mobile; footer "Exibindo N de M".
- Omitidos do mockup: Exportar CSV, Convidar por link, Convites pendentes, Último acesso, Filtros avançados, paginação — sem backend/campo correspondente.
- Lógica intacta (RPC, CRUD, WhatsApp settings, permissões).

## 2026-07-30 — User Management: people directory layout

- Redesign de tabela dark legada para diretório de pessoas: lista densa (desktop) + cards (mobile); chips de cargo com contagens; sem HTML Table.
- Extraído monólito para `src/components/user-management/*` (header, toolbar, list/card, badges, dialogs); re-export estável em `UserManagementView.tsx`.
- Tokens do design system (`bg-background` / `border-border` / etc.); removidos gray-800 forçado e gradientes purple/blue; copy de debug de permissão limpa.
- Lógica intacta: RPC `list_company_users`, CRUD, WhatsApp settings, gestor não vê admin, role edit só admin.

## 2026-07-28 — Delete usuário: FK `audit_logs.actor_id`

- **Causa:** `audit_logs_actor_id_fkey` com `NO ACTION` bloqueava `DELETE` em `user_profiles` (histórico de auditoria).
- **Migration** `20260728022743_audit_logs_actor_id_on_delete_set_null`: `ON DELETE SET NULL` em `audit_logs.actor_id` e demais FKs nullable para `user_profiles`.
- Edge `admin-delete-user`: remove `oncall_schedules` do usuário (FK NOT NULL) antes do delete; null em `leads.user_id`.
- UI: mensagem amigável em PT quando o erro for de vínculo/FK.

## 2026-07-27 — Config IA: settings shell + seções

- Layout profissional tipo settings: nav lateral (desktop) / tabs (mobile) com deep link `?section=`.
- Seções: Geral, Identidade, Contexto, Etiquetas, Visitas; form compartilhado + sticky Salvar/Descartar.
- Monólito `AiConfigurationView` extraído para `src/components/ai-config/*`; re-export estável no path antigo.
- Visual: header compacto, badges Ativa/Inativa + contagem de etiquetas + indicador dirty; placeholders duplicados removidos.

## 2026-07-27 — Etiquetas da IA (catálogo) + Config IA light mode

- Migration `company_ai_labels` (RLS company-scoped; gestor+ write; system não deletável) + seed das 3 labels por empresa; CHECK rígido de `conversation_contact_labels.status` removido.
- Edge `conversation-label-api`: `list_catalog` / `upsert_catalog` / `delete_catalog`; `set_label` valida slug no catálogo.
- UI: `AiConfigurationView` + `BusinessHoursFields` com tokens de tema; card **Etiquetas da IA**; Conversas (Premium/IG) usam catálogo no menu e badges.
- Docs: `conversation.label.set` em `docs/events.md`.

## 2026-07-27 — Modal Resumo: light mode + mobile + Qualidade

- `SummaryModalAnimated`: tokens de tema (`bg-background`/`text-foreground`) no lugar de zinc hardcoded.
- Mobile: sheet full-height, header/footer sticky, botões full-width.
- Card Qualidade: abre por padrão; Progress sem animação de width que escondia as barras; labels PT + score 0–10/0–100.

## 2026-07-25 — Agenda: responsividade mobile

- Header/stats/filtros empilham em telas estreitas; padding do `main` reduzido (`p-3` → `md:p-6`).
- Grade do calendário: células menores, dias abreviados no mobile, sem scale agressivo.
- Cards de compromisso: header/ações com wrap; layout 1 col até `xl`.

## 2026-07-25 — Agenda: badge do corretor em “Todos”

- Causa: com filtro **Todos**, o nome vinha de heuristics Isis/Arthur; sem match → “Não informado”. O `calendarId` do evento não era usado.
- Fix: `resolveAgendaEventCorretor` (broker_name → calendarId/oncall → descrição → creator). `loadCorretores` enriquece com `assigned_user.full_name`. Badge some se ainda for “Não informado”.

## 2026-07-25 — Chat vídeo: MIME vazio, ffmpeg retry, sem falso-MP4

- **Causa:** (1) `ffmpegLoadPromise` envenenava após 1 falha de CDN; (2) MOV/WebM ≤16 MB eram só renomeados pra `.mp4` sem transcode; (3) `file.type === ""` rejeitava anexo; (4) upload sem Content-Type → Storage `octet-stream`.
- **Fix:** `chatMediaKind.ts` (inferência MIME/extensão, pass-through só MP4 real, Content-Type no upload); `compressChatVideo` reseta cache + fallback jsDelivr/unpkg; accept inclui `.mov`/`.webm`; `ChatVideoPlayer` mostra erro de load; testes em `chatMediaKind.test.ts`.

## 2026-07-25 — Conversas: `company_id` nos webhooks resumo + follow-up

- Body de `resumo_conversa` e `follow-up-chats` passa a incluir `company_id` (além de `session_id`, `instancia`, `user_email`, `role`).
- Views: `ConversasViewPremium`, `ConversasViewInstagram`, `ConversasView`, `ChatsView` (resumo).
- Catálogo: `docs/events.md` — `conversation.summary.request` / `conversation.follow_up.request`.

## 2026-07-24 — schedule-api: fim de semana explícito + plantão Jastelo

- **Código:** busca aberta com data sáb/dom explícita usa `ctrl = "dia_especificado"` e `targetDates = [dt]` (não redireciona para `nextBizDays`). Mantém `ctrl === "segunda-feira"` para “hoje ≥16h / amanhã é fim de semana”.
- **Dados:** `oncall_schedules` Jastelo (`jasteloempreendimentos@gmail.com`) — `sat_works` 09:00–17:00, `sun_works` 11:30–17:00.
- **Deploy:** `schedule-api` v32 em `bfcssdogttmqeujgmxdf`.
- **Nota:** `texto_disponibilidade` para `dia_especificado` segue o ramo `blocos[0]` (dia único).

## 2026-07-22 — Dashboard: tooltip curto em Imóveis mais Procurados

- Tooltip/legenda do gráfico “Imóveis mais Procurados” não dumpam mais a ficha técnica completa de `imovel_interesse`.
- Helper `formatImovelInteresseLabel`: extrai Tipo · Bairro/Cidade/Área (max ~72 chars).
- ChartsTooltip `trigger="item"` + `chartsTooltipSx` (max-width 280, wrap).

## 2026-07-22 — Dashboard: agendamentos no gráfico de corretores + MoM rolling 30d

- **Corretores por Agendamentos:** `getLeadsByBroker` conta só leads com agendamento realizado (stage Visita Agendada / Em Negociação / Documentação / Contrato / Fechamento, ou `event_id` no calendário). Série vermelha “Não atribuídos” usa o mesmo filtro.
- **KPI MoM:** % passa de mês civil (MTD vs mês cheio) para janela rolling 30d vs 30d anteriores (leads, imóveis, disponíveis, VGV). Subtítulo: “vs. 30 dias anteriores”.
- Diagnóstico Jastelo: −32,5% era 54 novos no mês atual vs 80 no mês anterior; rolling 30d = 76 vs 61 → **+24,6%**.

## 2026-07-22 — Alerta email Resend ao corretor (visita agendada)

- Helper compartilhado `supabase/functions/_shared/email.ts`: `sendEmail`, `sendWelcomeEmailWithResend`, `sendVisitBookedAlertToBroker` (envs `RESEND_*`; no-op se off / sem email).
- `create-company-with-user` refatorado para usar o helper no welcome email.
- `schedule-api`: alerta após `book_visit` (só com corretor atribuído) e após `assign_visit_broker`.
- `google-calendar-api` `create_event` (Agenda CRM): alerta quando o calendário resolve corretor via plantão.
- UX: hint em UserManagement (criar/editar) — “Este email recebe alertas de visitas agendadas.”
- Evento documentado: `visit.booked.email_broker` em `docs/events.md`.
- **Ops:** garantir secrets no Dashboard — `RESEND_ENABLED=true`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (domínio verificado), opcional `RESEND_API_BASE_URL` / `PUBLIC_APP_URL`.
- **Deploy:** `schedule-api`, `google-calendar-api`, `create-company-with-user`.

## 2026-07-06 — Simulador Testar IA: sessão UUID + banco isolado + ingest n8n

- Tabela `ai_test_messages` (separada de `mensagens`) com RLS gestor+ e realtime.
- Edge `ai-test-api`: `ingest_text` e `ingest_image` para o n8n gravar respostas da IA.
- `session_id` UUID aleatório por conversa; **Limpar conversa** apaga o histórico no banco e gera novo UUID.
- Front: realtime na tela de teste; suporte a imagens no simulador WhatsApp.

## 2026-07-02 — Config IA: API Oficial sem exigir Conexões WhatsApp

- **`company_ai_activation_blockers`:** empresas com `APIOficial = true` não precisam de instância Evolution conectada para ativar a IA.
- **`AiConfigurationView`:** aguarda `loadingApiMode` e corrige race condition nos blockers; API Oficial usa WhatsApp Meta automaticamente.
- Migration `20260702130000` aplicada em produção via `supabase db query --linked`.

## 2026-07-02 — Chat WhatsApp: instância, lista, áudio e conexões

- **`enviar_mensagem`:** `resolveWhatsappSendInstancia` — empresas sem API Oficial usam instância real (`company_whatsapp_instances`), não `default`.
- **Lista de conversas:** removido filtro por aba de instância; polling silencioso (sem piscar item selecionado).
- **`mensagem-media-ingest`:** sniff MIME, rejeita mídia criptografada, normaliza `audioMessage` → `audio`, aceita `media_base64`, atualiza `plataforma`/`mensage_type` no retry.
- **`ChatAudioPlayer`:** detecta áudio inválido; tenta Blob com MIME explícito quando Storage serve `octet-stream`.
- **Conexões:** fallback em `company_whatsapp_instances` quando webhook `whatsapp-instances` falha (404 n8n); lista vazia após excluir instância sem alerta vermelho.
- **Testar IA:** tela em desenvolvimento (placeholder).

## 2026-06-29 — Simulador WhatsApp para testar IA

- Novo menu **Testar IA** (`/ai-test`) no sidebar, abaixo de Configuração para IA.
- View com simulador WhatsApp (IA sempre ativa no simulador; conversa inicia vazia, sem mensagem automática da IA).
- Toggle **Ativar assistente IA** movido para **Configuração para IA** (primeiro card; `company_features.ai_assistant_enabled`).
- Envio de mensagens de teste via webhook n8n `teste-ia` (override: `VITE_AI_TEST_WEBHOOK_URL`).

## 2026-06-29 — Admin: teste gratuito configurável no link de cadastro

- Migration `20260629120000_signup_links_trial_days.sql`: coluna `trial_days` em `signup_links` (padrão 7).
- Painel **Gerar Link de Cadastro**: toggle para habilitar teste gratuito (desligado por padrão); campo de dias (1–90) só aparece quando ativo.
- `SignupPage` e `create-company-with-user`: respeitam `trial_days` do link (edge força valor do link no fluxo público).

## 2026-06-03 — Lembretes de visita (1 dia e 3 horas) via n8n

- **Regra:** ao `book_visit` na `schedule-api`, agenda jobs na tabela `visit_reminder_jobs`.
  - **1 dia antes:** só se faltarem **mais de 24h** e a visita **não for no mesmo dia** → webhook `lembrete-1-dia`.
  - **3 horas antes:** sempre que o horário ainda não passou → webhook `lembrete-3-horas`.
  - **Mesmo dia:** pula lembrete de 1 dia; mantém só o de 3h.
- **Payload n8n:** lead (`nome`, `email`, `telefone`, `instancia`), imóvel, data/hora da visita, corretor, `company_id`, `whatsapp_ai_phone`.
- **Cancelamento:** `cancel_visit` cancela jobs pendentes do lead.
- **Dispatch:** edge `visit-reminder-dispatch` (cron a cada ~5 min) dispara webhooks pendentes.
- **Próximo:** configurar Cron no Supabase Dashboard chamando `visit-reminder-dispatch` (opcional secret `VISIT_REMINDER_CRON_SECRET`).

## 2026-06-03 — Fix: “Not Found” ao atribuir corretor da visita

- **Causa:** ao confirmar corretor, `assign_visit_broker` tentava mover o evento no Google Calendar; API retornava 404 com mensagem genérica `Not Found` (evento inexistente ou calendário de plantão ≠ calendário do corretor).
- **Correção:** `schedule-api` — em 404 do move, atribui corretor no CRM mesmo assim e devolve `calendar_sync_warning`; demais erros com mensagem em PT. Front: `assignVisitBroker` humaniza “Not Found”; toast de aviso se sync do calendário falhar.
- **Deploy:** `schedule-api` v29 em produção (`bfcssdogttmqeujgmxdf`).

## 2026-06-01 — Chat: composer unificado WhatsApp + Instagram

- **Motivo:** mudanças no WhatsApp (colar imagem, preview, anexo, áudio OGG) exigiam duplicar código no Instagram.
- **Solução:** módulos compartilhados — `useChatComposerMedia`, `ChatComposer`, `ChatMediaPreviewOverlay`, `chatMediaFiles.ts`, `chatImage.ts`, `clipboardImages.ts`.
- `ConversasViewPremium` e `ConversasViewInstagram` usam os mesmos componentes; Instagram alinhado a `pickVoiceRecorderMimeType` + `finalizeVoiceRecordingForWhatsapp` (OGG no webhook).
- **Fix IG foto no chat:** `insertMensagemOptimistic` — Instagram grava em `mensagens` (type IA + `conteudo_media`) antes do webhook, igual WhatsApp.
- **IG áudio MP4:** `voiceAudioInstagram.ts` — gravação/anexo/envio com `audio/mp4` (WhatsApp continua OGG).
- **Vídeo + PDF (WA + IG):** upload por tipo (`uploadChatMedia`), insert otimista (`sendChatMediaItems`), webhook `video`/`arquivo`, exibição `ChatMessageMediaBody` (player MP4 + card PDF).
- **Limite vídeo 16 MB:** `compressChatVideo.ts` (ffmpeg.wasm H.264) ao anexar; se não couber, toast com `ChatVideoSizeLimitError`.
- **Próximo:** opcional unificar bolhas; deploy front Hostinger após build.

## 2026-06-01 — Config IA: agendamento de visitas (DB + schedule-api)

- Migration `20260601120000_companies_ai_visit_scheduling.sql`: `ai_visit_broker_mode`, `ai_visit_priority_criterion`, `ai_visit_broker_priorities` + validação em `update_own_company`.
- `schedule-api` `book_visit`: lê config por `company_id`; aplica fila, prioridade (nota / ordem plantão / menos visitas no dia) ou manual (visita sem corretor no lead).
- Front: salva no banco via RPC; migra `localStorage` legado uma vez; aviso verde “regra ativa”.
- Painel: card **Visitas aguardando corretor** em `/ai-configuration` + `assign_visit_broker` na `schedule-api` (move evento Google + atualiza lead).
- Testes: `pnpm test` (node) em `src/lib/aiVisitScheduling.test.ts`; `pnpm test:visit-scheduling` (deno, se instalado).
- **Deploy produção (imobi / MCP `user-imobi`):**
  - Migrations aplicadas: `companies_ai_visit_scheduling_columns`, `companies_ai_visit_scheduling_rpcs`, `update_own_company_ai_visit_scheduling`, `get_own_company_restore_business_hours_summary`.
  - `schedule-api` **v28** (`verify_jwt: true`); fix typo `addMins(...)` em `index.ts` antes do bundle.
  - Front Hostinger: ainda requer `pnpm build` + SFTP conforme CI (não feito nesta sessão).

## 2026-05-28 — schedule-api: fix book_visit + deploy v25–v26

- `book_visit`: grava `freeBroker` no pré-check e envia `calendar_id` + `broker_id` para `google-calendar-api` com `use_broker_queue: false` (alinha com `check_availability`).
- Filtro de expediente unificado: `reqMin + SLOT_MIN <= fim` (igual busca direta).
- Erros diferenciados: `error_code` (`outside_schedule`, `slot_busy`, `calendar_error`, `booking_failed`, `auth_error`) e mensagens distintas para conflito vs falha técnica (500).
- v26: repassa `Authorization`/`apikey` do request (n8n JWT) nas chamadas internas a `google-calendar-api` — evita 401 Invalid JWT quando env `SUPABASE_SERVICE_ROLE_KEY` é `sb_secret_*`.
- Deploy produção: `schedule-api` v26 (`bfcssdogttmqeujgmxdf`).

## 2026-03-25 — Remoção de marca legada anterior / padronização WhatsApp

- Marca e textos: substituídos por IAFÉ IMOBI; emails de exemplo em seed/docs para `*@iafeimobi.local`; suporte `contato@iafeimobi.com.br` no alerta de assinatura.
- Banco (migrations): tabela consolidada `crm_whatsapp_messages`, sequence `crm_whatsapp_messages_id_seq`, shards `crm_whatsapp_messages_{telefone}`; views `vw_crm_whatsapp_*`; migration `20260325150000_rename_legacy_whatsapp_messages_to_crm.sql` para projetos que ainda tinham nomes antigos.
- Código: `types`, hooks (realtime/chat), métricas, webhooks e scraper alinhados aos novos identificadores.
- Regra Cursor: `iafe-imobi-rule-development.mdc` (substitui arquivo antigo).

## 2026-01-12 - Sistema Multi-Empresa e Painel Admin

### Resumo
Implementacao completa do sistema multi-empresa com painel administrativo global para gerenciamento de empresas, controle de assinaturas e bloqueio de acesso.

### Alteracoes Realizadas

#### Banco de Dados (Supabase)
- Novos campos em `companies`:
  - `subscription_status` (trial, active, grace, expired, blocked, cancelled)
  - `subscription_expires_at`, `trial_ends_at`
  - `grace_period_days`, `blocked_at`, `block_reason`
  - `billing_email`, `admin_notes`, `last_activity_at`
- Nova tabela `company_access_logs` para historico de acoes
- `user_profiles.company_id` agora permite NULL (para super_admin)

#### Funcoes SQL
- `is_super_admin()` - verifica se usuario e super_admin
- `check_company_access(UUID)` - verifica status de acesso da empresa
- `check_current_user_access()` - verifica acesso do usuario atual
- `block_company()` / `unblock_company()` - bloqueio/desbloqueio
- `renew_subscription()` - renovar assinatura
- `create_company_with_trial()` - criar empresa com trial
- `list_all_companies()` - listar todas empresas (super_admin)
- `get_admin_metrics()` - metricas globais
- `get_company_details()` - detalhes completos
- `update_expired_company_status()` - atualizar empresas expiradas
- View `companies_needing_attention` - empresas que precisam de atencao

#### RLS Policies
- Novas policies para super_admin em `companies` e `user_profiles`
- Policies para `company_access_logs`

#### Frontend
- Novo hook `useCompanyAccess` - verificar status de acesso
- Novo hook `useAdminCompanies` - operacoes administrativas
- Componente `BlockedAccessScreen` - tela de bloqueio
- Componente `GracePeriodBanner` - aviso de carencia
- `LoginPage` atualizado para verificar status da empresa
- Painel Admin completo:
  - `AdminLayout` - layout com sidebar administrativa
  - `AdminDashboard` - metricas e visao geral
  - `AdminCompanyList` - listagem com filtros e acoes
  - `AdminCompanyCreate` - wizard de criacao
  - `AdminCompanyDetails` - visualizacao/edicao
  - `AdminAccessLogs` - historico de acoes

#### Tipos Atualizados
- `UserProfile.role` agora inclui `super_admin`
- `UserProfile.company_id` agora aceita `null`

### Arquivos Criados
- `src/hooks/useCompanyAccess.ts`
- `src/hooks/useAdminCompanies.ts`
- `src/components/shared/SubscriptionAlert.tsx`
- `src/components/admin/AdminLayout.tsx`
- `src/components/admin/AdminDashboard.tsx`
- `src/components/admin/AdminCompanyList.tsx`
- `src/components/admin/AdminCompanyCreate.tsx`
- `src/components/admin/AdminCompanyDetails.tsx`
- `src/components/admin/AdminAccessLogs.tsx`
- `supabase/migrations/20260112000000_multi_tenant_subscription.sql`

### Arquivos Modificados
- `src/App.tsx` - integracao com AdminLayout e verificacao de acesso
- `src/components/LoginPage.tsx` - verificacao de status da empresa
- `src/hooks/useUserProfile.ts` - suporte a super_admin
- `src/hooks/usePermissions.ts` - suporte a super_admin
- `src/components/AppSidebar.tsx` - labels para super_admin

---

## 2026-01-12 (Continuacao) - Correcao de Seguranca e Edicao de Empresa

### Resumo
Corrigido problema critico de seguranca em RLS e adicionada funcionalidade para admin/gestor editar dados da propria empresa.

### Correcoes de Seguranca

#### PROBLEMA CRITICO CORRIGIDO
- Tabela `imoveisvivareal` tinha policy `imoveisvivareal_all` com `USING (true)` - qualquer usuario podia ver TODOS os imoveis de TODAS as empresas!

#### Novas Policies Seguras
- `imoveisvivareal_select_by_company` - SELECT filtrado por company_id
- `imoveisvivareal_insert_by_company` - INSERT apenas na propria empresa
- `imoveisvivareal_update_by_company` - UPDATE apenas na propria empresa
- `imoveisvivareal_delete_by_company` - DELETE apenas para admin/gestor da propria empresa

#### Policy Adicional
- `companies_update_own` - permite admin/gestor editar dados da propria empresa

### Novas Funcoes SQL
- `get_own_company()` - retorna dados da empresa do usuario atual
- `update_own_company(name, email, cnpj, phone, address)` - edita dados basicos da empresa

### Novos Arquivos Frontend
- `src/hooks/useOwnCompany.ts` - hook para gerenciar dados da propria empresa
- `src/components/CompanyDataEditor.tsx` - formulario de edicao de dados da empresa
- `src/components/ConfigurationsViewSimple.tsx` - tela de configuracoes simplificada

### Arquivos Modificados
- `src/pages/Index.tsx` - usa ConfigurationsViewSimple no lugar de ConfigurationsView

### Fluxo de Edicao de Empresa
1. Admin/Gestor acessa menu "Configuracoes"
2. Visualiza status da assinatura (trial/ativo/carencia/expirado)
3. Pode editar: Nome, Email, CNPJ, Telefone, Endereco
4. Informacoes do plano sao somente leitura

---

## 2026-01-12 (Continuacao 2) - Sistema de Impersonacao para Super Admin

### Resumo
Implementado sistema que permite ao super_admin acessar o sistema como qualquer outro usuario para suporte e verificacao.

### Banco de Dados

#### Nova Tabela
- `impersonation_sessions` - Registro de todas as sessoes de impersonacao com auditoria completa
  - `super_admin_id` - Quem iniciou a impersonacao
  - `impersonated_user_id` - Usuario sendo impersonado
  - `impersonated_email` - Email do usuario impersonado
  - `impersonated_company_id` - Empresa do usuario
  - `reason` - Motivo da impersonacao
  - `started_at` / `ended_at` - Duracao da sessao
  - `is_active` - Se a sessao ainda esta ativa

#### Novas Funcoes SQL
- `start_impersonation(user_id, reason)` - Inicia sessao de impersonacao
- `end_impersonation()` - Encerra sessao ativa
- `get_active_impersonation()` - Verifica se ha sessao ativa
- `list_users_for_impersonation(company_id, search)` - Lista usuarios disponiveis
- `get_impersonation_history(limit)` - Historico de impersonacoes

### Frontend

#### Novos Arquivos
- `src/hooks/useImpersonation.ts` - Hook para gerenciar impersonacao
- `src/components/admin/AdminImpersonation.tsx` - Tela para selecionar usuario
- `src/components/ImpersonationBanner.tsx` - Banner fixo mostrando sessao ativa

#### Arquivos Modificados
- `src/components/admin/AdminLayout.tsx` - Novo menu "Acessar Contas"
- `src/App.tsx` - Adicionado ImpersonationBanner

### Como Funciona

1. Super admin acessa "Acessar Contas" no painel administrativo
2. Busca usuario por nome, email ou empresa
3. Clica em "Acessar" e opcionalmente informa motivo
4. Sistema registra a sessao e redireciona para o dashboard do usuario
5. Banner amarelo fica visivel no topo mostrando que esta impersonando
6. Clicando em "Voltar ao Painel Admin" encerra a sessao

### Seguranca
- Todas as sessoes sao registradas na tabela `impersonation_sessions`
- Log de acesso da empresa tambem e atualizado
- Nao e possivel impersonar outro super_admin
- Apenas super_admin pode usar esta funcionalidade
- RLS aplicado na tabela de sessoes

### Proximos Passos
1. Criar Edge Function para envio de emails de aviso de expiracao
2. Implementar pg_cron para execucao automatica de `check_and_update_subscriptions()`
3. Testar fluxo completo de criacao de empresa e bloqueio
4. Adicionar dashboard de metricas por empresa
5. Mover funcionalidade de logo/personalizacao para painel admin

### Como Criar Super Admin
```sql
-- Primeiro criar usuario no auth.users via Supabase Dashboard
-- Depois criar perfil:
INSERT INTO public.user_profiles (id, email, full_name, role, company_id, is_active)
VALUES (
  'UUID_DO_USUARIO_AUTH',
  'admin@iafeimobi.local',
  'Super Administrador',
  'super_admin',
  NULL,
  true
);
```
