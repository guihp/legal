-- Gestores precisam ligar/desligar features da própria empresa (ex.: ai_assistant_enabled).
-- A policy antiga só permitia role 'admin' (fantasma global), bloqueando gestores no app.

DROP POLICY IF EXISTS "company_features_modify" ON public.company_features;

CREATE POLICY "company_features_modify" ON public.company_features
  FOR ALL
  TO public
  USING (
    get_user_role() = 'admin'
    OR (get_user_role() = 'gestor' AND company_id = get_user_company_id())
    OR (get_user_role() = 'super_admin')
  )
  WITH CHECK (
    get_user_role() = 'admin'
    OR (get_user_role() = 'gestor' AND company_id = get_user_company_id())
    OR (get_user_role() = 'super_admin')
  );
