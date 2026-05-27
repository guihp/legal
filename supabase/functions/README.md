# Edge Functions — IAFÉ IMOBI

Este diretório contém as Edge Functions do projeto. Executam lógica server-side com permissões SERVICE_ROLE quando necessário.

## Functions Disponíveis

### 1. admin-create-user
**Arquivo:** `admin-create-user/index.ts`
**Propósito:** Criar perfis de usuário com validação de permissões
**Permissões:** Admins podem criar qualquer role; Gestores podem criar apenas corretor/gestor
**Endpoint:** `POST /functions/v1/admin-create-user`

**Body da requisição:**
```json
{
  "email": "usuario@exemplo.com",
  "role": "corretor",
  "company_id": "uuid-da-empresa"
}
```

### 2. admin-update-user
**Arquivo:** `admin-update-user/index.ts`
**Propósito:** Atualizar perfis de usuário existentes
**Permissões:** Admins podem atualizar qualquer usuário; Gestores apenas da mesma empresa
**Endpoint:** `POST /functions/v1/admin-update-user`

### 3. admin-delete-user
**Arquivo:** `admin-delete-user/index.ts`
**Propósito:** Desativar usuários (soft delete)
**Permissões:** Admins podem deletar qualquer usuário; Gestores apenas da mesma empresa
**Endpoint:** `POST /functions/v1/admin-delete-user`

### 4. admin-reset-password
**Arquivo:** `admin-reset-password/index.ts`
**Propósito:** Resetar senha de usuários
**Permissões:** Apenas admins podem resetar senhas
**Endpoint:** `POST /functions/v1/admin-reset-password`

**Body da requisição:**
```json
{
  "email": "usuario@exemplo.com",
  "new_password": "NovaSenha123"
}
```

Ou usando user_id:
```json
{
  "user_id": "uuid-do-usuario",
  "new_password": "NovaSenha123"
}
```

### 5. mensagem-media-ingest
**Arquivo:** `mensagem-media-ingest/index.ts`  
**Propósito:** INSERT em `public.mensagens` + upload no bucket `company-assets` numa única chamada (sem nó Supabase no n8n para mídia).  
**Endpoint:** `POST /functions/v1/mensagem-media-ingest`

**Autenticação (mesmo padrão das tools HTTP do agente n8n):**
- Header `apikey`: service_role key do projeto
- Header `Authorization`: `Bearer <service_role key>`

**Modo recomendado — Form-Data + arquivo binário do n8n (após nó que baixa a mídia):**

No HTTP Request:
- Method: POST
- URL: `https://<project>.supabase.co/functions/v1/mensagem-media-ingest`
- Headers: `apikey` + `Authorization` (service_role, igual `property-search-api`)
- **Send Body:** ON
- **Body Content Type:** `Form-Data`
- Parâmetro binário:
  - **Parameter Type:** `n8n Binary File`
  - **Name:** `file`
  - **Input Data Field Name:** `data` (nome da aba Binary do nó anterior, ex. `baixar o arquivo`)
- Parâmetros texto (Form Data → Text):
  - `company_id`, `phone`, `mensagem_id` (obrigatórios)
  - `text` = legenda (opcional)
  - `mensage_type`, `type` (`lead`), `plataforma` (`WhatsApp`)

**Recomendado — JSON + `source_url` (1 nó HTTP; sem Supabase e sem “baixar arquivo”):**
```json
{
  "company_id": "uuid-da-empresa",
  "phone": "5511999999999",
  "mensagem_id": "wamid....",
  "source_url": "https://lookaside.fbsbx.com/...",
  "mensage_type": "audio",
  "text": "legenda opcional",
  "type": "lead",
  "plataforma": "WhatsApp",
  "fetch_authorization": "Bearer <token_api_whatsapp_meta>"
}
```

A edge: baixa a mídia → Storage → **INSERT** em `mensagens` (`text` + `conteudo_media`).

**Limite:** 25 MB por arquivo.

**Fluxo n8n mídia:** `If` (não é texto) → **só** HTTP Request → `mensagem-media-ingest`.

**Não use** `file_base64` no body — aumenta payload e custo.

### 6. mensagem-ingest
**Arquivo:** `mensagem-ingest/index.ts`  
**Propósito:** Gravar mensagem de **texto** em `public.mensagens` de forma **idempotente** (`upsert_mensagem` no Postgres). Evita erro 409 quando o n8n reenvia o mesmo `wamid`.  
**Endpoint:** `POST /functions/v1/mensagem-ingest`

**Autenticação:** igual `mensagem-media-ingest` (`apikey` + `Authorization: Bearer <service_role>`).

