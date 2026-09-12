-- F2 remediação P1-001/P1-002: next_action* só via GUC/RPC; respondeu pausa a fila.
-- Expand-only: CREATE OR REPLACE + recriar trigger (sem DROP de tabela/coluna).
-- F1 update_lead_status grava next_action* ao pausar 60d com via_lead_status_write.

create or replace function public.enforce_cadencia_write_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  via_cadencia text;
  via_status text;
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

  if via_cadencia = 'on' or via_status = 'on' then
    return new;
  end if;

  raise exception
    'Altere toques, próxima ação e data pela cadência (registrar_cadencia) ou pelo funil (update_lead_status).';
end;
$$;

drop trigger if exists trg_leads_enforce_cadencia_write on public.leads;
drop trigger if exists trg_leads_cadencia_write_guard on public.leads;

create trigger trg_leads_enforce_cadencia_write
  before update of touches_sem_resposta, next_action, next_action_due_date
  on public.leads
  for each row
  execute function public.enforce_cadencia_write_guard();

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
    -- CA-F2-06: zera toques e pausa a cadência até reagendar (sai da fila Hoje).
    new_touches := 0;
    next_due := null;
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
