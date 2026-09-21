-- Somente banco de teste descartável com todas as migrações aplicadas.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/reuniao-1-clique.sql
begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'reuniao_resultado') then
    raise exception 'Tipo reuniao_resultado ausente';
  end if;
  if not (
    'pendente' = any (enum_range(null::public.reuniao_resultado)::text[])
    and 'compareceu' = any (enum_range(null::public.reuniao_resultado)::text[])
    and 'no_show' = any (enum_range(null::public.reuniao_resultado)::text[])
    and 'pediu_proposta' = any (enum_range(null::public.reuniao_resultado)::text[])
    and 'fechou' = any (enum_range(null::public.reuniao_resultado)::text[])
    and 'recusou' = any (enum_range(null::public.reuniao_resultado)::text[])
    and 'reagendou' = any (enum_range(null::public.reuniao_resultado)::text[])
  ) then
    raise exception 'Enum reuniao_resultado incompleto';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'reuniao_local'
  ) then
    raise exception 'Coluna reuniao_local ausente';
  end if;
end $$;

-- D-1 civil Recife: 01:00 UTC do dia 22 = 22:00 Recife do dia 21 → D-1 = 20.
do $$
begin
  if public.reuniao_confirm_due_date('2026-09-22 01:00:00+00') is distinct from date '2026-09-20' then
    raise exception 'D-1 Recife para 2026-09-22 01:00 UTC deveria ser 2026-09-20';
  end if;
  if public.reuniao_confirm_due_date('2026-09-22 14:00:00-03') is distinct from date '2026-09-21' then
    raise exception 'D-1 Recife para 14:00 Recife do dia 22 deveria ser 2026-09-21';
  end if;
  if public.assert_reuniao_https_link('https://meet.example.com/a') is distinct from 'https://meet.example.com/a' then
    raise exception 'HTTPS válido deveria passar';
  end if;
  begin
    perform public.assert_reuniao_https_link('http://meet.example.com/a');
    raise exception 'HTTP deveria falhar';
  exception when raise_exception then
    if sqlerrm = 'HTTP deveria falhar' then raise; end if;
  end;
  begin
    perform public.assert_reuniao_https_link('https://user:pass@meet.example.com/a');
    raise exception 'credencial no link deveria falhar';
  exception when raise_exception then
    if sqlerrm = 'credencial no link deveria falhar' then raise; end if;
  end;
end $$;

insert into public.leads(company_name, status)
values ('Lead reunião F5', 'falando_decisor')
returning set_config('test.r5_lead_id', id::text, true),
          set_config('test.r5_updated_at', updated_at::text, true);

insert into public.leads(company_name, status)
values ('Lead reunião resultado', 'falando_decisor')
returning set_config('test.r5_res_id', id::text, true);

insert into public.leads(company_name, status)
values ('Lead reunião fechou', 'falando_decisor')
returning set_config('test.r5_close_id', id::text, true);

insert into public.leads(company_name, status)
values ('Lead reunião recusou', 'falando_decisor')
returning set_config('test.r5_lost_id', id::text, true);

insert into public.leads(company_name, status)
values ('Lead reunião bypass', 'falando_decisor')
returning set_config('test.r5_bypass_id', id::text, true);

insert into public.leads(company_name, status)
values ('Lead compareceu manter', 'falando_decisor')
returning set_config('test.r5_cmp_id', id::text, true);

insert into public.leads(company_name, status)
values ('Lead no-show pause', 'falando_decisor')
returning set_config('test.r5_pause_id', id::text, true);

insert into public.leads(company_name, status)
values ('Lead no-show legado', 'falando_decisor')
returning set_config('test.r5_stuck_id', id::text, true);

insert into public.leads(company_name, status)
values ('Lead https inválido', 'falando_decisor')
returning set_config('test.r5_https_id', id::text, true);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;

do $$
declare
  updated public.leads;
  atividade_count integer;
  today date := (timezone('America/Recife', now()))::date;
