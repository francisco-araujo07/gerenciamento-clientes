-- Converte um lead ativo em cliente de forma atômica, preservando seus dados.

create function public.convert_lead_to_client(p_lead_id uuid)
returns public.clients
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_lead public.leads;
  new_client public.clients;
begin
  select * into source_lead
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'Lead não encontrado.';
  end if;

  if source_lead.status not in ('novo', 'negociacao') then
    raise exception 'Somente leads novos ou em negociação podem ser convertidos.';
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

  update public.leads
  set status = 'convertido'
  where id = source_lead.id;

  return new_client;
end;
$$;

revoke all on function public.convert_lead_to_client(uuid) from public;
grant execute on function public.convert_lead_to_client(uuid) to authenticated;
