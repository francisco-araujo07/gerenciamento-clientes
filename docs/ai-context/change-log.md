# Registro de alterações

## Funil de status (F1) — remediação P0/P1 — 12/09/2026

- Trigger `enforce_lead_status_rules` + GUC `app.via_lead_status_write`: UPDATE direto de `status` (PostgREST/CRUD) falha; invariantes de `perdido` e `reuniao_marcada` valem em INSERT/UPDATE.
- `updateLead` deixa de enviar `status` e stubs; mudanças de status só pela RPC. Create autenticado e `leadPayload` rejeitam `negociacao`; com flag ON só a lista `createLeadStatuses`.
- `lead_status_history`: INSERT revogado de `authenticated`; linhas só pelo trigger SECURITY DEFINER. RPC rejeita destino `negociacao`.
- Docs honestas: a flag **não** desliga RPC/triggers após o migrate. Runbook de rollback e plano VALIDATE em `funil-status-runbook.md`. CHECKs permanecem `NOT VALID`.

## Funil de status (F1) — 12/09/2026

- Feature flag `VITE_FF_GLC_FUNIL_STATUS` (nome interno `ff_glc_funil_status`), default OFF: gateia a **UI** do funil. Após o migrate, RPC/enum/triggers existem no servidor mesmo com a flag OFF.
- Enum `lead_status` expandido em migration própria (ADD VALUE precisa ser commitado antes do uso); colunas stub `motivo_perda`, `motivo_perda_detalhe`, `reuniao_em`, `reuniao_link`; tabela `lead_status_history` com RLS SELECT (INSERT só via trigger).
- RPC `update_lead_status` para mudança atômica + histórico; `convert_lead_to_client` passa a bloquear `perdido` e `pausado_60d` e a aceitar demais status ativos.
- UI: badges, presets de filtro, select de status no detalhe, drawers de perda/reunião/pausa/encaminhado, timeline de histórico.
- Sem DROP/RENAME; sem F2/F3; `negociacao` permanece para revisão manual e não é destino de transição.

## Contador de leads filtrados — 10/09/2026

- Adicionado acima da tabela de Leads um contador acessível com `visibleLeads.length`, refletindo busca, status e filtro de atrasadas.
- Mantida a paginação existente no rodapé.
- Lint e build aprovados; alteração preparada para esta entrega.

## Ajuste visual de espaçamento — 10/09/2026

- Aumentado o espaçamento interno horizontal dos cartões responsivos da tabela de leads em `src/App.css`, de `16px` para `22px`, evitando que o nome da empresa fique colado à caixa branca.
- Alteração local posterior ao push de `main`, preparada para ser incluída nesta entrega.

## Aplicação das análises — 10/09/2026

- Aplicadas melhorias de segurança em `.gitignore`, cabeçalhos, configuração/sessão Supabase, Dependabot e CI; `exports/` foi protegido contra novos commits, mas contém dados reais e exige remoção/limpeza histórica manual.
- Preparada migração local de hardening de dados com constraints, índices `pg_trgm`, `audit_log` com RLS e testes SQL ampliados; nenhuma migração remota foi executada.
- Aplicados refactors arquiteturais para filtros, atrasos, agrupamento de projetos, tipos compartilhados, contratos de leitura e validações; adicionados testes de regressão.
- Aplicadas melhorias de UX/UI em confirmações, responsividade mobile, contraste, foco, estados vazios, feedbacks, badges e limites de formulários.
- Ampliados testes de contrato da conversão, typecheck da fixture TSX, cobertura nativa e etapas de CI.
- Corrigida a importação ESM de `dates.ts` no serviço de leads para compatibilidade com os testes Node.
- Relatórios de execução registrados em `docs/analysis/aplicacao-*.md`.
- Validação integrada concluída: lint, typecheck, 20 testes, cobertura e build passaram; cobertura registrada em 81,43% de linhas, 89,41% de branches e 68,42% de funções.
- Nenhum commit foi criado; as migrações SQL e configurações administrativas do Supabase continuam sem aplicação remota.

## Preparação da entrega final — 10/09/2026

- Validadas as alterações seguras com lint, typecheck, 20 testes, cobertura, build, `npm audit` e `git diff --check`.
- Removidos do índice os três CSVs reais de `exports/`, mantendo os arquivos locais e a proteção do `.gitignore`.
- Preparados commit e push no branch `main`; nenhum segredo, `.env` real ou dado pessoal será enviado.
- Relatório de entrega em `docs/analysis/entrega-push.md`; migrações SQL, configurações administrativas do Supabase e deploy continuam pendentes.

## Análise de segurança — 10/09/2026

