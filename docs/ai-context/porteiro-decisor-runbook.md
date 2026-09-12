# Runbook — Porteiro vs Decisor (F4)

A flag `VITE_FF_GLC_PORTEIRO_DECISOR` (`ff_glc_porteiro_decisor`) gateia **somente a UI**. Depois que a migration desta feature entra no banco, as colunas existem no servidor — ligar ou desligar a flag **não** apaga nomes, WhatsApps nem `contato_principal`.

## O que a flag controla

- ON: a UI mostra os 3 blocos Geral/Porteiro/Decisor, o radio “Usar este número no WhatsApp padrão”, o seletor **Para quem?** no modal F3 e o spotlight não bloqueante.
- OFF: esses controles somem. O WhatsApp do kit F3 e o fallback da F2 continuam usando `leads.whatsapp` legado.

## O que a flag não controla

- Existência das colunas `porteiro_nome`, `porteiro_whatsapp`, `decisor_nome`, `decisor_whatsapp`, `decisor_cargo`, `contato_principal`, `ultimo_combinado_com_porteiro` e `deleted_at`.
- Default de `contato_principal` = `geral`.
- Filtro `deleted_at IS NULL` nas listagens.
- Interpolação de `{{porteiro_nome}}`/`{{decisor_nome}}` a partir das colunas (vazio → `—`).

Rollback de emergência no servidor: não promover writes da UI. Desligar a flag sozinha não é rollback de schema. Sem DROP de `whatsapp`/`responsible_name`.

## Modelo (Opção A)

Campos no próprio `leads`. Sem tabela `lead_contato` (Opção B). O bloco Geral mantém `responsible_name` + `whatsapp`.

`contato_principal` aceita `porteiro|decisor|geral`. O radio do formulário grava esse campo. O seletor F3 pergunta “Para quem?” só com número E.164 válido; o default é o `contato_principal` (se o número dele for inválido, cai no primeiro válido).

## deleted_at

A coluna **não existia**. A migration **adiciona** `deleted_at timestamptz` nullable. Listagens e `getLead` filtram `IS NULL`. A exclusão da UI continua física (`DELETE`). O payload cadastral **não** envia `deleted_at`.

## Gate F4 ⇒ F3 (sem hard-block)

O ramp da F4 **assume** a migration da F3 aplicada para o seletor no modal. A UI da F4 **não** bloqueia o boot se a flag da F3 estiver OFF. Sem a F3 ON, o seletor não aparece; o fallback F2 usa o WhatsApp padrão (`contato_principal`) quando a F4 está ON.

## Ordem de promoção (sem 100%)

1. Aplicar as migrations F1, F2, F3 e esta F4 em banco de **teste** (expand-only; sem DROP/RENAME).
2. Rodar `supabase/tests/audit.sql`, `funil-status.sql`, `fila-cadencia.sql`, `kit-whatsapp.sql` e `porteiro-decisor.sql`.
3. Build de produção com a flag **OFF**.
4. Aplicar a migration em produção.
5. Ramp da flag em builds seguintes, com F3 já migrada. Não promover 100% nesta entrega.

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
- CA-F4-12: expand-only; sem Opção B; `deleted_at` nullable + filtro `IS NULL`.
- CA-F4-13: spotlight não bloqueante em `contato_porteiro`/`falando_decisor` sem nome.

## Residual conhecido

`deleted_at` é reserva para soft-filter; a UI ainda exclui de verdade. Sem migrate/promote prod nesta entrega.
