-- F1 Funil de status: expand-only. Sem DROP/RENAME.
-- Não executar automaticamente em produção; aplicar em banco de teste primeiro.
-- Leads em negociacao permanecem nesse valor (legado) e exigem revisão manual.
-- Códigos já eram snake_case; não há remap Novo→novo.

begin;

alter type public.lead_status add value if not exists 'contato_porteiro';
alter type public.lead_status add value if not exists 'encaminhado';
alter type public.lead_status add value if not exists 'falando_decisor';
alter type public.lead_status add value if not exists 'reuniao_marcada';
alter type public.lead_status add value if not exists 'proposta_enviada';
alter type public.lead_status add value if not exists 'pausado_60d';

alter table public.leads
  add column if not exists motivo_perda text,
  add column if not exists motivo_perda_detalhe text,
  add column if not exists reuniao_em timestamptz,
  add column if not exists reuniao_link text;

alter table public.leads add constraint leads_motivo_perda_enum check (
  motivo_perda is null or motivo_perda in (
    'sem_resposta', 'timing', 'preco', 'tem_fornecedor',
    'sem_fit', 'sem_decisor', 'concorrente', 'outro'
  )
) not valid;

alter table public.leads add constraint leads_funil_input_limits check (
  char_length(coalesce(motivo_perda_detalhe, '')) <= 2000 and
  char_length(coalesce(reuniao_link, '')) <= 2048 and
  (reuniao_link is null or reuniao_link ~* '^https://[^[:space:]]+$')
) not valid;

create table if not exists public.lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id),
  from_status text,
  to_status text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  note text
);

create index if not exists lead_status_history_lead_changed_at_idx
  on public.lead_status_history (lead_id, changed_at desc);

create index if not exists leads_overdue_funil_idx
  on public.leads (next_action_due_date)
  where status not in ('convertido', 'perdido', 'pausado_60d')
    and next_action_due_date is not null;

alter table public.lead_status_history enable row level security;
revoke all on table public.lead_status_history from public, anon, authenticated;
grant select, insert on table public.lead_status_history to authenticated;

create policy "Usuários autenticados consultam histórico de status"
on public.lead_status_history
for select to authenticated
using (true);

create policy "Usuários autenticados registram histórico de status"
on public.lead_status_history
for insert to authenticated
with check (true);

create policy "Bloquear sessões anônimas do histórico de status"
on public.lead_status_history
as restrictive for all to authenticated
using (
  (select auth.uid()) is not null
  and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false)
)
with check (
  (select auth.uid()) is not null
  and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false)
);

create or replace function public.is_typical_lead_status_transition(
  p_from public.lead_status,
  p_to public.lead_status
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_from = p_to then return true; end if;
  if p_from = 'convertido' or p_to = 'convertido' then return false; end if;
  if p_to = 'perdido' then return true; end if;
  if p_to = 'pausado_60d' and p_from in (
    'novo', 'contato_porteiro', 'encaminhado', 'falando_decisor',
    'reuniao_marcada', 'proposta_enviada', 'negociacao'
  ) then return true; end if;
  if p_from = 'pausado_60d' and p_to in (
    'novo', 'contato_porteiro', 'encaminhado', 'falando_decisor',
    'reuniao_marcada', 'proposta_enviada'
  ) then return true; end if;
  if p_from = 'negociacao' and p_to in (
    'contato_porteiro', 'encaminhado', 'falando_decisor',
    'reuniao_marcada', 'proposta_enviada', 'pausado_60d', 'perdido'
  ) then return true; end if;
  if (p_from, p_to) in (
    ('novo', 'contato_porteiro'),
    ('contato_porteiro', 'encaminhado'),
    ('encaminhado', 'falando_decisor'),
    ('falando_decisor', 'reuniao_marcada'),
    ('reuniao_marcada', 'proposta_enviada')
  ) then return true; end if;
  return false;
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
  previous_status public.lead_status;
  typical boolean;
begin
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

  previous_status := source_lead.status;

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

  insert into public.lead_status_history (lead_id, from_status, to_status, changed_by, note)
  values (
    source_lead.id,
    previous_status::text,
    p_to_status::text,
    auth.uid(),
    nullif(btrim(p_note), '')
  );

  return source_lead;
end;
$$;

revoke all on function public.is_typical_lead_status_transition(public.lead_status, public.lead_status) from public, anon;
revoke all on function public.update_lead_status(uuid, public.lead_status, timestamptz, boolean, text, text, text, timestamptz, text, text, date) from public, anon;
grant execute on function public.is_typical_lead_status_transition(public.lead_status, public.lead_status) to authenticated;
grant execute on function public.update_lead_status(uuid, public.lead_status, timestamptz, boolean, text, text, text, timestamptz, text, text, date) to authenticated;

create or replace function public.convert_lead_to_client(p_lead_id uuid)
returns public.clients
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_lead public.leads;
  new_client public.clients;
  previous_status public.lead_status;
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
  previous_status := source_lead.status;
  insert into public.clients (
    lead_id, company_name, responsible_name, whatsapp, email, instagram,
    address, google_maps_url, segment, notes
  ) values (
    source_lead.id, source_lead.company_name, source_lead.responsible_name,
    source_lead.whatsapp, source_lead.email, source_lead.instagram,
    source_lead.address, source_lead.google_maps_url, source_lead.segment,
    source_lead.notes
  ) returning * into new_client;
  update public.leads set status = 'convertido' where id = source_lead.id;
  insert into public.lead_status_history (lead_id, from_status, to_status, changed_by, note)
  values (source_lead.id, previous_status::text, 'convertido', auth.uid(), 'Conversão em cliente');
  return new_client;
end;
$$;

revoke all on function public.convert_lead_to_client(uuid) from public, anon;
grant execute on function public.convert_lead_to_client(uuid) to authenticated;

commit;
