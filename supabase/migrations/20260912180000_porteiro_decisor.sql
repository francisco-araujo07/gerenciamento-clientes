-- F4 Porteiro vs Decisor — Opção A: campos no lead.
-- Expand-only: sem DROP/RENAME. Sem tabela lead_contato (Opção B).
-- A flag VITE_FF_GLC_PORTEIRO_DECISOR não controla este SQL; ela só gateia a UI.
-- Sem migrate/promote de produção nesta entrega.
-- deleted_at: ADD nullable se ainda não existir; listagens filtram IS NULL.

begin;

alter table public.leads
  add column if not exists porteiro_nome text,
  add column if not exists porteiro_whatsapp text,
  add column if not exists decisor_nome text,
  add column if not exists decisor_whatsapp text,
  add column if not exists decisor_cargo text,
  add column if not exists contato_principal text not null default 'geral',
  add column if not exists ultimo_combinado_com_porteiro text,
  add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_contato_principal_check' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_contato_principal_check
      check (contato_principal in ('porteiro', 'decisor', 'geral'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_porteiro_nome_limit' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_porteiro_nome_limit
      check (char_length(coalesce(porteiro_nome, '')) <= 200);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_porteiro_whatsapp_limit' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_porteiro_whatsapp_limit
      check (char_length(coalesce(porteiro_whatsapp, '')) <= 50);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_decisor_nome_limit' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_decisor_nome_limit
      check (char_length(coalesce(decisor_nome, '')) <= 200);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_decisor_whatsapp_limit' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_decisor_whatsapp_limit
      check (char_length(coalesce(decisor_whatsapp, '')) <= 50);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_decisor_cargo_limit' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_decisor_cargo_limit
      check (char_length(coalesce(decisor_cargo, '')) <= 200);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_ultimo_combinado_com_porteiro_limit' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_ultimo_combinado_com_porteiro_limit
      check (char_length(coalesce(ultimo_combinado_com_porteiro, '')) <= 2000);
  end if;
end $$;

create index if not exists leads_deleted_at_alive_idx
  on public.leads (id)
  where deleted_at is null;

create index if not exists leads_contato_principal_idx
  on public.leads (contato_principal)
  where deleted_at is null;

-- Write-guard: deleted_at não entra no payload cadastral. UPDATE direto do campo
-- continua possível via SQL admin; a UI e o PostgREST do formulário não enviam a coluna.

commit;
