-- Links sem trial por padrão; admin habilita explicitamente no painel
ALTER TABLE public.signup_links
ALTER COLUMN trial_days SET DEFAULT 0;
