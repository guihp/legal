# n8n — gravar mensagem de texto (sem erro 409)

## O que mudou

- **Antes:** nó Supabase → *Create row* em `mensagens` → falha se o mesmo `mensagem_id` (wamid) chegar de novo.
- **Agora:** HTTP POST na edge **`mensagem-ingest`**, que chama a RPC **`upsert_mensagem`** no Postgres (idempotente).

## URL (produção)

`POST https://bfcssdogttmqeujgmxdf.supabase.co/functions/v1/mensagem-ingest`

## Headers (iguais ao `mensagem-media-ingest`)

| Header | Valor |
|--------|--------|
| `apikey` | service_role do projeto |
| `Authorization` | `Bearer <mesma service_role>` |
| `Content-Type` | `application/json` |

## Body JSON (expressões n8n)

```json
{
  "company_id": "={{ $('When Executed by Another Workflow').first().json.company_ID }}",
  "phone": "={{ $('When Executed by Another Workflow').first().json.remoteJid }}",
  "mensagem_id": "={{ $('When Executed by Another Workflow').first().json.messageId }}",
  "mensage_type": "={{ $('When Executed by Another Workflow').first().json.messageType }}",
  "text": "={{ $('When Executed by Another Workflow').first().json.conversation }}",
  "type": "lead",
  "plataforma": "WhatsApp"
}
```

## Passos no n8n Cloud

1. Abra o workflow com o nó **Adicioanar mensagem usuario texto**.
2. **Apague** o nó Supabase (*Create row*).
3. Adicione **HTTP Request** com os campos acima (ou importe `n8n/adicionar-mensagem-usuario-texto-upsert.json` e copie o nó).
4. Reconecte as entradas/saídas do fluxo.
5. **Salve** e **Publish** o workflow na nuvem.

Resposta esperada: `{ "ok": true, "row": { ... } }` — inclusive quando o wamid já existia (sem 409).

## RPC direta (opção B pura)

`POST https://bfcssdogttmqeujgmxdf.supabase.co/rest/v1/rpc/upsert_mensagem`

Body com prefixo `p_`:

```json
{
  "p_company_id": "uuid",
  "p_phone": "5511...",
  "p_mensagem_id": "wamid...",
  "p_mensage_type": "conversation",
  "p_text": "texto",
  "p_type": "lead",
  "p_plataforma": "WhatsApp"
}
```

Header extra: `Prefer: return=representation`
