-- Follow-up: settings, schedules, jobs, system labels, cycle RPCs

-- ---------------------------------------------------------------------------
-- 1) company_follow_up_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_follow_up_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  channel_whatsapp boolean NOT NULL DEFAULT true,
  channel_instagram boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.company_follow_up_settings IS
  'Configuração de follow-up automático por empresa (canais + enable).';

DROP TRIGGER IF EXISTS update_company_follow_up_settings_updated_at ON public.company_follow_up_settings;
CREATE TRIGGER update_company_follow_up_settings_updated_at
BEFORE UPDATE ON public.company_follow_up_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.company_follow_up_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_follow_up_settings_select ON public.company_follow_up_settings;
CREATE POLICY company_follow_up_settings_select
ON public.company_follow_up_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = company_follow_up_settings.company_id
  )
);

DROP POLICY IF EXISTS company_follow_up_settings_upsert ON public.company_follow_up_settings;
CREATE POLICY company_follow_up_settings_insert
ON public.company_follow_up_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = company_follow_up_settings.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
);

CREATE POLICY company_follow_up_settings_update
ON public.company_follow_up_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = company_follow_up_settings.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = company_follow_up_settings.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
);

-- ---------------------------------------------------------------------------
-- 2) company_follow_up_schedules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_follow_up_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  delay_minutes integer NOT NULL CHECK (delay_minutes > 0),
  is_system boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  label_slug text NOT NULL,
  label_name text NOT NULL,
  ai_description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, delay_minutes),
  UNIQUE (company_id, label_slug),
  CONSTRAINT company_follow_up_schedules_slug_format
    CHECK (label_slug ~ '^[a-z][a-z0-9_]*$')
);

CREATE INDEX IF NOT EXISTS idx_company_follow_up_schedules_company
  ON public.company_follow_up_schedules (company_id, sort_order);

COMMENT ON TABLE public.company_follow_up_schedules IS
  'Horários de follow-up por empresa (system 15m/1h + customs) com orientação para a IA.';

DROP TRIGGER IF EXISTS update_company_follow_up_schedules_updated_at ON public.company_follow_up_schedules;
CREATE TRIGGER update_company_follow_up_schedules_updated_at
BEFORE UPDATE ON public.company_follow_up_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- System schedules: delay/slug/name/is_system locked; enabled + ai_description free
CREATE OR REPLACE FUNCTION public.protect_system_follow_up_schedules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system IS TRUE THEN
      RAISE EXCEPTION 'Horários de follow-up de sistema não podem ser excluídos';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.is_system IS TRUE THEN
    IF NEW.is_system IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Não é permitido alterar is_system de horários de sistema';
    END IF;
    IF NEW.delay_minutes IS DISTINCT FROM OLD.delay_minutes THEN
      RAISE EXCEPTION 'Não é permitido alterar delay de horários de sistema';
    END IF;
    IF NEW.label_slug IS DISTINCT FROM OLD.label_slug THEN
      RAISE EXCEPTION 'Não é permitido alterar label_slug de horários de sistema';
    END IF;
    IF NEW.label_name IS DISTINCT FROM OLD.label_name THEN
      RAISE EXCEPTION 'Não é permitido alterar label_name de horários de sistema';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_system_follow_up_schedules_upd ON public.company_follow_up_schedules;
CREATE TRIGGER protect_system_follow_up_schedules_upd
  BEFORE UPDATE ON public.company_follow_up_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_system_follow_up_schedules();

DROP TRIGGER IF EXISTS protect_system_follow_up_schedules_del ON public.company_follow_up_schedules;
CREATE TRIGGER protect_system_follow_up_schedules_del
  BEFORE DELETE ON public.company_follow_up_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_system_follow_up_schedules();

ALTER TABLE public.company_follow_up_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_follow_up_schedules_select ON public.company_follow_up_schedules;
CREATE POLICY company_follow_up_schedules_select
ON public.company_follow_up_schedules
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = company_follow_up_schedules.company_id
  )
);

CREATE POLICY company_follow_up_schedules_insert
ON public.company_follow_up_schedules
FOR INSERT
WITH CHECK (
  is_system IS NOT TRUE
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = company_follow_up_schedules.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
);

CREATE POLICY company_follow_up_schedules_update
ON public.company_follow_up_schedules
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = company_follow_up_schedules.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = company_follow_up_schedules.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
);

