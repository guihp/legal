# Fix: schedule-api book_visit

**Status: aplicado em 28/05/2026 — deploy `schedule-api` v25**

## Problema
No `book_visit`, o loop encontra o broker livre mas não salva qual é.
Depois chama `google-calendar-api` com `use_broker_queue: true`, que re-seleciona
qualquer broker (incluindo os que NÃO trabalham naquele dia).

## Correção necessária no index.ts

### ANTES (buggy) - linhas do quick availability check:
```typescript
let anyFree = false;
for (const b of available) {
  if (!b.calendar_id) continue;
  const busy = await checkBusy(gFetch, b.calendar_id, slotStart, slotEnd);
  if (busy.length === 0) { anyFree = true; break; }
}
if (!anyFree) return ok({ success: false, response: "Eita acabaram de agendar..." });
```

### DEPOIS (fixed):
```typescript
let freeBroker: any = null;
for (const b of available) {
  if (!b.calendar_id) continue;
  const busy = await checkBusy(gFetch, b.calendar_id, slotStart, slotEnd);
  if (busy.length === 0) { freeBroker = b; break; }
}
if (!freeBroker) return ok({ success: false, response: "Eita acabaram de agendar pra esse horário, teria alguma outra opção?" });
```

### ANTES (buggy) - createBody:
```typescript
const createBody: any = {
  action: "create_event_from_n8n",
  company_id: companyId,
  lead_id: sessionId,
  use_broker_queue: true,
  auto_reassign_on_conflict: true,
  start: slotStart,
  ...
};
```

### DEPOIS (fixed):
```typescript
const createBody: any = {
  action: "create_event_from_n8n",
  company_id: companyId,
  lead_id: sessionId,
  calendar_id: freeBroker.calendar_id,
  broker_id: freeBroker.assigned_user_id || "",
  use_broker_queue: false,
  auto_reassign_on_conflict: false,
  nome_cliente: nomeCliente,
  start: slotStart,
  ...
};
```
