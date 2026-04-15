-- Correção urgente de vazamento entre empresas (multi-tenant)
-- 1) Leads: remover acesso global de admin e escopar por company_id
-- 2) User profiles: remover SELECT/UPDATE/INSERT permissivos entre empresas

-- =============================================================================
-- LEADS (RLS)
-- =============================================================================
DROP POLICY IF EXISTS leads_select_admin_global ON public.leads;
DROP POLICY IF EXISTS leads_insert_admin_global ON public.leads;
DROP POLICY IF EXISTS leads_update_admin_global ON public.leads;
DROP POLICY IF EXISTS leads_delete_admin_global ON public.leads;

CREATE POLICY leads_select_scoped ON public.leads
FOR SELECT
TO public
USING (
  CASE
    WHEN is_super_admin() THEN true
    WHEN get_user_role() IN ('admin', 'gestor') THEN company_id = get_user_company_id()
    ELSE company_id = get_user_company_id() AND id_corretor_responsavel = auth.uid()
  END
);

CREATE POLICY leads_insert_scoped ON public.leads
FOR INSERT
TO public
WITH CHECK (
  CASE
    WHEN is_super_admin() THEN true
    WHEN get_user_role() IN ('admin', 'gestor') THEN company_id = get_user_company_id()
    ELSE company_id = get_user_company_id() AND (id_corretor_responsavel IS NULL OR id_corretor_responsavel = auth.uid())
  END
);

CREATE POLICY leads_update_scoped ON public.leads
FOR UPDATE
TO public
USING (
  CASE
    WHEN is_super_admin() THEN true
    WHEN get_user_role() IN ('admin', 'gestor') THEN company_id = get_user_company_id()
    ELSE company_id = get_user_company_id() AND id_corretor_responsavel = auth.uid()
  END
)
WITH CHECK (
  CASE
    WHEN is_super_admin() THEN true
    ELSE company_id = get_user_company_id()
  END
);

CREATE POLICY leads_delete_scoped ON public.leads
FOR DELETE
TO public
USING (
  CASE
    WHEN is_super_admin() THEN true
    WHEN get_user_role() IN ('admin', 'gestor') THEN company_id = get_user_company_id()
    ELSE false
  END
);

-- =============================================================================
-- USER_PROFILES (RLS)
-- =============================================================================
DROP POLICY IF EXISTS user_profiles_select_all ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_admin ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_admin_or_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_authenticated ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_admin ON public.user_profiles;

CREATE POLICY user_profiles_select_scoped ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  is_super_admin()
  OR id = auth.uid()
  OR company_id = get_user_company_id()
);

CREATE POLICY user_profiles_update_scoped ON public.user_profiles
FOR UPDATE
TO public
USING (
  is_super_admin()
  OR id = auth.uid()
  OR (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'gestor'))
)
WITH CHECK (
  is_super_admin()
  OR company_id = get_user_company_id()
  OR id = auth.uid()
);

CREATE POLICY user_profiles_insert_scoped ON public.user_profiles
FOR INSERT
TO public
WITH CHECK (
  is_super_admin()
  OR (
    id = auth.uid()
    AND (
      company_id = get_user_company_id()
      OR company_id IS NULL
    )
  )
  OR (
    get_user_role() IN ('admin', 'gestor')
    AND company_id = get_user_company_id()
  )
);

-- =============================================================================
-- INQUILINATO (RLS)
-- =============================================================================
DROP POLICY IF EXISTS inquilinato_conversations_all ON public.inquilinato_conversations;
DROP POLICY IF EXISTS inquilinato_messages_all ON public.inquilinato_messages;

CREATE POLICY inquilinato_conversations_scoped ON public.inquilinato_conversations
FOR ALL
TO public
USING (
  is_super_admin()
  OR company_id = get_user_company_id()
)
WITH CHECK (
  is_super_admin()
  OR company_id = get_user_company_id()
);

CREATE POLICY inquilinato_messages_scoped ON public.inquilinato_messages
FOR ALL
TO public
USING (
  is_super_admin()
  OR company_id = get_user_company_id()
)
WITH CHECK (
  is_super_admin()
  OR company_id = get_user_company_id()
);

-- =============================================================================
-- CONTRACTS (RLS)
-- =============================================================================
DROP POLICY IF EXISTS "Anyone can view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Anyone can create contracts" ON public.contracts;
DROP POLICY IF EXISTS "Anyone can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Anyone can delete contracts" ON public.contracts;

CREATE POLICY contracts_select_scoped ON public.contracts
FOR SELECT
TO public
USING (
  is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id::text = contracts.created_by
      AND up.company_id = get_user_company_id()
  )
);

CREATE POLICY contracts_insert_scoped ON public.contracts
FOR INSERT
TO public
WITH CHECK (
  is_super_admin()
  OR created_by = auth.uid()::text
);

CREATE POLICY contracts_update_scoped ON public.contracts
FOR UPDATE
TO public
USING (
  is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id::text = contracts.created_by
      AND up.company_id = get_user_company_id()
  )
)
WITH CHECK (
  is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id::text = contracts.created_by
      AND up.company_id = get_user_company_id()
  )
);

CREATE POLICY contracts_delete_scoped ON public.contracts
FOR DELETE
TO public
USING (
  is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id::text = contracts.created_by
      AND up.company_id = get_user_company_id()
  )
);
