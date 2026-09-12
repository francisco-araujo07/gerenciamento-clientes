-- Somente banco de teste descartável com todas as migrações aplicadas.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/funil-status.sql
begin;

do $$
begin
  if not (
    'contato_porteiro' = any (enum_range(null::public.lead_status)::text[])
    and 'encaminhado' = any (enum_range(null::public.lead_status)::text[])
    and 'falando_decisor' = any (enum_range(null::public.lead_status)::text[])
    and 'reuniao_marcada' = any (enum_range(null::public.lead_status)::text[])
    and 'proposta_enviada' = any (enum_range(null::public.lead_status)::text[])
    and 'pausado_60d' = any (enum_range(null::public.lead_status)::text[])
    and 'negociacao' = any (enum_range(null::public.lead_status)::text[])
  ) then
    raise exception 'Enum lead_status sem os códigos canônicos do funil';
  end if;
end $$;

insert into public.leads(company_name, status)
values ('Lead funil novo', 'novo')
returning set_config('test.funil_lead_id', id::text, true),
          set_config('test.funil_updated_at', updated_at::text, true);

insert into public.leads(company_name, status)
values ('Lead funil negociacao', 'negociacao')
returning set_config('test.funil_neg_id', id::text, true);

insert into public.leads(company_name, status)
values ('Lead funil proposta', 'proposta_enviada')
returning set_config('test.funil_prop_id', id::text, true);

insert into public.leads(company_name, status)
values ('Lead funil perdido', 'perdido')
returning set_config('test.funil_lost_id', id::text, true);

insert into public.leads(company_name, status)
values ('Lead funil pausado', 'pausado_60d')
returning set_config('test.funil_pause_id', id::text, true);

-- Sem remap: negociacao permanece negociacao.
do $$
declare n bigint;
begin
  select count(*) into n from public.leads where status = 'negociacao' and id = current_setting('test.funil_neg_id')::uuid;
  if n <> 1 then raise exception 'Lead legado em negociacao foi remapeado'; end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;

do $$
declare
  updated public.leads;
  from_st text;
