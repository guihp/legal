# ✅ Checklist de Configuração no Coolify

## 🔧 Configurações Necessárias

### 1. Variáveis de Ambiente (OBRIGATÓRIO)
- [ ] Ir em "Environment Variables"
- [ ] Clicar em "+ Add"
- [ ] Adicionar cada variável abaixo:
  ```
  VITE_SUPABASE_URL=https://bfcssdogttmqeujgmxdf.supabase.co
  VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY_AQUI
  VITE_WHATSAPP_API_BASE=https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook
  VITE_EVOLUTION_API_URL=https://api.evolution.com.br
  VITE_DEFAULT_NEW_USER_PASSWORD=Imobi@1234
  ```
- [ ] **MARCAR** o checkbox "Use Docker Build Secrets" (importante!)
- [ ] Salvar

### 2. Porta (CORRIGIR)
- [ ] Ir em "General"
- [ ] Localizar "Ports Exposes"
- [ ] Alterar de `3000` para `80`
- [ ] Salvar

### 3. Redeploy
- [ ] Clicar em "Redeploy" após configurar tudo acima
- [ ] Aguardar o build completar
- [ ] Verificar se está funcionando acessando a URL

## ⚠️ Importante
- As variáveis VITE_* precisam estar disponíveis **durante o build**, não só em runtime
- Por isso é necessário marcar "Use Docker Build Secrets"
- Sem as variáveis, o build vai criar uma aplicação que não consegue conectar ao Supabase




