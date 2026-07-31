-- Fix notify_on_lead_stage_change: leads.name can be WhatsApp placeholder "~".
-- Resolve display name like the CRM UI (name → nome_instagram → @arroba → phone).

CREATE OR REPLACE FUNCTION public.lead_display_name(
  p_name text,
  p_nome_instagram text,
  p_arroba text,
  p_phone text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      trim(
        CASE
          WHEN lower(trim(COALESCE(p_name, ''))) IN ('', '~', '-', '.', 'null', 'undefined')
            THEN ''
          ELSE trim(p_name)
        END
      ),
      ''
    ),
    NULLIF(trim(COALESCE(p_nome_instagram, '')), ''),
    CASE
      WHEN NULLIF(trim(COALESCE(p_arroba, '')), '') IS NULL THEN NULL
      WHEN left(trim(p_arroba), 1) = '@' THEN trim(p_arroba)
      ELSE '@' || trim(p_arroba)
    END,
    NULLIF(trim(COALESCE(p_phone, '')), ''),
    'Lead sem nome'
  );
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

  lead_name := public.lead_display_name(
    NEW.name,
    NEW.nome_instagram_cliente,
    NEW.arroba_instagram_cliente,
    NEW.phone
  );
  from_label := public.format_lead_stage_label(OLD.stage);
  to_label := public.format_lead_stage_label(NEW.stage);

  IF public.is_visit_scheduled_stage(NEW.stage)
     AND NOT public.is_visit_scheduled_stage(OLD.stage) THEN
    notif_type := 'appointment';
    notif_title := 'Visita agendada';
    notif_body := format(
      'Visita agendada para "%s" (estágio: %s → %s).',
      lead_name,
      from_label,
      to_label
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

COMMENT ON FUNCTION public.lead_display_name(text, text, text, text) IS
  'Resolves a human lead label; treats WhatsApp placeholder "~" as empty.';
COMMENT ON FUNCTION public.notify_on_lead_stage_change() IS
  'Creates user_notifications for assigned broker + gestores/admins when leads.stage changes.';

-- Backfill bodies that captured the WhatsApp "~" placeholder
UPDATE public.user_notifications un
SET
  body = format(
    '"%s" foi movido de "%s" para "%s".',
    public.lead_display_name(
      l.name,
      l.nome_instagram_cliente,
      l.arroba_instagram_cliente,
      l.phone
    ),
    COALESCE(un.meta->>'from_stage_label', public.format_lead_stage_label(un.meta->>'from_stage')),
    COALESCE(un.meta->>'to_stage_label', public.format_lead_stage_label(un.meta->>'to_stage'))
  ),
  meta = jsonb_set(
    un.meta,
    '{lead_name}',
    to_jsonb(
      public.lead_display_name(
        l.name,
        l.nome_instagram_cliente,
        l.arroba_instagram_cliente,
        l.phone
      )
    )
  )
FROM public.leads l
WHERE un.type = 'lead_stage_changed'
  AND (un.meta->>'lead_id') IS NOT NULL
  AND (un.meta->>'lead_id')::uuid = l.id
  AND (
    un.meta->>'lead_name' = '~'
    OR un.body LIKE '~ %'
    OR left(un.body, 1) = '~'
  );
