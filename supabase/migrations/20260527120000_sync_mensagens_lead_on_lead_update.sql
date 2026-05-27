-- Preenche mensagens.lead_id quando o lead é criado/atualizado depois da mensagem
-- (fluxo comum: n8n grava mensagem antes de vincular instagram_id_cliente no CRM).

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
    SET lead_id = NEW.id
    WHERE m.company_id = NEW.company_id
      AND m.lead_id IS NULL
      AND lower(trim(coalesce(m.plataforma, 'WhatsApp'))) = 'instagram'
      AND m.contact_norm = v_ig_norm;
  END IF;

  IF v_phone_norm IS NOT NULL AND v_phone_norm <> '' THEN
    UPDATE public.mensagens m
    SET lead_id = NEW.id
    WHERE m.company_id = NEW.company_id
      AND m.lead_id IS NULL
      AND lower(trim(coalesce(m.plataforma, 'WhatsApp'))) <> 'instagram'
      AND m.contact_norm = v_phone_norm;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_sync_mensagens_lead_id ON public.leads;
CREATE TRIGGER leads_sync_mensagens_lead_id
  AFTER INSERT OR UPDATE OF instagram_id_cliente, phone, company_id
  ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_mensagens_lead_id_from_lead();

COMMENT ON FUNCTION public.sync_mensagens_lead_id_from_lead() IS
  'Backfill mensagens.lead_id quando lead ganha instagram_id_cliente ou phone após mensagem já inserida.';
