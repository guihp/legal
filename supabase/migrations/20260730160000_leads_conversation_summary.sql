-- Persist AI conversation summary on leads (LeadViewModal + n8n resumo_conversa)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS conversation_summary text NULL;

COMMENT ON COLUMN public.leads.conversation_summary IS
  'Resumo da conversa gerado via n8n webhook resumo_conversa (LeadViewModal / Conversas).';
