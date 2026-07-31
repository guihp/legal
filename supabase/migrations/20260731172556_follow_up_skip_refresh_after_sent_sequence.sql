-- Bug: after follow-up-dispatch marks a job `sent` and enqueue_next creates the
-- next step (e.g. 15m), n8n ingests the AI FU reply WITHOUT from_follow_up=true.
-- That called start_or_refresh → cancelled the 15m and re-queued 7m forever.
--
-- Guard: skip cycle refresh when mid-sequence after a recent sent; if the next
-- step was already cancelled by the race, restore it via enqueue_next.

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
  v_sent_id uuid;
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

  -- Mid-sequence: pending next already exists after recent sent → skip refresh
  IF EXISTS (
    SELECT 1
    FROM public.conversation_follow_up_jobs sent
    JOIN public.conversation_follow_up_jobs nxt
      ON nxt.company_id = sent.company_id
     AND nxt.channel = sent.channel
     AND nxt.session_id = sent.session_id
     AND nxt.cycle_id = sent.cycle_id
     AND nxt.status = 'pending'
     AND nxt.delay_minutes > COALESCE(sent.delay_minutes, 0)
    WHERE sent.company_id = p_company_id
      AND sent.channel = v_channel
      AND sent.session_id = v_session
      AND sent.status = 'sent'
      AND sent.sent_at IS NOT NULL
      AND sent.sent_at > v_now - interval '5 minutes'
  ) THEN
    RETURN NULL;
  END IF;

  -- Race repair: FU AI reply (missing from_follow_up) cancelled the next step
  -- within ~2 minutes of sent → restore next and skip new 7m cycle
  SELECT id INTO v_sent_id
  FROM public.conversation_follow_up_jobs
  WHERE company_id = p_company_id
    AND channel = v_channel
    AND session_id = v_session
    AND status = 'sent'
    AND sent_at IS NOT NULL
    AND sent_at > v_now - interval '2 minutes'
  ORDER BY sent_at DESC
  LIMIT 1;

  IF v_sent_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.conversation_follow_up_jobs sent
       JOIN public.company_follow_up_schedules s
         ON s.company_id = sent.company_id
        AND s.enabled IS TRUE
        AND s.delay_minutes > COALESCE(sent.delay_minutes, 0)
       WHERE sent.id = v_sent_id
         AND NOT EXISTS (
           SELECT 1
           FROM public.conversation_follow_up_jobs later
           WHERE later.company_id = sent.company_id
             AND later.channel = sent.channel
             AND later.session_id = sent.session_id
             AND later.cycle_id = sent.cycle_id
             AND later.delay_minutes > COALESCE(sent.delay_minutes, 0)
             AND later.status IN ('pending', 'sent')
         )
     )
  THEN
    -- Drop stray 7m pendings from the false cycle_refresh
    UPDATE public.conversation_follow_up_jobs j
    SET
      status = 'cancelled',
      last_error = 'sequence_guard_stray',
      updated_at = now()
    WHERE j.company_id = p_company_id
      AND j.channel = v_channel
      AND j.session_id = v_session
      AND j.status = 'pending'
      AND j.cycle_id IS DISTINCT FROM (
        SELECT s.cycle_id FROM public.conversation_follow_up_jobs s WHERE s.id = v_sent_id
      );

    BEGIN
      PERFORM public.enqueue_next_follow_up_job(v_sent_id);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RETURN NULL;
  END IF;

  -- Stage gate: only Novo Lead / Qualificado
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

  UPDATE public.conversation_follow_up_jobs
  SET
    status = 'cancelled',
    last_error = COALESCE(NULLIF(trim(COALESCE(last_error, '')), ''), 'cycle_refresh'),
    updated_at = now()
  WHERE company_id = p_company_id
    AND channel = v_channel
    AND session_id = v_session
    AND status = 'pending';

  v_cycle_id := gen_random_uuid();

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
  'Starts FU cycle (first schedule only). Skips restart when from_follow_up OR mid-sequence after recent sent (missing n8n flag).';
