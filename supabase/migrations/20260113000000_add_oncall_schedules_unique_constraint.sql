-- =============================================================================
-- MIGRATION: Adicionar constraint unique para oncall_schedules
-- Data: 2026-01-13
-- =============================================================================

-- Adicionar constraint unique em (company_id, calendar_id)
-- Isso permite usar ON CONFLICT no upsert
ALTER TABLE public.oncall_schedules
ADD CONSTRAINT oncall_schedules_company_calendar_unique 
UNIQUE (company_id, calendar_id);

COMMENT ON CONSTRAINT oncall_schedules_company_calendar_unique ON public.oncall_schedules 
IS 'Garante que cada empresa tenha apenas um registro por calendar_id';
