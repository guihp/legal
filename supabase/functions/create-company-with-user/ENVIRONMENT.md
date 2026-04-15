# Variáveis de ambiente (Supabase Edge Function)

Configure estas variáveis no projeto Supabase para a função `create-company-with-user`:

- `ASAAS_ENABLED`  
  - `true` para habilitar cobrança automática no cadastro.
  - `false` para desabilitar integração de pagamento.

- `ASAAS_API_BASE_URL`  
  - Sandbox: `https://api-sandbox.asaas.com`
  - Produção: `https://api.asaas.com`

- `ASAAS_API_KEY`  
  - Chave de API do Asaas (sandbox ou produção conforme a URL).

- `SUPABASE_URL`  
  - URL do projeto Supabase.

- `SUPABASE_ANON_KEY`  
  - Chave anônima do projeto.

- `SUPABASE_SERVICE_ROLE_KEY`  
  - Chave service role do projeto.

## Exemplo (Sandbox)

```bash
ASAAS_ENABLED=true
ASAAS_API_BASE_URL=https://api-sandbox.asaas.com
ASAAS_API_KEY=coloque_sua_chave_sandbox_aqui
```

## Envio de email (Resend)

- `RESEND_ENABLED`  
  - `true` para enviar email com credenciais ao finalizar cadastro.
  - `false` para desabilitar envio.

- `RESEND_API_KEY`  
  - Chave da API Resend.

- `RESEND_FROM_EMAIL`  
  - Remetente validado no Resend (ex.: `onboarding@seudominio.com`).

- `RESEND_API_BASE_URL`  
  - Padrão: `https://api.resend.com`

- `PUBLIC_APP_URL`  
  - URL pública da aplicação para o link de acesso no email.

### Exemplo

```bash
RESEND_ENABLED=true
RESEND_API_KEY=coloque_sua_chave_resend_aqui
RESEND_FROM_EMAIL=onboarding@seudominio.com
RESEND_API_BASE_URL=https://api.resend.com
PUBLIC_APP_URL=https://app.seudominio.com
```

## Google Calendar (OAuth por empresa)

Use estas variáveis para conexão automática no módulo de Agenda/Plantão:

- `GOOGLE_CLIENT_ID`
  - Client ID OAuth 2.0 do Google Cloud.

- `GOOGLE_CLIENT_SECRET`
  - Client Secret OAuth 2.0.

- `GOOGLE_REDIRECT_URI`
  - URL de callback cadastrada no Google Cloud.
  - Exemplo produção: `https://imobi.iafeoficial.com/auth/google/callback`
  - Exemplo local: `http://localhost:8081/auth/google/callback`

### Exemplo

```bash
GOOGLE_CLIENT_ID=coloque_o_client_id_aqui
GOOGLE_CLIENT_SECRET=coloque_o_client_secret_aqui
GOOGLE_REDIRECT_URI=https://imobi.iafeoficial.com/auth/google/callback
```

## Troca para Produção (sem hardcode)

Basta alterar no Supabase:

```bash
ASAAS_API_BASE_URL=https://api.asaas.com
ASAAS_API_KEY=coloque_sua_chave_producao_aqui
```

Não é necessário alterar código para trocar sandbox/produção.
