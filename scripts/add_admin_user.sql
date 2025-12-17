-- Script para adicionar usuário admin
-- Execute este script no SQL Editor do Supabase Dashboard
-- Usuário: 1992tiagofranca@gmail.com com role 'admin'

-- Primeiro, vamos verificar se o usuário já existe na auth.users
DO $$
DECLARE
    admin_user_id uuid;
BEGIN
    -- Buscar o ID do usuário na auth.users
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = '1992tiagofranca@gmail.com';
    
    -- Se o usuário existe, inserir na user_profiles
    IF admin_user_id IS NOT NULL THEN
        -- Inserir na user_profiles se não existir
        INSERT INTO public.user_profiles (
            id,
            user_id,
            email,
            role,
            company_id,
            created_at,
            updated_at
        )
        VALUES (
            gen_random_uuid(),
            admin_user_id,
            '1992tiagofranca@gmail.com',
            'admin',
            NULL, -- admin não tem company_id específico
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            role = EXCLUDED.role,
            updated_at = NOW();
            
        RAISE NOTICE 'Usuário admin adicionado/atualizado com sucesso. ID: %', admin_user_id;
    ELSE
        RAISE NOTICE 'Usuário 1992tiagofranca@gmail.com não encontrado na auth.users. Verifique se o usuário foi criado corretamente.';
    END IF;
END $$;

-- Verificar se foi inserido corretamente
SELECT 
    up.id,
    up.user_id,
    up.email,
    up.role,
    up.company_id,
    up.created_at
FROM public.user_profiles up
WHERE up.email = '1992tiagofranca@gmail.com';
