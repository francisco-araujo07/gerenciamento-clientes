-- F5 P1-001 / P1-002 / P2-003 — fluxos guiados, guarda de regravação, HTTPS em reuniao_link.
-- Expand-only: CREATE FUNCTION / CREATE OR REPLACE / DROP FUNCTION da RPC antiga (não é DROP de tabela/coluna).
-- A flag VITE_FF_GLC_REUNIAO não controla este SQL; ela só gateia a UI.
-- Não executar automaticamente em produção.

begin;

create or replace function public.assert_reuniao_https_link(p_link text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  trimmed text;
begin
  trimmed := nullif(btrim(coalesce(p_link, '')), '');
  if trimmed is null then
    return null;
  end if;
  if trimmed !~* '^https://' or trimmed ~ '[[:space:]]' or trimmed ~* '^https://[^/]*@' then
    raise exception 'O link da reunião deve usar HTTPS sem credenciais.';
  end if;
  return trimmed;
end;
$$;

create or replace function public.normalize_reuniao_https_link()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.reuniao_link is not distinct from old.reuniao_link then
    return new;
  end if;
  new.reuniao_link := public.assert_reuniao_https_link(new.reuniao_link);
  return new;
end;
$$;

drop trigger if exists trg_leads_reuniao_https_link on public.leads;
create trigger trg_leads_reuniao_https_link
  before insert or update of reuniao_link
  on public.leads
  for each row
  execute function public.normalize_reuniao_https_link();

-- Assinatura nova (13 args). DROP FUNCTION da RPC antiga evita overload ambíguo no PostgREST.
drop function if exists public.registrar_resultado_reuniao(
  uuid, timestamptz, public.reuniao_resultado, text, timestamptz, text, text, text, text
);

create function public.registrar_resultado_reuniao(
  p_lead_id uuid,
  p_expected_updated_at timestamptz,
  p_resultado public.reuniao_resultado,
  p_notas text default null,
  p_reuniao_em timestamptz default null,
  p_reuniao_link text default null,
  p_reuniao_local text default null,
  p_motivo_perda text default null,
  p_motivo_perda_detalhe text default null,
  p_compareceu_destino text default null,
  p_no_show_destino text default null,
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
  today_recife date;
  next_text text;
  next_due date;
  next_status public.lead_status;
  stored_resultado public.reuniao_resultado;
  atividade_resultado text;
  apply_reschedule boolean := false;
  no_show_stuck boolean := false;
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

  no_show_stuck :=
    source_lead.reuniao_resultado = 'no_show'
    and p_resultado = 'no_show'
    and p_no_show_destino in ('reagendar', 'pausado_60d');

  -- P1-002: não regravar se já ≠ pendente, salvo reagendou ou no_show preso (política explícita).
  if source_lead.reuniao_resultado is not null
     and source_lead.reuniao_resultado is distinct from 'pendente'
     and p_resultado is distinct from 'reagendou'
     and not no_show_stuck then
    raise exception 'Resultado da reunião já registrado.';
  end if;

  today_recife := (timezone('America/Recife', now()))::date;
  next_status := source_lead.status;
  stored_resultado := p_resultado;
  atividade_resultado := p_resultado::text;
  next_text := source_lead.next_action;
  next_due := source_lead.next_action_due_date;

  if p_resultado = 'compareceu' then
    if p_compareceu_destino is null or p_compareceu_destino not in ('proposta_enviada', 'manter') then
      raise exception 'Escolha o próximo passo após a reunião: enviar proposta ou definir a próxima ação.';
    end if;
    if p_compareceu_destino = 'proposta_enviada' then
      next_status := 'proposta_enviada';
      next_text := 'Enviar proposta';
      next_due := today_recife;
    else
      if coalesce(btrim(p_next_action), '') = '' then
        raise exception 'Informe a próxima ação após a reunião.';
      end if;
      next_text := btrim(p_next_action);
      next_due := coalesce(p_next_action_due_date, today_recife);
    end if;
  elsif p_resultado = 'no_show' then
    if p_no_show_destino is null or p_no_show_destino not in ('reagendar', 'pausado_60d') then
      raise exception 'Escolha reagendar a reunião ou pausar o lead por 60 dias.';
    end if;
    if p_no_show_destino = 'reagendar' then
      if p_reuniao_em is null then
        raise exception 'Informe a nova data e hora da reunião.';
      end if;
      apply_reschedule := true;
      stored_resultado := 'pendente';
      next_text := 'Confirmar reunião no WhatsApp';
      next_due := public.reuniao_confirm_due_date(p_reuniao_em);
    else
      next_status := 'pausado_60d';
      next_text := coalesce(nullif(btrim(p_next_action), ''), 'Retomar cadência');
      next_due := coalesce(p_next_action_due_date, today_recife + 60);
    end if;
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
    apply_reschedule := true;
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
  elsif next_status = 'pausado_60d' then
    perform set_config('app.lead_status_note', coalesce(p_notas, 'No-show — pausado 60 dias'), true);
  else
    perform set_config('app.lead_status_note', coalesce(p_notas, ''), true);
  end if;

  begin
    update public.leads
    set
      status = next_status,
      reuniao_em = case when apply_reschedule then p_reuniao_em else reuniao_em end,
      reuniao_link = case
        when apply_reschedule then coalesce(public.assert_reuniao_https_link(p_reuniao_link), reuniao_link)
        else reuniao_link
      end,
      reuniao_local = case
        when apply_reschedule then coalesce(nullif(btrim(p_reuniao_local), ''), reuniao_local)
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

revoke all on function public.assert_reuniao_https_link(text) from public, anon;
revoke all on function public.registrar_resultado_reuniao(
  uuid, timestamptz, public.reuniao_resultado, text, timestamptz, text, text, text, text, text, text, text, date
) from public, anon;

grant execute on function public.assert_reuniao_https_link(text) to authenticated;
grant execute on function public.registrar_resultado_reuniao(
  uuid, timestamptz, public.reuniao_resultado, text, timestamptz, text, text, text, text, text, text, text, date
) to authenticated;

commit;
