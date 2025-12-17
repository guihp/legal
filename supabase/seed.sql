-- =============================================================================
-- SEED DATA FOR IMOBIPRO SYSTEM
-- =============================================================================
-- This file contains safe demo data for new installations
-- DO NOT include production data, PII, or sensitive information

-- =============================================================================
-- ADMIN USER CREATION
-- =============================================================================
-- Create admin user in auth.users table
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000', -- admin user ID
  '00000000-0000-0000-0000-000000000000', -- default instance_id
  'authenticated',
  'authenticated',
  'admin@imobipro.com',
  crypt('admin123', gen_salt('bf')), -- password: admin123 (change in production!)
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Create admin user profile
INSERT INTO public.user_profiles (
  id,
  company_id,
  full_name,
  email,
  phone,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000', -- same ID as auth.users
  '550e8400-e29b-41d4-a716-446655440001', -- Demo Imobiliária company
  'Admin Sistema',
  'admin@imobipro.com',
  '+5511999999999',
  'admin',
  true,
  NOW(),
  NOW()
);

-- =============================================================================
-- DEMO DATA
-- =============================================================================

-- Demo company data
INSERT INTO public.companies (id, name, email, phone, address, is_active, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Demo Imobiliária', 'contato@demoimobiliaria.com', '+5511999999999', 'Rua Demo, 123 - São Paulo, SP', true, NOW()),
('550e8400-e29b-41d4-a716-446655440002', 'Exemplo Imóveis', 'info@exemploimoveis.com', '+5511888888888', 'Av. Exemplo, 456 - Rio de Janeiro, RJ', true, NOW());

-- Demo company features
INSERT INTO public.company_features (id, company_id, feature_key, is_enabled, created_at) VALUES
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440001', 'whatsapp_integration', true, NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440001', 'lead_management', true, NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440001', 'property_management', true, NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440001', 'contract_templates', true, NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440002', 'whatsapp_integration', true, NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440002', 'lead_management', true, NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440002', 'property_management', true, NOW());

-- Demo company settings
INSERT INTO public.company_settings (id, company_id, display_name, display_subtitle, theme, primary_color, language, timezone, created_at) VALUES
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440001', 'Demo Imobiliária', 'Gestão Imobiliária Demo', 'dark', '#3B82F6', 'pt-BR', 'America/Sao_Paulo', NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440002', 'Exemplo Imóveis', 'Gestão Imobiliária Exemplo', 'dark', '#3B82F6', 'pt-BR', 'America/Sao_Paulo', NOW());

-- Demo properties (using imoveisvivareal table)
INSERT INTO public.imoveisvivareal (id, listing_id, tipo_categoria, tipo_imovel, descricao, preco, tamanho_m2, quartos, banheiros, garagem, cidade, bairro, endereco, numero, cep, user_id, company_id, modalidade, disponibilidade, created_at) VALUES
(nextval('imoveisvivareal_id_seq'), 'DEMO001', 'Residencial', 'Apartamento', 'Apartamento demonstrativo com 2 quartos, sala, cozinha e banheiro. Localização privilegiada.', 2500.00, 65.50, 2, 1, 1, 'São Paulo', 'Centro', 'Rua das Flores', '123', '01000-000', NULL, '550e8400-e29b-41d4-a716-446655440001', 'Aluguel', 'disponivel', NOW()),
(nextval('imoveisvivareal_id_seq'), 'DEMO002', 'Residencial', 'Casa', 'Casa de exemplo com 3 quartos, 2 banheiros, sala, cozinha e quintal.', 450000.00, 120.00, 3, 2, 2, 'São Paulo', 'Jardim Exemplo', 'Av. Principal', '789', '01200-000', NULL, '550e8400-e29b-41d4-a716-446655440001', 'Venda', 'disponivel', NOW()),
(nextval('imoveisvivareal_id_seq'), 'DEMO003', 'Residencial', 'Loft', 'Loft moderno e funcional, ideal para jovens profissionais.', 1800.00, 45.00, 1, 1, 1, 'Rio de Janeiro', 'Vila Nova', 'Rua Moderna', '456', '20000-000', NULL, '550e8400-e29b-41d4-a716-446655440002', 'Aluguel', 'disponivel', NOW());

-- Demo contract templates  
INSERT INTO public.contract_templates (id, company_id, name, template_type, file_name, file_path, created_at) VALUES
(gen_random_uuid()::text, '550e8400-e29b-41d4-a716-446655440001', 'Contrato de Locação Padrão', 'Locação', 'contrato_locacao_padrao.pdf', '/templates/contrato_locacao_padrao.pdf', NOW()),
(gen_random_uuid()::text, '550e8400-e29b-41d4-a716-446655440001', 'Contrato de Venda Padrão', 'Venda', 'contrato_venda_padrao.pdf', '/templates/contrato_venda_padrao.pdf', NOW()),
(gen_random_uuid()::text, '550e8400-e29b-41d4-a716-446655440002', 'Contrato de Locação Simples', 'Locação', 'contrato_locacao_simples.pdf', '/templates/contrato_locacao_simples.pdf', NOW());

-- Demo role permissions
INSERT INTO public.role_permissions (id, role, permission_key, permission_name, category, description, is_enabled, created_at) VALUES
(gen_random_uuid(), 'gestor', 'imoveisvivareal_read', 'Visualizar Imóveis', 'imoveisvivareal', 'Permite visualizar imóveis da empresa', true, NOW()),
(gen_random_uuid(), 'gestor', 'imoveisvivareal_write', 'Gerenciar Imóveis', 'imoveisvivareal', 'Permite criar, editar e excluir imóveis', true, NOW()),
(gen_random_uuid(), 'gestor', 'leads_read', 'Visualizar Leads', 'leads', 'Permite visualizar leads da empresa', true, NOW()),
(gen_random_uuid(), 'gestor', 'leads_write', 'Gerenciar Leads', 'leads', 'Permite criar, editar e excluir leads', true, NOW()),
(gen_random_uuid(), 'corretor', 'imoveisvivareal_read', 'Visualizar Imóveis', 'imoveisvivareal', 'Permite visualizar imóveis da empresa', true, NOW()),
(gen_random_uuid(), 'corretor', 'leads_read', 'Visualizar Leads', 'leads', 'Permite visualizar leads da empresa', true, NOW()),
(gen_random_uuid(), 'corretor', 'leads_write', 'Gerenciar Leads', 'leads', 'Permite criar, editar e excluir leads', true, NOW());

-- Demo leads
INSERT INTO public.leads (id, name, email, phone, source, message, stage, company_id, created_at) VALUES
(gen_random_uuid(), 'João Silva', 'joao.silva@email.com', '+5511999999999', 'Site', 'Interessado em apartamento de 2 quartos', 'Novo Lead', '550e8400-e29b-41d4-a716-446655440001', NOW()),
(gen_random_uuid(), 'Maria Santos', 'maria.santos@email.com', '+5511888888888', 'Indicação', 'Procurando casa para compra', 'Novo Lead', '550e8400-e29b-41d4-a716-446655440001', NOW()),
(gen_random_uuid(), 'Pedro Costa', 'pedro.costa@email.com', '+5511777777777', 'Site', 'Interessado em loft para aluguel', 'Novo Lead', '550e8400-e29b-41d4-a716-446655440002', NOW());

-- =============================================================================
-- INSTRUCTIONS FOR USE
-- =============================================================================
-- 
-- To apply this seed data:
-- 1. Ensure your migrations have been applied successfully
-- 2. Run: psql -h <host> -p <port> -U <user> -d <database> -f supabase/seed.sql
-- 3. Or use Supabase CLI: supabase db reset (applies migrations + seed)
-- 4. Or in Supabase Dashboard SQL Editor, copy and paste this content
--
-- Note: This creates demo companies with IDs that can be used for testing
-- Company 1 ID: 550e8400-e29b-41d4-a716-446655440001
-- Company 2 ID: 550e8400-e29b-41d4-a716-446655440002
--
-- WhatsApp Integration:
-- - WhatsApp functionality is now handled via external N8N webhooks
-- - Use the frontend "CONEXÕES" module to create/manage instances
-- - External endpoints: https://devlabz.n8nlabz.com.br/webhook/*
--
-- Remember to create user profiles manually or via auth signup flow
-- as they depend on auth.users table managed by Supabase Auth
