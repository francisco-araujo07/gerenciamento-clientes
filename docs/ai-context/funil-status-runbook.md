# Runbook — Funil de status (F1)

A flag `VITE_FF_GLC_FUNIL_STATUS` (`ff_glc_funil_status`) gateia **somente a UI**. Depois que as migrations deste funil entram no banco, enum, colunas, RPC, triggers e histórico existem no servidor — ligar ou desligar a flag **não** desliga a RPC nem as invariantes.

## O que a flag controla

- ON: a UI mostra o funil canônico, o select de status no detalhe e chama `update_lead_status`.
- OFF: a UI não chama a RPC de funil; edição cadastral não envia `status`. Create autenticado no servidor só aceita a lista de criação (`novo`, `contato_porteiro`, `encaminhado`, `falando_decisor`, `proposta_enviada`).

## O que a flag não controla

- Existência de `update_lead_status` / `convert_lead_to_client`.
- Trigger `enforce_lead_status_rules` (perdido⇒motivo, reunião⇒data, create allowlist, UPDATE de `status` só com GUC `app.via_lead_status_write`).
- Histórico gravado pelo trigger `write_lead_status_history_row` (sem INSERT direto de `authenticated`).

Rollback de emergência no servidor: revogar `EXECUTE` das RPCs e **não** promover writes da UI. Desligar a flag sozinha não é rollback de schema.

## Ordem de promoção (sem 100%)

1. Aplicar as migrations em banco de **teste** (expand-only; sem DROP/RENAME).
2. Rodar `supabase/tests/audit.sql` e `supabase/tests/funil-status.sql` (inclui bypass de UPDATE/INSERT).
3. Build de produção com a flag **OFF**.
4. Aplicar as migrations em produção.
5. Ramp da flag em builds seguintes. Não promover 100% nesta entrega.
6. F2/F3 ficam fora.

## Plano VALIDATE (P2-002)

Os CHECKs `leads_motivo_perda_enum` e `leads_funil_input_limits` permanecem `NOT VALID`. Não rodar `VALIDATE CONSTRAINT` agora: o trigger já fecha o write path de status. VALIDATE só depois de inventariar linhas existentes e corrigir stubs inválidos, em janela própria.

## Residual conhecido

Sessão SQL que consiga `set_config('app.via_lead_status_write', 'on', true)` ainda pode atualizar `status` (PostgREST não expõe esse GUC). Histórico continua sendo escrito pelo trigger SECURITY DEFINER.
