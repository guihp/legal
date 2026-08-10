-- Appointment push/inbox copy: title "Visita Agendada" + body with lead + broker names.
-- Removes stage transition text from appointment body.

CREATE OR REPLACE FUNCTION public.notify_on_lead_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
  lead_name text;
  broker_name text;
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

  lead_name := public.lead_display_name(
    NEW.name,
    NEW.nome_instagram_cliente,
    NEW.arroba_instagram_cliente,
    NEW.phone
  );
  from_label := public.format_lead_stage_label(OLD.stage);
  to_label := public.format_lead_stage_label(NEW.stage);

  broker_id := COALESCE(NEW.id_corretor_responsavel, NEW.user_id);

  IF public.is_visit_scheduled_stage(NEW.stage)
     AND NOT public.is_visit_scheduled_stage(OLD.stage) THEN
    SELECT NULLIF(trim(up.full_name), '')
      INTO broker_name
    FROM public.user_profiles up
    WHERE up.id = broker_id;

    broker_name := COALESCE(broker_name, 'Não atribuído');

    notif_type := 'appointment';
    notif_title := 'Visita Agendada';
    notif_body := format(
      'Visita agendada Para "%s" Corretor responsável "%s"',
      lead_name,
      broker_name
    );
  ELSE
    notif_type := 'lead_stage_changed';
    notif_title := 'Lead movido no pipeline';
    notif_body := format(
      '"%s" foi movido de "%s" para "%s".',
      lead_name,
      from_label,
      to_label
    );
  END IF;

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
        'broker_id', broker_id,
        'broker_name', CASE WHEN notif_type = 'appointment' THEN broker_name ELSE NULL END,
        'route', CASE WHEN notif_type = 'appointment' THEN '/agenda' ELSE '/clients' END
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_on_lead_stage_change() IS
  'Creates user_notifications for assigned broker + gestores/admins when leads.stage changes. Appointment title/body: Visita Agendada + lead + corretor responsável.';