CREATE POLICY company_follow_up_schedules_delete
ON public.company_follow_up_schedules
FOR DELETE
USING (
  is_system IS NOT TRUE
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = company_follow_up_schedules.company_id
      AND up.role IN ('admin', 'gestor', 'super_admin')
  )
);

-- ---------------------------------------------------------------------------
-- 3) conversation_follow_up_jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_follow_up_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'instagram')),
  session_id text NOT NULL,
  schedule_id uuid NOT NULL REFERENCES public.company_follow_up_schedules(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL,
  trigger_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  label_slug text NOT NULL,
  instancia text,
  delay_minutes integer NOT NULL,
  ai_description text NOT NULL DEFAULT '',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_follow_up_jobs_pending_trigger
  ON public.conversation_follow_up_jobs (trigger_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_conversation_follow_up_jobs_session
  ON public.conversation_follow_up_jobs (company_id, channel, session_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversation_follow_up_jobs_pending
  ON public.conversation_follow_up_jobs (company_id, channel, session_id, schedule_id, cycle_id)
  WHERE status = 'pending';

COMMENT ON TABLE public.conversation_follow_up_jobs IS
  'Jobs de follow-up automático por conversa/ciclo (dispatch via edge + cron).';

DROP TRIGGER IF EXISTS update_conversation_follow_up_jobs_updated_at ON public.conversation_follow_up_jobs;
CREATE TRIGGER update_conversation_follow_up_jobs_updated_at
BEFORE UPDATE ON public.conversation_follow_up_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.conversation_follow_up_jobs ENABLE ROW LEVEL SECURITY;

-- Authenticated: SELECT + cancel (update pending→cancelled) no escopo da empresa
CREATE POLICY conversation_follow_up_jobs_select
ON public.conversation_follow_up_jobs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = conversation_follow_up_jobs.company_id
  )
);

CREATE POLICY conversation_follow_up_jobs_cancel
ON public.conversation_follow_up_jobs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = conversation_follow_up_jobs.company_id
  )
)
WITH CHECK (
  status = 'cancelled'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true)
      AND up.company_id = conversation_follow_up_jobs.company_id
  )
);

