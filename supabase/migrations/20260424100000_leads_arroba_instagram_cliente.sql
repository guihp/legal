-- Handle do cliente no Instagram (ex.: exibição nas conversas IG)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS arroba_instagram_cliente text NULL;

COMMENT ON COLUMN public.leads.arroba_instagram_cliente IS
  'Arroba / username do cliente no Instagram (quando session_id = leads.id).';
