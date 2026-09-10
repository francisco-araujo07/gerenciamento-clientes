# Estado atual

## Etapas concluídas

Parte 1 — Descoberta do produto.

Parte 2 — Requisitos detalhados do MVP.

Parte 3 — Experiência do usuário.

Parte 4 — Arquitetura técnica.

Parte 5 — Modelo de dados.

Parte 6 — Estrutura de arquivos.

Parte 7 — Ordem de construção do MVP.

Parte 8 — Testes e validação.

Parte 9 — Publicação, segurança e backup.

Parte 10 — Operação e evolução futura.

Base da aplicação — React, TypeScript e Vite configurados; estrutura de pastas aprovada criada.

Base do Supabase — cliente, variáveis de ambiente de exemplo e migração inicial com tabelas e permissões criados. A migração foi aplicada e os endpoints das tabelas foram verificados no projeto remoto.

Login — tela de acesso por e-mail e senha criada e integrada ao Supabase. A criação dos usuários permanece manual no painel do Supabase.

Leads — tabela e página individual conectadas ao Supabase, com cadastro, edição, exclusão confirmada, busca, filtros, ordenação por próxima ação e visualização dos dados completos.

Importação de leads — modelo CSV, prévia, validação, detecção de possíveis duplicidades, seleção manual e confirmação antes da inclusão no banco implementados.

Conversão de lead — ação e função transacional implementadas para criar o cliente e marcar o lead como convertido. A migração correspondente foi aplicada no Supabase; falta a validação com um lead fictício autenticado.

Clientes e projetos — tabela de clientes convertidos, filtro por situação, página de detalhes, cadastro, edição e exclusão de projetos e edição e exclusão confirmada de clientes implementados.

Dashboard — faturamento calculado a partir dos projetos concluídos, filtros semanal, mensal e total e atalhos para as áreas de Leads e Clientes implementados.

Guia de ligação — aba autenticada com playbook interativo em estrutura de árvore para conduzir ligações de venda de landing pages, apresentação de protótipo e negociação.

Navegação inicial — após autenticar, o usuário é direcionado ao Dashboard.

Interface — dashboard, tabelas e importação CSV receberam a linguagem visual dos mockups aprovados, preservando apenas as áreas do MVP.

Publicação — primeira versão publicada em https://gerenciamento-clientes.pages.dev e com resposta HTTP 200 confirmada. O deploy foi feito pela ferramenta oficial da Cloudflare; falta conectar o repositório GitHub no painel para automatizar as próximas publicações.

## Auditoria técnica — 06/09/2026

Correções locais de faturamento, paginação, concorrência, CSV, configuração, sessão, acessibilidade e formulários concluídas. TypeScript strict, 15 testes e CI adicionados. Build, lint e testes aprovados; login do build e fluxos fictícios inspecionados no navegador.

Migração de endurecimento e teste SQL preparados, mas NÃO executados. Supabase remoto e deploy não foram alterados. O status histórico de publicação acima não comprova a configuração atual. Consultar ../qualidade.md e ../operacao.md.

## Próxima etapa

Segurança local adicional: privilégios limitados a CRUD, bloqueando TRUNCATE. Migrações e testes SQL aprovados em PostgreSQL isolado (PGlite, claims simuladas), sem dados reais. CI PostgreSQL 17 adicionado, ainda não executado remotamente. Isso atualiza a pendência de testes locais acima; Supabase real permanece inalterado.

O administrador deve validar signup fechado, contas autorizadas e backup, executar a migração e os testes em banco de teste e depois promover as alterações. Revalidar deploy de dist, cabeçalhos e fluxo autenticado na URL final. Confirmar restauração, MFA e monitoramento antes de declarar produção pronta.
