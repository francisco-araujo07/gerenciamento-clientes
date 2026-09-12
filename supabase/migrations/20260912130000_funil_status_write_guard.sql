-- Fecha o write path de status fora das RPCs (P0-001) e o INSERT direto no histórico (P2-001).
-- Expand-only: sem DROP/RENAME. CHECKs NOT VALID permanecem assim (P2-002).
-- A flag VITE_FF_GLC_FUNIL_STATUS não controla este SQL; ela só gateia a UI.

create or replace function public.enforce_lead_status_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  create_allowed constant public.lead_status[] := array[
    'novo',
    'contato_porteiro',
    'encaminhado',
    'falando_decisor',
    'proposta_enviada'
  ]::public.lead_status[];
begin
  if new.status = 'perdido' then
    if new.motivo_perda is null then
      raise exception 'Informe o motivo da perda para status perdido.';
    end if;
    if new.motivo_perda = 'outro' and coalesce(btrim(new.motivo_perda_detalhe), '') = '' then
      raise exception 'Descreva o motivo da perda quando for outro.';
    end if;
  end if;

  if new.status = 'reuniao_marcada' and new.reuniao_em is null then
    raise exception 'Informe a data da reunião para status reuniao_marcada.';
  end if;

  if tg_op = 'INSERT'
     and current_user = 'authenticated'
     and not (new.status = any (create_allowed)) then
    raise exception 'Status % não é permitido na criação do lead.', new.status;
  end if;

  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and current_setting('app.via_lead_status_write', true) is distinct from 'on' then
    raise exception 'Altere o status pela ação de funil ou conversão (update_lead_status / convert_lead_to_client).';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_leads_enforce_status_rules on public.leads;
create trigger trg_leads_enforce_status_rules
  before insert or update of status, motivo_perda, motivo_perda_detalhe, reuniao_em
  on public.leads
  for each row
  execute function public.enforce_lead_status_rules();

create or replace function public.write_lead_status_history_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  insert into public.lead_status_history (lead_id, from_status, to_status, changed_by, note)
  values (
    new.id,
    old.status::text,
    new.status::text,
    auth.uid(),
    nullif(btrim(coalesce(current_setting('app.lead_status_note', true), '')), '')
  );

  return new;
end;
$$;

drop trigger if exists trg_leads_write_status_history on public.leads;
create trigger trg_leads_write_status_history
  after update of status
  on public.leads
  for each row
  execute function public.write_lead_status_history_row();

revoke insert on table public.lead_status_history from authenticated, anon, public;
drop policy if exists "Usuários autenticados registram histórico de status" on public.lead_status_history;

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
    next_action = case
      when p_to_status = 'pausado_60d' and p_next_action is not null then nullif(btrim(p_next_action), '')
      else next_action
    end,
    next_action_due_date = case
      when p_to_status = 'pausado_60d' and p_next_action_due_date is not null then p_next_action_due_date
      else next_action_due_date
    end
  where id = source_lead.id
  returning * into source_lead;

  return source_lead;
end;
$$;

revoke all on function public.update_lead_status(
  uuid, public.lead_status, timestamptz, boolean, text, text, text, timestamptz, text, text, date
) from public, anon;
grant execute on function public.update_lead_status(
  uuid, public.lead_status, timestamptz, boolean, text, text, text, timestamptz, text, text, date
) to authenticated;

create or replace function public.convert_lead_to_client(p_lead_id uuid)
returns public.clients
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_lead public.leads;
  new_client public.clients;
begin
  select * into source_lead from public.leads where id = p_lead_id for update;
  if not found then raise exception 'Lead não encontrado.'; end if;
  select * into new_client from public.clients where lead_id = p_lead_id;
  if found and source_lead.status = 'convertido' then return new_client; end if;
  if source_lead.status in ('perdido', 'pausado_60d') then
    raise exception 'Leads perdidos ou pausados não podem ser convertidos.';
  end if;
  if source_lead.status = 'convertido' then
    raise exception 'Use a ação de conversão para criar o cliente.';
  end if;
  insert into public.clients (
    lead_id, company_name, responsible_name, whatsapp, email, instagram,
    address, google_maps_url, segment, notes
  ) values (
    source_lead.id, source_lead.company_name, source_lead.responsible_name,
    source_lead.whatsapp, source_lead.email, source_lead.instagram,
    source_lead.address, source_lead.google_maps_url, source_lead.segment,
    source_lead.notes
  ) returning * into new_client;

  perform set_config('app.via_lead_status_write', 'on', true);
  perform set_config('app.lead_status_note', 'Conversão em cliente', true);

  update public.leads set status = 'convertido' where id = source_lead.id;
  return new_client;
end;
$$;

revoke all on function public.convert_lead_to_client(uuid) from public, anon;
grant execute on function public.convert_lead_to_client(uuid) to authenticated;
