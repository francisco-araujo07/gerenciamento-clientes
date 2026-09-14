# Modelo de dados

## Entidades confirmadas

- **Usuário:** pessoa da equipe com login próprio.
- **Lead:** empresa ainda em processo comercial, com contatos, origem, status, próxima ação e resumo/anotações. Com o funil F1 o status canônico passa a incluir cadência, reunião, proposta, pausa e perda com motivo; `negociacao` permanece como legado (sem create e sem transição *para* esse valor). Stubs: `motivo_perda`, `motivo_perda_detalhe`, `reuniao_em`, `reuniao_link`. A flag Vite não altera o schema. Mudança de `status` só pelas RPCs; trigger impõe `perdido`⇒motivo e `reuniao_marcada`⇒`reuniao_em` também no INSERT.
- **Histórico de status:** `lead_status_history` registra from→to, data, autor e nota. Autenticados só leem; INSERT fica no trigger SECURITY DEFINER das RPCs. Sem UPDATE/DELETE público. CHECKs dos stubs permanecem `NOT VALID` até uma janela VALIDATE futura.
- **Cadência:** `touches_sem_resposta` (default 0) no lead; `lead_atividade` (tipo `toque|resposta|reagendar`, resultado `toquei|respondeu|sem_resposta|reagendado`, canal `whatsapp|ligacao|outro`); `cadencia_config` global com offsets `[3,4,6]`, máximo 4 e pausa 60d. Autenticados leem atividades e config; INSERT de atividade só via trigger da RPC; sem UPDATE/DELETE público. `touches_sem_resposta`, `next_action` e `next_action_due_date` só mudam com GUC de cadência ou de status (F1). `respondeu` zera toques e anula a due date. Mapeamento RPC→atividade: `toquei`/`sem_resposta` → tipo `toque`; `respondeu` → tipo `resposta`; `reagendar` → tipo `reagendar` + resultado `reagendado`.
- **Kit WhatsApp:** colunas do lead `gatilho` (≤280), `prototipo_url`, `prototipo_notas` e `wa_ultimo_template_id` (FK para `wa_templates`, ON DELETE SET NULL). Tabela `wa_templates` (`nome`, `etapa`, `corpo`, `ativo`) com RLS: autenticados SELECT/INSERT/UPDATE; sem DELETE público. Etapa: status F1 ativo ou `qualquer`. Seeds SPEC: primeira abordagem (porteiro), follow-up D+3, break-up, decisor 2 horários, confirmar reunião D-1. A flag Vite não altera o schema. O envio não passa pelo banco: só monta `https://wa.me/{e164}?text=`. Com F4, `{{porteiro_nome}}`/`{{decisor_nome}}` vêm das colunas do lead.
- **Porteiro vs decisor:** Opção A no próprio lead — `porteiro_nome`, `porteiro_whatsapp`, `decisor_nome`, `decisor_whatsapp`, `decisor_cargo` (opcional), `contato_principal` (`porteiro|decisor|geral`, default `geral`), `ultimo_combinado_com_porteiro`. `responsible_name` e `whatsapp` permanecem no bloco Geral. Sem tabela `lead_contato`. `deleted_at` nullable. O JS só escreve campos F4 e filtra `deleted_at IS NULL` com a flag ON; a flag Vite não cria nem apaga o schema.
- **Guia de conversa:** conteúdo estático no frontend (6 etapas WhatsApp + árvore legada de ligação). A flag Vite só troca o chrome e mostra a tab WhatsApp; não cria tabela nem altera `wa_templates`.
- **Cliente:** empresa convertida de um lead, com contatos e resumo/anotações preservados.
- **Projeto:** serviço contratado por um cliente, com nome, preço, prazo, situação e data de conclusão.

## Relações

- Um lead convertido gera um cliente e preserva seus dados e anotações.
- Um cliente pode ter um ou mais projetos.
- Cada projeto pertence a um único cliente.

## Regras dos dados

- A próxima ação terá descrição e data prevista.
- A origem do lead será registrada, como Google, Instagram ou indicação.
- O CSV sinalizará possíveis duplicados por WhatsApp, e-mail ou empresa para revisão manual.

## Organização da tabela de clientes

- Mostrar uma linha por cliente.
- Exibir empresa, responsável e um resumo dos projetos na tabela.
- Exibir projetos, preço, prazo e situação na página de detalhes do cliente.
