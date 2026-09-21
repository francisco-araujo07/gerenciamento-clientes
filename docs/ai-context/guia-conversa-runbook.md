# Runbook — Guia de conversa (F11)

A flag `VITE_FF_GLC_GUIA_CONVERSA` (`ff_glc_guia_conversa`) gateia **somente a UI**. Default **OFF**. Não há migration. O conteúdo do WhatsApp é estático no frontend; desligar a flag volta o chrome legado **Guia de ligação** e esconde a tab WhatsApp.

## O que a flag controla

- ON: menu, título, breadcrumb e `document.title` passam a **Guia de conversa**. Tabs `Ligação | WhatsApp` (default WhatsApp). Rota canônica `/guia-conversa`. Seletor de lead (`?leadId=`), interpolação, copiar e “Usar este texto no lead aberto” (este último só se a F3 também estiver ON).
- OFF: chrome **Guia de ligação**, sem tab WhatsApp nova. A árvore legada de ligação permanece. `/guia-ligacao` e `/guia-conversa` ainda abrem a página autenticada, sem apagar a rota antiga.

## O que a flag não controla

- Schema, RPC, `wa_templates` ou os 5 corpos F3. Esta entrega **não** atualiza seeds do Kit.
- Auto-aplicar status ou cadência. O Guia só sugere `status` (código + rótulo F1), `next_action` e `next_action_due_date`. Nunca `proxima_acao_*`.
- WhatsApp Business API / Cloud API / envio server-side.
- F5/F6: a reunião F5 tem runbook próprio (`reuniao-1-clique-runbook.md`); F6 (kanban) permanece fora. Tab Ligação não ganha roteiro de cold call novo.

## Rotas

| Path | Flag ON | Flag OFF |
|---|---|---|
| `/guia-conversa` | Guia de conversa, tab WhatsApp (ou `?tab=ligacao`) | Chrome legado, só Ligação |
| `/guia-ligacao` | Redirect (replaceState) para `/guia-conversa` | Chrome legado, só Ligação |
| `?leadId=` | Interpola o lead e habilita o modal F3 | Ignorado na tab (inexistente) |

SPA: `public/_redirects` devolve `index.html` nesses paths. Auth igual ao resto do app.

## Conteúdo WhatsApp

Fonte canônica: brief PRIMARY *GLC — Estilo de venda MF Softwares*. Copy da tab WhatsApp em `src/features/guide/guia-conversa-data.ts` (`guiaConversaSays`, princípios §1.1/1.2, funil §1.3) deve bater letra a letra com esse brief. **Não** copiar corpos dos seeds F3 nem o playbook legado de ligação.

Seis etapas: Preparação; Mensagem ao porteiro (abertura + variante gatilho); Reações A–F; Decisor responde (§3.1); Pedir reunião (§3.2–3.6); Pós/cadência (§3.7 D-1, T3, break-up T4, §3.8 GLC).

Chips F3 **somente** nestes 5 nós (1 chip por seed; ramos extras só no Guia):

| Chip F3 | Nó |
|---|---|
| Primeira abordagem (porteiro) | abertura `mensagem-porteiro` |
| Follow-up D+3 | ramo F `reacao-f` |
| Break-up | `pos-breakup` T4 |
| Decisor respondeu — pedir 2 horários | `decisor-responde` §3.1 |
| Confirmar reunião D-1 | `pos-confirmar-d1` §3.7 |

Variáveis: as da F3 + `horario_1` / `horario_2` (default `amanhã 10h` / `amanhã 16h`), `nome` (`decisor_nome` → `porteiro_nome` → `responsavel`), `hora` (de `reuniao_em`) e `reuniao_link`. Blocos `{{#se campo}}…{{/se}}` somem se o valor estiver vazio ou `—`.

Microcopy de anexar print igual ao Kit. Princípios §1.1/1.2/1.3 em `<details>` colapsável. Zero strings R$ / faixa numérica de pacote (§3.3). Checklist GLC usa `next_action` e `next_action_due_date` (nunca persistir nomes de campo do playbook legado). Ramo A: due date **D+3** + follow-up se silêncio. Ramo B: duas falas (canal/nome, depois obrigado). Ramo C “Se não”: `perdido` + `sem_decisor`; `pausado_60d` só se timing.

## Gate F11 ⇒ F3 / F2 (sem hard-block)

- “Usar este texto no lead aberto” abre o modal F3 com `texto_final` do Guia **só** se F3 ON e houver lead. Sem isso, o botão some; copiar continua.
- Link para a fila Hoje só se F2 ON (`/hoje`, empty/help `#hoje-empty-help`).
- Ramp da F11 **não** exige F1–F4 ligadas. Sem F3, o Guia ainda mostra as falas.

## Ordem de promoção (sem 100%)

1. Não há migrate. Não promover schema.
2. Build de produção com a flag **OFF**.
3. Francisco valida o wording do brief na tab WhatsApp (flag ON só em Preview/teste).
4. Ramp da flag em builds seguintes. Não promover 100% nesta entrega.
5. Findings **antes** do merge. Não mergear esta PR automaticamente.

## Aceite (Must)

- Flag OFF por padrão; OFF = chrome legado, sem tab WhatsApp.
- Rename ON: Guia de conversa (menu, título, breadcrumb, document title).
- Tabs Ligação | WhatsApp; default WhatsApp; Ligação = legado.
- 6 etapas; cada fala com “O que dizer” + “O que fazer no GLC”.
- Sem R$ de pacote; sem `proxima_acao_*`; sem atualizar `wa_templates`.
- Auth igual ao app. Expand-only (aqui: só frontend). Sem secrets.

## Residual conhecido

P1-001..007 da review da copy (PR #9) fechados: `ramoCNao` sem prefixo “Se não:”; Ramo B em dois nós; §1.1 com aspas `“site”.`, exemplos de gatilho, “com atendente” e “quando for pedir call”; títulos A–F da SPEC; `{{nome}}` = decisor → porteiro → responsável; Ramo C “Se não” = `perdido`+`sem_decisor` (`pausado_60d` só se timing); Ramo A due date D+3.

Ainda aberto: Francisco valida o wording com a flag ON em Preview/teste antes do ramp. Corpos `wa_templates` F3 permanecem os seeds SPEC (não atualizados nesta entrega). Sem claim de residual zero de copy — o brief PRIMARY completo não está versionado neste repo.
