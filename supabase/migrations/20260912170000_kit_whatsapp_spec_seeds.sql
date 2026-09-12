-- F3 remediação P1 — alinha seeds e CHECK de etapa à SPEC CA-F3-02.
-- Expand-only: troca o CHECK (não é DROP de tabela/coluna) e atualiza os 5 seeds por id.
-- Idempotente se a migration anterior já tiver nascido com a SPEC.

begin;

drop index if exists public.wa_templates_seed_etapa_uidx;

alter table public.wa_templates drop constraint if exists wa_templates_etapa_check;

alter table public.wa_templates
  add constraint wa_templates_etapa_check check (
    etapa in (
      'novo',
      'contato_porteiro',
      'encaminhado',
      'falando_decisor',
      'reuniao_marcada',
      'proposta_enviada',
      'negociacao',
      'qualquer',
      'abertura',
      'follow_up',
      'case_nicho',
      'break_up',
      'prototipo'
    )
  );

update public.wa_templates set
  nome = 'Primeira abordagem (porteiro)',
  etapa = 'contato_porteiro',
  corpo = 'Oi! Aqui é {{seu_nome}}. Vi a {{empresa}} ({{segmento}} em {{bairro_ou_cidade}}) e {{gatilho}}. Você poderia me encaminhar para quem decide a parte de marketing/site?',
  ativo = true
where id = 'a1111111-1111-4111-8111-111111111111';

update public.wa_templates set
  nome = 'Follow-up D+3',
  etapa = 'qualquer',
  corpo = 'Oi, {{seu_nome}} de novo. Conseguiu passar o contato de quem decide sobre a {{empresa}}? Se preferir, te mando um print de como ficaria.',
  ativo = true
where id = 'a2222222-2222-4222-8222-222222222222';

update public.wa_templates set
  nome = 'Break-up',
  etapa = 'qualquer',
  corpo = 'Oi, última tentativa da minha parte sobre a {{empresa}}. Se não for o momento, sem problema — posso retomar depois.',
  ativo = true
where id = 'a3333333-3333-4333-8333-333333333333';

update public.wa_templates set
  nome = 'Decisor respondeu — pedir 2 horários',
  etapa = 'falando_decisor',
  corpo = 'Oi {{decisor_nome}}! Que bom falar sobre a {{empresa}}. Para te mostrar o print, quais dois horários nesta semana ficam melhores pra você?',
  ativo = true
where id = 'a4444444-4444-4444-8444-444444444444';

update public.wa_templates set
  nome = 'Confirmar reunião D-1',
  etapa = 'reuniao_marcada',
  corpo = 'Oi {{decisor_nome}}, confirmando nossa conversa sobre a {{empresa}} amanhã. Qualquer imprevisto, me avisa que encaixo outro horário.',
  ativo = true
where id = 'a5555555-5555-4555-8555-555555555555';

alter table public.wa_templates drop constraint wa_templates_etapa_check;

alter table public.wa_templates
  add constraint wa_templates_etapa_check check (
    etapa in (
      'novo',
      'contato_porteiro',
      'encaminhado',
      'falando_decisor',
      'reuniao_marcada',
      'proposta_enviada',
      'negociacao',
      'qualquer'
    )
  );

create unique index if not exists wa_templates_seed_nome_uidx
  on public.wa_templates (nome)
  where nome in (
    'Primeira abordagem (porteiro)',
    'Follow-up D+3',
    'Break-up',
    'Decisor respondeu — pedir 2 horários',
    'Confirmar reunião D-1'
  );

commit;
