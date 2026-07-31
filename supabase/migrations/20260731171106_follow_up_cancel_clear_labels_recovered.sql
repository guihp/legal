-- When the client replies: cancel pending FU jobs, stamp recovered_at on sent jobs,
-- and remove follow_up / follow_up_* contact labels (labels are applied via n8n/API only).
-- Cycle refresh still uses cancel_follow_up_jobs without clearing labels.

ALTER TABLE public.conversation_follow_up_jobs
  ADD COLUMN IF NOT EXISTS recovered_at timestamptz;

COMMENT ON COLUMN public.conversation_follow_up_jobs.recovered_at IS
  'When the client replied after this follow-up was sent (lead recovered).';

CREATE INDEX IF NOT EXISTS idx_conversation_follow_up_jobs_session_created
  ON public.conversation_follow_up_jobs (company_id, channel, session_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Clear timed + generic follow-up labels for a session
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_follow_up_contact_labels(
  p_company_id uuid,
  p_channel text,
  p_session_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_channel text := lower(trim(p_channel));
  v_session text := trim(p_session_id);
BEGIN
  IF p_company_id IS NULL OR v_session = '' THEN
    RETURN 0;
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

  DELETE FROM public.conversation_contact_labels
  WHERE company_id = p_company_id
    AND channel = v_channel
    AND session_id = v_session
    AND (
      status = 'follow_up'
      OR status LIKE 'follow_up_%'
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.clear_follow_up_contact_labels(uuid, text, text) IS
  'Removes follow_up / follow_up_* labels for a conversation session.';

GRANT EXECUTE ON FUNCTION public.clear_follow_up_contact_labels(uuid, text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Client reply: cancel pending + recover sent + clear labels
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_client_reply_follow_up(
  p_company_id uuid,
  p_channel text,
  p_session_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled integer := 0;
  v_channel text := lower(trim(p_channel));
  v_session text := trim(p_session_id);
BEGIN
  IF p_company_id IS NULL OR v_session = '' THEN
    RETURN 0;
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

  -- Stamp recovery on sent follow-ups that are still open
  UPDATE public.conversation_follow_up_jobs
  SET
    recovered_at = COALESCE(recovered_at, now()),
    updated_at = now()
  WHERE company_id = p_company_id
    AND channel = v_channel
    AND session_id = v_session
    AND status = 'sent'
    AND recovered_at IS NULL;

  -- Cancel pending jobs with explicit reason
  UPDATE public.conversation_follow_up_jobs
  SET
    status = 'cancelled',
    last_error = COALESCE(NULLIF(trim(COALESCE(last_error, '')), ''), 'client_replied'),
    updated_at = now()
  WHERE company_id = p_company_id
    AND channel = v_channel
    AND session_id = v_session
    AND status = 'pending';

  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  PERFORM public.clear_follow_up_contact_labels(p_company_id, v_channel, v_session);

  RETURN v_cancelled;
END;
$$;

COMMENT ON FUNCTION public.handle_client_reply_follow_up(uuid, text, text) IS
  'On client inbound: mark sent jobs recovered, cancel pending, clear follow_up_* labels.';

GRANT EXECUTE ON FUNCTION public.handle_client_reply_follow_up(uuid, text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Stage leave allow-list: also clear follow-up labels for the lead's sessions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_follow_up_jobs_for_lead(
  p_lead_id uuid,
  p_reason text DEFAULT 'stage_not_allowed'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_count integer := 0;
  v_phone_norm text;
  v_ig_norm text;
  v_reason text := NULLIF(trim(COALESCE(p_reason, '')), '');
  r RECORD;
BEGIN
  IF p_lead_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_phone_norm := public.normalize_phone_digits(v_lead.phone);
  v_ig_norm := NULLIF(lower(trim(COALESCE(v_lead.instagram_id_cliente, ''))), '');
  IF v_reason IS NULL THEN
    v_reason := 'stage_not_allowed';
  END IF;

  UPDATE public.conversation_follow_up_jobs j
  SET
    status = 'cancelled',
    last_error = v_reason,
    updated_at = now()
  WHERE j.company_id = v_lead.company_id
    AND j.status = 'pending'
    AND (
      (
        j.channel = 'whatsapp'
        AND v_phone_norm IS NOT NULL
        AND v_phone_norm <> ''
        AND public.normalize_phone_digits(j.session_id) = v_phone_norm
      )
      OR (
        j.channel = 'instagram'
        AND v_ig_norm IS NOT NULL
        AND lower(trim(j.session_id)) = v_ig_norm
      )
      OR EXISTS (
        SELECT 1
        FROM public.mensagens m
        WHERE m.lead_id = v_lead.id
          AND m.company_id = v_lead.company_id
          AND m.phone = j.session_id
      )
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Clear FU labels on every distinct session that had jobs for this lead
  FOR r IN
    SELECT DISTINCT j.channel, j.session_id
    FROM public.conversation_follow_up_jobs j
    WHERE j.company_id = v_lead.company_id
      AND (
        (
          j.channel = 'whatsapp'
          AND v_phone_norm IS NOT NULL
          AND v_phone_norm <> ''
          AND public.normalize_phone_digits(j.session_id) = v_phone_norm
        )
        OR (
          j.channel = 'instagram'
          AND v_ig_norm IS NOT NULL
          AND lower(trim(j.session_id)) = v_ig_norm
        )
        OR EXISTS (
          SELECT 1
          FROM public.mensagens m
          WHERE m.lead_id = v_lead.id
            AND m.company_id = v_lead.company_id
            AND m.phone = j.session_id
        )
      )
  LOOP
    PERFORM public.clear_follow_up_contact_labels(v_lead.company_id, r.channel, r.session_id);
  END LOOP;

  RETURN v_count;
END;
$$;
