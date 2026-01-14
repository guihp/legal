-- =============================================================================
-- MIGRATION: Multi-Tenant e Controle de Assinaturas
-- Data: 2026-01-12
-- Descrição: Adiciona campos para controle de assinaturas, bloqueio de empresas
--            e suporte ao role super_admin
-- =============================================================================

-- NOTA: Esta migration já foi aplicada via MCP Supabase.
-- Este arquivo serve como documentação e backup.

-- 1. Adicionar novos campos na tabela companies
-- =============================================================================

-- Status da assinatura
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial'
CHECK (subscription_status IN ('trial', 'active', 'grace', 'expired', 'blocked', 'cancelled'));

-- Data de expiração da assinatura
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- Data de fim do período de teste
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Dias de carência após expiração
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 7;

-- Data de bloqueio (se bloqueado manualmente)
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

-- Motivo do bloqueio
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS block_reason TEXT;

-- Email de cobrança
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS billing_email TEXT;

-- Notas administrativas
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Último login de qualquer usuário da empresa
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- 2. Criar tabela de logs de acesso de empresas
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.company_access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('blocked', 'unblocked', 'subscription_changed', 'plan_changed', 'created', 'grace_period_started', 'expired')),
    previous_status TEXT,
    new_status TEXT,
    reason TEXT,
    performed_by UUID REFERENCES public.user_profiles(id),
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Índices para a tabela de logs
CREATE INDEX IF NOT EXISTS idx_company_access_logs_company_id ON public.company_access_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_company_access_logs_created_at ON public.company_access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_company_access_logs_action ON public.company_access_logs(action);

-- Habilitar RLS
ALTER TABLE public.company_access_logs ENABLE ROW LEVEL SECURITY;

-- 3. Atualizar tabela user_profiles para permitir company_id nulo (super_admin)
-- =============================================================================

-- Primeiro remover a constraint NOT NULL do company_id
ALTER TABLE public.user_profiles ALTER COLUMN company_id DROP NOT NULL;

-- 4. Índices adicionais para companies
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON public.companies(subscription_status);
CREATE INDEX IF NOT EXISTS idx_companies_subscription_expires_at ON public.companies(subscription_expires_at);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON public.companies(is_active);

-- 5. Comentários para documentação
-- =============================================================================

COMMENT ON COLUMN public.companies.subscription_status IS 'Status da assinatura: trial, active, grace, expired, blocked, cancelled';
COMMENT ON COLUMN public.companies.subscription_expires_at IS 'Data de expiração da assinatura atual';
COMMENT ON COLUMN public.companies.trial_ends_at IS 'Data de fim do período de teste';
COMMENT ON COLUMN public.companies.grace_period_days IS 'Dias de carência após expiração antes de bloquear';
COMMENT ON COLUMN public.companies.blocked_at IS 'Data/hora em que a empresa foi bloqueada';
COMMENT ON COLUMN public.companies.block_reason IS 'Motivo do bloqueio da empresa';
COMMENT ON COLUMN public.companies.billing_email IS 'Email para cobrança (pode ser diferente do email principal)';
COMMENT ON COLUMN public.companies.admin_notes IS 'Notas internas do administrador sobre a empresa';
COMMENT ON COLUMN public.companies.last_activity_at IS 'Última atividade registrada de qualquer usuário';

COMMENT ON TABLE public.company_access_logs IS 'Log de ações administrativas sobre empresas (bloqueios, desbloqueios, mudanças de plano)';