**Body JSON:**
```json
{
  "company_id": "uuid-da-empresa",
  "phone": "5511999999999",
  "mensagem_id": "wamid....",
  "mensage_type": "conversation",
  "text": "conteúdo da mensagem",
  "type": "lead",
  "plataforma": "WhatsApp",
  "instancia": "opcional"
}
```

**n8n:** substitua o nó Supabase *Create row* em `mensagens` por um **HTTP Request** para esta URL (ou importe `n8n/adicionar-mensagem-usuario-texto-upsert.json`).

**Alternativa direta (RPC):** `POST /rest/v1/rpc/upsert_mensagem` com parâmetros `p_company_id`, `p_phone`, `p_mensagem_id`, etc.

### 7. vivareal-scraper
**Arquivo:** `vivareal-scraper/index.ts`
**Propósito:** Fazer scraping interno do VivaReal para importar imóveis automaticamente
**Permissões:** Usuários autenticados podem importar imóveis da sua empresa
**Endpoint:** `POST /functions/v1/vivareal-scraper`

**Body da requisição:**
```json
{
  "url": "https://www.vivareal.com.br/imobiliaria/668348/"
}
```

**Funcionalidades:**
- Extrai todos os imóveis de uma imobiliária do VivaReal
- Processa em lotes para evitar sobrecarga
- Baixa e faz upload de imagens para Supabase Storage
- Extrai todas as informações: preço, localização, quartos, banheiros, vagas, metragem, descrição, etc.
- Valida e deduplica imóveis antes de inserir

## Comandos de Deploy

### Pré-requisitos
```bash
# Instalar Supabase CLI
npm install -g @supabase/cli

# Login no Supabase
supabase login

# Linkar ao projeto de destino
supabase link --project-ref <PROJECT_REF_DO_DESTINO>
```

### Deploy Individual das Functions
```bash
# Deploy da função de criar usuário
supabase functions deploy admin-create-user

# Deploy da função de atualizar usuário  
supabase functions deploy admin-update-user

# Deploy da função de deletar usuário
supabase functions deploy admin-delete-user

# Deploy da função de resetar senha
supabase functions deploy admin-reset-password

# Deploy da função de scraping VivaReal
supabase functions deploy vivareal-scraper
```

### Deploy de Todas as Functions
```bash
# Deploy de todas as functions de uma vez
supabase functions deploy admin-create-user admin-update-user admin-delete-user
```

### Configuração de Variáveis de Ambiente
As functions precisam das seguintes variáveis configuradas no projeto Supabase:

```bash
# Via Supabase CLI
supabase secrets set SUPABASE_URL=https://bfcssdogttmqeujgmxdf.supabase.co
supabase secrets set SUPABASE_ANON_KEY=sua-anon-key

# Via Supabase Dashboard
# Settings > Edge Functions > Environment Variables
```

## Estrutura das Functions

Todas as functions seguem o mesmo padrão:

1. **CORS Headers** - Permitir chamadas do frontend
2. **Autenticação** - Verificar JWT token válido
3. **Autorização** - Validar role do usuário (admin/gestor)
4. **Validação** - Verificar dados de entrada
5. **Operação** - Executar lógica de negócio
6. **Resposta** - Retornar resultado padronizado

## Segurança

- ✅ Todas as functions verificam autenticação via JWT
- ✅ Validação de roles (admin/gestor) antes de operações
- ✅ Gestores limitados ao escopo da própria empresa
- ✅ Admins têm acesso global mas são auditados
- ✅ Headers CORS configurados para produção

## Dependências

- `@supabase/supabase-js@2` - Cliente Supabase
- `deno std/http/server` - Servidor HTTP

## Troubleshooting

### Erro de Permissão
```
Error: Forbidden: Only admins and gestores can create users
```
**Solução:** Verificar se o usuário tem role 'admin' ou 'gestor' na tabela user_profiles

### Erro de Usuário Não Encontrado
```
Error: User not found in auth.users
```
**Solução:** Criar o usuário primeiro via Supabase Auth (Dashboard ou signup)

### Erro de Configuração
```
Error: Cannot access Supabase URL
```
**Solução:** Verificar se SUPABASE_URL e SUPABASE_ANON_KEY estão configuradas

## Logs e Monitoramento

Para visualizar logs das functions:
```bash
# Via CLI
supabase functions logs admin-create-user

# Via MCP Supabase (se disponível)
# Use get_logs com service: "edge-function"
```

## Versionamento

- Versão atual: 1.0.0
- Compatibilidade: Supabase-js v2
- Deno runtime: std@0.168.0
