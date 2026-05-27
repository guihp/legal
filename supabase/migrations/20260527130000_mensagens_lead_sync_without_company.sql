-- Permite resolver lead_id (e company_id) mesmo quando o n8n não envia company_id no INSERT.

CREATE OR REPLACE FUNCTION public.trg_mensagens_before_save()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_lead_id uuid;
  v_lead_company_id uuid;
  v_norm text;
  v_plat text;
BEGIN
  v_plat := lower(trim(coalesce(NEW.plataforma, 'WhatsApp')));
  v_norm := public.resolve_mensagens_contact_norm(NEW.phone, NEW.plataforma);

  IF v_norm IS NOT NULL AND v_norm <> '' THEN
    NEW.contact_norm := v_norm;
    NEW.phone := v_norm;
  ELSE
    NEW.contact_norm := NULL;
  END IF;

  IF NEW.lead_id IS NOT NULL THEN
    IF NEW.company_id IS NULL THEN
      SELECT l.company_id INTO NEW.company_id
      FROM public.leads l
      WHERE l.id = NEW.lead_id;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.contact_norm IS NULL OR NEW.contact_norm = '' THEN
    RETURN NEW;
  END IF;

  IF v_plat = 'instagram' THEN
    SELECT l.id, l.company_id
    INTO v_lead_id, v_lead_company_id
    FROM public.leads l
    WHERE lower(trim(coalesce(l.instagram_id_cliente, ''))) = NEW.contact_norm
      AND (NEW.company_id IS NULL OR l.company_id = NEW.company_id)
    ORDER BY l.updated_at DESC NULLS LAST, l.created_at DESC NULLS LAST
    LIMIT 1;
  ELSE
    SELECT l.id, l.company_id
    INTO v_lead_id, v_lead_company_id
    FROM public.leads l
    WHERE public.normalize_phone_digits(l.phone) = NEW.contact_norm
      AND (NEW.company_id IS NULL OR l.company_id = NEW.company_id)
    ORDER BY l.updated_at DESC NULLS LAST, l.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_lead_id IS NOT NULL THEN
    NEW.lead_id := v_lead_id;
    IF NEW.company_id IS NULL AND v_lead_company_id IS NOT NULL THEN
      NEW.company_id := v_lead_company_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_mensagens_lead_id_from_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ig_norm text;
  v_phone_norm text;
BEGIN
  v_ig_norm := lower(trim(coalesce(NEW.instagram_id_cliente, '')));
  v_phone_norm := public.normalize_phone_digits(NEW.phone);

  IF v_ig_norm <> '' THEN
    UPDATE public.mensagens m
    SET
      lead_id = NEW.id,
      company_id = COALESCE(m.company_id, NEW.company_id)
    WHERE m.lead_id IS NULL
      AND lower(trim(coalesce(m.plataforma, 'WhatsApp'))) = 'instagram'
      AND m.contact_norm = v_ig_norm
      AND (m.company_id = NEW.company_id OR m.company_id IS NULL);
  END IF;

  IF v_phone_norm IS NOT NULL AND v_phone_norm <> '' THEN
    UPDATE public.mensagens m
    SET
      lead_id = NEW.id,
      company_id = COALESCE(m.company_id, NEW.company_id)
    WHERE m.lead_id IS NULL
      AND lower(trim(coalesce(m.plataforma, 'WhatsApp'))) <> 'instagram'
      AND m.contact_norm = v_phone_norm
      AND (m.company_id = NEW.company_id OR m.company_id IS NULL);
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill linhas já gravadas sem company_id / lead_id
UPDATE public.mensagens m
SET
  lead_id = l.id,
  company_id = COALESCE(m.company_id, l.company_id)
FROM public.leads l
WHERE m.lead_id IS NULL
  AND m.contact_norm IS NOT NULL
  AND m.contact_norm <> ''
  AND (
    (
      lower(trim(coalesce(m.plataforma, 'WhatsApp'))) = 'instagram'
      AND lower(trim(coalesce(l.instagram_id_cliente, ''))) = m.contact_norm
    )
    OR (
      lower(trim(coalesce(m.plataforma, 'WhatsApp'))) <> 'instagram'
      AND public.normalize_phone_digits(l.phone) = m.contact_norm
      AND (m.company_id IS NULL OR m.company_id = l.company_id)
    )
  );
