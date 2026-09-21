# Runbook — Reunião com 1 clique (F5)

A flag `VITE_FF_GLC_REUNIAO` (`ff_glc_reuniao`) gateia **somente a UI**. Default **OFF**. Depois que a migration entra no banco, colunas, enum, RPCs `marcar_reuniao` / `registrar_resultado_reuniao`, D-1 e o trigger de atividade existem no servidor — ligar ou desligar a flag **não** desliga o motor nem apaga `reuniao_*`.

## O que a flag controla

- ON: modal completo ao ir para `reuniao_marcada` (data/hora, link, local, notas; resultado default `pendente`); card **Próxima reunião** com countdown no detalhe; CTAs **Confirmar reunião** e **Registrar resultado** na fila Hoje (se F2 ON) e no card.
- OFF: esses controles somem. Se a F1 estiver ON, o stub mínimo permanece: data/hora + link no drawer de status. O JS **não** envia `reuniao_local` / `reuniao_resultado` / `reuniao_notas` no payload cadastral.

## O que a flag não controla

- Existência das colunas `reuniao_local`, `reuniao_resultado`, `reuniao_notas` (além dos stubs F1 `reuniao_em` / `reuniao_link`).
- `update_lead_status` ao ir para `reuniao_marcada`: depois do migrate grava `next_action` = “Confirmar reunião no WhatsApp”, `next_action_due_date` = D-1 civil em America/Recife, `reuniao_resultado=pendente` e atividade `tipo=reuniao`.
- Write-guards: `status` só com GUC `app.via_lead_status_write`; `next_action*` / toques só com GUC de cadência, de status ou `app.via_reuniao_write`; campos `reuniao_*` só com GUC de status ou de reunião. INSERT em `lead_atividade` só via trigger SECURITY DEFINER.

Rollback de emergência no servidor: revogar `EXECUTE` de `marcar_reuniao` e `registrar_resultado_reuniao` e **não** promover writes da UI. Desligar a flag sozinha não é rollback de schema.

## D-1 (decisão D-1)

D-1 = **dia civil anterior** à data de `reuniao_em` no fuso `America/Recife`. Não é `reuniao_em − 24 horas` como timestamp e não é a data UTC menos um. Exemplo: `2026-09-22 01:00 UTC` = 21/09 22:00 em Recife → due date `2026-09-20`.

Campos reais: `next_action` / `next_action_due_date`. Nunca `proxima_acao_*`.

## Integração F2 / F3 (sem hard-block)

- F2 ON: a fila Hoje mostra os CTAs. Confirmar só com resultado `pendente` e `reuniao_em` ainda no futuro; **Registrar resultado** quando `reuniao_em` já passou e o resultado está pendente/null. F2 OFF: a fila não aparece; o card no detalhe permanece se F5 ON.
- F3 ON: Confirmar abre o Kit com o seed **Confirmar reunião D-1**. F3 OFF: degrada para `https://wa.me/{numero}` sem template (mesmo fallback da F2).

Ramp da F5 **assume** migrate F1 (status `reuniao_marcada` + stubs) e, para a fila/CTAs, migrate F2. Sem F3 o WhatsApp de confirmação continua via `wa.me`.

## Fluxos de resultado (CA-F5)

| Resultado | Efeito |
|---|---|
| `compareceu` | Permanece `reuniao_marcada`. `next_action` = “Definir próximo passo após reunião”, due = hoje Recife. |
| `no_show` | Permanece `reuniao_marcada`. `next_action` = “Reagendar reunião (no-show)”, due = hoje Recife. |
| `pediu_proposta` | Status → `proposta_enviada`. `next_action` = “Enviar proposta”, due = hoje Recife. |
| `fechou` | Grava resultado e chama `convert_lead_to_client`. Não inventa preço de projeto. |
| `recusou` | Status → `perdido` (motivo obrigatório). |
| `reagendou` | Nova `reuniao_em` obrigatória; resultado volta a `pendente`; D-1 recalculado; `next_action` de confirmação. |

## Ordem de promoção (sem 100%)

1. Aplicar as migrations F1 (e F2 se a fila já estiver no plano) e esta F5 em banco de **teste** (expand-only; sem DROP de tabela/coluna).
2. Rodar `supabase/tests/audit.sql`, `funil-status.sql`, `fila-cadencia.sql`, `kit-whatsapp.sql`, `porteiro-decisor.sql` e `reuniao-1-clique.sql`.
3. Build de produção com a flag **OFF**.
4. Aplicar a migration expand F5 em produção.
5. Ramp da flag em builds seguintes. Não promover 100% nesta entrega.
6. Fora: Google Calendar / Zoom OAuth, cron D-1 no servidor, kanban F6, inventar preços.

A flag **não** aplica a migration. Migration e ramp são passos separados. Sem migrate/promote prod nesta entrega.

## Aceite (CA-F5)

- CA-F5-01: flag `VITE_FF_GLC_REUNIAO` OFF por padrão; OFF oculta UI F5; stub F1 permanece se F1 ON.
- CA-F5-02: colunas `reuniao_local`, `reuniao_resultado` (enum), `reuniao_notas`; stubs F1 `reuniao_em`/`reuniao_link` completados.
- CA-F5-03: modal completo em `reuniao_marcada` (data/hora, link, local, notas); default `pendente`.
- CA-F5-04: ao marcar, `next_action` = “Confirmar reunião no WhatsApp”; due = D-1 civil Recife; atividade `tipo=reuniao`.
- CA-F5-05: D-1 = dia civil anterior a `reuniao_em` em America/Recife.
- CA-F5-06: card “Próxima reunião” com countdown no detalhe (flag ON).
- CA-F5-07: CTA confirmar na fila Hoje; abre Kit D-1 se F3 ON, senão `wa.me`.
- CA-F5-08: CTA “Registrar resultado” quando `reuniao_em` passou e resultado pendente/null.
- CA-F5-09..14: fluxos compareceu / no_show / pediu_proposta / fechou / recusou / reagendou.
- CA-F5-15: expand-only; authz deny-by-default; write-guards GUC respeitados.
- CA-F5-16: sem Google Calendar, Zoom OAuth, cron D-1 server, F6 ou preços inventados.

## Residual conhecido

Sessão SQL que consiga `set_config` de `app.via_reuniao_write` ou `app.via_lead_status_write` ainda pode atualizar campos da reunião (PostgREST não expõe esses GUCs). Atividades continuam sendo escritas pelo trigger SECURITY DEFINER. Sem migrate/promote prod nesta entrega.
