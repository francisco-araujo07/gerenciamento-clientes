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

  -- compareceu.
  select * into updated from public.registrar_resultado_reuniao(
    updated.id, updated.updated_at, 'compareceu', 'Reunião ok', null, null, null, null, null
  );
  if updated.reuniao_resultado <> 'compareceu' then raise exception 'compareceu não gravado'; end if;
  if updated.status <> 'reuniao_marcada' then raise exception 'compareceu não deveria mudar o status'; end if;
  if updated.next_action is distinct from 'Definir próximo passo após reunião' then
    raise exception 'next_action de compareceu incorreto';
  end if;
  if updated.next_action_due_date is distinct from today then
    raise exception 'due date de compareceu deveria ser hoje Recife';
  end if;

  -- Reabre pendente via reagendou para testar os outros fluxos em leads dedicados.
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

  -- pediu_proposta a partir do lead já marcado (r5_res).
  select * into updated from public.registrar_resultado_reuniao(
    updated.id, updated.updated_at, 'pediu_proposta', 'Quer proposta', null, null, null, null, null
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

  -- no_show + reagendou no lead original da marcação F1.
  select * into updated from public.registrar_resultado_reuniao(
    current_setting('test.r5_lead_id')::uuid,
    (select updated_at from public.leads where id = current_setting('test.r5_lead_id')::uuid),
    'no_show', null, null, null, null, null, null
  );
  if updated.reuniao_resultado <> 'no_show' then raise exception 'no_show não gravado'; end if;
  if updated.next_action is distinct from 'Reagendar reunião (no-show)' then
    raise exception 'next_action de no_show incorreto';
  end if;

  select * into updated from public.registrar_resultado_reuniao(
    updated.id, updated.updated_at, 'reagendou', 'Novo horário',
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
  if has_function_privilege('anon', 'public.registrar_resultado_reuniao(uuid, timestamptz, reuniao_resultado, text, timestamptz, text, text, text, text)', 'EXECUTE') then
    raise exception 'registrar_resultado_reuniao exposto a visitante';
  end if;
  if not has_function_privilege('authenticated', 'public.marcar_reuniao(uuid, timestamptz, timestamptz, text, text, text, boolean, text)', 'EXECUTE') then
    raise exception 'authenticated sem EXECUTE em marcar_reuniao';
  end if;
end $$;

rollback;
