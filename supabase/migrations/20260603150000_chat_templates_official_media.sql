-- Templates: flag API Oficial + anexo de mídia (imagem, vídeo, áudio, PDF)
alter table public.chat_templates
  add column if not exists is_official_api boolean not null default false;

alter table public.chat_templates
  add column if not exists media_url text;

alter table public.chat_templates
  add column if not exists media_type text;

alter table public.chat_templates
  add column if not exists media_mime_type text;

alter table public.chat_templates
  add column if not exists media_name text;

comment on column public.chat_templates.media_type is 'imagem | audio | video | pdf';
comment on column public.chat_templates.is_official_api is 'Template aprovado para envio via WhatsApp Cloud API (fora da janela 24h)';

-- Permite template só com mídia (sem texto)
alter table public.chat_templates
  alter column message drop not null;

alter table public.chat_templates
  alter column message set default '';
