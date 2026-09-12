-- F2 Fila de cadência — coluna, atividades, config, RPC e guarda de write.
-- Expand-only: sem DROP/RENAME. Sem predicado deleted_at (coluna ainda não existe).
-- A flag VITE_FF_GLC_FILA_CADENCIA não controla este SQL; ela só gateia a UI.

begin;

alter table public.leads
  add column if not exists touches_sem_resposta integer not null default 0;

alter table public.leads add constraint leads_touches_sem_resposta_nonneg
  check (touches_sem_resposta >= 0);

create index if not exists leads_next_action_due_date_cadencia_idx
  on public.leads (next_action_due_date);

create table if not exists public.lead_atividade (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id),
  tipo text not null,
  resultado text not null,
  canal text,
  nota text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint lead_atividade_tipo_check check (tipo in ('toque', 'resposta', 'reagendar')),
  constraint lead_atividade_resultado_check check (resultado in ('toquei', 'respondeu', 'sem_resposta', 'reagendado')),
  constraint lead_atividade_canal_check check (canal is null or canal in ('whatsapp', 'ligacao', 'outro')),
  constraint lead_atividade_nota_limit check (char_length(coalesce(nota, '')) <= 2000)
);

create index if not exists lead_atividade_lead_created_at_idx
  on public.lead_atividade (lead_id, created_at desc);

create table if not exists public.cadencia_config (
  id text primary key default 'global',
  max_touches_sem_resposta integer not null default 4,
  offset_dias_apos_toque integer[] not null default array[3, 4, 6],
  offset_pausado_dias integer not null default 60,
  constraint cadencia_config_max_touches_check check (max_touches_sem_resposta >= 1),
  constraint cadencia_config_offsets_check check (
    cardinality(offset_dias_apos_toque) >= 1
    and offset_dias_apos_toque[1] is not null
  ),
  constraint cadencia_config_pause_check check (offset_pausado_dias >= 1)
);

insert into public.cadencia_config (
  id, max_touches_sem_resposta, offset_dias_apos_toque, offset_pausado_dias
) values ('global', 4, array[3, 4, 6], 60)
on conflict (id) do nothing;

alter table public.lead_atividade enable row level security;
alter table public.cadencia_config enable row level security;

revoke all on table public.lead_atividade from public, anon, authenticated;
revoke all on table public.cadencia_config from public, anon, authenticated;
grant select on table public.lead_atividade to authenticated;
grant select on table public.cadencia_config to authenticated;

create policy "Usuários autenticados consultam atividades do lead"
on public.lead_atividade
for select to authenticated
using (true);

create policy "Bloquear sessões anônimas das atividades"
on public.lead_atividade
as restrictive for all to authenticated
using (
  (select auth.uid()) is not null
  and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false)
)
with check (
  (select auth.uid()) is not null
  and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false)
);

create policy "Usuários autenticados consultam config de cadência"
on public.cadencia_config
for select to authenticated
using (true);

create policy "Bloquear sessões anônimas da config de cadência"
on public.cadencia_config
as restrictive for all to authenticated
using (
  (select auth.uid()) is not null
  and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false)
)
with check (
  (select auth.uid()) is not null
  and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false)
);

create or replace function public.enforce_cadencia_write_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.touches_sem_resposta is distinct from old.touches_sem_resposta
     and current_setting('app.via_cadencia_write', true) is distinct from 'on' then
    raise exception 'Altere toques pela ação de cadência (registrar_cadencia).';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_enforce_cadencia_write on public.leads;
create trigger trg_leads_enforce_cadencia_write
  before update of touches_sem_resposta
  on public.leads
  for each row
  execute function public.enforce_cadencia_write_guard();

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
  if current_setting('app.via_cadencia_write', true) is distinct from 'on' then
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
  after update of touches_sem_resposta, next_action, next_action_due_date
  on public.leads
  for each row
  execute function public.write_lead_atividade_row();

create or replace function public.cadencia_follow_up_text(p_touch integer)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_touch = 1 then
    return 'Follow-up: reforçar o contato e confirmar se receberam a mensagem.';
  end if;
  if p_touch = 2 then
    return 'Enviar case ou exemplo do nicho para gerar contexto.';
  end if;
  if p_touch = 3 then
    return 'Break-up: última tentativa educada antes de pausar ou marcar perdido.';
  end if;
  return null;
