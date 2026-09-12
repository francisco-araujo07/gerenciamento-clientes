# Decisões confirmadas

| Decisão | Detalhe |
|---|---|
| Objetivo do sistema | Aumentar controle, escala e velocidade da aquisição de clientes. |
| Entrada de leads | IA pesquisa; a equipe aprova manualmente; IA cadastra apenas os aprovados. |
| Estrutura principal | Dashboard, tabela de leads e tabela de clientes. |
| Clientes | Clientes ficam em tabela própria; projetos vinculados concentram prazo, preço e situação do serviço. |
| Faturamento | Somar somente projetos concluídos, usando a data de conclusão para os filtros. |
| Situações do projeto | Aguardando início, Em desenvolvimento, Pausado, Concluído e Abandonado. |
| Filtro de clientes | Permitir filtrar a tabela pela situação do projeto. |
| Funil de leads | MVP legado: Novo, Negociação, Convertido e Perdido. F1 (flag `ff_glc_funil_status` / `VITE_FF_GLC_FUNIL_STATUS`, default OFF): funil canônico `novo`, `contato_porteiro`, `encaminhado`, `falando_decisor`, `reuniao_marcada`, `proposta_enviada`, `convertido`, `perdido`, `pausado_60d`, mais legado `negociacao` para revisão manual. Sem auto-map de `negociacao` → `falando_decisor`. Sem coluna `status_v2`. |
| Conversão de lead | Criar cliente correspondente e preservar os dados e anotações do lead. |
| Visualização padrão de leads | Ocultar leads convertidos e perdidos, mantendo-os disponíveis para filtros e consulta. |
| Dados dos leads | Empresa, responsável, contatos, endereço/Google Maps, segmento, status, resumo/anotações e próxima ação. |
| Dados dos clientes | Dados de contato do lead, resumo/anotações, projeto, preço, prazo, situação do serviço e data de conclusão. |
| Ações manuais | Permitir cadastrar, editar e excluir leads e clientes, com confirmação antes da exclusão. |
| Exclusão definitiva | Usar somente para registros criados por engano; usar status para registros encerrados. |
| Busca rápida | Permitir busca por empresa ou responsável. |
| Próxima ação | Registrar descrição e data prevista; priorizar registros atrasados. |
| Origem do lead | Registrar a origem, como Google, Instagram ou indicação. |
| Importação de leads | Importar CSV de leads aprovados, com modelo, prévia, validação, confirmação manual e revisão de possíveis duplicados. |
| Duplicados no CSV | Sinalizar possíveis duplicados por WhatsApp, e-mail ou empresa e não importar automaticamente. |
| Acesso da IA ao banco | Não permitir acesso direto no MVP; a IA prepara o CSV estruturado. |
| Navegação | Organizar o sistema em Dashboard, Leads e Clientes. |
| Referência visual | Seguir os mockups de `docs/mockups` para cores, tipografia, estrutura e componentes, sem adicionar ao MVP as áreas extras exibidas neles. |
| Detalhes de registros | Abrir uma página própria com contatos, resumo/anotações e ações ao selecionar uma linha. |
| Colunas visíveis de leads | Empresa, Responsável, WhatsApp, Status, Próxima ação e Ações. |
| Organização de clientes | Um cliente pode ter vários projetos; cada projeto pertence a um único cliente. |
| Colunas visíveis de clientes | Empresa, Responsável, Resumo dos projetos e Ações. |
| Dados de projetos | Exibir projetos, preço, prazo e situação na página de detalhes do cliente. |
| Plataforma | Aplicação web responsiva, acessível em computador e celular. |
| Hospedagem | Cloudflare Pages. |
| Interface | React com TypeScript. |
| Ferramenta de desenvolvimento | Vite. |
| Banco, autenticação e permissões | Supabase. |
| Estrutura de arquivos | Organizar o projeto em páginas, funcionalidades, componentes, conexão Supabase, tipos, utilitários e migrações. |
| Acesso de usuários | Login e senha próprios para cada membro da equipe. |
| Permissões do MVP | Todos os usuários autenticados da equipe podem visualizar e editar os mesmos dados. |
| Gestão de acessos | Criar e remover usuários manualmente no Supabase, sem tela administrativa no MVP. |
| Backup | O administrador do Supabase exporta os dados semanalmente e guarda o arquivo em local privado com acesso controlado. |
| Custo inicial | Priorizar planos gratuitos e monitorar limites de uso. |
| Automação de mensagens | Evolução futura, fora do MVP. |
| Contratos formais | Não serão incluídos. |
