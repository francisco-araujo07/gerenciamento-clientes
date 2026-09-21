# Runbook — Mini-kanban do funil (F6)

A flag `VITE_FF_GLC_MINI_KANBAN` (`ff_glc_mini_kanban`) gateia **somente a UI**. Default **OFF**. Não há migration. O board lê os leads já carregados na aba Leads e muda status pelas RPCs existentes da F1/F5.

## O que a flag controla

- ON: na aba Leads aparecem as visões `Tabela | Kanban`. O board mostra colunas dos status ativos (`novo`, `contato_porteiro`, `encaminhado`, `falando_decisor`, `reuniao_marcada`, `proposta_enviada`) e `negociacao` só se o count filtrado for > 0.
- OFF: a aba Kanban não existe; a lista permanece só tabela, como antes da F6.

## O que a flag não controla

- Schema, RPCs, triggers ou histórico. DnD chama `update_lead_status` (e `marcar_reuniao` se F5 ON ao ir para `reuniao_marcada`).
- Filtros da lista (busca, status, atrasadas): o kanban recebe o mesmo `visibleLeads`.
- Existência de `convertido` / `perdido` / `pausado_60d` no funil — esses status **não** viram coluna no board v1.

Rollback de emergência: desligar a flag e **não** promover um build com ela ligada. Não há schema para reverter.

## Colunas e cards

- Sem coluna `convertido`. Perdido e pausado também ficam fora do board.
- `negociacao` (legado) some quando count=0 entre os leads filtrados; não é destino de drop (a matriz F1 rejeita).
- Card: empresa, segmento, `next_action` truncada, `next_action_due_date` (badge vermelho se atrasada no dia civil `America/Recife`), `touches_sem_resposta`, inicial do porteiro/decisor (F4 ON) ou do responsável.
- Até 30 cards por coluna, com **Carregar mais**.

## DnD e modais F1/F5

- Soltar em outra coluna avalia a mesma matriz de transição da F1.
- Típico sem extras (ex.: `novo` → `contato_porteiro`): RPC na hora.
- Reunião, encaminhado, perdido, pausado ou atípico: o mesmo `LeadStatusTransitionDialog` da F1/F5. Cancelar o modal devolve o card à coluna de origem.
- Se a RPC/`updateLeadStatus` falhar **depois** do confirm (ou no apply típico), o overlay otimista é descartado e o card volta à coluna/status originais. O erro sobe no `form-error` da página (`role="alert"`). P1-001 da PR #12 fechado.
- Destino `negociacao` ou `convertido`: recusado, card não muda.

Ramp da F6 **assume** F1 ligada depois do migrate do funil. Sem hard-block se F1 estiver OFF — o legado da tabela continua. F5 ON completa o modal de reunião; F5 OFF usa o stub F1 (data/hora + link). F4 ON troca a inicial do card.

## Ordem de promoção (sem 100%)

1. Confirmar F1 (e, se o modal completo de reunião importar, F5) já migradas em banco de **teste**.
2. Build de produção com a flag **OFF**.
3. Ramp da flag em builds seguintes. Não promover 100% nesta entrega.
4. Fora: WIP limits, swimlanes, convertidos no board, CMS, nova migration.

A flag **não** aplica migration. Sem migrate/promote prod nesta entrega. Expand-only (não há DROP porque não há SQL novo).

## Aceite (CA-F6)

- CA-F6-01: flag `VITE_FF_GLC_MINI_KANBAN` OFF por padrão; OFF oculta a aba Kanban.
- CA-F6-02: visões `Tabela | Kanban` na aba Leads com a flag ON.
- CA-F6-03: colunas ativas canônicas + `negociacao` só se count>0; sem `convertido`.
- CA-F6-04: card com empresa, segmento, próxima ação truncada, due date, toques e inicial.
- CA-F6-05: filtros da lista aplicam no kanban.
- CA-F6-06: atrasada = `next_action_due_date` < dia civil em America/Recife.
- CA-F6-07: DnD usa API/modais F1/F5; cancelar modal → card volta.
- CA-F6-08: máx 30 cards/coluna + carregar mais.
- CA-F6-09: expand-only; sem DROP; sem secrets; sem WIP/swimlanes/CMS.
- P1-001: erro pós-confirm da RPC reverte o overlay; toast/erro na página; card não fica na coluna destino.

## Residual conhecido (P2, não bloqueia)

- O filtro “Apenas atrasadas” da lista continua usando a data local do navegador (`filterLeads`); só o badge do card do kanban usa Recife.
- O arraste começa no corpo do card; o link da empresa continua sendo clique para abrir o lead (não inicia DnD).

Sem migrate/promote prod nesta entrega. Flag default OFF.