- Criado `docs/analysis/seguranca.md` com revisão independente de autenticação/sessão, RLS/autorização, segredos, validação de entrada, cabeçalhos HTTP, ataques comuns, auditoria, backup/DR, dependências e CI/CD. Nenhum código alterado.
- Achados novos além da auditoria de 06/09: exports com dados reais de leads fora do `.gitignore` (`exports/`), ausência de trilha de auditoria de dados e falta de Dependabot/scanner de segredos no CI.

## Análise de dados — 10/09/2026

- Criado `docs/analysis/dados-supabase.md`: análise de modelagem, RLS, conversão de lead, auditoria, paginação, backup e evolução futura do banco. Somente leitura; nenhum código/schema/migração foi alterado ou executado.

## Segurança adicional — 06/09/2026

- Migração pendente limita permissões a CRUD e bloqueia TRUNCATE.
- Matriz SQL ampliada: três tabelas, sessões anônimas, identidade ausente, privilégios de visitante e entradas inválidas. Aprovada em PostgreSQL isolado com claims simuladas.
- CI PostgreSQL 17 adicionado; execução remota e aplicação em Supabase permanecem pendentes.

## 2026-08-16

- Alterado o título da aba do navegador para `GLC - Gerenciamento de Leads e Clientes`.
- Corrigida a navegação após o login para abrir o Dashboard em vez da tabela de Leads.
- Publicada a primeira versão do MVP em https://gerenciamento-clientes.pages.dev.
- Corrigido o estado registrado da conversão: a migração já foi aplicada no Supabase; permanece pendente apenas o teste prático autenticado.
- Ajustadas as telas de Leads, Clientes e Importação CSV para seguir a linguagem visual dos mockups, com controles visuais, ícones e área de envio destacada.
- Implementado o dashboard com faturamento por projetos concluídos, filtros semanal, mensal e total e atalhos para Leads e Clientes.

- Registrado o planejamento oficial da descoberta do produto e do escopo inicial do MVP.
- Registradas as regras de conversão, perda e visualização de leads.
- Registradas as colunas iniciais das tabelas de leads e clientes.
- Registradas ações manuais, confirmação de exclusão e busca rápida.
- Registrada a importação de leads por CSV com validação e confirmação manual.
- Registrada a navegação principal e a página de detalhes de registros.
- Registrada a organização visual do dashboard e das tabelas.
- Registrada a arquitetura técnica da aplicação.
- Registrado o modelo inicial de dados e a relação de um cliente com vários projetos.
- Removido o histórico de atividades do MVP; mantido o campo de resumo/anotações.
- Registrados Vite e a estrutura de arquivos do projeto.
- Registrada a ordem de construção do MVP.
- Registrados testes, validação e critérios de aceite do MVP.
- Registrados o plano de publicação, segurança e backup.
- Corrigida a documentação para refletir a ausência de histórico de atividades e os projetos vinculados a clientes.
- Registradas as regras operacionais, de acesso, duplicidade, exclusão, backup e evolução após o MVP.
- Criada a base da aplicação com React, TypeScript e Vite, incluindo a estrutura de pastas aprovada.
- Adicionada a base local do Supabase: cliente, variáveis de ambiente de exemplo e migração inicial de dados com RLS.
- Integrada a tela de login por e-mail e senha ao Supabase, com controle de sessão e saída.
- Criada a tabela de leads conectada ao Supabase, com cadastro, edição, exclusão confirmada, busca e filtros.
- Criada a página individual de detalhes do lead, com contatos, localização, próxima ação e anotações.
- Implementada a importação de leads por CSV com modelo, prévia, validação, duplicidades e confirmação manual.
- Implementada a conversão transacional de lead em cliente, pendente de aplicação da nova migração no Supabase.
- Criadas a tabela de clientes, o filtro por situação de projeto, os detalhes do cliente e o cadastro de projetos.
- Adicionadas edição e exclusão de projetos e exclusão confirmada de clientes.
- Confirmado que os mockups serão a referência visual, preservando o escopo funcional de Dashboard, Leads e Clientes.
- Implementada a edição dos dados cadastrais do cliente.
- Adicionada a aba autenticada Guia de ligação, com árvore interativa de preparação, descoberta, agendamento, apresentação, negociação e pós-ligação.
- Validado o destino de links de Google Maps para aceitar somente URLs HTTPS antes de abrir uma nova aba.

## 06/09/2026 — Auditoria técnica
- Corrigidos limites de período e soma do faturamento; leitura paginada e paginação visual de tabelas.
- Acrescentados controle de versão em edições, validação explícita de payload, limites e parser estrito de CSV.
- Corrigidos configuração/sessão, mensagens de erro, edição de clientes/projetos, foco modal e layout móvel.
- Adicionados build seguro, TypeScript strict, 15 testes, workflow de qualidade e cabeçalhos para publicação.
- Preparados migração e teste SQL de hardening, sem aplicação remota. Evidências e pendências em ../qualidade.md.
