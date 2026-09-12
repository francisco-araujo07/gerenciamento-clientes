-- F3 Kit WhatsApp — colunas do lead, wa_templates, seeds e RLS.
-- Expand-only: sem DROP/RENAME. Sem migrate/promote de produção nesta entrega.
-- A flag VITE_FF_GLC_KIT_WHATSAPP não controla este SQL; ela só gateia a UI.
-- Nenhum cliente WhatsApp Cloud API / BSP: o envio continua só via https://wa.me/...

begin;

alter table public.leads
  add column if not exists gatilho text,
  add column if not exists prototipo_url text,
  add column if not exists prototipo_notas text,
  add column if not exists wa_ultimo_template_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_gatilho_limit' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_gatilho_limit
      check (char_length(coalesce(gatilho, '')) <= 280);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_prototipo_notas_limit' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_prototipo_notas_limit
      check (char_length(coalesce(prototipo_notas, '')) <= 2000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_prototipo_url_https' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_prototipo_url_https
      check (
        prototipo_url is null
        or prototipo_url ~* '^https://[^[:space:]]+$'
      ) not valid;
  end if;
end $$;

create table if not exists public.wa_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  etapa text not null,
  corpo text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wa_templates_nome_limit check (
    char_length(btrim(nome)) between 1 and 120
  ),
  constraint wa_templates_etapa_check check (
    etapa in ('abertura', 'follow_up', 'case_nicho', 'break_up', 'prototipo')
  ),
  constraint wa_templates_corpo_limit check (
    char_length(btrim(corpo)) between 1 and 2000
  )
);

create unique index if not exists wa_templates_seed_etapa_uidx
  on public.wa_templates (etapa)
  where nome in (
    'Abertura',
    'Follow-up',
    'Case / nicho',
    'Break-up',
    'Protótipo'
  );

create index if not exists wa_templates_etapa_ativo_idx
  on public.wa_templates (etapa, ativo);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_wa_ultimo_template_id_fkey'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_wa_ultimo_template_id_fkey
      foreign key (wa_ultimo_template_id)
      references public.wa_templates(id)
      on delete set null;
  end if;
end $$;

create index if not exists leads_wa_ultimo_template_id_idx
  on public.leads (wa_ultimo_template_id);

drop trigger if exists trg_wa_templates_set_updated_at on public.wa_templates;
create trigger trg_wa_templates_set_updated_at
  before update on public.wa_templates
  for each row
  execute function public.set_updated_at();

insert into public.wa_templates (id, nome, etapa, corpo, ativo) values
  (
    'a1111111-1111-4111-8111-111111111111',
    'Abertura',
    'abertura',
    'Oi {{responsavel}}! Aqui é {{seu_nome}}. Vi a {{empresa}} ({{segmento}} em {{bairro_ou_cidade}}) e {{gatilho}}. Posso te mandar um print rápido de como ficaria uma landing page pra vocês?',
    true
  ),
  (
    'a2222222-2222-4222-8222-222222222222',
    'Follow-up',
    'follow_up',
    'Oi {{responsavel}}, {{seu_nome}} de novo. Conseguiu ver a mensagem sobre a {{empresa}}? Se fizer sentido, te mando um print do protótipo.',
    true
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    'Case / nicho',
    'case_nicho',
    '{{responsavel}}, preparei um exemplo do nicho {{segmento}} pra {{empresa}} em {{bairro_ou_cidade}}. Se quiser, te mostro como ficaria o site de vocês.',
    true
  ),
  (
    'a4444444-4444-4444-8444-444444444444',
    'Break-up',
    'break_up',
    '{{responsavel}}, última tentativa da minha parte sobre a {{empresa}}. Se não for o momento, sem problema — posso retomar depois. Se quiser o print do protótipo, é só responder.',
    true
  ),
  (
    'a5555555-5555-4555-8555-555555555555',
    'Protótipo',
    'prototipo',
    '{{responsavel}}, montei um rascunho pra {{empresa}}: {{prototipo_url}}. Dá uma olhada e me diz o que ajustamos.',
    true
  )
on conflict (id) do nothing;

alter table public.wa_templates enable row level security;

revoke all on table public.wa_templates from public, anon, authenticated;
grant select, insert, update on table public.wa_templates to authenticated;

create policy "Usuários autenticados consultam templates WhatsApp"
on public.wa_templates
for select to authenticated
using (true);

create policy "Usuários autenticados criam templates WhatsApp"
on public.wa_templates
for insert to authenticated
with check (true);

create policy "Usuários autenticados editam templates WhatsApp"
on public.wa_templates
for update to authenticated
using (true)
with check (true);

create policy "Bloquear sessões anônimas dos templates WhatsApp"
on public.wa_templates
as restrictive for all to authenticated
using (
  (select auth.uid()) is not null
  and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false)
)
with check (
  (select auth.uid()) is not null
  and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false)
);

commit;
