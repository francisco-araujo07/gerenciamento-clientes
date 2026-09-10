-- Aplicar primeiro em ambiente de teste. Não altera dados existentes.
begin;

-- RLS não protege TRUNCATE. Manter somente o CRUD necessário à aplicação.
revoke all on table public.leads, public.clients, public.projects from public, anon, authenticated;
grant select, insert, update, delete on table public.leads, public.clients, public.projects to authenticated;

-- A equipe continua compartilhando os dados. Contas anônimas não são membros.
-- IMPORTANTE: desabilitar signup público no painel; usuários são criados pelo administrador.
create policy "Bloquear sessões anônimas de leads" on public.leads
as restrictive for all to authenticated
using ((select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false))
with check ((select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
create policy "Bloquear sessões anônimas de clientes" on public.clients
as restrictive for all to authenticated
using ((select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false))
with check ((select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
create policy "Bloquear sessões anônimas de projetos" on public.projects
as restrictive for all to authenticated
using ((select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false))
with check ((select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));

-- NOT VALID preserva registros antigos; inserts/updates já são verificados.
-- Após revisar dados legados, executar VALIDATE CONSTRAINT separadamente.
alter table public.leads add constraint leads_input_limits check (
  char_length(company_name) <= 200 and
  char_length(coalesce(responsible_name, '')) <= 200 and
  char_length(coalesce(whatsapp, '')) <= 50 and
  char_length(coalesce(email, '')) <= 254 and
  char_length(coalesce(instagram, '')) <= 200 and
  char_length(coalesce(address, '')) <= 1000 and
  char_length(coalesce(google_maps_url, '')) <= 2048 and
  (google_maps_url is null or google_maps_url ~* '^https://[^[:space:]]+$') and
  char_length(coalesce(segment, '')) <= 200 and
  char_length(coalesce(source, '')) <= 200 and
  char_length(coalesce(notes, '')) <= 10000 and
  char_length(coalesce(next_action, '')) <= 2000
) not valid;
alter table public.clients add constraint clients_input_limits check (
  char_length(company_name) <= 200 and
  char_length(coalesce(responsible_name, '')) <= 200 and
  char_length(coalesce(whatsapp, '')) <= 50 and
  char_length(coalesce(email, '')) <= 254 and
  char_length(coalesce(instagram, '')) <= 200 and
  char_length(coalesce(address, '')) <= 1000 and
  char_length(coalesce(google_maps_url, '')) <= 2048 and
  (google_maps_url is null or google_maps_url ~* '^https://[^[:space:]]+$') and
  char_length(coalesce(segment, '')) <= 200 and
  char_length(coalesce(notes, '')) <= 10000
) not valid;
alter table public.projects add constraint projects_input_limits check (
  char_length(name) <= 200 and price <> 'NaN'::numeric
) not valid;

-- O lock serializa conversões concorrentes. Repetir após timeout devolve o mesmo cliente.
create or replace function public.convert_lead_to_client(p_lead_id uuid)
returns public.clients language plpgsql security invoker set search_path = public
as $$
declare source_lead public.leads; new_client public.clients;
begin
  select * into source_lead from public.leads where id = p_lead_id for update;
  if not found then raise exception 'Lead não encontrado.'; end if;
  select * into new_client from public.clients where lead_id = p_lead_id;
  if found and source_lead.status = 'convertido' then return new_client; end if;
  if source_lead.status not in ('novo', 'negociacao') then
    raise exception 'Somente leads novos ou em negociação podem ser convertidos.';
  end if;
  insert into public.clients (lead_id, company_name, responsible_name, whatsapp, email, instagram, address, google_maps_url, segment, notes)
  values (source_lead.id, source_lead.company_name, source_lead.responsible_name, source_lead.whatsapp, source_lead.email, source_lead.instagram, source_lead.address, source_lead.google_maps_url, source_lead.segment, source_lead.notes)
  returning * into new_client;
  update public.leads set status = 'convertido' where id = source_lead.id;
  return new_client;
end;
$$;
revoke all on function public.convert_lead_to_client(uuid) from public, anon;
grant execute on function public.convert_lead_to_client(uuid) to authenticated;

-- Impede marcar convertido pelo CRUD sem criar o cliente correspondente.
-- Dados legados não são modificados automaticamente.
create function public.require_client_on_conversion()
returns trigger language plpgsql security invoker set search_path = public
as $$
begin
  if new.status = 'convertido' then
    if tg_op = 'INSERT' or old.status <> 'convertido' then
      if not exists (select 1 from public.clients where lead_id = new.id) then
        raise exception 'Use a ação de conversão para criar o cliente.';
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger leads_require_client_on_conversion
before insert or update of status on public.leads
for each row execute function public.require_client_on_conversion();
commit;