end;
$$;

create or replace function public.registrar_cadencia(
  p_lead_id uuid,
  p_expected_updated_at timestamptz,
  p_acao text,
  p_nota text default null,
  p_next_action text default null,
  p_next_action_due_date date default null,
  p_canal text default 'whatsapp'
)
returns public.leads
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_lead public.leads;
  cfg public.cadencia_config;
  new_touches integer;
  offset_days integer;
  today_recife date;
  next_text text;
  next_due date;
  tipo_val text;
  resultado_val text;
begin
  if p_acao not in ('toquei', 'respondeu', 'sem_resposta', 'reagendar') then
    raise exception 'Ação de cadência inválida.';
  end if;

  if p_canal is not null and p_canal not in ('whatsapp', 'ligacao', 'outro') then
    raise exception 'Canal de cadência inválido.';
  end if;

  select * into cfg from public.cadencia_config where id = 'global';
  if not found then
    raise exception 'Configuração de cadência ausente.';
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

  if source_lead.status in ('convertido', 'perdido', 'pausado_60d') then
    raise exception 'Lead inativo não entra na cadência.';
  end if;

  today_recife := (timezone('America/Recife', now()))::date;
  new_touches := source_lead.touches_sem_resposta;
  next_text := source_lead.next_action;
  next_due := source_lead.next_action_due_date;

  if p_acao in ('toquei', 'sem_resposta') then
    if source_lead.touches_sem_resposta >= cfg.max_touches_sem_resposta then
      raise exception 'TOUCH_LIMIT' using errcode = 'PT409';
    end if;

    new_touches := source_lead.touches_sem_resposta + 1;
    if new_touches >= cfg.max_touches_sem_resposta then
      raise exception 'TOUCH_LIMIT' using errcode = 'PT409';
    end if;

    offset_days := cfg.offset_dias_apos_toque[new_touches];
    if offset_days is null then
      raise exception 'TOUCH_LIMIT' using errcode = 'PT409';
    end if;

    next_text := public.cadencia_follow_up_text(new_touches);
    next_due := today_recife + offset_days;
    tipo_val := 'toque';
    resultado_val := case when p_acao = 'toquei' then 'toquei' else 'sem_resposta' end;
  elsif p_acao = 'respondeu' then
    new_touches := 0;
    tipo_val := 'resposta';
    resultado_val := 'respondeu';
  else
    if p_next_action_due_date is null then
      raise exception 'Informe a nova data da próxima ação.';
    end if;
    next_text := coalesce(nullif(btrim(p_next_action), ''), source_lead.next_action);
    next_due := p_next_action_due_date;
    tipo_val := 'reagendar';
    resultado_val := 'reagendado';
  end if;

  begin
    perform set_config('app.via_cadencia_write', 'on', true);
    perform set_config('app.cadencia_tipo', tipo_val, true);
    perform set_config('app.cadencia_resultado', resultado_val, true);
    perform set_config('app.cadencia_canal', coalesce(p_canal, 'whatsapp'), true);
    perform set_config('app.cadencia_nota', coalesce(p_nota, ''), true);

    update public.leads
    set
      touches_sem_resposta = new_touches,
      next_action = next_text,
      next_action_due_date = next_due
    where id = source_lead.id
    returning * into source_lead;

    perform set_config('app.via_cadencia_write', '', true);
    perform set_config('app.cadencia_tipo', '', true);
    perform set_config('app.cadencia_resultado', '', true);
    perform set_config('app.cadencia_canal', '', true);
    perform set_config('app.cadencia_nota', '', true);
  exception when others then
    perform set_config('app.via_cadencia_write', '', true);
    perform set_config('app.cadencia_tipo', '', true);
    perform set_config('app.cadencia_resultado', '', true);
    perform set_config('app.cadencia_canal', '', true);
    perform set_config('app.cadencia_nota', '', true);
    raise;
  end;

  return source_lead;
end;
$$;

revoke all on function public.cadencia_follow_up_text(integer) from public, anon;
revoke all on function public.registrar_cadencia(uuid, timestamptz, text, text, text, date, text) from public, anon;
grant execute on function public.cadencia_follow_up_text(integer) to authenticated;
grant execute on function public.registrar_cadencia(uuid, timestamptz, text, text, text, date, text) to authenticated;

commit;
