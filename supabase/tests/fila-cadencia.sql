-- Somente banco de teste descartável com todas as migrações aplicadas.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/fila-cadencia.sql
begin;

do $$
declare
  cfg public.cadencia_config;
begin
  select * into cfg from public.cadencia_config where id = 'global';
  if cfg.max_touches_sem_resposta <> 4 then
    raise exception 'max_touches_sem_resposta default deveria ser 4';
  end if;
  if cfg.offset_dias_apos_toque <> array[3, 4, 6] then
    raise exception 'offset_dias_apos_toque default deveria ser [3,4,6]';
  end if;
  if cfg.offset_pausado_dias <> 60 then
    raise exception 'offset_pausado_dias default deveria ser 60';
  end if;
  if public.cadencia_follow_up_text(1) is null
     or public.cadencia_follow_up_text(2) is null
     or public.cadencia_follow_up_text(3) is null then
    raise exception 'Textos de follow-up ausentes';
  end if;
end $$;

insert into public.leads(company_name, status, next_action, next_action_due_date)
values ('Lead cadência novo', 'novo', 'Primeiro toque', (timezone('America/Recife', now()))::date)
returning set_config('test.cad_lead_id', id::text, true),
          set_config('test.cad_updated_at', updated_at::text, true);

insert into public.leads(company_name, status, next_action, next_action_due_date)
values ('Lead cadência negociacao', 'negociacao', 'Retomar legado', (timezone('America/Recife', now()))::date)
returning set_config('test.cad_neg_id', id::text, true);

insert into public.leads(company_name, status, motivo_perda)
values ('Lead cadência perdido', 'perdido', 'preco')
returning set_config('test.cad_lost_id', id::text, true);

insert into public.leads(company_name, status)
values ('Lead cadência bypass', 'novo')
returning set_config('test.cad_bypass_id', id::text, true);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;

do $$
declare
  updated public.leads;
  today date := (timezone('America/Recife', now()))::date;
  atividade_count integer;
