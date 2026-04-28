CREATE TABLE IF NOT EXISTS public.broker_queue_state (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  last_index integer NOT NULL DEFAULT -1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_queue_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS broker_queue_state_select ON public.broker_queue_state;
CREATE POLICY broker_queue_state_select
ON public.broker_queue_state
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = broker_queue_state.company_id
      AND COALESCE(up.is_active, true)
      AND up.role IN ('admin', 'gestor')
  )
);

DROP POLICY IF EXISTS broker_queue_state_modify ON public.broker_queue_state;
CREATE POLICY broker_queue_state_modify
ON public.broker_queue_state
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = broker_queue_state.company_id
      AND COALESCE(up.is_active, true)
      AND up.role IN ('admin', 'gestor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.company_id = broker_queue_state.company_id
      AND COALESCE(up.is_active, true)
      AND up.role IN ('admin', 'gestor')
  )
);
