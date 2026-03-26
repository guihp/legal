# 📝 Processo de Atualização no Git e Coolify

Este documento descreve o processo padrão para fazer atualizações no código e subir para o Git, que automaticamente atualiza no Coolify.

## 🔄 Fluxo de Atualização

```
Código Local → Git Commit → Git Push → Coolify (Auto Deploy)
```

## 📋 Passo a Passo

### 1. Verificar Status do Git

```bash
cd /caminho/do/repositorio/legal
git status
```

**O que fazer:**
- Verificar quais arquivos foram alterados
- Confirmar que não há arquivos que não deveriam ser commitados (como `.env.local` com secrets)

### 2. Adicionar Arquivos ao Staging

```bash
git add -A
```

**Ou para adicionar arquivos específicos:**
```bash
git add caminho/do/arquivo.ts
git add src/components/MeuComponente.tsx
```

**O que isso faz:**
- Prepara os arquivos modificados para o commit
- `-A` adiciona todas as mudanças (novos, modificados e deletados)

### 3. Criar Commit

```bash
git commit -m "tipo: descrição curta

- Detalhe 1 da mudança
- Detalhe 2 da mudança
- Detalhe 3 da mudança"
```

**Formato de mensagem (Conventional Commits):**
- `feat:` - Nova funcionalidade
- `fix:` - Correção de bug
- `refactor:` - Refatoração de código
- `docs:` - Documentação
- `style:` - Formatação, espaços, etc (não muda funcionalidade)
- `chore:` - Tarefas de manutenção, atualização de dependências

**Exemplos:**
```bash
git commit -m "feat: adiciona máscara de telefone brasileiro"
git commit -m "fix: corrige erro de conexão com Supabase"
git commit -m "refactor: atualiza hook para usar webhook N8N"
```

### 4. Fazer Push para o GitHub

```bash
git push origin main
```

**O que isso faz:**
- Envia os commits locais para o repositório remoto no GitHub
- O Coolify está configurado para fazer deploy automático quando há push na branch `main`

### 5. Verificar Deploy no Coolify

Após o push:
1. Acesse o painel do Coolify
2. O deploy deve iniciar automaticamente (ou clique em "Redeploy" se necessário)
3. Verifique os logs do build
4. Aguarde o container reiniciar

## ⚠️ Importante

### ✅ ANTES de fazer commit:

1. **Verificar se não há erros de lint:**
   ```bash
   pnpm lint
   ```

2. **Verificar se compila:**
   ```bash
   pnpm build
   ```

3. **Não commitar arquivos sensíveis:**
   - `.env.local` (contém secrets)
   - `node_modules/` (já está no .gitignore)
   - Arquivos temporários

4. **Não commitar arquivos de configuração local:**
   - `.vscode/settings.json` (se for específico do seu ambiente)

### 🔍 Verificar o que será commitado:

```bash
git diff --cached
```

Mostra as diferenças que serão commitadas.

### 📝 Ver histórico de commits:

```bash
git log --oneline -10
```

Mostra os últimos 10 commits.

## 🔄 Processo Completo (Resumo Rápido)

```bash
# 1. Verificar mudanças
git status

# 2. Adicionar arquivos
git add -A

# 3. Fazer commit
git commit -m "tipo: descrição"

# 4. Enviar para GitHub
git push origin main
```

## 🚨 Em Caso de Erro

### Se o push falhar (conflitos):

```bash
# Atualizar código local primeiro
git pull origin main

# Resolver conflitos se houver
# Depois fazer push novamente
git push origin main
```

### Se commitou algo errado:

```bash
# Desfazer último commit (mantém as mudanças)
git reset --soft HEAD~1

# Ou desfazer completamente
git reset --hard HEAD~1
```

### Se precisa alterar último commit:

```bash
# Fazer as alterações necessárias
git add -A
git commit --amend -m "nova mensagem"
git push origin main --force
```

⚠️ **Cuidado com `--force`**: só use se tiver certeza que ninguém mais está trabalhando na branch.

## 📌 Checklist de Atualização

- [ ] Verificar `git status` - confirmar arquivos alterados
- [ ] Rodar `pnpm lint` - verificar erros de lint
- [ ] Rodar `pnpm build` - verificar se compila
- [ ] Criar commit com mensagem descritiva
- [ ] Fazer push para `origin main`
- [ ] Verificar deploy no Coolify
- [ ] Testar a aplicação após deploy

## 🎯 Exemplo Real de Atualização

**Cenário:** Adicionar máscara de telefone e remover página de contratos

```bash
# 1. Verificar status
git status
# Output: mostra AppSidebar.tsx, ConnectionsViewSimplified.tsx modificados

# 2. Adicionar arquivos
git add src/components/AppSidebar.tsx src/components/ConnectionsViewSimplified.tsx src/hooks/useChatInstancesFromMessages.ts

# 3. Commit
git commit -m "feat: remove contratos MVP, adiciona máscara telefone BR, integra webhook N8N

- Remove página 'Contratos (MVP)' do sidebar
- Implementa máscara de telefone brasileiro (DDD) 9 XXXX-XXXX
- Atualiza useChatInstancesFromMessages para usar webhook N8N"

# 4. Push
git push origin main

# 5. Verificar no Coolify (manualmente via interface web)
```

## 📚 Referências

- **Repositório:** https://github.com/guihp/legal.git
- **Branch padrão:** `main`
- **Coolify:** Faz deploy automático ao detectar push na branch `main`

---

**Última atualização:** Dezembro 2024  
**Mantido por:** Equipe de Desenvolvimento


