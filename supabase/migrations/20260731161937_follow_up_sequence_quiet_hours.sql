-- Follow-up: sequential dispatch + quiet hours window 07:00–21:00 America/Sao_Paulo.
-- Only the first enabled schedule is queued at cycle start; next step after previous sent.

-- ---------------------------------------------------------------------------
-- 1) Quiet-hours clamp helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clamp_to_follow_up_window(p_ts timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  v_local timestamp;
  v_date date;
  v_time time;
  v_open time := TIME '07:00';
  v_close time := TIME '21:00';
BEGIN
  IF p_ts IS NULL THEN
    RETURN NULL;
  END IF;

  -- timestamptz → wall clock in BRT
  v_local := p_ts AT TIME ZONE 'America/Sao_Paulo';
  v_date := v_local::date;
  v_time := v_local::time;

  -- [07:00, 21:00) → keep
  IF v_time >= v_open AND v_time < v_close THEN
    RETURN p_ts;
  END IF;

  -- before 07:00 → today 07:00 BRT
  IF v_time < v_open THEN
    RETURN (v_date + v_open) AT TIME ZONE 'America/Sao_Paulo';
  END IF;

  -- >= 21:00 → next day 07:00 BRT
  RETURN ((v_date + INTERVAL '1 day')::date + v_open) AT TIME ZONE 'America/Sao_Paulo';
END;
$$;

COMMENT ON FUNCTION public.clamp_to_follow_up_window(timestamptz) IS
  'Clamps timestamptz into follow-up quiet-hours window 07:00–21:00 America/Sao_Paulo (defers to next open).';

GRANT EXECUTE ON FUNCTION public.clamp_to_follow_up_window(timestamptz) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) cycle_anchor_at on jobs
-- ---------------------------------------------------------------------------
ALTER TABLE public.conversation_follow_up_jobs
  ADD COLUMN IF NOT EXISTS cycle_anchor_at timestamptz;

COMMENT ON COLUMN public.conversation_follow_up_jobs.cycle_anchor_at IS
  'Cycle start (IA text msg time). Delays are relative to this anchor; trigger_at is clamped to quiet hours.';

-- Backfill: approximate anchor = trigger_at - delay_minutes
UPDATE public.conversation_follow_up_jobs
SET cycle_anchor_at = trigger_at - make_interval(mins => delay_minutes)
WHERE cycle_anchor_at IS NULL
  AND delay_minutes IS NOT NULL
  AND delay_minutes > 0;

UPDATE public.conversation_follow_up_jobs
SET cycle_anchor_at = COALESCE(created_at, trigger_at, now())
WHERE cycle_anchor_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3) start_or_refresh_follow_up_cycle — only first schedule + clamp
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_or_refresh_follow_up_cycle(
  p_company_id uuid,
  p_channel text,
  p_session_id text,
  p_instancia text DEFAULT NULL,
  p_from_follow_up boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel text := lower(trim(p_channel));
  v_session text := trim(p_session_id);
  v_settings public.company_follow_up_settings%ROWTYPE;
  v_cycle_id uuid;
  v_now timestamptz := now();
  v_stage text;
  r RECORD;
BEGIN
  IF p_from_follow_up IS TRUE THEN
    RETURN NULL; -- envio do próprio follow-up não reinicia o ciclo
  END IF;

  IF p_company_id IS NULL OR v_session = '' THEN
    RETURN NULL;
  END IF;
  IF v_channel NOT IN ('whatsapp', 'instagram') THEN
    RAISE EXCEPTION 'channel inválido (whatsapp|instagram)';
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND COALESCE(up.is_active, true)
        AND up.company_id = p_company_id
    ) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  SELECT * INTO v_settings
  FROM public.company_follow_up_settings
  WHERE company_id = p_company_id;

  IF NOT FOUND OR v_settings.enabled IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  IF v_channel = 'whatsapp' AND v_settings.channel_whatsapp IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  IF v_channel = 'instagram' AND v_settings.channel_instagram IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  -- Stage gate: only Novo Lead / Qualificado (null/unknown → block)
  v_stage := public.resolve_follow_up_lead_stage(p_company_id, v_channel, v_session);
  IF public.is_follow_up_allowed_stage(v_stage) IS NOT TRUE THEN
    UPDATE public.conversation_follow_up_jobs
    SET
      status = 'cancelled',
      last_error = 'stage_not_allowed',
      updated_at = now()
    WHERE company_id = p_company_id
      AND channel = v_channel
      AND session_id = v_session
      AND status = 'pending';
    RETURN NULL;
  END IF;

  -- Cancela pending anteriores e abre novo ciclo a partir desta msg da IA
  PERFORM public.cancel_follow_up_jobs(p_company_id, v_channel, v_session);

  v_cycle_id := gen_random_uuid();

  -- Sequência: só o primeiro horário enabled (menor delay)
  SELECT id, delay_minutes, label_slug, ai_description
  INTO r
  FROM public.company_follow_up_schedules
  WHERE company_id = p_company_id
    AND enabled IS TRUE
  ORDER BY delay_minutes ASC
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.conversation_follow_up_jobs (
      company_id, channel, session_id, schedule_id, cycle_id,
      trigger_at, status, label_slug, instancia, delay_minutes, ai_description,
      cycle_anchor_at
    ) VALUES (
      p_company_id, v_channel, v_session, r.id, v_cycle_id,
      public.clamp_to_follow_up_window(v_now + make_interval(mins => r.delay_minutes)),
      'pending', r.label_slug, NULLIF(trim(COALESCE(p_instancia, '')), ''),
      r.delay_minutes, COALESCE(r.ai_description, ''),
      v_now
    );
  END IF;

  RETURN v_cycle_id;
