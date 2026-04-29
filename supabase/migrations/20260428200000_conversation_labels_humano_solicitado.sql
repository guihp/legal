-- Permite etiqueta "Humano solicitado" (cliente pediu atendimento humano; mutuamente exclusiva com ai_ativa/humano).
ALTER TABLE public.conversation_contact_labels
  DROP CONSTRAINT IF EXISTS conversation_contact_labels_status_check;

ALTER TABLE public.conversation_contact_labels
  ADD CONSTRAINT conversation_contact_labels_status_check
  CHECK (status IN ('ai_ativa', 'humano', 'humano_solicitado'));
