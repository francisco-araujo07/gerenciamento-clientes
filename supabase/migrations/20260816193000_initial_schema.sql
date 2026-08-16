-- Estrutura inicial do MVP: leads, clientes e projetos.

create type public.lead_status as enum ('novo', 'negociacao', 'convertido', 'perdido');
create type public.project_status as enum (
  'aguardando_inicio',
  'em_desenvolvimento',
  'pausado',
  'concluido',
  'abandonado'
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(trim(company_name)) > 0),
  responsible_name text,
  whatsapp text,
  email text,
  instagram text,
  address text,
  google_maps_url text,
  segment text,
  source text,
  status public.lead_status not null default 'novo',
  notes text,
  next_action text,
  next_action_due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid unique references public.leads(id) on delete set null,
  company_name text not null check (char_length(trim(company_name)) > 0),
  responsible_name text,
  whatsapp text,
  email text,
  instagram text,
  address text,
  google_maps_url text,
  segment text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  price numeric(12, 2) not null check (price >= 0),
  deadline date,
  status public.project_status not null default 'aguardando_inicio',
  completed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_completion_date_matches_status check (
    (status = 'concluido' and completed_at is not null)
    or (status <> 'concluido' and completed_at is null)
  )
);

create index leads_status_next_action_due_date_idx
  on public.leads (status, next_action_due_date);
create index leads_company_name_idx on public.leads (company_name);
create index leads_responsible_name_idx on public.leads (responsible_name);
create index clients_company_name_idx on public.clients (company_name);
create index clients_responsible_name_idx on public.clients (responsible_name);
create index projects_client_id_idx on public.projects (client_id);
create index projects_status_completed_at_idx on public.projects (status, completed_at);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

alter table public.leads enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;

-- No MVP, qualquer pessoa autenticada da equipe pode consultar e editar todos os dados.
create policy "Usuários autenticados podem consultar leads"
on public.leads for select to authenticated using (true);
create policy "Usuários autenticados podem criar leads"
on public.leads for insert to authenticated with check (true);
create policy "Usuários autenticados podem editar leads"
on public.leads for update to authenticated using (true) with check (true);
create policy "Usuários autenticados podem excluir leads"
on public.leads for delete to authenticated using (true);

create policy "Usuários autenticados podem consultar clientes"
on public.clients for select to authenticated using (true);
create policy "Usuários autenticados podem criar clientes"
on public.clients for insert to authenticated with check (true);
create policy "Usuários autenticados podem editar clientes"
on public.clients for update to authenticated using (true) with check (true);
create policy "Usuários autenticados podem excluir clientes"
on public.clients for delete to authenticated using (true);

create policy "Usuários autenticados podem consultar projetos"
on public.projects for select to authenticated using (true);
create policy "Usuários autenticados podem criar projetos"
on public.projects for insert to authenticated with check (true);
create policy "Usuários autenticados podem editar projetos"
on public.projects for update to authenticated using (true) with check (true);
create policy "Usuários autenticados podem excluir projetos"
on public.projects for delete to authenticated using (true);
