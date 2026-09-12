-- Somente banco de teste descartável com todas as migrações aplicadas.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/kit-whatsapp.sql
begin;

do $$
declare
  seed_count integer;
  etapas text[];
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'gatilho'
  ) then
    raise exception 'coluna gatilho ausente';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'prototipo_url'
  ) then
    raise exception 'coluna prototipo_url ausente';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'prototipo_notas'
  ) then
    raise exception 'coluna prototipo_notas ausente';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'wa_ultimo_template_id'
  ) then
    raise exception 'coluna wa_ultimo_template_id ausente';
  end if;

  select count(*), array_agg(etapa order by etapa)
    into seed_count, etapas
  from public.wa_templates
  where ativo
    and etapa in ('abertura', 'follow_up', 'case_nicho', 'break_up', 'prototipo');

  if seed_count < 5 then
    raise exception 'deveria haver 5 seeds ativos, encontrados %', seed_count;
  end if;
  if etapas is distinct from array['abertura', 'break_up', 'case_nicho', 'follow_up', 'prototipo']::text[] then
    raise exception 'etapas seed inesperadas: %', etapas;
  end if;
end $$;

insert into public.leads(company_name, status, whatsapp, gatilho)
values ('Lead kit WA', 'novo', '81988887777', 'vi o Instagram')
returning set_config('test.wa_lead_id', id::text, true);

do $$
begin
  begin
    update public.leads
    set gatilho = repeat('x', 281)
    where id = current_setting('test.wa_lead_id')::uuid;
    raise exception 'gatilho > 280 deveria falhar';
  exception when check_violation then
    null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;

do $$
declare
  created public.wa_templates;
  updated public.wa_templates;
  visible integer;
begin
  if not exists (select 1 from public.wa_templates where ativo) then
    raise exception 'authenticated não lê wa_templates';
  end if;

  insert into public.wa_templates (nome, etapa, corpo, ativo)
  values ('Extra abertura', 'abertura', 'Oi {{empresa}}', true)
  returning * into created;

  update public.wa_templates
  set ativo = false, corpo = 'texto editado {{empresa}}'
  where id = created.id
  returning * into updated;
  if updated.ativo then raise exception 'desativar template falhou'; end if;

  select count(*) into visible from public.wa_templates where id = created.id and not ativo;
  if visible <> 1 then raise exception 'inativo deveria continuar visível na config'; end if;

  begin
    insert into public.wa_templates (nome, etapa, corpo)
    values ('Ruim', 'etapa_invalida', 'oi');
    raise exception 'etapa inválida deveria falhar';
  exception when check_violation then
    null;
  end;

  begin
    delete from public.wa_templates where id = created.id;
    if found then raise exception 'DELETE autenticado em wa_templates deveria ser bloqueado'; end if;
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

update public.leads
set wa_ultimo_template_id = 'a1111111-1111-4111-8111-111111111111'
where id = current_setting('test.wa_lead_id')::uuid;

delete from public.wa_templates where id = 'a1111111-1111-4111-8111-111111111111';

do $$
begin
  if (select wa_ultimo_template_id from public.leads where id = current_setting('test.wa_lead_id')::uuid) is not null then
    raise exception 'ON DELETE SET NULL de wa_ultimo_template_id falhou';
  end if;
end $$;

-- Recoloca o seed apagado no teste para não vazar estado se o arquivo for reexecutado no mesmo banco.
insert into public.wa_templates (id, nome, etapa, corpo, ativo) values
  (
    'a1111111-1111-4111-8111-111111111111',
    'Abertura',
    'abertura',
    'Oi {{responsavel}}! Aqui é {{seu_nome}}. Vi a {{empresa}} ({{segmento}} em {{bairro_ou_cidade}}) e {{gatilho}}. Posso te mandar um print rápido de como ficaria uma landing page pra vocês?',
    true
  )
on conflict (id) do nothing;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin
    if exists(select 1 from public.wa_templates) then
      raise exception 'Visitante lê wa_templates';
    end if;
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

do $$
declare p text;
begin
  if not has_table_privilege('authenticated', 'public.wa_templates', 'SELECT') then
    raise exception 'authenticated sem SELECT em wa_templates';
  end if;
  if not has_table_privilege('authenticated', 'public.wa_templates', 'INSERT') then
    raise exception 'authenticated sem INSERT em wa_templates';
  end if;
  if not has_table_privilege('authenticated', 'public.wa_templates', 'UPDATE') then
    raise exception 'authenticated sem UPDATE em wa_templates';
  end if;
  if has_table_privilege('authenticated', 'public.wa_templates', 'DELETE') then
    raise exception 'authenticated tem DELETE em wa_templates';
  end if;
  if has_table_privilege('authenticated', 'public.wa_templates', 'TRUNCATE') then
    raise exception 'authenticated tem TRUNCATE em wa_templates';
  end if;
  if has_table_privilege('anon', 'public.wa_templates', 'SELECT') then
    raise exception 'Visitante tem SELECT em wa_templates';
  end if;
  foreach p in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
    if has_table_privilege('anon', 'public.wa_templates', p) then
      raise exception 'Visitante tem % em wa_templates', p;
    end if;
  end loop;
end $$;

rollback;
