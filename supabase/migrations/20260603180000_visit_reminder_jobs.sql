-- Fila de lembretes de visita (1 dia e 3 horas antes) disparados via webhooks n8n.

CREATE TABLE IF NOT EXISTS public.visit_reminder_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_id text,
  reminder_type text NOT NULL CHECK (reminder_type IN ('1_day', '3_hours')),
  visit_at timestamptz NOT NULL,
  trigger_at timestamptz NOT NULL,
  webhook_url text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_reminder_jobs_pending_trigger
  ON public.visit_reminder_jobs (trigger_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_visit_reminder_jobs_lead
  ON public.visit_reminder_jobs (lead_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_visit_reminder_jobs_pending
  ON public.visit_reminder_jobs (lead_id, COALESCE(event_id, ''), reminder_type)
  WHERE status = 'pending';

COMMENT ON TABLE public.visit_reminder_jobs IS
  'Jobs agendados para webhooks n8n de lembrete de visita (1 dia e 3 horas antes).';

ALTER TABLE public.visit_reminder_jobs ENABLE ROW LEVEL SECURITY;

-- Apenas service role / edge functions (sem policy para authenticated).

CREATE OR REPLACE FUNCTION public.touch_visit_reminder_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visit_reminder_jobs_updated_at ON public.visit_reminder_jobs;
CREATE TRIGGER trg_visit_reminder_jobs_updated_at
  BEFORE UPDATE ON public.visit_reminder_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_visit_reminder_jobs_updated_at();
