-- Período de teste configurável por link de cadastro (admin)
ALTER TABLE public.signup_links
ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 7;

COMMENT ON COLUMN public.signup_links.trial_days IS 'Dias de teste gratuito ao concluir cadastro via link (padrão 7, admin pode definir 15)';
