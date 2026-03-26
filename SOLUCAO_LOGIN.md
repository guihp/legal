# 🔧 Solução para Erro de Login

## ❌ Erro Atual
```
Não foi possível encontrar um servidor com o nome de host especificado.
Fetch API cannot load https://bfcssdogttmqeujgmxdf.supabase.co/auth/v1/token
```

## ✅ Solução Passo a Passo

### 1. Marcar "Use Docker Build Secrets" (CRÍTICO)
- [ ] No Coolify, vá em "Environment Variables"
- [ ] **MARQUE** o checkbox "Use Docker Build Secrets"
- [ ] Clique em "Save All Environment Variables"

### 2. Verificar URL do Supabase
Verifique no Supabase Dashboard:
- [ ] Vá em Settings > API
- [ ] Confirme que a URL é: `https://bfcssdogttmqeujgmxdf.supabase.co`
- [ ] Confirme que a `anon` key está correta

### 3. Redeploy Completo
- [ ] Clique em "Redeploy" no Coolify
- [ ] Aguarde o build completar (pode demorar alguns minutos)
- [ ] Verifique os logs para garantir que não há erros de build

### 4. Testar Novamente
- [ ] Acesse a aplicação
- [ ] Abra o console do navegador (F12)
- [ ] Tente fazer login
- [ ] Verifique se o erro persiste

## 🔍 Diagnóstico Adicional

Se o erro persistir após fazer tudo acima:

1. **Testar URL do Supabase:**
   ```bash
   curl https://bfcssdogttmqeujgmxdf.supabase.co/rest/v1/
   ```
   Deve retornar uma resposta (mesmo que seja erro de autenticação)

2. **Verificar se as variáveis foram injetadas:**
   - No console do navegador, verifique se há mensagem:
     - ❌ "Configuração do Supabase ausente" = variáveis não foram injetadas
     - ✅ "Supabase inicializado" = variáveis estão OK

3. **Possíveis causas alternativas:**
   - Problema de rede/DNS no servidor do Coolify
   - URL do Supabase incorreta
   - Firewall bloqueando conexões

## 📝 Variáveis Configuradas (Estão Corretas)

```
VITE_SUPABASE_URL=https://bfcssdogttmqeujgmxdf.supabase.co
VITE_SUPABASE_ANON_KEY=<copie em Supabase Dashboard → Settings → API → anon public>
VITE_WHATSAPP_API_BASE=https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook
VITE_EVOLUTION_API_URL=https://evo-sw04w08owc0gocsgoow8okcg.vemprajogo.com
VITE_DEFAULT_NEW_USER_PASSWORD=Imobi@1234
```




