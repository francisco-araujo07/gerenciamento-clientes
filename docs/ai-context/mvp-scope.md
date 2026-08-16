# Escopo do MVP

## Incluído

- Dashboard inicial com faturamento atual e filtros semanal, mensal e total.
- Tabela de controle de leads.
- Tabela de controle de clientes, separada da tabela de leads.
- Filtro por situação na tabela de clientes.
- Registro de preço, prazo de serviço e situação atual para cada cliente.

## Regra de faturamento

O dashboard calcula o faturamento pela soma dos preços dos projetos marcados como `Concluído`. Os filtros de período usam a data em que o projeto foi marcado como concluído.

## Colunas da tabela de leads

- Empresa
- Responsável
- WhatsApp
- E-mail
- Instagram
- Endereço e link do Google Maps
- Segmento
- Origem do lead
- Status
- Resumo e anotações
- Próxima ação e data prevista

## Dados na página de detalhes do cliente

- Empresa
- Responsável
- WhatsApp
- E-mail
- Instagram
- Endereço e link do Google Maps
- Segmento
- Resumo e anotações
- Nome do projeto
- Preço
- Prazo
- Situação do serviço
- Data de conclusão

## Ações nas tabelas

- Cadastrar, editar e excluir leads e clientes manualmente.
- Solicitar confirmação antes de excluir um registro.
- Buscar por empresa ou responsável.
- Ordenar leads pela data da próxima ação.
- Filtrar leads com próxima ação atrasada.
- Usar exclusão definitiva somente para registros criados por engano.

## Importação de leads por CSV

1. Disponibilizar um modelo de arquivo CSV com as colunas aceitas.
2. Permitir enviar um CSV com leads aprovados manualmente pela equipe.
3. Mostrar uma prévia antes de importar os dados.
4. Validar campos obrigatórios e sinalizar possíveis duplicados por WhatsApp, e-mail ou empresa.
5. Incluir os leads no banco somente após confirmação manual.

A IA não terá acesso direto ao banco de dados no MVP; ela gera o arquivo estruturado para a importação.

## Navegação e detalhes

- Oferecer as áreas principais: Dashboard, Leads e Clientes.
- Abrir uma página de detalhes ao selecionar uma linha da tabela.
- Exibir na página de detalhes os contatos, o resumo/anotações e as ações disponíveis para o registro.

## Organização visual do MVP

- Dashboard inicial: faturamento atual com filtros semanal, mensal e total, além de acessos para Leads e Clientes.
- Tabela de leads: Empresa, Responsável, WhatsApp, Status, Próxima ação e Ações.
- Tabela de clientes: Empresa, Responsável, Resumo dos projetos e Ações.
- Exibir projetos, preço, prazo e situação na página de detalhes de cada cliente.
- Exibir os demais dados somente na página de detalhes de cada registro.

## Situações do projeto

- Aguardando início
- Em desenvolvimento
- Pausado
- Concluído
- Abandonado

## Regras para leads

- O funil de leads será: `Novo` → `Negociação` → `Convertido` ou `Perdido`.
- Ao converter um lead, criar o cliente correspondente e preservar os dados e anotações do lead.
- Leads convertidos não aparecem na visualização padrão da tabela de leads.
- Leads perdidos permanecem registrados, mas não aparecem na visualização padrão; podem ser consultados e filtrados quando necessário.

## Fora do MVP

- Automação de mensagens iniciais.
- Contratos formais.
