-- API Oficial Meta: não exige instância Evolution conectada para ativar a IA.

CREATE OR REPLACE FUNCTION public.company_ai_activation_blockers(p_company_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.companies%ROWTYPE;
  blockers text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO c FROM public.companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RETURN ARRAY['Empresa não encontrada'];
  END IF;

  IF NOT COALESCE(c."APIOficial", false) THEN
    IF NOT public.company_has_connected_whatsapp(p_company_id) THEN
      blockers := array_append(blockers, 'WhatsApp não conectado (Conexões)');
    END IF;
  END IF;

  IF NULLIF(TRIM(COALESCE(c.ai_initial_message, '')), '') IS NULL THEN
    blockers := array_append(blockers, 'Mensagem inicial');
  END IF;
  IF NULLIF(TRIM(COALESCE(c.ai_assistant_name, '')), '') IS NULL THEN
    blockers := array_append(blockers, 'Nome da IA');
  END IF;
  IF NULLIF(TRIM(COALESCE(c.ai_unknown_info_message, '')), '') IS NULL THEN
    blockers := array_append(blockers, 'Resposta quando não souber no cadastro');
  END IF;
  IF NULLIF(TRIM(COALESCE(c.ai_company_mission, '')), '') IS NULL THEN
    blockers := array_append(blockers, 'Missão da empresa');
  END IF;
  IF NULLIF(TRIM(COALESCE(c.ai_tone, '')), '') IS NULL THEN
    blockers := array_append(blockers, 'Tom da IA');
  END IF;
  IF NULLIF(TRIM(COALESCE(c.ai_payment_methods, '')), '') IS NULL THEN
    blockers := array_append(blockers, 'Métodos de pagamento');
  END IF;
  IF NULLIF(TRIM(COALESCE(c.ai_visit_policy, '')), '') IS NULL THEN
    blockers := array_append(blockers, 'Política de visita');
  END IF;
  IF NULLIF(TRIM(COALESCE(c.ai_target_audience, '')), '') IS NULL THEN
    blockers := array_append(blockers, 'Público-alvo');
  END IF;
  IF NULLIF(TRIM(COALESCE(c.ai_rules, '')), '') IS NULL THEN
    blockers := array_append(blockers, 'Regras da IA');
  END IF;
  IF NULLIF(TRIM(COALESCE(c.ai_additional_info, '')), '') IS NULL THEN
    blockers := array_append(blockers, 'Informações adicionais');
  END IF;
  IF NULLIF(TRIM(COALESCE(c.business_hours, '')), '') IS NULL THEN
    blockers := array_append(blockers, 'Horário de funcionamento');
  END IF;

  RETURN blockers;
END;
$function$;

COMMENT ON FUNCTION public.company_ai_activation_blockers(uuid) IS
  'Pendências para ativar ai_assistant_enabled. API Oficial (APIOficial=true) não exige WhatsApp Evolution.';
