# Modelo de dados

## Entidades confirmadas

- **Usuário:** pessoa da equipe com login próprio.
- **Lead:** empresa ainda em processo comercial, com contatos, origem, status, próxima ação e resumo/anotações. Com o funil F1 o status canônico passa a incluir cadência, reunião, proposta, pausa e perda com motivo; `negociacao` permanece como legado (sem create e sem transição *para* esse valor). Stubs: `motivo_perda`, `motivo_perda_detalhe`, `reuniao_em`, `reuniao_link`. A flag Vite não altera o schema. Mudança de `status` só pelas RPCs; trigger impõe `perdido`⇒motivo e `reuniao_marcada`⇒`reuniao_em` também no INSERT.
- **Histórico de status:** `lead_status_history` registra from→to, data, autor e nota. Autenticados só leem; INSERT fica no trigger SECURITY DEFINER das RPCs. Sem UPDATE/DELETE público. CHECKs dos stubs permanecem `NOT VALID` até uma janela VALIDATE futura.
- **Cadência:** `touches_sem_resposta` (default 0) no lead; `lead_atividade` (tipo `toque|resposta|reagendar`, resultado `toquei|respondeu|sem_resposta|reagendado`); `cadencia_config` global com offsets `[3,4,6]`, máximo 4 e pausa 60d. Autenticados leem atividades e config; INSERT de atividade só via trigger da RPC; sem UPDATE/DELETE público. `touches_sem_resposta` só muda com GUC `app.via_cadencia_write`.
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