begin
  if not public.is_typical_lead_status_transition('novo', 'contato_porteiro') then
    raise exception 'novo→contato_porteiro deveria ser típica';
  end if;
  if public.is_typical_lead_status_transition('novo', 'proposta_enviada') then
    raise exception 'novo→proposta_enviada não é típica';
  end if;
  if not public.is_typical_lead_status_transition('negociacao', 'falando_decisor') then
    raise exception 'negociacao→falando_decisor deveria ser típica';
  end if;

  select * into updated from public.update_lead_status(
    current_setting('test.funil_lead_id')::uuid,
    'contato_porteiro',
    current_setting('test.funil_updated_at')::timestamptz,
    false, null, null, null, null, null, null, null
  );
  if updated.status <> 'contato_porteiro' then raise exception 'Status não atualizado'; end if;
  select from_status into from_st
  from public.lead_status_history
  where lead_id = current_setting('test.funil_lead_id')::uuid
  order by changed_at desc
  limit 1;
  if from_st is distinct from 'novo' then raise exception 'Histórico from_status incorreto'; end if;

  begin
    perform public.update_lead_status(
      current_setting('test.funil_lead_id')::uuid,
      'proposta_enviada',
      updated.updated_at,
      false, null, null, null, null, null, null, null
    );
    raise exception 'Transição atípica sem confirmação deveria falhar';
  exception when raise_exception then
    if sqlerrm = 'Transição atípica sem confirmação deveria falhar' then raise; end if;
  end;

  select * into updated from public.update_lead_status(
    current_setting('test.funil_lead_id')::uuid,
    'proposta_enviada',
    updated.updated_at,
    true, 'salto atípico', null, null, null, null, null, null
  );
  if updated.status <> 'proposta_enviada' then raise exception 'Salto atípico confirmado falhou'; end if;

  begin
    perform public.update_lead_status(
      current_setting('test.funil_lead_id')::uuid,
      'perdido',
      updated.updated_at,
      false, null, null, null, null, null, null, null
    );
    raise exception 'Perdido sem motivo deveria falhar';
  exception when raise_exception then
    if sqlerrm = 'Perdido sem motivo deveria falhar' then raise; end if;
  end;

  begin
    perform public.update_lead_status(
      current_setting('test.funil_lead_id')::uuid,
      'perdido',
      updated.updated_at,
      false, null, 'outro', null, null, null, null, null
    );
    raise exception 'Outro sem detalhe deveria falhar';
  exception when raise_exception then
    if sqlerrm = 'Outro sem detalhe deveria falhar' then raise; end if;
  end;

  select * into updated from public.update_lead_status(
    current_setting('test.funil_lead_id')::uuid,
    'perdido',
    updated.updated_at,
    false, null, 'preco', null, null, null, null, null
  );
  if updated.motivo_perda is distinct from 'preco' then raise exception 'Motivo da perda não gravado'; end if;

  begin
    perform public.convert_lead_to_client(current_setting('test.funil_lead_id')::uuid);
    raise exception 'Conversão de perdido deveria falhar';
  exception when raise_exception then
    if sqlerrm = 'Conversão de perdido deveria falhar' then raise; end if;
  end;

  begin
    perform public.convert_lead_to_client(current_setting('test.funil_pause_id')::uuid);
    raise exception 'Conversão de pausado deveria falhar';
  exception when raise_exception then
    if sqlerrm = 'Conversão de pausado deveria falhar' then raise; end if;
  end;

  perform public.convert_lead_to_client(current_setting('test.funil_prop_id')::uuid);
  if not exists (
    select 1 from public.clients where lead_id = current_setting('test.funil_prop_id')::uuid
  ) then raise exception 'Conversão a partir de proposta_enviada falhou'; end if;
  if not exists (
    select 1 from public.lead_status_history
    where lead_id = current_setting('test.funil_prop_id')::uuid
      and from_status = 'proposta_enviada'
      and to_status = 'convertido'
  ) then raise exception 'Histórico da conversão ausente'; end if;

  insert into public.leads(company_name, status)
  values ('Lead reunião', 'falando_decisor')
  returning set_config('test.funil_meet_id', id::text, true);

  begin
    perform public.update_lead_status(
      current_setting('test.funil_meet_id')::uuid,
      'reuniao_marcada',
      (select updated_at from public.leads where id = current_setting('test.funil_meet_id')::uuid),
      false, null, null, null, null, null, null, null
    );
    raise exception 'Reunião sem data deveria falhar';
  exception when raise_exception then
    if sqlerrm = 'Reunião sem data deveria falhar' then raise; end if;
  end;

  perform public.update_lead_status(
    current_setting('test.funil_meet_id')::uuid,
    'reuniao_marcada',
    (select updated_at from public.leads where id = current_setting('test.funil_meet_id')::uuid),
    false, null, null, null, now(), 'https://meet.example.com/demo', null, null
  );

  begin
    perform public.update_lead_status(
      current_setting('test.funil_neg_id')::uuid,
      'encaminhado',
      (select updated_at from public.leads where id = current_setting('test.funil_neg_id')::uuid),
      false, null, null, null, null, null, null, null
    );
    raise exception 'Encaminhado sem nota deveria falhar';
  exception when raise_exception then
    if sqlerrm = 'Encaminhado sem nota deveria falhar' then raise; end if;
  end;

  perform public.update_lead_status(
    current_setting('test.funil_neg_id')::uuid,
    'encaminhado',
    (select updated_at from public.leads where id = current_setting('test.funil_neg_id')::uuid),
    false, 'Encaminhou para o sócio', null, null, null, null, null, null
  );

  begin
    update public.lead_status_history set note = 'hack' where lead_id = current_setting('test.funil_lead_id')::uuid;
    if found then raise exception 'UPDATE público no histórico deveria ser bloqueado'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.lead_status_history where lead_id = current_setting('test.funil_lead_id')::uuid;
    if found then raise exception 'DELETE público no histórico deveria ser bloqueado'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin
    if exists(select 1 from public.lead_status_history) then
      raise exception 'Visitante lê histórico de status';
    end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
declare p text;
begin
  foreach p in array array['UPDATE', 'DELETE', 'TRUNCATE'] loop
    if has_table_privilege('authenticated', 'public.lead_status_history', p) then
      raise exception 'authenticated tem % em lead_status_history', p;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.lead_status_history', 'SELECT') then
    raise exception 'Visitante tem SELECT em lead_status_history';
  end if;
  if has_function_privilege('anon', 'public.update_lead_status(uuid, lead_status, timestamptz, boolean, text, text, text, timestamptz, text, text, date)', 'EXECUTE') then
    raise exception 'update_lead_status exposto a visitante';
  end if;
end $$;

rollback;
