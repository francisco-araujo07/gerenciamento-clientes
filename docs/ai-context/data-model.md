# Modelo de dados

## Entidades confirmadas

- **Usuário:** pessoa da equipe com login próprio.
- **Lead:** empresa ainda em processo comercial, com contatos, origem, status, próxima ação e resumo/anotações. Com o funil F1 (flag OFF por padrão) o status canônico passa a incluir cadência, reunião, proposta, pausa e perda com motivo; `negociacao` permanece como legado. Stubs: `motivo_perda`, `motivo_perda_detalhe`, `reuniao_em`, `reuniao_link`.
- **Histórico de status:** `lead_status_history` registra from→to, data, autor e nota. Autenticados leem e inserem; sem UPDATE/DELETE público.
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
