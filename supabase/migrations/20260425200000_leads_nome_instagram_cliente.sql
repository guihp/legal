-- Nome amigável do cliente no Instagram (lista de conversas / header).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS nome_instagram_cliente text NULL;

COMMENT ON COLUMN public.leads.nome_instagram_cliente IS
  'Nome de exibição do cliente no Instagram (DM); usado na UI quando session_id = leads.id.';
