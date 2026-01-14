-- Migration: Corrigir função create_company_messages_table para criar tabelas com todas as colunas
-- Atualiza a função para usar múltiplos EXECUTE format() em vez de um único format() com múltiplos placeholders

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
    -- Se já existe, adicionar colunas faltantes (se necessário)
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS data TIMESTAMP DEFAULT now()', table_name);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS media TEXT', table_name);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS instancia TEXT DEFAULT ''sdr''::text', table_name);
    RETURN;
  END IF;
  
  -- Criar a tabela com a estrutura completa da tabela original imobipro_messages
  EXECUTE format('
    CREATE TABLE public.%I (
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

COMMENT ON FUNCTION public.create_company_messages_table IS 'Cria automaticamente a tabela imobipro_messages_{phone} para uma empresa com todas as colunas necessárias';
