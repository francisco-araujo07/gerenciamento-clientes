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
2. Rodar `supabase/tests/audit.sql`, `funil-status.sql`, `fila-cadencia.sql` e `kit-whatsapp.sql`.
3. Build de produção com a flag **OFF**.
4. Aplicar a migration em produção.
5. Francisco valida o wording dos 5 seeds antes do ramp.
6. Ramp da flag em builds seguintes, com F2 já migrada. Não promover 100% nesta entrega.

## Templates

- Etapas: `abertura`, `follow_up`, `case_nicho`, `break_up`, `prototipo`.
- Sugestão no modal: status do lead → etapa (ex.: `novo`→abertura, `contato_porteiro`→follow_up, `encaminhado`→case_nicho, `falando_decisor`/`reuniao_marcada`/`proposta_enviada`→prototipo).
- Prévia editável **não** grava o template. Inativos aparecem só na config.
- Número: sempre `leads.whatsapp` principal, normalizado E.164 BR.
- `{{porteiro_nome}}` e `{{decisor_nome}}` resolvem para `—` (UI de porteiro/decisor é F4).

## Residual conhecido

`wa_ultimo_template_id` é gravado por UPDATE autenticado no lead (não passa pelo motor F2). Status e cadência continuam guardados pelos GUCs da F1/F2.
