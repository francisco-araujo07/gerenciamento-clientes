-- Somente banco de teste descartável com todas as migrações aplicadas.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/kit-whatsapp.sql
begin;

do $$
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

  if (
    select count(*) from public.wa_templates
    where ativo and nome in (
      'Primeira abordagem (porteiro)',
      'Follow-up D+3',
      'Break-up',
      'Decisor respondeu — pedir 2 horários',
      'Confirmar reunião D-1'
    )
  ) <> 5 then
    raise exception 'CA-F3-02: os 5 seeds da SPEC deveriam estar ativos';
  end if;

  if (
    select etapa from public.wa_templates
    where nome = 'Primeira abordagem (porteiro)'
  ) is distinct from 'contato_porteiro' then
    raise exception 'Primeira abordagem deveria ser etapa contato_porteiro';
  end if;
  if (
    select etapa from public.wa_templates
    where nome = 'Follow-up D+3'
  ) is distinct from 'qualquer' then
    raise exception 'Follow-up D+3 deveria ser etapa qualquer';
  end if;
  if (
    select etapa from public.wa_templates
    where nome = 'Break-up'
  ) is distinct from 'qualquer' then
    raise exception 'Break-up deveria ser etapa qualquer';
  end if;
  if (
    select etapa from public.wa_templates
    where nome = 'Decisor respondeu — pedir 2 horários'
  ) is distinct from 'falando_decisor' then
    raise exception 'Decisor 2 horários deveria ser etapa falando_decisor';
  end if;
  if (
    select etapa from public.wa_templates
    where nome = 'Confirmar reunião D-1'
  ) is distinct from 'reuniao_marcada' then
    raise exception 'Confirmar D-1 deveria ser etapa reuniao_marcada';
  end if;
  if exists (
    select 1 from public.wa_templates
    where nome in ('Case / nicho', 'Protótipo', 'Abertura')
  ) then
    raise exception 'seeds legados Case/nicho/Protótipo/Abertura não deveriam permanecer';
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
  values ('Extra abordagem', 'contato_porteiro', 'Oi {{empresa}}', true)
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
    'Primeira abordagem (porteiro)',
    'contato_porteiro',
    'Oi! Aqui é {{seu_nome}}. Vi a {{empresa}} ({{segmento}} em {{bairro_ou_cidade}}) e {{gatilho}}. Você poderia me encaminhar para quem decide a parte de marketing/site?',
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