-- ---------------------------------------------------------------------------
-- 4) Seed labels (extend system catalog) + schedules
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_company_ai_system_labels(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_ai_labels (company_id, slug, name, color, is_system, sort_order)
  VALUES
    (p_company_id, 'ai_ativa', 'AI ATIVA', 'emerald', true, 10),
    (p_company_id, 'humano', 'Humano', 'amber', true, 20),
    (p_company_id, 'humano_solicitado', 'Humano solicitado', 'orange', true, 30),
    (p_company_id, 'follow_up', 'Follow-UP', 'sky', true, 40),
    (p_company_id, 'follow_up_15m', 'Follow-up-15m', 'violet', true, 50),
    (p_company_id, 'follow_up_1h', 'Follow-up-1h', 'rose', true, 60)
  ON CONFLICT (company_id, slug) DO UPDATE
  SET
    is_system = EXCLUDED.is_system,
    name = CASE
      WHEN public.company_ai_labels.is_system IS TRUE
        OR EXCLUDED.slug IN ('follow_up', 'follow_up_15m', 'follow_up_1h')
      THEN EXCLUDED.name
      ELSE public.company_ai_labels.name
    END,
    sort_order = COALESCE(public.company_ai_labels.sort_order, EXCLUDED.sort_order);
END;
$$;

COMMENT ON FUNCTION public.seed_company_ai_system_labels IS
  'Insere etiquetas de sistema (AI/humano + follow_up / 15m / 1h) para uma empresa.';

CREATE OR REPLACE FUNCTION public.seed_company_follow_up_defaults(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_follow_up_settings (
    company_id, enabled, channel_whatsapp, channel_instagram
  )
  VALUES (p_company_id, false, true, true)
  ON CONFLICT (company_id) DO NOTHING;

  PERFORM public.seed_company_ai_system_labels(p_company_id);

  INSERT INTO public.company_follow_up_schedules (
    company_id, delay_minutes, is_system, enabled,
    label_slug, label_name, ai_description, sort_order
  )
  VALUES
    (
      p_company_id, 15, true, true,
      'follow_up_15m', 'Follow-up-15m',
      'O cliente está em silêncio há cerca de 15 minutos após a última mensagem da IA. Faça um follow-up breve, natural e sem pressão: relembre o ponto da conversa e ofereça um próximo passo claro (tirar dúvida, enviar opções ou agendar).',
      10
    ),
    (
      p_company_id, 60, true, true,
      'follow_up_1h', 'Follow-up-1h',
      'O cliente está em silêncio há cerca de 1 hora. Faça um follow-up educado e objetivo, retomando o interesse sem insistir. Ofereça ajuda concreta e deixe a porta aberta para retomar quando quiser.',
      20
    )
  ON CONFLICT (company_id, delay_minutes) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.seed_company_follow_up_defaults IS
  'Settings + schedules system (15m/1h) + labels de follow-up para uma empresa.';

CREATE OR REPLACE FUNCTION public.trigger_seed_company_follow_up()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_company_follow_up_defaults(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_company_follow_up_on_insert ON public.companies;
CREATE TRIGGER seed_company_follow_up_on_insert
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_seed_company_follow_up();

-- Backfill all companies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_company_follow_up_defaults(r.id);
  END LOOP;
END;
$$;

-- Promote any pre-existing custom follow_up (ex. Jastelo) to system + canonical name
UPDATE public.company_ai_labels
SET
  is_system = true,
  name = 'Follow-UP',
  sort_order = COALESCE(sort_order, 40)
WHERE slug = 'follow_up';

UPDATE public.company_ai_labels
SET name = 'Follow-up-15m', is_system = true, sort_order = COALESCE(sort_order, 50)
WHERE slug = 'follow_up_15m';

UPDATE public.company_ai_labels
SET name = 'Follow-up-1h', is_system = true, sort_order = COALESCE(sort_order, 60)
WHERE slug = 'follow_up_1h';

-- ---------------------------------------------------------------------------
-- 5) Cycle RPCs (SECURITY DEFINER — service role / authenticated company scope)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_follow_up_jobs(
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

  -- Caller: service_role OU usuário da mesma empresa
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

  UPDATE public.conversation_follow_up_jobs
  SET status = 'cancelled', updated_at = now()
  WHERE company_id = p_company_id
    AND channel = v_channel
    AND session_id = v_session
    AND status = 'pending';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

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

GRANT EXECUTE ON FUNCTION public.cancel_follow_up_jobs(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_or_refresh_follow_up_cycle(uuid, text, text, text, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) Sync label when custom schedule created/updated/deleted (app also syncs;
--    DB helper for delay→slug consistency on update)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_follow_up_schedule_label()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system IS NOT TRUE THEN
      DELETE FROM public.company_ai_labels
      WHERE company_id = OLD.company_id
        AND slug = OLD.label_slug
        AND is_system IS NOT TRUE;
    END IF;
    RETURN OLD;
  END IF;

  INSERT INTO public.company_ai_labels (
    company_id, slug, name, color, is_system, sort_order
  )
  VALUES (
    NEW.company_id,
    NEW.label_slug,
    NEW.label_name,
    CASE WHEN NEW.is_system THEN 'violet' ELSE 'sky' END,
    NEW.is_system,
    100 + NEW.sort_order
  )
  ON CONFLICT (company_id, slug) DO UPDATE
  SET
    name = CASE
      WHEN public.company_ai_labels.is_system THEN public.company_ai_labels.name
      ELSE EXCLUDED.name
    END,
    is_system = CASE
      WHEN public.company_ai_labels.is_system OR EXCLUDED.is_system THEN true
      ELSE false
    END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_follow_up_schedule_label_ins ON public.company_follow_up_schedules;
CREATE TRIGGER sync_follow_up_schedule_label_ins
  AFTER INSERT ON public.company_follow_up_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_follow_up_schedule_label();

DROP TRIGGER IF EXISTS sync_follow_up_schedule_label_upd ON public.company_follow_up_schedules;
CREATE TRIGGER sync_follow_up_schedule_label_upd
  AFTER UPDATE OF label_slug, label_name, is_system ON public.company_follow_up_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_follow_up_schedule_label();

DROP TRIGGER IF EXISTS sync_follow_up_schedule_label_del ON public.company_follow_up_schedules;
CREATE TRIGGER sync_follow_up_schedule_label_del
  AFTER DELETE ON public.company_follow_up_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_follow_up_schedule_label();
