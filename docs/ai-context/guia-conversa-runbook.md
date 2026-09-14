# Runbook — Guia de conversa (F11)

A flag `VITE_FF_GLC_GUIA_CONVERSA` (`ff_glc_guia_conversa`) gateia **somente a UI**. Default **OFF**. Não há migration. O conteúdo do WhatsApp é estático no frontend; desligar a flag volta o chrome legado **Guia de ligação** e esconde a tab WhatsApp.

## O que a flag controla

- ON: menu, título, breadcrumb e `document.title` passam a **Guia de conversa**. Tabs `Ligação | WhatsApp` (default WhatsApp). Rota canônica `/guia-conversa`. Seletor de lead (`?leadId=`), interpolação, copiar e “Usar este texto no lead aberto” (este último só se a F3 também estiver ON).
- OFF: chrome **Guia de ligação**, sem tab WhatsApp nova. A árvore legada de ligação permanece. `/guia-ligacao` e `/guia-conversa` ainda abrem a página autenticada, sem apagar a rota antiga.

## O que a flag não controla

- Schema, RPC, `wa_templates` ou os 5 corpos F3. Esta entrega **não** atualiza seeds do Kit.
- Auto-aplicar status ou cadência. O Guia só sugere `status` (código + rótulo F1), `next_action` e `next_action_due_date`. Nunca `proxima_acao_*`.
- WhatsApp Business API / Cloud API / envio server-side.
- F5/F6 (pausadas). Tab Ligação não ganha roteiro de cold call novo.

## Rotas

| Path | Flag ON | Flag OFF |
|---|---|---|
| `/guia-conversa` | Guia de conversa, tab WhatsApp (ou `?tab=ligacao`) | Chrome legado, só Ligação |
| `/guia-ligacao` | Redirect (replaceState) para `/guia-conversa` | Chrome legado, só Ligação |
| `?leadId=` | Interpola o lead e habilita o modal F3 | Ignorado na tab (inexistente) |

SPA: `public/_redirects` devolve `index.html` nesses paths. Auth igual ao resto do app.

## Conteúdo WhatsApp

Seis etapas versionadas em `src/features/guide/guia-conversa-data.ts`: Preparação; Mensagem ao porteiro; Reações A–F; Decisor responde; Pedir reunião; Pós/cadência.

Chips F3 só nos mapeamentos dos 5 seeds (primeira abordagem, follow-up D+3, break-up, decisor 2 horários, confirmar D-1). Ramos extras (A–F, case/nicho, 4º toque) existem só no Guia.

Variáveis: as da F3 + `horario_1` / `horario_2` (default amanhã 10h/16h em America/Recife). Blocos `{{#se campo}}…{{/se}}` somem se o valor estiver vazio ou `—`.

Microcopy de anexar print igual ao Kit. Princípios em `<details>` colapsável. Zero strings R$ de pacote.

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

O brief PRIMARY (`GLC-estilo-venda-guia-conversa.md`) não estava no checkout deste agente; os 5 corpos F3 foram copiados à letra e os ramos extras seguem o playbook já versionado na tab Ligação + funil F1/F2, sem inventar preço. Francisco deve confrontar a tab WhatsApp com o brief antes do ramp.
