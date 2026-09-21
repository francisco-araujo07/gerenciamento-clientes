-- F5 Reunião com 1 clique — colunas, enum, D-1 civil Recife, RPCs e write-guard.
-- Expand-only: ADD COLUMN / CREATE TYPE / troca de CHECK (não é DROP de tabela/coluna).
-- A flag VITE_FF_GLC_REUNIAO não controla este SQL; ela só gateia a UI.
-- Não executar automaticamente em produção.

begin;

do $$ begin
  create type public.reuniao_resultado as enum (
    'pendente',
    'compareceu',
    'no_show',
    'pediu_proposta',
    'fechou',
    'recusou',
    'reagendou'
  );
exception when duplicate_object then null;
end $$;

alter table public.leads
  add column if not exists reuniao_local text,
  add column if not exists reuniao_resultado public.reuniao_resultado not null default 'pendente',
  add column if not exists reuniao_notas text;

alter table public.leads drop constraint if exists leads_reuniao_input_limits;
alter table public.leads add constraint leads_reuniao_input_limits check (
  char_length(coalesce(reuniao_local, '')) <= 500 and
  char_length(coalesce(reuniao_notas, '')) <= 2000
) not valid;

create index if not exists leads_reuniao_em_pendente_idx
  on public.leads (reuniao_em)
  where status = 'reuniao_marcada' and reuniao_resultado = 'pendente';

alter table public.lead_atividade drop constraint if exists lead_atividade_tipo_check;
alter table public.lead_atividade add constraint lead_atividade_tipo_check check (
  tipo in ('toque', 'resposta', 'reagendar', 'reuniao')
);

alter table public.lead_atividade drop constraint if exists lead_atividade_resultado_check;
alter table public.lead_atividade add constraint lead_atividade_resultado_check check (
  resultado in (
    'toquei', 'respondeu', 'sem_resposta', 'reagendado',
    'marcada', 'compareceu', 'no_show', 'pediu_proposta', 'fechou', 'recusou', 'reagendou'
  )
);

create or replace function public.reuniao_confirm_due_date(p_reuniao_em timestamptz)
returns date
language sql
immutable
set search_path = public
as $$
  select (timezone('America/Recife', p_reuniao_em))::date - 1;
$$;

create or replace function public.enforce_reuniao_write_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  via_status text;
  via_reuniao text;
  changed boolean;
begin
  if tg_op is distinct from 'UPDATE' then
    return new;
  end if;

  changed :=
    new.reuniao_em is distinct from old.reuniao_em
    or new.reuniao_link is distinct from old.reuniao_link
    or new.reuniao_local is distinct from old.reuniao_local
    or new.reuniao_resultado is distinct from old.reuniao_resultado
    or new.reuniao_notas is distinct from old.reuniao_notas;

  if not changed then
    return new;
  end if;

  via_status := nullif(current_setting('app.via_lead_status_write', true), '');
  via_reuniao := nullif(current_setting('app.via_reuniao_write', true), '');

  if via_status = 'on' or via_reuniao = 'on' then
    return new;
  end if;

  raise exception
    'Altere os campos da reunião pela ação de funil (update_lead_status / marcar_reuniao) ou pelo resultado (registrar_resultado_reuniao).';
end;
$$;

drop trigger if exists trg_leads_enforce_reuniao_write on public.leads;
create trigger trg_leads_enforce_reuniao_write
  before update of reuniao_em, reuniao_link, reuniao_local, reuniao_resultado, reuniao_notas
  on public.leads
  for each row
  execute function public.enforce_reuniao_write_guard();

create or replace function public.write_lead_atividade_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tipo_val text;
  resultado_val text;
