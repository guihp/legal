-- Migration para corrigir estrutura da tabela user_profiles
-- Data: 2025-08-26 05:00:00

-- Verificar se a tabela existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'Tabela user_profiles não existe';
    END IF;
END $$;

-- Adicionar campos que podem estar faltando
DO $$ 
BEGIN
    -- Adicionar campo full_name se não existir
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'full_name') THEN
        ALTER TABLE public.user_profiles ADD COLUMN full_name TEXT;
        RAISE NOTICE 'Campo full_name adicionado';
    END IF;
    
    -- Adicionar campo department se não existir
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'department') THEN
        ALTER TABLE public.user_profiles ADD COLUMN department TEXT;
        RAISE NOTICE 'Campo department adicionado';
    END IF;
    
    -- Adicionar campo phone se não existir
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'phone') THEN
        ALTER TABLE public.user_profiles ADD COLUMN phone TEXT;
        RAISE NOTICE 'Campo phone adicionado';
    END IF;
    
    -- Adicionar campo is_active se não existir
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_active') THEN
        ALTER TABLE public.user_profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE 'Campo is_active adicionado';
    END IF;
    
    -- Adicionar campo created_at se não existir
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'created_at') THEN
        ALTER TABLE public.user_profiles ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
        RAISE NOTICE 'Campo created_at adicionado';
    END IF;
    
    -- Adicionar campo updated_at se não existir
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'updated_at') THEN
        ALTER TABLE public.user_profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
        RAISE NOTICE 'Campo updated_at adicionado';
    END IF;
END $$;

-- Garantir que campos obrigatórios não sejam nulos
ALTER TABLE public.user_profiles ALTER COLUMN email SET NOT NULL;
ALTER TABLE public.user_profiles ALTER COLUMN full_name SET NOT NULL;
ALTER TABLE public.user_profiles ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.user_profiles ALTER COLUMN company_id SET NOT NULL;

-- Adicionar constraint para role válido
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check 
    CHECK (role IN ('admin', 'gestor', 'corretor'));

-- Adicionar constraint para email único
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_email_key;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_email_key UNIQUE (email);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON public.user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON public.user_profiles(is_active);

-- Habilitar RLS se não estiver habilitado
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Criar policies básicas se não existirem
DO $$ 
BEGIN
    -- Policy para SELECT
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'user_profiles_select_all') THEN
        CREATE POLICY "user_profiles_select_all" ON public.user_profiles FOR SELECT USING (true);
        RAISE NOTICE 'Policy user_profiles_select_all criada';
    END IF;
    
    -- Policy para INSERT
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'user_profiles_insert_admin') THEN
        CREATE POLICY "user_profiles_insert_admin" ON public.user_profiles FOR INSERT 
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_profiles 
                WHERE id = current_setting('request.jwt.claims', true)::json->>'sub'
                AND role IN ('admin', 'gestor')
            )
        );
        RAISE NOTICE 'Policy user_profiles_insert_admin criada';
    END IF;
    
    -- Policy para UPDATE
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'user_profiles_update_admin') THEN
        CREATE POLICY "user_profiles_update_admin" ON public.user_profiles FOR UPDATE 
        USING (
            EXISTS (
                SELECT 1 FROM public.user_profiles 
                WHERE id = current_setting('request.jwt.claims', true)::json->>'sub'
                AND role IN ('admin', 'gestor')
            )
        );
        RAISE NOTICE 'Policy user_profiles_update_admin criada';
    END IF;
END $$;

-- Verificar estrutura final
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    CASE WHEN column_name IN ('email', 'full_name', 'role', 'company_id') THEN 'OBRIGATÓRIO' ELSE 'OPCIONAL' END as status
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public' 
ORDER BY ordinal_position;
