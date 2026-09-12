-- Somente banco de teste descartável com todas as migrações aplicadas.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/porteiro-decisor.sql
begin;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'lead_contato'
  ) then
    raise exception 'CA-F4-12: tabela lead_contato (Opção B) não deveria existir';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'whatsapp'
  ) then
    raise exception 'CA-F4-03: coluna whatsapp legado ausente';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'responsible_name'
  ) then
    raise exception 'CA-F4-03: coluna responsible_name legado ausente';
  end if;

  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'leads'
      and column_name in (
        'porteiro_nome', 'porteiro_whatsapp', 'decisor_nome', 'decisor_whatsapp',
        'decisor_cargo', 'contato_principal', 'ultimo_combinado_com_porteiro', 'deleted_at'
      )
  ) <> 8 then
    raise exception 'CA-F4-02: colunas F4 ausentes em leads';
  end if;
end $$;

insert into public.leads(company_name, status)
values ('Lead F4 default', 'novo')
returning set_config('test.f4_lead_id', id::text, true);

do $$
declare
  contato text;
  deleted timestamptz;
begin
  select contato_principal, deleted_at
    into contato, deleted
  from public.leads
  where id = current_setting('test.f4_lead_id')::uuid;

  if contato is distinct from 'geral' then
    raise exception 'CA-F4-04: default contato_principal deveria ser geral';
  end if;
  if deleted is not null then
    raise exception 'deleted_at deveria nascer nulo';
  end if;
end $$;

update public.leads
set
  porteiro_nome = 'João',
  porteiro_whatsapp = '81977776666',
  decisor_nome = 'Carla',
  decisor_whatsapp = '81966665555',
  decisor_cargo = 'Sócia',
  contato_principal = 'decisor',
  ultimo_combinado_com_porteiro = 'Passar print amanhã'
where id = current_setting('test.f4_lead_id')::uuid;

do $$
begin
  begin
    update public.leads
    set contato_principal = 'secretaria'
    where id = current_setting('test.f4_lead_id')::uuid;
    raise exception 'contato_principal inválido deveria falhar';
  exception when check_violation then
    null;
  end;

  begin
    update public.leads
    set porteiro_nome = repeat('x', 201)
    where id = current_setting('test.f4_lead_id')::uuid;
    raise exception 'porteiro_nome > 200 deveria falhar';
  exception when check_violation then
    null;
  end;
end $$;

update public.leads
set deleted_at = now()
where id = current_setting('test.f4_lead_id')::uuid;

do $$
begin
  if exists (
    select 1 from public.leads
    where id = current_setting('test.f4_lead_id')::uuid
      and deleted_at is null
  ) then
    raise exception 'linha com deleted_at preenchido deveria sair do filtro IS NULL';
  end if;
  if not exists (
    select 1 from public.leads
    where id = current_setting('test.f4_lead_id')::uuid
      and deleted_at is not null
  ) then
    raise exception 'deleted_at deveria persistir (soft-filter, sem DROP)';
  end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;

do $$
declare visible integer;
begin
  select count(*) into visible
  from public.leads
  where id = current_setting('test.f4_lead_id')::uuid
    and deleted_at is null;
  if visible <> 0 then
    raise exception 'authenticated ainda vê lead com deleted_at quando filtra IS NULL';
  end if;
end $$;

reset role;

rollback;