begin
  if (select touches_sem_resposta from public.leads where id = current_setting('test.cad_lead_id')::uuid) <> 0 then
    raise exception 'touches_sem_resposta default deveria ser 0';
  end if;

  select * into updated from public.registrar_cadencia(
    current_setting('test.cad_lead_id')::uuid,
    current_setting('test.cad_updated_at')::timestamptz,
    'toquei', null, null, null, 'whatsapp'
  );
  if updated.touches_sem_resposta <> 1 then raise exception '1º toque não incrementou'; end if;
  if updated.next_action_due_date <> today + 3 then raise exception '1º toque deveria somar +3d'; end if;
  if updated.next_action is distinct from public.cadencia_follow_up_text(1) then
    raise exception '1º toque sem texto de follow-up';
  end if;

  select * into updated from public.registrar_cadencia(
    updated.id, updated.updated_at, 'sem_resposta', null, null, null, 'whatsapp'
  );
  if updated.touches_sem_resposta <> 2 then raise exception '2º toque não incrementou'; end if;
  if updated.next_action_due_date <> today + 4 then raise exception '2º toque deveria somar +4d'; end if;
  if updated.next_action is distinct from public.cadencia_follow_up_text(2) then
    raise exception '2º toque sem texto de case/nicho';
  end if;

  select * into updated from public.registrar_cadencia(
    updated.id, updated.updated_at, 'toquei', null, null, null, 'whatsapp'
  );
  if updated.touches_sem_resposta <> 3 then raise exception '3º toque não incrementou'; end if;
  if updated.next_action_due_date <> today + 6 then raise exception '3º toque deveria somar +6d'; end if;
  if updated.next_action is distinct from public.cadencia_follow_up_text(3) then
    raise exception '3º toque sem texto de break-up';
  end if;

  begin
    perform public.registrar_cadencia(
      updated.id, updated.updated_at, 'toquei', null, null, null, 'whatsapp'
    );
    raise exception '4º toque deveria falhar com TOUCH_LIMIT';
  exception when sqlstate 'PT409' then
    if sqlerrm is distinct from 'TOUCH_LIMIT' then
      raise exception '4º toque deveria usar mensagem TOUCH_LIMIT';
    end if;
  end;

  if (select touches_sem_resposta from public.leads where id = updated.id) <> 3 then
    raise exception '4º toque não pode avançar silenciosamente';
  end if;

  select count(*) into atividade_count
  from public.lead_atividade
  where lead_id = updated.id;
  if atividade_count <> 3 then
    raise exception 'Atividades do motor não gravadas (esperado 3, veio %)', atividade_count;
  end if;

  select * into updated from public.registrar_cadencia(
    updated.id, (select updated_at from public.leads where id = updated.id),
    'respondeu', 'Falou com o sócio', null, null, 'ligacao'
  );
  if updated.touches_sem_resposta <> 0 then raise exception 'Respondeu deveria zerar toques'; end if;

  select * into updated from public.registrar_cadencia(
    updated.id, updated.updated_at, 'reagendar', null, 'Retomar segunda', today + 2, 'whatsapp'
  );
  if updated.next_action_due_date <> today + 2 then raise exception 'Reagendar não atualizou a data'; end if;
  if updated.touches_sem_resposta <> 0 then raise exception 'Reagendar não pode incrementar toques'; end if;

  select * into updated from public.registrar_cadencia(
    current_setting('test.cad_neg_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.cad_neg_id')::uuid),
    'toquei', null, null, null, 'whatsapp'
  );
  if updated.touches_sem_resposta <> 1 then
    raise exception 'Lead em negociacao deveria entrar na cadência';
  end if;

  begin
    perform public.registrar_cadencia(
      current_setting('test.cad_lost_id')::uuid,
      (select updated_at from public.leads where id = current_setting('test.cad_lost_id')::uuid),
      'toquei', null, null, null, 'whatsapp'
    );
    raise exception 'Lead perdido não deveria aceitar cadência';
  exception when raise_exception then
    if sqlerrm = 'Lead perdido não deveria aceitar cadência' then raise; end if;
  end;

  begin
    update public.leads
    set touches_sem_resposta = 9
    where id = current_setting('test.cad_bypass_id')::uuid;
    raise exception 'UPDATE direto de touches_sem_resposta deveria falhar';
  exception when raise_exception then
    if sqlerrm = 'UPDATE direto de touches_sem_resposta deveria falhar' then raise; end if;
  end;

  begin
    insert into public.lead_atividade (lead_id, tipo, resultado)
    values (current_setting('test.cad_bypass_id')::uuid, 'toque', 'toquei');
    raise exception 'INSERT direto em lead_atividade deveria falhar';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.lead_atividade set nota = 'hack' where lead_id = current_setting('test.cad_lead_id')::uuid;
    if found then raise exception 'UPDATE público em lead_atividade deveria ser bloqueado'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.lead_atividade where lead_id = current_setting('test.cad_lead_id')::uuid;
    if found then raise exception 'DELETE público em lead_atividade deveria ser bloqueado'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    update public.cadencia_config set max_touches_sem_resposta = 99 where id = 'global';
    if found then raise exception 'UPDATE público em cadencia_config deveria ser bloqueado'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin
    if exists(select 1 from public.lead_atividade) then
      raise exception 'Visitante lê lead_atividade';
    end if;
  exception when insufficient_privilege then null;
  end;
  begin
    if exists(select 1 from public.cadencia_config) then
      raise exception 'Visitante lê cadencia_config';
    end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
declare p text;
begin
  foreach p in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
    if has_table_privilege('authenticated', 'public.lead_atividade', p) then
      raise exception 'authenticated tem % em lead_atividade', p;
    end if;
    if has_table_privilege('authenticated', 'public.cadencia_config', p) then
      raise exception 'authenticated tem % em cadencia_config', p;
    end if;
  end loop;
  if not has_table_privilege('authenticated', 'public.lead_atividade', 'SELECT') then
    raise exception 'authenticated sem SELECT em lead_atividade';
  end if;
  if not has_table_privilege('authenticated', 'public.cadencia_config', 'SELECT') then
    raise exception 'authenticated sem SELECT em cadencia_config';
  end if;
  if has_table_privilege('anon', 'public.lead_atividade', 'SELECT') then
    raise exception 'Visitante tem SELECT em lead_atividade';
  end if;
  if has_table_privilege('anon', 'public.cadencia_config', 'SELECT') then
    raise exception 'Visitante tem SELECT em cadencia_config';
  end if;
  if has_function_privilege('anon', 'public.registrar_cadencia(uuid, timestamptz, text, text, text, date, text)', 'EXECUTE') then
    raise exception 'registrar_cadencia exposto a visitante';
  end if;
end $$;

rollback;
