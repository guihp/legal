# Hierarquia de Usuários e Permissões (Resumo)

## Papéis
- admin: acesso global. Pode gerenciar qualquer usuário e empresa.
- gestor: acesso à própria empresa. Pode listar usuários da empresa, atualizar hierarquia apenas para corretores e desativar usuários da empresa.
- corretor: acesso somente ao próprio perfil.

## Tabela `user_profiles`
- SELECT:
  - admin/gestor: usuários da própria empresa (via `list_company_users`).
  - corretor: apenas o próprio registro.
- UPDATE role:
  - admin: qualquer usuário (`changeUserRole`).
  - gestor: apenas via RPC `update_user_role_in_company(target_user_id, new_role)`, limitado a definir `corretor` e apenas na mesma empresa.
  - corretor: não permitido.
- UPDATE is_active (desativar):
  - admin: qualquer usuário (`deactivateUser`).
  - gestor: via RPC `deactivate_user_in_company(target_user_id)` na mesma empresa.
  - corretor: não permitido.

## Tabela `push_subscriptions`
- SELECT / INSERT / UPDATE / DELETE: somente o próprio usuário (`user_id = auth.uid()`) e `company_id` da empresa ativa em `user_profiles`.
- Uso: endpoints Web Push por dispositivo (PWA). `service_role` bypassa RLS para fan-out no Edge.

## Tabela `user_notification_preferences`
- SELECT / INSERT / UPDATE: somente o próprio row (`user_id = auth.uid()` + company scope).
- Sem DELETE via client — desligar via `push_enabled` / toggles de categoria.
- RPC `ensure_user_notification_preferences()`: upsert de defaults no primeiro acesso (não sobrescreve prefs existentes).

## Tabela `user_notifications` (inbox / outbox push)
- SELECT / UPDATE / DELETE: destinatário (`user_id = auth.uid()`).
- INSERT: `company_id` da empresa ativa do autenticado (triggers/Edge usam `SECURITY DEFINER` / service_role).
- Tipos: `lead_stage_changed`, `appointment`, `connection_*`, `general` + `chat_human_reply`, `chat_human_requested`, `agenda_reminder`.
- Fan-out Web Push: INSERT dispara `enqueue_push_for_notification` (service_role / Edge); prefs em `user_notification_preferences` gateiam o envio — não a inbox.

## Storage `avatars`
- SELECT: público (anon + authenticated) — exibir `avatar_url`.
- INSERT / UPDATE / DELETE: autenticado apenas em `avatars/{auth.uid()}/…`.
- Bucket dedicado (não usa `company-assets`).

## Observações
- Ao criar usuário via módulo, o `company_id` do novo perfil é vinculado ao `company_id` do criador.
- Senha padrão configurável via `VITE_DEFAULT_NEW_USER_PASSWORD` (fallback `Imobi@1234`). Recomenda-se forçar troca no primeiro acesso.


## Tabela `leads`
- Leitura:
  - admin/gestor: todos os leads
  - corretor: apenas leads atribuídos a si (`id_corretor_responsavel = auth.uid()`)
- Criação:
  - admin/gestor: livre
  - corretor: somente se `user_id = auth.uid()`
- Edição:
  - admin/gestor: livre
  - corretor: apenas nos próprios
- Atribuição de responsável (`id_corretor_responsavel`):
  - admin/gestor podem alterar
  - corretores não alteram o responsável de outros


