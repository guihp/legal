-- Trava nome das etiquetas de sistema (só cor/sort_order editáveis) + re-seed/reset canônico

CREATE OR REPLACE FUNCTION public.protect_system_ai_labels()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_system IS TRUE THEN
    IF NEW.is_system IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Não é permitido alterar is_system de etiquetas de sistema';
    END IF;
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION 'Não é permitido alterar o slug de etiquetas de sistema';
    END IF;
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      RAISE EXCEPTION 'Não é permitido alterar o nome de etiquetas de sistema';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_system_ai_labels IS
  'Etiquetas is_system: slug, name e is_system imutáveis; color/sort_order liberados.';

-- Garante as 3 de sistema em todas as empresas (idempotente)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_company_ai_system_labels(r.id);
  END LOOP;
END;
$$;

-- Restaura nomes canônicos (caso alguém tenha renomeado antes da trava)
UPDATE public.company_ai_labels SET name = 'AI ATIVA'
WHERE is_system AND slug = 'ai_ativa' AND name IS DISTINCT FROM 'AI ATIVA';

UPDATE public.company_ai_labels SET name = 'Humano'
WHERE is_system AND slug = 'humano' AND name IS DISTINCT FROM 'Humano';

UPDATE public.company_ai_labels SET name = 'Humano solicitado'
WHERE is_system AND slug = 'humano_solicitado' AND name IS DISTINCT FROM 'Humano solicitado';