begin
  if current_setting('app.via_cadencia_write', true) is distinct from 'on'
     and current_setting('app.via_reuniao_write', true) is distinct from 'on' then
    return new;
  end if;

  tipo_val := nullif(btrim(coalesce(current_setting('app.cadencia_tipo', true), '')), '');
  resultado_val := nullif(btrim(coalesce(current_setting('app.cadencia_resultado', true), '')), '');
  if tipo_val is null or resultado_val is null then
    return new;
  end if;

  insert into public.lead_atividade (lead_id, tipo, resultado, canal, nota, created_by)
  values (
    new.id,
    tipo_val,
    resultado_val,
    nullif(btrim(coalesce(current_setting('app.cadencia_canal', true), '')), ''),
    nullif(btrim(coalesce(current_setting('app.cadencia_nota', true), '')), ''),
    auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists trg_leads_write_cadencia_atividade on public.leads;
create trigger trg_leads_write_cadencia_atividade
  after update of touches_sem_resposta, next_action, next_action_due_date, reuniao_resultado, reuniao_em
  on public.leads
  for each row
  execute function public.write_lead_atividade_row();

create or replace function public.enforce_cadencia_write_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  via_cadencia text;
  via_status text;
  via_reuniao text;
  touches_changed boolean;
  next_action_changed boolean;
  due_changed boolean;
begin
  if tg_op is distinct from 'UPDATE' then
    return new;
  end if;

  touches_changed := new.touches_sem_resposta is distinct from old.touches_sem_resposta;
  next_action_changed := new.next_action is distinct from old.next_action;
  due_changed := new.next_action_due_date is distinct from old.next_action_due_date;

  if not touches_changed and not next_action_changed and not due_changed then
    return new;
  end if;

  via_cadencia := nullif(current_setting('app.via_cadencia_write', true), '');
  via_status := nullif(current_setting('app.via_lead_status_write', true), '');
  via_reuniao := nullif(current_setting('app.via_reuniao_write', true), '');

  if via_cadencia = 'on' or via_status = 'on' or via_reuniao = 'on' then
    return new;
  end if;

  raise exception
    'Altere toques, próxima ação e data pela cadência (registrar_cadencia), pelo funil (update_lead_status) ou pela reunião (marcar_reuniao / registrar_resultado_reuniao).';
end;
$$;

create or replace function public.update_lead_status(
  p_lead_id uuid,
  p_to_status public.lead_status,
  p_expected_updated_at timestamptz,
  p_confirm_atypical boolean default false,
  p_note text default null,
  p_motivo_perda text default null,
  p_motivo_perda_detalhe text default null,
  p_reuniao_em timestamptz default null,
  p_reuniao_link text default null,
  p_next_action text default null,
  p_next_action_due_date date default null
)
returns public.leads
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_lead public.leads;
  typical boolean;
begin
  if p_to_status = 'negociacao' then
    raise exception 'negociacao é legado e não pode ser destino de transição.';
  end if;

  if p_to_status = 'convertido' then
    raise exception 'Use a ação de conversão para criar o cliente.';
  end if;

  select * into source_lead
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'Lead não encontrado.';
  end if;

  if source_lead.updated_at is distinct from p_expected_updated_at then
    raise exception 'O lead foi alterado por outra pessoa.';
  end if;

  if source_lead.status = 'convertido' then
    raise exception 'Lead convertido não muda de status por aqui.';
  end if;

  if source_lead.status = p_to_status then
    return source_lead;
  end if;

  typical := public.is_typical_lead_status_transition(source_lead.status, p_to_status);
  if not typical and not coalesce(p_confirm_atypical, false) then
    raise exception 'Confirme a transição atípica para continuar.';
  end if;

  if p_to_status = 'perdido' then
    if p_motivo_perda is null or p_motivo_perda not in (
      'sem_resposta', 'timing', 'preco', 'tem_fornecedor',
      'sem_fit', 'sem_decisor', 'concorrente', 'outro'
    ) then
      raise exception 'Informe o motivo da perda.';
    end if;
    if p_motivo_perda = 'outro' and coalesce(btrim(p_motivo_perda_detalhe), '') = '' then
      raise exception 'Descreva o motivo da perda.';
    end if;
  end if;

  if p_to_status = 'reuniao_marcada' and p_reuniao_em is null then
    raise exception 'Informe data e hora da reunião.';
  end if;

  if p_to_status = 'encaminhado' and coalesce(btrim(p_note), '') = '' then
    raise exception 'Descreva para quem ou o que foi encaminhado.';
  end if;

  perform set_config('app.via_lead_status_write', 'on', true);
  perform set_config('app.lead_status_note', coalesce(p_note, ''), true);

  if p_to_status = 'reuniao_marcada' then
    perform set_config('app.via_reuniao_write', 'on', true);
    perform set_config('app.cadencia_tipo', 'reuniao', true);
    perform set_config('app.cadencia_resultado', 'marcada', true);
    perform set_config('app.cadencia_canal', 'outro', true);
    perform set_config('app.cadencia_nota', coalesce(p_note, ''), true);
  end if;

  begin
    update public.leads
    set
      status = p_to_status,
      motivo_perda = case when p_to_status = 'perdido' then p_motivo_perda else motivo_perda end,
      motivo_perda_detalhe = case
        when p_to_status = 'perdido' then nullif(btrim(p_motivo_perda_detalhe), '')
        else motivo_perda_detalhe
      end,
      reuniao_em = case when p_to_status = 'reuniao_marcada' then p_reuniao_em else reuniao_em end,
      reuniao_link = case
        when p_to_status = 'reuniao_marcada' then nullif(btrim(p_reuniao_link), '')
        else reuniao_link
      end,
      reuniao_resultado = case
        when p_to_status = 'reuniao_marcada' then 'pendente'::public.reuniao_resultado
        else reuniao_resultado
      end,
      next_action = case
        when p_to_status = 'reuniao_marcada' then 'Confirmar reunião no WhatsApp'
        when p_to_status = 'pausado_60d' and p_next_action is not null then nullif(btrim(p_next_action), '')
        else next_action
      end,
      next_action_due_date = case
        when p_to_status = 'reuniao_marcada' then public.reuniao_confirm_due_date(p_reuniao_em)
        when p_to_status = 'pausado_60d' and p_next_action_due_date is not null then p_next_action_due_date
        else next_action_due_date
      end
    where id = source_lead.id
    returning * into source_lead;
  exception when others then
    perform set_config('app.via_lead_status_write', '', true);
    perform set_config('app.lead_status_note', '', true);
    perform set_config('app.via_reuniao_write', '', true);
    perform set_config('app.cadencia_tipo', '', true);
    perform set_config('app.cadencia_resultado', '', true);
    perform set_config('app.cadencia_canal', '', true);
    perform set_config('app.cadencia_nota', '', true);
    raise;
  end;

  perform set_config('app.via_lead_status_write', '', true);
  perform set_config('app.lead_status_note', '', true);
  perform set_config('app.via_reuniao_write', '', true);
  perform set_config('app.cadencia_tipo', '', true);
  perform set_config('app.cadencia_resultado', '', true);
  perform set_config('app.cadencia_canal', '', true);
  perform set_config('app.cadencia_nota', '', true);

  return source_lead;
end;
$$;

create or replace function public.marcar_reuniao(
  p_lead_id uuid,
  p_expected_updated_at timestamptz,
  p_reuniao_em timestamptz,
  p_reuniao_link text default null,
  p_reuniao_local text default null,
  p_reuniao_notas text default null,
  p_confirm_atypical boolean default false,
  p_note text default null
)
returns public.leads
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_lead public.leads;
  typical boolean;
begin
  if p_reuniao_em is null then
    raise exception 'Informe data e hora da reunião.';
  end if;

  select * into source_lead
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'Lead não encontrado.';
  end if;

  if source_lead.updated_at is distinct from p_expected_updated_at then
    raise exception 'O lead foi alterado por outra pessoa.';
  end if;

  if source_lead.status = 'convertido' then
    raise exception 'Lead convertido não muda de status por aqui.';
  end if;

  if source_lead.status in ('perdido', 'pausado_60d') then
    raise exception 'Retome o lead antes de marcar a reunião.';
  end if;

  if source_lead.status is distinct from 'reuniao_marcada' then
    typical := public.is_typical_lead_status_transition(source_lead.status, 'reuniao_marcada');
    if not typical and not coalesce(p_confirm_atypical, false) then
      raise exception 'Confirme a transição atípica para continuar.';
    end if;
  end if;

  perform set_config('app.via_lead_status_write', 'on', true);
  perform set_config('app.via_reuniao_write', 'on', true);
  perform set_config('app.lead_status_note', coalesce(p_note, ''), true);
  perform set_config('app.cadencia_tipo', 'reuniao', true);
  perform set_config('app.cadencia_resultado', 'marcada', true);
  perform set_config('app.cadencia_canal', 'outro', true);
  perform set_config('app.cadencia_nota', coalesce(p_note, p_reuniao_notas, ''), true);

  begin
    update public.leads
    set
      status = 'reuniao_marcada',
      reuniao_em = p_reuniao_em,
      reuniao_link = nullif(btrim(p_reuniao_link), ''),
      reuniao_local = nullif(btrim(p_reuniao_local), ''),
      reuniao_notas = nullif(btrim(p_reuniao_notas), ''),
      reuniao_resultado = 'pendente',
      next_action = 'Confirmar reunião no WhatsApp',
      next_action_due_date = public.reuniao_confirm_due_date(p_reuniao_em)
    where id = source_lead.id
    returning * into source_lead;
  exception when others then
    perform set_config('app.via_lead_status_write', '', true);
    perform set_config('app.via_reuniao_write', '', true);
    perform set_config('app.lead_status_note', '', true);
    perform set_config('app.cadencia_tipo', '', true);
    perform set_config('app.cadencia_resultado', '', true);
    perform set_config('app.cadencia_canal', '', true);
    perform set_config('app.cadencia_nota', '', true);
    raise;
  end;

  perform set_config('app.via_lead_status_write', '', true);
  perform set_config('app.via_reuniao_write', '', true);
  perform set_config('app.lead_status_note', '', true);
  perform set_config('app.cadencia_tipo', '', true);
  perform set_config('app.cadencia_resultado', '', true);
  perform set_config('app.cadencia_canal', '', true);
  perform set_config('app.cadencia_nota', '', true);

  return source_lead;
end;
$$;

create or replace function public.registrar_resultado_reuniao(
  p_lead_id uuid,
  p_expected_updated_at timestamptz,
  p_resultado public.reuniao_resultado,
  p_notas text default null,
  p_reuniao_em timestamptz default null,
  p_reuniao_link text default null,
  p_reuniao_local text default null,
  p_motivo_perda text default null,
  p_motivo_perda_detalhe text default null
)
returns public.leads
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_lead public.leads;
  today_recife date;
  next_text text;
  next_due date;
  next_status public.lead_status;
  stored_resultado public.reuniao_resultado;
  atividade_resultado text;
begin
  if p_resultado is null or p_resultado = 'pendente' then
    raise exception 'Informe o resultado da reunião.';
  end if;

  select * into source_lead
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'Lead não encontrado.';
  end if;

  if source_lead.updated_at is distinct from p_expected_updated_at then
    raise exception 'O lead foi alterado por outra pessoa.';
  end if;

  if source_lead.status is distinct from 'reuniao_marcada' then
    raise exception 'Só é possível registrar resultado com status reuniao_marcada.';
  end if;

  today_recife := (timezone('America/Recife', now()))::date;
  next_status := source_lead.status;
  stored_resultado := p_resultado;
  atividade_resultado := p_resultado::text;
  next_text := source_lead.next_action;
  next_due := source_lead.next_action_due_date;

  if p_resultado = 'compareceu' then
    next_text := 'Definir próximo passo após reunião';
    next_due := today_recife;
  elsif p_resultado = 'no_show' then
    next_text := 'Reagendar reunião (no-show)';
    next_due := today_recife;
  elsif p_resultado = 'pediu_proposta' then
    next_status := 'proposta_enviada';
    next_text := 'Enviar proposta';
    next_due := today_recife;
  elsif p_resultado = 'fechou' then
    next_text := 'Converter em cliente';
    next_due := today_recife;
  elsif p_resultado = 'recusou' then
    if p_motivo_perda is null or p_motivo_perda not in (
      'sem_resposta', 'timing', 'preco', 'tem_fornecedor',
      'sem_fit', 'sem_decisor', 'concorrente', 'outro'
    ) then
      raise exception 'Informe o motivo da perda.';
    end if;
    if p_motivo_perda = 'outro' and coalesce(btrim(p_motivo_perda_detalhe), '') = '' then
      raise exception 'Descreva o motivo da perda.';
    end if;
    next_status := 'perdido';
    next_text := null;
    next_due := null;
  elsif p_resultado = 'reagendou' then
    if p_reuniao_em is null then
      raise exception 'Informe a nova data e hora da reunião.';
    end if;
    stored_resultado := 'pendente';
    next_text := 'Confirmar reunião no WhatsApp';
    next_due := public.reuniao_confirm_due_date(p_reuniao_em);
  end if;

  perform set_config('app.via_lead_status_write', 'on', true);
  perform set_config('app.via_reuniao_write', 'on', true);
  perform set_config('app.cadencia_tipo', 'reuniao', true);
  perform set_config('app.cadencia_resultado', atividade_resultado, true);
  perform set_config('app.cadencia_canal', 'outro', true);
  perform set_config('app.cadencia_nota', coalesce(p_notas, ''), true);
  if next_status = 'perdido' then
    perform set_config('app.lead_status_note', coalesce(p_notas, 'Recusou após reunião'), true);
  elsif next_status = 'proposta_enviada' then
    perform set_config('app.lead_status_note', coalesce(p_notas, 'Pediu proposta após reunião'), true);
  else
    perform set_config('app.lead_status_note', coalesce(p_notas, ''), true);
  end if;

  begin
    update public.leads
    set
      status = next_status,
      reuniao_em = case when p_resultado = 'reagendou' then p_reuniao_em else reuniao_em end,
      reuniao_link = case
        when p_resultado = 'reagendou' then coalesce(nullif(btrim(p_reuniao_link), ''), reuniao_link)
        else reuniao_link
      end,
      reuniao_local = case
        when p_resultado = 'reagendou' then coalesce(nullif(btrim(p_reuniao_local), ''), reuniao_local)
        else reuniao_local
      end,
      reuniao_notas = coalesce(nullif(btrim(p_notas), ''), reuniao_notas),
      reuniao_resultado = stored_resultado,
      motivo_perda = case when next_status = 'perdido' then p_motivo_perda else motivo_perda end,
      motivo_perda_detalhe = case
        when next_status = 'perdido' then nullif(btrim(p_motivo_perda_detalhe), '')
        else motivo_perda_detalhe
      end,
      next_action = next_text,
      next_action_due_date = next_due
    where id = source_lead.id
    returning * into source_lead;

    if p_resultado = 'fechou' then
      perform public.convert_lead_to_client(source_lead.id);
      select * into source_lead from public.leads where id = source_lead.id;
    end if;
  exception when others then
    perform set_config('app.via_lead_status_write', '', true);
    perform set_config('app.via_reuniao_write', '', true);
    perform set_config('app.lead_status_note', '', true);
    perform set_config('app.cadencia_tipo', '', true);
    perform set_config('app.cadencia_resultado', '', true);
    perform set_config('app.cadencia_canal', '', true);
    perform set_config('app.cadencia_nota', '', true);
    raise;
  end;

  perform set_config('app.via_lead_status_write', '', true);
  perform set_config('app.via_reuniao_write', '', true);
  perform set_config('app.lead_status_note', '', true);
  perform set_config('app.cadencia_tipo', '', true);
  perform set_config('app.cadencia_resultado', '', true);
  perform set_config('app.cadencia_canal', '', true);
  perform set_config('app.cadencia_nota', '', true);

  return source_lead;
end;
$$;

revoke all on function public.reuniao_confirm_due_date(timestamptz) from public, anon;
revoke all on function public.marcar_reuniao(uuid, timestamptz, timestamptz, text, text, text, boolean, text) from public, anon;
revoke all on function public.registrar_resultado_reuniao(uuid, timestamptz, public.reuniao_resultado, text, timestamptz, text, text, text, text) from public, anon;
grant execute on function public.reuniao_confirm_due_date(timestamptz) to authenticated;
grant execute on function public.marcar_reuniao(uuid, timestamptz, timestamptz, text, text, text, boolean, text) to authenticated;
grant execute on function public.registrar_resultado_reuniao(uuid, timestamptz, public.reuniao_resultado, text, timestamptz, text, text, text, text) to authenticated;

commit;
