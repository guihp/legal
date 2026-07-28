-- Allow deleting user_profiles without losing audit history / orphaning nullable refs.
-- Root cause: audit_logs.actor_id FK used NO ACTION while actor_id is nullable.
-- Also harden other nullable FKs to user_profiles that would block the same delete.

-- audit_logs.actor_id (nullable) — preserve rows, null out actor
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;

-- company_access_logs.performed_by
ALTER TABLE public.company_access_logs
  DROP CONSTRAINT IF EXISTS company_access_logs_performed_by_fkey;
ALTER TABLE public.company_access_logs
  ADD CONSTRAINT company_access_logs_performed_by_fkey
  FOREIGN KEY (performed_by) REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;

-- company_api_keys.created_by
ALTER TABLE public.company_api_keys
  DROP CONSTRAINT IF EXISTS company_api_keys_created_by_fkey;
ALTER TABLE public.company_api_keys
  ADD CONSTRAINT company_api_keys_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;

-- company_google_calendar_integrations.created_by
ALTER TABLE public.company_google_calendar_integrations
  DROP CONSTRAINT IF EXISTS company_google_calendar_integrations_created_by_fkey;
ALTER TABLE public.company_google_calendar_integrations
  ADD CONSTRAINT company_google_calendar_integrations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;

-- contract_templates.user_id
ALTER TABLE public.contract_templates
  DROP CONSTRAINT IF EXISTS contract_templates_user_id_fkey;
ALTER TABLE public.contract_templates
  ADD CONSTRAINT contract_templates_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;

-- conversation_contact_labels.updated_by
ALTER TABLE public.conversation_contact_labels
  DROP CONSTRAINT IF EXISTS conversation_contact_labels_updated_by_fkey;
ALTER TABLE public.conversation_contact_labels
  ADD CONSTRAINT conversation_contact_labels_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;

-- dispatch_configurations.user_id
ALTER TABLE public.dispatch_configurations
  DROP CONSTRAINT IF EXISTS dispatch_configurations_user_id_fkey;
ALTER TABLE public.dispatch_configurations
  ADD CONSTRAINT dispatch_configurations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;

-- imoveisvivareal.user_id
ALTER TABLE public.imoveisvivareal
  DROP CONSTRAINT IF EXISTS imoveisvivareal_user_id_fkey;
ALTER TABLE public.imoveisvivareal
  ADD CONSTRAINT imoveisvivareal_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;

-- leads.id_corretor_responsavel / leads.user_id
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_id_corretor_responsavel_fkey;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_id_corretor_responsavel_fkey
  FOREIGN KEY (id_corretor_responsavel) REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_user_id_fkey;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;

-- oncall_schedules.assigned_user_id (nullable)
ALTER TABLE public.oncall_schedules
  DROP CONSTRAINT IF EXISTS oncall_schedules_assigned_user_id_fkey;
ALTER TABLE public.oncall_schedules
  ADD CONSTRAINT oncall_schedules_assigned_user_id_fkey
  FOREIGN KEY (assigned_user_id) REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;

-- oncall_schedules.user_id is NOT NULL — keep NO ACTION; delete path must remove rows first.
-- (documented; edge function admin-delete-user deletes those rows before profile delete)
