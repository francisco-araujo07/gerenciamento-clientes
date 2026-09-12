-- F1 Funil de status — expand do enum (precisa ser commitado antes do uso).
-- Sem DROP/RENAME. Não executar automaticamente em produção.

alter type public.lead_status add value if not exists 'contato_porteiro';
alter type public.lead_status add value if not exists 'encaminhado';
alter type public.lead_status add value if not exists 'falando_decisor';
alter type public.lead_status add value if not exists 'reuniao_marcada';
alter type public.lead_status add value if not exists 'proposta_enviada';
alter type public.lead_status add value if not exists 'pausado_60d';
