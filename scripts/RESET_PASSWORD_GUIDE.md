# 🔐 Guia para Resetar Senhas de Usuários

Este guia explica como resetar senhas de usuários no sistema IMOBIPRO.

## 📋 Métodos Disponíveis

### **Método 1: Via Supabase Dashboard (Mais Fácil)** ⭐ RECOMENDADO

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto: `bfcssdogttmqeujgmxdf`
3. Vá em **Authentication** > **Users**
4. Encontre o usuário pelo email
5. Clique nos **3 pontos** ao lado do usuário
6. Selecione **Reset Password**
7. O sistema enviará um email de reset (ou você pode definir uma nova senha diretamente)

---

### **Método 2: Via Edge Function (Programático)**

#### **Passo 1: Fazer Deploy da Edge Function**

```bash
cd /Volumes/HD/Downloads/imobipro-main

# Fazer login no Supabase CLI
supabase login

# Linkar ao projeto
supabase link --project-ref bfcssdogttmqeujgmxdf

# Deploy da função
supabase functions deploy admin-reset-password
```

#### **Passo 2: Obter Token Admin**

Você precisa do token JWT de um usuário admin:

1. Faça login no sistema como admin
2. Abra o DevTools do navegador (F12)
3. Vá em **Application** > **Local Storage** > `http://localhost:5173`
4. Procure por `sb-<project>-auth-token`
5. Copie o valor (é um JSON, pegue o `access_token`)

Ou use o script para obter via login:

```bash
# Criar um script de login temporário
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://bfcssdogttmqeujgmxdf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmY3NzZG9ndHRtcWV1amdteGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MjMwOTcsImV4cCI6MjA3NjA5OTA5N30.fVPtCjUKT3upBOIf7mm9pB2uxqlMfnMZjYd2cmb9bdg'
);
supabase.auth.signInWithPassword({
  email: 'admin@imobipro.com',
  password: 'admin123'
}).then(({ data, error }) => {
  if (error) console.error('Erro:', error);
  else console.log('Token:', data.session.access_token);
});
"
```

#### **Passo 3: Resetar Senha**

```bash
# Usar o script Node.js
node scripts/reset-user-password.js <email> <nova_senha> <admin_token>

# Exemplo:
node scripts/reset-user-password.js usuario@exemplo.com NovaSenha123 eyJhbGc...
```

---

### **Método 3: Via SQL Direto (Avançado)**

⚠️ **ATENÇÃO**: Este método requer acesso direto ao banco de dados.

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Execute o script `scripts/list-users.sql` para ver os usuários
4. Use a função `crypt` para criar uma nova senha:

```sql
-- Resetar senha de um usuário específico
UPDATE auth.users
SET 
  encrypted_password = crypt('NovaSenha123', gen_salt('bf')),
  updated_at = NOW()
WHERE email = 'usuario@exemplo.com';
```

---

## 🔍 Listar Usuários Cadastrados

Para ver todos os usuários cadastrados:

### Via SQL Editor:
1. Acesse Supabase Dashboard > SQL Editor
2. Execute o arquivo `scripts/list-users.sql`

### Via Script Node.js (criar se necessário):
```bash
node scripts/list-users.js
```

---

## 📝 Exemplo Completo

### Cenário: Resetar senha de dois usuários

**Usuário 1:**
- Email: `usuario1@exemplo.com`
- Nova senha: `SenhaSegura123`

**Usuário 2:**
- Email: `usuario2@exemplo.com`
- Nova senha: `SenhaSegura456`

**Passos:**

1. **Listar usuários** (SQL Editor):
```sql
SELECT email, full_name, role FROM public.user_profiles;
```

2. **Resetar via Dashboard:**
   - Authentication > Users
   - Encontrar cada usuário
   - Reset Password

3. **Ou via Edge Function** (após deploy):
```bash
# Obter token admin primeiro
ADMIN_TOKEN=$(node -e "console.log('seu_token_aqui')")

# Resetar usuário 1
node scripts/reset-user-password.js usuario1@exemplo.com SenhaSegura123 $ADMIN_TOKEN

# Resetar usuário 2
node scripts/reset-user-password.js usuario2@exemplo.com SenhaSegura456 $ADMIN_TOKEN
```

---

## ⚠️ Segurança

- ✅ Sempre use senhas fortes (mínimo 8 caracteres, maiúsculas, números)
- ✅ Apenas admins podem resetar senhas
- ✅ Registre todas as operações de reset de senha
- ✅ Notifique os usuários quando suas senhas forem resetadas

---

## 🆘 Troubleshooting

### "Unauthorized" ao chamar Edge Function
- Verifique se o token admin é válido
- Certifique-se de que o usuário tem role 'admin'

### "User not found"
- Verifique se o email está correto
- Execute `list-users.sql` para ver todos os usuários

### Edge Function não encontrada
- Certifique-se de que fez o deploy: `supabase functions deploy admin-reset-password`
- Verifique se o projeto está linkado: `supabase link --project-ref bfcssdogttmqeujgmxdf`

---

## 📞 Suporte

Se precisar de ajuda, verifique:
- Logs da Edge Function no Supabase Dashboard
- Console do navegador para erros de autenticação
- Documentação do Supabase: https://supabase.com/docs








