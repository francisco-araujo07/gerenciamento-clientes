-- Recomendações de dados do relatório de 10/09/2026.
-- Aplicar primeiro em banco descartável e revisar constraints NOT VALID antes de VALIDATE.
-- Rollback manual: remover triggers, função, tabela/policies, índices e constraints desta
-- migração em ordem inversa. Não remover pg_trgm se já era usado por outro objeto.
begin;

-- Checks de formato que também devem valer para escritas fora da aplicação.
alter table public.leads add constraint leads_email_format check (
  email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
) not valid;
alter table public.clients add constraint clients_email_format check (
  email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
) not valid;

-- Índices para ordenação, relatórios por origem e leads ativos atrasados.
create index leads_created_at_idx on public.leads (created_at desc);
create index leads_source_idx on public.leads (source);
create index leads_overdue_idx on public.leads (next_action_due_date)
  where status in ('novo', 'negociacao') and next_action_due_date is not null;

-- Busca textual com ILIKE '%termo%' usada pelas consultas paginadas do serviço.
create extension if not exists pg_trgm;
create index leads_company_name_trgm_idx
  on public.leads using gin (company_name gin_trgm_ops);
create index leads_responsible_name_trgm_idx
  on public.leads using gin (responsible_name gin_trgm_ops);
create index clients_company_name_trgm_idx
  on public.clients using gin (company_name gin_trgm_ops);
create index clients_responsible_name_trgm_idx
  on public.clients using gin (responsible_name gin_trgm_ops);

-- Trilha de alterações das três entidades do MVP.
create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null check (table_name in ('leads', 'clients', 'projects')),
  row_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);
create index audit_log_row_idx
  on public.audit_log (table_name, row_id, changed_at desc);
create index audit_log_changed_at_idx
  on public.audit_log (changed_at desc);

alter table public.audit_log enable row level security;
revoke all on table public.audit_log from public, anon, authenticated;
grant select on table public.audit_log to authenticated;
create policy "Membros identificados consultam auditoria"
on public.audit_log
for select to authenticated
using (
  (select auth.uid()) is not null
  and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false)
);

create function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (
    table_name, row_id, operation, changed_by, old_data, new_data
  )
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    auth.uid(),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;
revoke all on function public.write_audit_log() from public, anon, authenticated;

create trigger leads_write_audit_log
after insert or update or delete on public.leads
for each row execute function public.write_audit_log();
create trigger clients_write_audit_log
after insert or update or delete on public.clients
for each row execute function public.write_audit_log();
create trigger projects_write_audit_log
after insert or update or delete on public.projects
for each row execute function public.write_audit_log();

commit;