begin
  -- Stub F1: update_lead_status em reuniao_marcada grava D-1 + next_action + atividade tipo=reuniao.
  select * into updated from public.update_lead_status(
    current_setting('test.r5_lead_id')::uuid,
    'reuniao_marcada',
    current_setting('test.r5_updated_at')::timestamptz,
    false, null, null, null,
    '2026-09-22 01:00:00+00',
    'https://meet.example.com/f5',
    null, null
  );
  if updated.status <> 'reuniao_marcada' then raise exception 'Status reuniao_marcada não gravado'; end if;
  if updated.reuniao_resultado <> 'pendente' then raise exception 'Resultado default deveria ser pendente'; end if;
  if updated.next_action is distinct from 'Confirmar reunião no WhatsApp' then
    raise exception 'next_action de confirmação D-1 ausente';
  end if;
  if updated.next_action_due_date is distinct from date '2026-09-20' then
    raise exception 'D-1 civil Recife não gravado (esperado 2026-09-20)';
  end if;
  select count(*) into atividade_count
  from public.lead_atividade
  where lead_id = updated.id and tipo = 'reuniao' and resultado = 'marcada';
  if atividade_count <> 1 then raise exception 'Atividade tipo=reuniao na marcação ausente'; end if;

  -- marcar_reuniao completa local/notas.
  select * into updated from public.marcar_reuniao(
    current_setting('test.r5_res_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.r5_res_id')::uuid),
    '2026-09-22 14:00:00-03',
    'https://meet.example.com/kit',
    'Sala da diretoria',
    'Levar print',
    false,
    null
  );
  if updated.reuniao_local is distinct from 'Sala da diretoria' then raise exception 'reuniao_local não gravado'; end if;
  if updated.reuniao_notas is distinct from 'Levar print' then raise exception 'reuniao_notas não gravado'; end if;
  if updated.next_action_due_date is distinct from date '2026-09-21' then
    raise exception 'D-1 da marcar_reuniao incorreto';
  end if;

  -- P1-001 compareceu → proposta_enviada (lead dedicado; não encadear outro resultado).
  perform public.marcar_reuniao(
    current_setting('test.r5_cmp_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.r5_cmp_id')::uuid),
    now() + interval '2 days',
    null, null, null, false, null
  );
  select * into updated from public.registrar_resultado_reuniao(
    current_setting('test.r5_cmp_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.r5_cmp_id')::uuid),
    'compareceu', 'Reunião ok', null, null, null, null, null,
    'proposta_enviada', null, null, null
  );
  if updated.reuniao_resultado <> 'compareceu' then raise exception 'compareceu não gravado'; end if;
  if updated.status <> 'proposta_enviada' then raise exception 'compareceu+proposta deveria ir para proposta_enviada'; end if;
  if updated.next_action is distinct from 'Enviar proposta' then
    raise exception 'next_action de compareceu+proposta incorreto';
  end if;

  -- P1-001 compareceu → manter + next_action (lead F1 original).
  select * into updated from public.registrar_resultado_reuniao(
    current_setting('test.r5_lead_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.r5_lead_id')::uuid),
    'compareceu', 'Seguir alinhamento', null, null, null, null, null,
    'manter', null, 'Alinhar proposta com o sócio', today
  );
  if updated.reuniao_resultado <> 'compareceu' then raise exception 'compareceu manter não gravado'; end if;
  if updated.status <> 'reuniao_marcada' then raise exception 'compareceu+manter não deveria mudar o status'; end if;
  if updated.next_action is distinct from 'Alinhar proposta com o sócio' then
    raise exception 'next_action de compareceu+manter incorreto';
  end if;
  if updated.next_action_due_date is distinct from today then
    raise exception 'due date de compareceu+manter deveria ser hoje Recife';
  end if;

  -- P1-002: regravar pediu_proposta sem reset deve falhar.
  begin
    perform public.registrar_resultado_reuniao(
      updated.id, updated.updated_at, 'pediu_proposta', 'bypass', null, null, null, null, null
    );
    raise exception 'P1-002 deveria recusar regravação após compareceu';
  exception when raise_exception then
    if sqlerrm = 'P1-002 deveria recusar regravação após compareceu' then raise; end if;
    if sqlerrm is distinct from 'Resultado da reunião já registrado.' then
      raise exception 'Mensagem P1-002 inesperada: %', sqlerrm;
    end if;
  end;

  -- P1-002: reagendou continua permitido.
  select * into updated from public.registrar_resultado_reuniao(
    updated.id, updated.updated_at, 'reagendou', 'Novo horário após compareceu',
    '2026-09-25 10:00:00-03', 'https://meet.example.com/novo', 'Meet', null, null
  );
  if updated.reuniao_resultado <> 'pendente' then raise exception 'reagendou deveria voltar a pendente'; end if;
  if updated.next_action is distinct from 'Confirmar reunião no WhatsApp' then
    raise exception 'reagendou deveria repor a confirmação D-1';
  end if;
  if updated.next_action_due_date is distinct from date '2026-09-24' then
    raise exception 'D-1 do reagendamento incorreto';
  end if;
  if updated.reuniao_local is distinct from 'Meet' then raise exception 'local do reagendamento não gravado'; end if;

  perform public.marcar_reuniao(
    current_setting('test.r5_close_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.r5_close_id')::uuid),
    now() + interval '2 days',
    null, null, null, false, null
  );
  perform public.marcar_reuniao(
    current_setting('test.r5_lost_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.r5_lost_id')::uuid),
    now() + interval '2 days',
    null, null, null, false, null
  );
  perform public.marcar_reuniao(
    current_setting('test.r5_pause_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.r5_pause_id')::uuid),
    now() + interval '2 days',
    null, null, null, false, null
  );
  perform public.marcar_reuniao(
    current_setting('test.r5_stuck_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.r5_stuck_id')::uuid),
    now() + interval '2 days',
    null, null, null, false, null
  );

  -- pediu_proposta a partir de pendente (lead r5_res, sem compareceu prévio).
  select * into updated from public.registrar_resultado_reuniao(
    current_setting('test.r5_res_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.r5_res_id')::uuid),
    'pediu_proposta', 'Quer proposta', null, null, null, null, null
  );
  if updated.status <> 'proposta_enviada' then raise exception 'pediu_proposta deveria ir para proposta_enviada'; end if;
  if updated.next_action is distinct from 'Enviar proposta' then raise exception 'next_action de proposta incorreto'; end if;

  -- fechou converte.
  select * into updated from public.registrar_resultado_reuniao(
    current_setting('test.r5_close_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.r5_close_id')::uuid),
    'fechou', null, null, null, null, null, null
  );
  if updated.status <> 'convertido' then raise exception 'fechou deveria converter o lead'; end if;
  if not exists (select 1 from public.clients where lead_id = current_setting('test.r5_close_id')::uuid) then
    raise exception 'fechou não criou cliente';
  end if;

  -- recusou → perdido.
  select * into updated from public.registrar_resultado_reuniao(
    current_setting('test.r5_lost_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.r5_lost_id')::uuid),
    'recusou', 'Não vai seguir', null, null, null, 'preco', null
  );
  if updated.status <> 'perdido' then raise exception 'recusou deveria marcar perdido'; end if;
  if updated.motivo_perda is distinct from 'preco' then raise exception 'motivo da recusa não gravado'; end if;

  -- P1-001 no_show → pausado_60d.
  select * into updated from public.registrar_resultado_reuniao(
    current_setting('test.r5_pause_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.r5_pause_id')::uuid),
    'no_show', null, null, null, null, null, null,
    null, 'pausado_60d', null, null
  );
  if updated.reuniao_resultado <> 'no_show' then raise exception 'no_show não gravado'; end if;
  if updated.status <> 'pausado_60d' then raise exception 'no_show+pausa deveria ir para pausado_60d'; end if;
  if updated.next_action is distinct from 'Retomar cadência' then
    raise exception 'next_action de pausa no-show incorreto';
  end if;
  if updated.next_action_due_date is distinct from today + 60 then
    raise exception 'due +60d da pausa no-show incorreto';
  end if;

  -- P1-001 no_show legado preso: reabrir com reagendar.
  perform set_config('app.via_reuniao_write', 'on', true);
  perform set_config('app.via_lead_status_write', 'on', true);
  update public.leads
  set reuniao_resultado = 'no_show',
      next_action = 'Reagendar reunião (no-show)',
      next_action_due_date = today
  where id = current_setting('test.r5_stuck_id')::uuid;
  perform set_config('app.via_reuniao_write', '', true);
  perform set_config('app.via_lead_status_write', '', true);

  select * into updated from public.registrar_resultado_reuniao(
    current_setting('test.r5_stuck_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.r5_stuck_id')::uuid),
    'no_show', 'Reabriu após no-show',
    '2026-09-28 11:00:00-03', 'https://meet.example.com/stuck', null, null, null,
    null, 'reagendar', null, null
  );
  if updated.reuniao_resultado <> 'pendente' then raise exception 'no_show+reagendar deveria voltar a pendente'; end if;
  if updated.status <> 'reuniao_marcada' then raise exception 'no_show+reagendar deveria manter reuniao_marcada'; end if;
  if updated.next_action_due_date is distinct from date '2026-09-27' then
    raise exception 'D-1 do no_show+reagendar incorreto';
  end if;
  select count(*) into atividade_count
  from public.lead_atividade
  where lead_id = updated.id and tipo = 'reuniao' and resultado = 'no_show';
  if atividade_count < 1 then raise exception 'Atividade no_show no reagendamento ausente'; end if;

  -- P2-003: link HTTP rejeitado na RPC.
  begin
    perform public.marcar_reuniao(
      current_setting('test.r5_https_id')::uuid,
      (select updated_at from public.leads where id = current_setting('test.r5_https_id')::uuid),
      now() + interval '2 days',
      'http://meet.example.com/inseguro',
      null, null, false, null
    );
    raise exception 'marcar_reuniao deveria recusar HTTP';
  exception when raise_exception then
    if sqlerrm = 'marcar_reuniao deveria recusar HTTP' then raise; end if;
  end;

  begin
    update public.leads
    set reuniao_resultado = 'compareceu'
    where id = current_setting('test.r5_bypass_id')::uuid;
    raise exception 'UPDATE direto de reuniao_resultado sem GUC deveria falhar';
  exception when raise_exception then
    if sqlerrm = 'UPDATE direto de reuniao_resultado sem GUC deveria falhar' then raise; end if;
  end;

  begin
    update public.leads
    set reuniao_local = 'hack'
    where id = current_setting('test.r5_bypass_id')::uuid;
    raise exception 'UPDATE direto de reuniao_local sem GUC deveria falhar';
  exception when raise_exception then
    if sqlerrm = 'UPDATE direto de reuniao_local sem GUC deveria falhar' then raise; end if;
  end;

  begin
    insert into public.lead_atividade (lead_id, tipo, resultado)
    values (current_setting('test.r5_bypass_id')::uuid, 'reuniao', 'marcada');
    raise exception 'INSERT direto em lead_atividade deveria falhar';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin
    perform public.marcar_reuniao(
      current_setting('test.r5_bypass_id')::uuid,
      now(), now(), null, null, null, false, null
    );
    raise exception 'Visitante executou marcar_reuniao';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
begin
  if has_function_privilege('anon', 'public.marcar_reuniao(uuid, timestamptz, timestamptz, text, text, text, boolean, text)', 'EXECUTE') then
    raise exception 'marcar_reuniao exposto a visitante';
  end if;
  if has_function_privilege(
    'anon',
    'public.registrar_resultado_reuniao(uuid, timestamptz, reuniao_resultado, text, timestamptz, text, text, text, text, text, text, text, date)',
    'EXECUTE'
  ) then
    raise exception 'registrar_resultado_reuniao exposto a visitante';
  end if;
  if not has_function_privilege('authenticated', 'public.marcar_reuniao(uuid, timestamptz, timestamptz, text, text, text, boolean, text)', 'EXECUTE') then
    raise exception 'authenticated sem EXECUTE em marcar_reuniao';
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'registrar_resultado_reuniao'
      and pg_get_function_identity_arguments(p.oid)
        = 'uuid, timestamp with time zone, reuniao_resultado, text, timestamp with time zone, text, text, text, text'
  ) then
    raise exception 'assinatura antiga de registrar_resultado_reuniao ainda existe';
  end if;
end $$;

rollback;
