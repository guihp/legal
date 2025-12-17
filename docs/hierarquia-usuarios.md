# Hierarquia de Usuários — Matriz de Permissões (RLS)

Este documento descreve, de forma didática, como as políticas RLS aplicam a hierarquia de acesso por `role` e `company_id` nas tabelas do domínio. O objetivo é preservar o MVP e garantir isolamento multi-tenant.

## Papéis
- corretor: vê e gerencia apenas seus próprios registros (`user_id = auth.uid()`).
- gestor: vê todos os registros da sua empresa (`company_id = get_user_company_id()`); pode gerenciar conforme a tabela.
- admin: equivalente ao gestor, com poder de gestão ampliado e acesso ao gerenciamento de permissões.

## Regras por tabela (resumo)

- `user_profiles`
  - SELECT/UPDATE: somente o próprio registro (`id = auth.uid()`).

- `properties` / `imoveisvivareal`
  - Admin/Gestor: CRUD global
  - Corretor: leitura de todos; pode adicionar; pode alterar disponibilidade (com observação); não pode editar/deletar

- `property_images`
  - Leitura para autenticados; mutações por admin/gestor

- `leads`
  - Admin/Gestor: leitura e CRUD de todos
  - Corretor: leitura/criação/atualização dos próprios (`user_id = auth.uid()`), delete negado

- `contract_templates` (tabela)
  - Leitura/criação para todos autenticados; update/delete por admin/gestor ou autor (`user_id`)

- `contracts`
  - Admin/Gestor: leitura e CRUD de todos
  - Corretor: leitura/escopo próprio (a definir conforme evolução do módulo)

- `whatsapp_instances`
  - Admin/Gestor: leitura e CRUD
  - Corretor: sem acesso

- `whatsapp_chats`
  - Admin/Gestor: todos
  - Corretor: apenas os próprios (`user_id = auth.uid()`)

- `whatsapp_messages`
  - Admin/Gestor: todos
  - Corretor: apenas as próprias (envio `from_me=true`) e leitura das suas

## Observações
- Triggers BEFORE INSERT definem automaticamente `user_id` e `company_id` quando nulos.
- Todas as políticas de escrita aplicam `WITH CHECK (company_id = get_user_company_id())` para impedir spoof de empresa.
- Evita-se recursão nas policies consultando `get_user_role()`/`get_user_company_id()` (SECURITY DEFINER) somente em tabelas diferentes de `user_profiles`.

Última atualização: sincronizada com a migration de RLS consolidada.

