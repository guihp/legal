-- Add pipeline stage "Visita realizada" (slug: visita-realizada).
-- Order (CRM): ... → visita-agendada → visita-realizada → visita-cancelada → em-negociacao → ...
-- Historically leads.stage was unconstrained text (mixed slug + title). Add CHECK for known stages.

CREATE OR REPLACE FUNCTION public.format_lead_stage_label(p_stage text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(replace(trim(COALESCE(p_stage, '')), ' ', '-'))
    WHEN 'novo-lead' THEN 'Novo Lead'
    WHEN 'qualificado' THEN 'Qualificado'
    WHEN 'visita-agendada' THEN 'Visita agendada'
    WHEN 'visita-realizada' THEN 'Visita realizada'
    WHEN 'visita-cancelada' THEN 'Visita cancelada'
    WHEN 'em-negociacao' THEN 'Em negociação'
    WHEN 'documentacao' THEN 'Documentação'
    WHEN 'contrato' THEN 'Contrato'
    WHEN 'fechamento' THEN 'Fechamento'
    ELSE COALESCE(NULLIF(trim(p_stage), ''), '—')
  END;
$$;

COMMENT ON FUNCTION public.format_lead_stage_label(text) IS
  'Maps leads.stage slug/title to Portuguese display label (incl. visita-realizada).';

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_stage_allowed;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_stage_allowed CHECK (
    stage IS NULL
    OR translate(
      lower(replace(trim(stage), ' ', '-')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ) IN (
      'novo-lead',
      'qualificado',
      'visita-agendada',
      'visita-realizada',
      'visita-cancelada',
      'em-negociacao',
      'documentacao',
      'contrato',
      'fechamento'
    )
  );

COMMENT ON CONSTRAINT leads_stage_allowed ON public.leads IS
  'Allowed CRM pipeline stages (slug or title; accents normalized).';
