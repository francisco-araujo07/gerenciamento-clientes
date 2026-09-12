# Runbook — Porteiro vs Decisor (F4)

A flag `VITE_FF_GLC_PORTEIRO_DECISOR` (`ff_glc_porteiro_decisor`) gateia a **UI** e o **contrato JS** com as colunas F4. Default **OFF**. Depois que a migration entra no banco, as colunas existem no servidor — desligar a flag **não** apaga nomes, WhatsApps nem `contato_principal`.

## P1-001 — flag OFF ≠ schema optional

A F4 original (PR #6) espalhava `porteiroDecisorLeadFields` em `leadPayload`/`leadUpdatePayload` e filtrava `deleted_at IS NULL` em `listLeads`/`getLead`/cadência **mesmo com a flag OFF**. Deploy do JS **antes** do migrate quebrava list/get/create. **Flag OFF não era deploy seguro pré-migrate.**

Após esta remediação (espelho da F3 / `kitWhatsappLeadFields`):

- Flag OFF: payload, `select`/queries e busca voltam ao pré-F4 — sem `porteiro_*`, `decisor_*`, `contato_principal`, `ultimo_combinado_com_porteiro` e sem depender de `deleted_at`. Compatível com schema **sem** colunas F4.
- Flag ON: inclui esses campos no payload e aplica `deleted_at IS NULL` + busca em porteiro/decisor.

Nunca ligar a flag antes do migrate. `select('*')` continua; o que quebra pré-migrate é **escrever** colunas F4 ou **filtrar/buscar** nelas.

## O que a flag controla

- ON: a UI mostra os 3 blocos Geral/Porteiro/Decisor, o radio “Usar este número no WhatsApp padrão”, o seletor **Para quem?** no modal F3 e o spotlight não bloqueante. O JS envia campos F4 e filtra `deleted_at IS NULL`.
- OFF: esses controles somem. Payload e listagens não tocam colunas F4. O WhatsApp do kit F3 e o fallback da F2 continuam usando `leads.whatsapp` legado.

## O que a flag não controla

- Existência das colunas no banco depois do migrate (`porteiro_nome`, `porteiro_whatsapp`, `decisor_nome`, `decisor_whatsapp`, `decisor_cargo`, `contato_principal`, `ultimo_combinado_com_porteiro` e `deleted_at`).
- Default de `contato_principal` = `geral` no schema.
- Interpolação de `{{porteiro_nome}}`/`{{decisor_nome}}` a partir das colunas quando elas existem (vazio → `—`).

Rollback de emergência no servidor: não promover writes da UI. Desligar a flag sozinha não é rollback de schema. Sem DROP de `whatsapp`/`responsible_name`.

## Modelo (Opção A)

Campos no próprio `leads`. Sem tabela `lead_contato` (Opção B). O bloco Geral mantém `responsible_name` + `whatsapp`.

`contato_principal` aceita `porteiro|decisor|geral`. O radio do formulário grava esse campo. O seletor F3 pergunta “Para quem?” só com número E.164 válido; o default é o `contato_principal` (se o número dele for inválido, cai no primeiro válido).

## deleted_at

A coluna **não existia**. A migration **adiciona** `deleted_at timestamptz` nullable. Com a flag ON, listagens, `getLead` e a fila de cadência filtram `IS NULL`. Com a flag OFF, essas queries **não** mencionam `deleted_at`. A exclusão da UI continua física (`DELETE`). O payload cadastral **nunca** envia `deleted_at`.

## Gate F4 ⇒ F3 (sem hard-block)

O ramp da F4 **assume** a migration da F3 aplicada para o seletor no modal. A UI da F4 **não** bloqueia o boot se a flag da F3 estiver OFF. Sem a F3 ON, o seletor não aparece; o fallback F2 usa o WhatsApp padrão (`contato_principal`) quando a F4 está ON.

## Ordem de promoção (sem 100%)

Ordem correta: **migrate expand F4 → só então deploy do app**. Não inverter.

1. Aplicar as migrations F1, F2, F3 e esta F4 em banco de **teste** (expand-only; sem DROP/RENAME).
2. Rodar `supabase/tests/audit.sql`, `funil-status.sql`, `fila-cadencia.sql`, `kit-whatsapp.sql` e `porteiro-decisor.sql`.
3. Aplicar a migration expand F4 em produção.
4. Só então fazer deploy do app (flag continua **OFF**).
5. Ramp da flag em builds seguintes, com F3 já migrada. Não promover 100% nesta entrega.

Esta remediação torna o JS com flag OFF compatível com schema sem colunas F4 (deploy desta correção não exige migrate). Isso **não** autoriza ligar a flag nem publicar um build com a flag ON antes do migrate.

## Aceite (CA-F4-01..13)

- CA-F4-01: flag OFF por padrão; OFF oculta blocos, radio, seletor e spotlight.
- CA-F4-02: colunas F4 + `deleted_at` existem após o migrate.
- CA-F4-03: `responsible_name` e `whatsapp` permanecem (bloco Geral); sem DROP.
- CA-F4-04: `contato_principal` enum `porteiro|decisor|geral`, default `geral`.
- CA-F4-05: UI Contatos em 3 blocos Geral/Porteiro/Decisor.
- CA-F4-06: radio “Usar este número no WhatsApp padrão”.
- CA-F4-07: F3 pergunta “Para quem?” só com número válido.
- CA-F4-08: default do seletor = `contato_principal`.
- CA-F4-09: `wa.me` com E.164 do escolhido.
- CA-F4-10: `{{porteiro_nome}}`/`{{decisor_nome}}` das colunas F4.
- CA-F4-11: CSV com colunas opcionais `porteiro_*`/`decisor_*`.
- CA-F4-12: expand-only; sem Opção B; `deleted_at` nullable; filtro `IS NULL` só com flag ON.
- CA-F4-13: spotlight não bloqueante em `contato_porteiro`/`falando_decisor` sem nome.
- P1-001: flag OFF → payload sem campos F4 e queries sem `deleted_at`; flag ON → inclui.

## Residual conhecido

`deleted_at` é reserva para soft-filter; a UI ainda exclui de verdade. Sem migrate/promote prod nesta entrega.
