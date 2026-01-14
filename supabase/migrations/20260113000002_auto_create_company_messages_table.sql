-- Migration: Criar automaticamente tabela imobipro_messages_{phone} quando uma empresa for criada
-- Cria a tabela específica da empresa com a estrutura necessária

-- Função para criar a tabela de mensagens da empresa
CREATE OR REPLACE FUNCTION public.create_company_messages_table(p_whatsapp_ai_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_name text;
  phone_clean text;
BEGIN
  -- Limpar o número do telefone (apenas números)
  phone_clean := regexp_replace(p_whatsapp_ai_phone, '[^0-9]', '', 'g');
  
  -- Construir nome da tabela
  table_name := 'imobipro_messages_' || phone_clean;
  
  -- Verificar se a tabela já existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = table_name
  ) THEN
    -- Se já existe, não fazer nada
    RETURN;
  END IF;
  
  -- Criar a tabela com a estrutura da tabela original imobipro_messages
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS public.%I (
      id INTEGER NOT NULL DEFAULT nextval(''imobipro_messages1_id_seq''::regclass),
      session_id VARCHAR(255) NOT NULL,
      message JSONB NOT NULL,
      data TIMESTAMP DEFAULT now(),
      media TEXT,
      instancia TEXT DEFAULT ''sdr''::text,
      CONSTRAINT %I_pkey PRIMARY KEY (id)
    )
  ', table_name, table_name || '_pkey');
  
  -- Criar índices para melhor performance
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I_session_id_idx ON public.%I(session_id)', table_name || '_session_id', table_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I_data_idx ON public.%I(data)', table_name || '_data', table_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I_instancia_idx ON public.%I(instancia)', table_name || '_instancia', table_name);
  
  -- Habilitar RLS na tabela (opcional, mas recomendado)
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  
END;
$$;

COMMENT ON FUNCTION public.create_company_messages_table IS 'Cria automaticamente a tabela imobipro_messages_{phone} para uma empresa';

-- Função trigger que será chamada quando uma empresa for criada
CREATE OR REPLACE FUNCTION public.trigger_create_company_messages_table()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se whatsapp_ai_phone foi fornecido, criar a tabela
  IF NEW.whatsapp_ai_phone IS NOT NULL AND NEW.whatsapp_ai_phone != '' THEN
    PERFORM public.create_company_messages_table(NEW.whatsapp_ai_phone);
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_create_company_messages_table IS 'Trigger que cria a tabela de mensagens quando uma empresa é criada';

-- Criar o trigger
DROP TRIGGER IF EXISTS create_company_messages_table_trigger ON public.companies;
CREATE TRIGGER create_company_messages_table_trigger
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_company_messages_table();

COMMENT ON TRIGGER create_company_messages_table_trigger ON public.companies IS 'Cria automaticamente a tabela de mensagens quando uma nova empresa é inserida';
