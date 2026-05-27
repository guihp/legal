-- Insert idempotente por (company_id, mensagem_id) — evita 409 quando n8n reprocessa o mesmo wamid.

CREATE OR REPLACE FUNCTION public.upsert_mensagem(
  p_company_id uuid,
  p_phone text,
  p_mensagem_id text,
  p_mensage_type text DEFAULT NULL,
  p_text text DEFAULT NULL,
  p_type text DEFAULT 'lead',
  p_plataforma text DEFAULT 'WhatsApp',
  p_instancia text DEFAULT NULL,
  p_conteudo_media text DEFAULT NULL
)
RETURNS public.mensagens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.mensagens;
  v_mid text;
BEGIN
  v_mid := trim(coalesce(p_mensagem_id, ''));
  IF p_company_id IS NULL OR trim(coalesce(p_phone, '')) = '' THEN
    RAISE EXCEPTION 'company_id and phone are required';
  END IF;

  IF v_mid = '' THEN
    INSERT INTO public.mensagens (
      company_id, phone, mensage_type, text, type, plataforma, instancia, conteudo_media
    )
    VALUES (
      p_company_id, p_phone, p_mensage_type, p_text, p_type, p_plataforma, p_instancia, p_conteudo_media
    )
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  INSERT INTO public.mensagens (
    company_id,
    phone,
    mensagem_id,
    mensage_type,
    text,
    type,
    plataforma,
    instancia,
    conteudo_media
  )
  VALUES (
    p_company_id,
    p_phone,
    v_mid,
    p_mensage_type,
    p_text,
    p_type,
    p_plataforma,
    p_instancia,
    p_conteudo_media
  )
  ON CONFLICT (company_id, mensagem_id)
    WHERE mensagem_id IS NOT NULL AND trim(mensagem_id) <> ''
  DO UPDATE SET
    text = COALESCE(EXCLUDED.text, mensagens.text),
    mensage_type = COALESCE(EXCLUDED.mensage_type, mensagens.mensage_type),
    type = COALESCE(EXCLUDED.type, mensagens.type),
    instancia = COALESCE(EXCLUDED.instancia, mensagens.instancia),
    conteudo_media = COALESCE(EXCLUDED.conteudo_media, mensagens.conteudo_media),
    plataforma = COALESCE(EXCLUDED.plataforma, mensagens.plataforma),
    phone = COALESCE(EXCLUDED.phone, mensagens.phone)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.upsert_mensagem IS
  'Grava mensagem de chat de forma idempotente por (company_id, mensagem_id). Use no n8n em vez de INSERT direto.';

GRANT EXECUTE ON FUNCTION public.upsert_mensagem(
  uuid, text, text, text, text, text, text, text, text
) TO authenticated, service_role;
