-- Script SQL para listar todos os usuários cadastrados
-- Execute este script no SQL Editor do Supabase Dashboard

-- Listar usuários da tabela auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at,
  updated_at
FROM auth.users
ORDER BY created_at DESC;

-- Listar perfis da tabela user_profiles
SELECT 
  id,
  email,
  full_name,
  role,
  company_id,
  is_active,
  created_at,
  updated_at
FROM public.user_profiles
ORDER BY created_at DESC;

-- Listar usuários com informações completas (JOIN)
SELECT 
  u.id as user_id,
  u.email,
  u.email_confirmed_at,
  u.last_sign_in_at,
  p.full_name,
  p.role,
  p.company_id,
  p.is_active,
  c.name as company_name
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
LEFT JOIN public.companies c ON p.company_id = c.id
ORDER BY u.created_at DESC;








