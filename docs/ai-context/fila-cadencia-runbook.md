# Runbook — Fila de cadência (F2)

A flag `VITE_FF_GLC_FILA_CADENCIA` (`ff_glc_fila_cadencia`) gateia **somente a UI**. Depois que a migration desta fila entra no banco, coluna `touches_sem_resposta`, tabelas `lead_atividade`/`cadencia_config`, RPC `registrar_cadencia` e triggers existem no servidor — ligar ou desligar a flag **não** desliga o motor.

## O que a flag controla

- ON: a UI mostra o menu **Hoje** (acima de Leads), a fila Todos|Hoje|Atrasadas, as ações de cadência e a timeline de atividades no detalhe.
- OFF: a UI legado de Leads permanece; nenhum write de cadência parte da interface.

## O que a flag não controla

- Existência de `registrar_cadencia`, `cadencia_follow_up_text` e `cadencia_config`.
- Trigger `enforce_cadencia_write_guard` (`touches_sem_resposta` só com GUC `app.via_cadencia_write`).
- `lead_atividade` gravada pelo trigger SECURITY DEFINER (sem INSERT direto de `authenticated`).

Rollback de emergência no servidor: revogar `EXECUTE` de `registrar_cadencia` e **não** promover writes da UI. Desligar a flag sozinha não é rollback de schema.

## Pré-requisito F1

O ramp da F2 assume F1 ligada (`VITE_FF_GLC_FUNIL_STATUS=true`) depois do migrate do funil: a fila usa os status canônicos e os modais de Perdido/Pausar da F1. Com F2 OFF o legado não quebra, mesmo se F1 estiver OFF.

## Ordem de promoção (sem 100%)

1. Aplicar as migrations F1 e esta F2 em banco de **teste** (expand-only; sem DROP/RENAME).
2. Rodar `supabase/tests/audit.sql`, `supabase/tests/funil-status.sql` e `supabase/tests/fila-cadencia.sql`.
3. Build de produção com a flag **OFF**.
4. Aplicar as migrations em produção.
5. Ramp da flag em builds seguintes, com F1 já ON. Não promover 100% nesta entrega.
6. F3, cron/badge, kanban e WhatsApp Business API ficam fora.

## Motor (servidor)

- 1º toque sem resposta: +3 dias + texto de follow-up.
- 2º: +4 dias + case/nicho.
- 3º: +6 dias + break-up.
- 4º: `409` / `TOUCH_LIMIT` — a UI oferece Pausar 60d, Perdido ou Cancelar. Nada avança em silêncio.
- Datas civis no fuso `America/Recife`.
- WhatsApp da lista é mascarado; com F3 OFF o fallback é `wa.me` sem template.

## Residual conhecido

Sessão SQL que consiga `set_config('app.via_cadencia_write', 'on', true)` ainda pode atualizar `touches_sem_resposta` (PostgREST não expõe esse GUC). Atividades continuam sendo escritas pelo trigger SECURITY DEFINER.