END;
$$;

COMMENT ON FUNCTION public.start_or_refresh_follow_up_cycle(uuid, text, text, text, boolean) IS
  'Starts follow-up cycle: cancels pending, queues only first enabled schedule (clamped to 07–21 BRT). Stage gate Novo Lead/Qualificado.';

GRANT EXECUTE ON FUNCTION public.start_or_refresh_follow_up_cycle(uuid, text, text, text, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) enqueue_next_follow_up_job — after previous sent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_next_follow_up_job(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.conversation_follow_up_jobs%ROWTYPE;
  v_next RECORD;
  v_now timestamptz := now();
  v_anchor timestamptz;
  v_raw timestamptz;
  v_new_id uuid;
BEGIN
  IF p_job_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- service_role only (called from edge after webhook OK)
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_job
  FROM public.conversation_follow_up_jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_job.status IS DISTINCT FROM 'sent' THEN
    RETURN NULL;
  END IF;

  v_anchor := COALESCE(v_job.cycle_anchor_at, v_job.created_at, v_now);

  SELECT s.id, s.delay_minutes, s.label_slug, s.ai_description
  INTO v_next
  FROM public.company_follow_up_schedules s
  WHERE s.company_id = v_job.company_id
    AND s.enabled IS TRUE
    AND s.delay_minutes > v_job.delay_minutes
  ORDER BY s.delay_minutes ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Already queued/sent for this schedule in the same cycle?
  IF EXISTS (
    SELECT 1
    FROM public.conversation_follow_up_jobs j
    WHERE j.company_id = v_job.company_id
      AND j.channel = v_job.channel
      AND j.session_id = v_job.session_id
      AND j.cycle_id = v_job.cycle_id
      AND j.schedule_id = v_next.id
      AND j.status IN ('pending', 'sent')
  ) THEN
    RETURN NULL;
  END IF;

  v_raw := greatest(v_now, v_anchor + make_interval(mins => v_next.delay_minutes));

  INSERT INTO public.conversation_follow_up_jobs (
    company_id, channel, session_id, schedule_id, cycle_id,
    trigger_at, status, label_slug, instancia, delay_minutes, ai_description,
    cycle_anchor_at
  ) VALUES (
    v_job.company_id, v_job.channel, v_job.session_id, v_next.id, v_job.cycle_id,
    public.clamp_to_follow_up_window(v_raw),
    'pending', v_next.label_slug, v_job.instancia,
    v_next.delay_minutes, COALESCE(v_next.ai_description, ''),
    v_anchor
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.enqueue_next_follow_up_job(uuid) IS
  'After a follow-up job is sent, enqueue the next enabled schedule in the same cycle (clamped to quiet hours). service_role only.';

GRANT EXECUTE ON FUNCTION public.enqueue_next_follow_up_job(uuid) TO service_role;
