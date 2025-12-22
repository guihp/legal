# 🚀 Guia de Deploy no Coolify

Este documento descreve como fazer deploy do IMOBIPRO no Coolify.

## ✅ Pré-requisitos

- Projeto configurado no Coolify
- Banco de dados Supabase já configurado com dados existentes
- Webhooks N8N já configurados e funcionando

## 📋 Configuração no Coolify

### 1. Criar Novo Serviço

1. No painel do Coolify, clique em **"New Resource"**
2. Selecione **"Docker Compose"** ou **"Docker Image"**
3. Selecione **"From GitHub"** ou **"From GitLab"** conforme seu repositório

### 2. Configurar Variáveis de Ambiente

No painel do Coolify, adicione as seguintes variáveis de ambiente no campo **"Environment Variables"**:

#### **Obrigatórias:**

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

#### **Opcionais (conforme sua configuração):**

```env
VITE_WHATSAPP_API_BASE=https://devlabz.n8nlabz.com.br/webhook
VITE_EVOLUTION_API_URL=https://api.evolution.com.br
VITE_VIVAREAL_API_KEY=sua_api_key_vivareal
VITE_EMAIL_SERVICE_URL=https://seu-servico-email.com
```

**⚠️ IMPORTANTE:** 
- As variáveis `VITE_*` são injetadas no momento do **build** do Docker
- Configure todas as variáveis antes de iniciar o build
- O Coolify pode solicitar que você defina essas variáveis como **Build Arguments** ou **Environment Variables**

### 3. Configurações de Build

#### Se usar **Docker Compose:**
Não é necessário - o Dockerfile está configurado corretamente.

#### Se usar **Docker Image diretamente:**
- **Dockerfile path:** `Dockerfile` (raiz do projeto)
- **Context:** `.` (raiz do projeto)
- **Build command:** O Coolify fará o build automaticamente usando o Dockerfile

### 4. Portas

O nginx está configurado para escutar na porta **80**. O Coolify geralmente mapeia automaticamente, mas verifique:

- **Porta do Container:** `80`
- **Porta Pública:** Configure conforme necessário (ex: `80`, `443`)

### 5. Health Check

O container já inclui um healthcheck configurado no Dockerfile, mas você pode adicionar manualmente no Coolify:

- **Health Check Path:** `/health`
- **Health Check Port:** `80`

## 🔄 Processo de Deploy

1. **Push para o repositório** (se conectado via Git)
2. **Ou faça upload** do código no Coolify
3. O Coolify irá:
   - Fazer pull do código
   - Executar `docker build` usando o Dockerfile
   - Durante o build, as variáveis `VITE_*` serão injetadas no código
   - O resultado será uma imagem Docker com nginx servindo os arquivos estáticos
   - Iniciar o container

## ✅ Verificação Pós-Deploy

1. **Acesse a URL** fornecida pelo Coolify
2. **Verifique o console do navegador** para erros de conexão com Supabase
3. **Teste o login** com um usuário existente no banco
4. **Verifique os módulos principais:**
   - Dashboard carrega corretamente
   - Leads aparecem na lista
   - Propriedades são exibidas
   - Conexões WhatsApp funcionam (se configurado)

## 🐛 Troubleshooting

### Erro: "Configuração do Supabase ausente"

**Causa:** Variáveis de ambiente não foram configuradas corretamente.

**Solução:**
1. Verifique se `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão configuradas no Coolify
2. Certifique-se de que estão marcadas como **Build Arguments** ou disponíveis durante o build
3. Faça um rebuild completo da aplicação

### Erro: "404 Not Found" em rotas

**Causa:** Nginx não está fazendo fallback corretamente para `index.html`.

**Solução:**
1. Verifique se o arquivo `nginx.conf` está sendo copiado corretamente no Dockerfile
2. Verifique os logs do container: `docker logs <container_id>`
3. Acesse `/health` para verificar se o nginx está rodando

### Build falha

**Causa:** Dependências não estão instalando corretamente.

**Solução:**
1. Verifique se `package.json` e `pnpm-lock.yaml` (ou `package-lock.json`) estão presentes
2. Verifique os logs de build no Coolify
3. Tente fazer build localmente primeiro para identificar o problema

### Imagem muito grande

**Causa:** O multi-stage build deveria reduzir o tamanho, mas pode haver problemas.

**Solução:**
1. O Dockerfile já está otimizado com multi-stage build
2. A imagem final usa apenas `nginx:alpine` (muito leve)
3. Se ainda estiver grande, verifique se não há arquivos desnecessários sendo copiados

## 📝 Notas Importantes

- ✅ **Não há seeds sendo executados automaticamente** - o projeto apenas faz build e serve os arquivos estáticos
- ✅ **Dados existentes no banco são preservados** - nenhuma operação de banco é executada durante o deploy
- ✅ **Webhooks externos** continuam funcionando normalmente - são chamados via API externa
- ✅ **Build otimizado** - usando multi-stage build para reduzir tamanho da imagem final
- ✅ **Health check incluído** - monitoramento automático da aplicação

## 🔗 Links Úteis

- [Documentação do Coolify](https://coolify.io/docs)
- [Documentação do Nginx](https://nginx.org/en/docs/)
- [Documentação do Vite](https://vitejs.dev/)

---

**Última atualização:** Janeiro 2025




