# Runbook — Kit WhatsApp (F3)

A flag `VITE_FF_GLC_KIT_WHATSAPP` (`ff_glc_kit_whatsapp`) gateia **somente a UI**. Depois que a migration deste kit entra no banco, as colunas `gatilho`, `prototipo_url`, `prototipo_notas`, `wa_ultimo_template_id` e a tabela `wa_templates` existem no servidor — ligar ou desligar a flag **não** apaga templates nem colunas.

## O que a flag controla

- ON: a UI mostra o botão **Abrir WhatsApp** com modal (detalhe do lead e fila Hoje), a página **Templates WA** e os campos de gatilho/protótipo no formulário.
- OFF: esses controles somem. Se a F2 estiver ON, o fallback continua sendo `https://wa.me/{numero}` **sem** template.

## O que a flag não controla

- Existência de `wa_templates` e das colunas do lead.
- Seeds dos 5 templates.
- RLS e o motor F2 (`registrar_cadencia`). “Considerar como Toquei?” chama o motor existente; a flag do kit não liga nem desliga a cadência.

Rollback de emergência no servidor: revogar `INSERT`/`UPDATE` de `wa_templates` e **não** promover writes da UI. Desligar a flag sozinha não é rollback de schema.

## Envio

Somente `https://wa.me/{e164}?text=...` no cliente. Não há WhatsApp Business API, BSP, Cloud API nem envio server-side. A flag **não** escolhe outro canal.

## Gate F3 ⇒ F2 (sem hard-block)

O ramp da F3 **assume** a migration da F2 aplicada: o Sim de “Considerar como Toquei?” chama `registrar_cadencia`. A UI da F3 **não** bloqueia o boot se a flag da F2 estiver OFF. Sem a migration da F2, o registro do toque falha no servidor.

## Ordem de promoção (sem 100%)

1. Aplicar as migrations F1, F2 e esta F3 em banco de **teste** (expand-only; sem DROP/RENAME).
2. Rodar `supabase/tests/audit.sql`, `funil-status.sql`, `fila-cadencia.sql`, `kit-whatsapp.sql` e `porteiro-decisor.sql` (este último só depois da migration F4).
3. Build de produção com a flag **OFF**.
4. Aplicar a migration em produção.
5. Francisco valida o wording dos 5 seeds antes do ramp.
6. Ramp da flag em builds seguintes, com F2 já migrada. Não promover 100% nesta entrega.

## Templates (CA-F3-02)

| Seed | Etapa |
|---|---|
| Primeira abordagem (porteiro) | `contato_porteiro` (também sugerido em `novo`) |
| Follow-up D+3 | `qualquer` (padrão quando não há seed específico) |
| Break-up | `qualquer` (disponível no select; não é o default) |
| Decisor respondeu — pedir 2 horários | `falando_decisor` |
| Confirmar reunião D-1 | `reuniao_marcada` |

- `etapa` aceita status F1 ativos + `qualquer`. Não replica Case/nicho nem Protótipo.
- Prévia editável **não** grava o template. Inativos aparecem só na config.
- Sem F4: número sempre `leads.whatsapp` principal, normalizado E.164 BR (`00` internacional é removido). `{{porteiro_nome}}`/`{{decisor_nome}}` → `—` se as colunas estiverem vazias.
- Com F4 ON: o modal pergunta “Para quem?” (Porteiro/Decisor/Principal) só com número válido; default = `contato_principal`; `wa.me` usa o E.164 do escolhido; as variáveis vêm das colunas F4.

## Residual conhecido

`wa_ultimo_template_id` é gravado por UPDATE autenticado no lead (não passa pelo motor F2). Status e cadência continuam guardados pelos GUCs da F1/F2.

P2 não feitos nesta remediação: preview persistido, badge/cron, escolha automática Break-up por toque. A UI F4 está no runbook `porteiro-decisor-runbook.md`.

## Cloudflare Pages (check vermelho nas PRs)

**Pré-existente em `main`** (hard-fail no `vite.config` desde `153adab`, 10/09). A F3 **não** introduziu o check. Não bloqueia Qualidade.

- Causa do Preview da #5: `vite build` chamava `publicConfig()` e abortava sem `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Essas vars não estão no escopo Preview do Pages.
- Preferência: Francisco adiciona as duas vars em **Production e Preview** no dashboard (Supabase de teste no Preview; nunca `service_role`). Sem secrets no repo.
- Degradação desta PR: se **as duas** faltam, o build não aborta. Runtime continua validando (`supabase` = null → tela “Conecte o Supabase”). Par incompleto ou chave privilegiada **ainda** aborta o build.
- Preview sem vars no painel sobe, mas não é app funcional. Qualidade continua injetando fixtures. Checklist: `docs/operacao.md`. Flags OFF. Sem migrate/promote.
