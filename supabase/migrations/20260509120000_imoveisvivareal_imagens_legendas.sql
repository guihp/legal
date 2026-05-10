-- Legendas curtas por foto (índice alinhado com imoveisvivareal.imagens).
-- O app limita a 50 caracteres; coluna text[] sem limite rígido no PG.

ALTER TABLE public.imoveisvivareal
  ADD COLUMN IF NOT EXISTS imagens_legendas text[] NULL;

COMMENT ON COLUMN public.imoveisvivareal.imagens_legendas IS
  'Legenda opcional por imagem; mesmo índice que imagens[].';
