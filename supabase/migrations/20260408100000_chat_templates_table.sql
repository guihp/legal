create table if not exists public.chat_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  shortcut text not null,
  message text not null,
  created_at timestamp with time zone default now()
);

alter table public.chat_templates enable row level security;

create policy "Users can view templates of their company" on public.chat_templates 
  for select using (company_id in (select company_id from user_profiles where id = auth.uid()));

create policy "Users can insert templates for their company" on public.chat_templates 
  for insert with check (company_id in (select company_id from user_profiles where id = auth.uid()));

create policy "Users can update templates for their company" on public.chat_templates 
  for update using (company_id in (select company_id from user_profiles where id = auth.uid()));

create policy "Users can delete templates for their company" on public.chat_templates 
  for delete using (company_id in (select company_id from user_profiles where id = auth.uid()));
