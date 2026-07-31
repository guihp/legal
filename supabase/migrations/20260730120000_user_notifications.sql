-- In-app notifications for company users (pipeline moves, appointments, connections)
-- Schema: user_notifications + server-side triggers on leads.stage changes

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_notifications_type_check CHECK (
    type = ANY (ARRAY[
      'lead_stage_changed'::text,
      'appointment'::text,
      'connection_request'::text,
      'connection_approved'::text,
      'connection_rejected'::text,
      'general'::text
    ])
  )
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
  ON public.user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON public.user_notifications (user_id)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_notifications_company
  ON public.user_notifications (company_id, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_notifications_select_own" ON public.user_notifications;
CREATE POLICY "user_notifications_select_own"
  ON public.user_notifications
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_notifications_update_own" ON public.user_notifications;
CREATE POLICY "user_notifications_update_own"
  ON public.user_notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_notifications_insert_company" ON public.user_notifications;
CREATE POLICY "user_notifications_insert_company"
  ON public.user_notifications
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT up.company_id
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
    )
  );

DROP POLICY IF EXISTS "user_notifications_delete_own" ON public.user_notifications;
CREATE POLICY "user_notifications_delete_own"
  ON public.user_notifications
  FOR DELETE
  USING (user_id = auth.uid());

-- Compat view for legacy client code that still references public.notifications
CREATE OR REPLACE VIEW public.notifications
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  company_id,
  type,
  title,
  body AS message,
  meta AS data,
  (read_at IS NOT NULL) AS is_read,
  created_at,
  created_at AS updated_at,
  read_at
FROM public.user_notifications;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

-- Map legacy notifications inserts (message/data/is_read) → user_notifications
CREATE OR REPLACE FUNCTION public.notifications_view_instead_of_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.user_notifications (
    id, company_id, user_id, type, title, body, meta, read_at, created_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.company_id,
    NEW.user_id,
    NEW.type,
    NEW.title,
    COALESCE(NEW.message, ''),
    COALESCE(NEW.data, '{}'::jsonb),
    CASE WHEN COALESCE(NEW.is_read, false) THEN now() ELSE NULL END,
    COALESCE(NEW.created_at, now())
  )
  RETURNING id INTO new_id;

  NEW.id := new_id;
  NEW.read_at := CASE WHEN COALESCE(NEW.is_read, false) THEN now() ELSE NULL END;
  NEW.updated_at := COALESCE(NEW.created_at, now());
  NEW.is_read := COALESCE(NEW.is_read, false);
  NEW.message := COALESCE(NEW.message, '');
  NEW.data := COALESCE(NEW.data, '{}'::jsonb);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notifications_view_instead_of_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_notifications
  SET
    title = COALESCE(NEW.title, title),
    body = COALESCE(NEW.message, body),
    meta = COALESCE(NEW.data, meta),
    type = COALESCE(NEW.type, type),
    read_at = CASE
      WHEN NEW.is_read IS TRUE THEN COALESCE(read_at, now())
      WHEN NEW.is_read IS FALSE THEN NULL
      WHEN NEW.read_at IS NOT NULL THEN NEW.read_at
      ELSE read_at
    END
  WHERE id = OLD.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_instead_insert ON public.notifications;
CREATE TRIGGER trg_notifications_instead_insert
  INSTEAD OF INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notifications_view_instead_of_insert();

DROP TRIGGER IF EXISTS trg_notifications_instead_update ON public.notifications;
CREATE TRIGGER trg_notifications_instead_update
  INSTEAD OF UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notifications_view_instead_of_update();

-- Realtime for in-app bell
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END $$;

-- Pretty stage labels for Portuguese UI
CREATE OR REPLACE FUNCTION public.format_lead_stage_label(p_stage text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(replace(trim(COALESCE(p_stage, '')), ' ', '-'))
    WHEN 'novo-lead' THEN 'Novo Lead'
    WHEN 'qualificado' THEN 'Qualificado'
    WHEN 'visita-agendada' THEN 'Visita agendada'
    WHEN 'visita-cancelada' THEN 'Visita cancelada'
    WHEN 'em-negociacao' THEN 'Em negociação'
    WHEN 'documentacao' THEN 'Documentação'
    WHEN 'contrato' THEN 'Contrato'
    WHEN 'fechamento' THEN 'Fechamento'
    ELSE COALESCE(NULLIF(trim(p_stage), ''), '—')
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_visit_scheduled_stage(p_stage text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(replace(trim(COALESCE(p_stage, '')), ' ', '-')) = 'visita-agendada';
$$;

CREATE OR REPLACE FUNCTION public.notify_on_lead_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
  lead_name text;
  from_label text;
  to_label text;
  notif_type text;
  notif_title text;
  notif_body text;
  broker_id uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.stage IS NOT DISTINCT FROM NEW.stage THEN
    RETURN NEW;
  END IF;

  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  lead_name := COALESCE(NULLIF(trim(NEW.name), ''), 'Lead sem nome');
  from_label := public.format_lead_stage_label(OLD.stage);
  to_label := public.format_lead_stage_label(NEW.stage);

  IF public.is_visit_scheduled_stage(NEW.stage)
     AND NOT public.is_visit_scheduled_stage(OLD.stage) THEN
    notif_type := 'appointment';
    notif_title := 'Visita agendada';
    notif_body := format(
      'Visita agendada para %s (estágio: %s → %s).',
      lead_name,
      from_label,
      to_label
    );
  ELSE
    notif_type := 'lead_stage_changed';
    notif_title := 'Lead movido no pipeline';
    notif_body := format(
      '%s movido de "%s" para "%s".',
      lead_name,
      from_label,
      to_label
    );
  END IF;

  broker_id := COALESCE(NEW.id_corretor_responsavel, NEW.user_id);

  FOR rid IN
    SELECT DISTINCT x.id
    FROM (
      SELECT broker_id AS id
      WHERE broker_id IS NOT NULL
      UNION
      SELECT up.id
      FROM public.user_profiles up
      WHERE up.company_id = NEW.company_id
        AND up.is_active IS TRUE
        AND up.role IN ('gestor', 'admin')
    ) x
    WHERE x.id IS NOT NULL
  LOOP
    INSERT INTO public.user_notifications (
      company_id,
      user_id,
      type,
      title,
      body,
      meta
    ) VALUES (
      NEW.company_id,
      rid,
      notif_type,
      notif_title,
      notif_body,
      jsonb_build_object(
        'lead_id', NEW.id,
        'from_stage', OLD.stage,
        'to_stage', NEW.stage,
        'from_stage_label', from_label,
        'to_stage_label', to_label,
        'lead_name', lead_name,
        'route', CASE WHEN notif_type = 'appointment' THEN '/agenda' ELSE '/clients' END
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_lead_stage_change ON public.leads;
CREATE TRIGGER trg_notify_lead_stage_change
  AFTER UPDATE OF stage ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_lead_stage_change();

COMMENT ON TABLE public.user_notifications IS
  'In-app notifications per user (pipeline moves, appointments, connection requests).';
COMMENT ON FUNCTION public.notify_on_lead_stage_change() IS
  'Creates user_notifications for assigned broker + gestores/admins when leads.stage changes.';
