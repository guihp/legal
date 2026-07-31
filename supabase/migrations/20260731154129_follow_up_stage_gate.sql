-- Follow-up stage gate: only "Novo Lead" / "Qualificado" may schedule or dispatch.
-- Cancels pending jobs when stage leaves the allowed set.

-- ---------------------------------------------------------------------------
-- Helpers (shared stage slug + allow-list)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_lead_stage_slug(p_stage text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(
    translate(
      lower(replace(trim(COALESCE(p_stage, '')), ' ', '-')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    ''
  );
$$;

COMMENT ON FUNCTION public.normalize_lead_stage_slug(text) IS
  'Normalizes leads.stage title/slug to accent-free kebab slug (e.g. Novo Lead → novo-lead).';

CREATE OR REPLACE FUNCTION public.is_follow_up_allowed_stage(p_stage text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    public.normalize_lead_stage_slug(p_stage) IN ('novo-lead', 'qualificado'),
    false
  );
$$;

COMMENT ON FUNCTION public.is_follow_up_allowed_stage(text) IS
  'True when stage is Novo Lead or Qualificado (title or slug; accents ignored).';

CREATE OR REPLACE FUNCTION public.resolve_follow_up_lead_stage(
  p_company_id uuid,
  p_channel text,
  p_session_id text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel text := lower(trim(COALESCE(p_channel, '')));
  v_session text := trim(COALESCE(p_session_id, ''));
  v_stage text;
  v_phone_norm text;
  v_ig_norm text;
BEGIN
  IF p_company_id IS NULL OR v_session = '' THEN
    RETURN NULL;
  END IF;

  -- 1) Via mensagens.lead_id (most recent linked message for this session key)
  SELECT l.stage INTO v_stage
  FROM public.mensagens m
  JOIN public.leads l ON l.id = m.lead_id
  WHERE m.company_id = p_company_id
    AND m.lead_id IS NOT NULL
    AND (
      m.phone = v_session
      OR m.contact_norm = CASE
        WHEN v_channel = 'instagram' THEN lower(v_session)
        ELSE public.normalize_phone_digits(v_session)
      END
    )
  ORDER BY m.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_stage IS NOT NULL THEN
    RETURN v_stage;
  END IF;

  -- 2) Direct lead match by channel key
  IF v_channel = 'instagram' THEN
    v_ig_norm := lower(v_session);
    SELECT l.stage INTO v_stage
    FROM public.leads l
    WHERE l.company_id = p_company_id
      AND (
        lower(trim(COALESCE(l.instagram_id_cliente, ''))) = v_ig_norm
        OR l.id::text = v_session
      )
    ORDER BY l.updated_at DESC NULLS LAST
    LIMIT 1;
  ELSE
    v_phone_norm := public.normalize_phone_digits(v_session);
    IF v_phone_norm IS NOT NULL AND v_phone_norm <> '' THEN
      SELECT l.stage INTO v_stage
      FROM public.leads l
      WHERE l.company_id = p_company_id
        AND public.normalize_phone_digits(l.phone) = v_phone_norm
      ORDER BY l.updated_at DESC NULLS LAST
      LIMIT 1;
    END IF;
  END IF;

  RETURN v_stage;
END;
$$;

COMMENT ON FUNCTION public.resolve_follow_up_lead_stage(uuid, text, text) IS
  'Resolves leads.stage for a conversation session (mensagens.lead_id, then phone / IG id).';

GRANT EXECUTE ON FUNCTION public.normalize_lead_stage_slug(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_follow_up_allowed_stage(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_follow_up_lead_stage(uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Cancel pending jobs for a lead's sessions (stage left allow-list)
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
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.cancel_follow_up_jobs_for_lead(uuid, text) IS
  'Cancels pending follow-up jobs for sessions linked to a lead (phone / IG / mensagens).';

GRANT EXECUTE ON FUNCTION public.cancel_follow_up_jobs_for_lead(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Gate inside start_or_refresh_follow_up_cycle
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

  FOR r IN
    SELECT id, delay_minutes, label_slug, ai_description
    FROM public.company_follow_up_schedules
    WHERE company_id = p_company_id
      AND enabled IS TRUE
    ORDER BY delay_minutes ASC
  LOOP
    INSERT INTO public.conversation_follow_up_jobs (
      company_id, channel, session_id, schedule_id, cycle_id,
      trigger_at, status, label_slug, instancia, delay_minutes, ai_description
    ) VALUES (
      p_company_id, v_channel, v_session, r.id, v_cycle_id,
      v_now + make_interval(mins => r.delay_minutes),
      'pending', r.label_slug, NULLIF(trim(COALESCE(p_instancia, '')), ''),
      r.delay_minutes, COALESCE(r.ai_description, '')
    );
  END LOOP;

  RETURN v_cycle_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: cancel pending when stage leaves allow-list
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_cancel_follow_up_on_lead_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.stage IS DISTINCT FROM OLD.stage
     AND public.is_follow_up_allowed_stage(NEW.stage) IS NOT TRUE
  THEN
    PERFORM public.cancel_follow_up_jobs_for_lead(NEW.id, 'stage_not_allowed');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_follow_up_on_lead_stage ON public.leads;
CREATE TRIGGER trg_cancel_follow_up_on_lead_stage
  AFTER UPDATE OF stage ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_cancel_follow_up_on_lead_stage();

COMMENT ON FUNCTION public.trg_cancel_follow_up_on_lead_stage() IS
  'Cancels pending follow-up jobs when lead leaves Novo Lead / Qualificado.';
