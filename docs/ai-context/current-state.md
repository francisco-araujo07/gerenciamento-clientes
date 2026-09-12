# Estado atual

## Porteiro vs Decisor (F4) — remediação P1-001, flag OFF

A F4 (PR #6) já está em `main`. Remediação P1-001: `porteiroDecisorLeadFields`, filtro `deleted_at IS NULL` e busca em porteiro/decisor só entram com `VITE_FF_GLC_PORTEIRO_DECISOR` ON (espelho da F3 / `kitWhatsappLeadFields`). Flag OFF = payload e queries pré-F4, compatível com schema sem essas colunas. Flag OFF **não** era deploy seguro pré-migrate na PR #6; a ordem correta continua **migrate expand F4 → só então deploy do app** para ligar a feature. Default OFF. Expand-only. Sem migrate/promote prod. Runbook: `porteiro-decisor-runbook.md`.

## Kit WhatsApp (F3) — mergeada em main, flag OFF

Implementado o kit de templates no card/detalhe do lead e na fila Hoje, com migration expand-only e flag `VITE_FF_GLC_KIT_WHATSAPP` (`ff_glc_kit_whatsapp`) default OFF. A flag gateia **somente a UI**. Envio só via `https://wa.me/...`. Seeds CA-F3-02: primeira abordagem (porteiro), follow-up D+3, break-up, decisor 2 horários, confirmar reunião D-1. “Considerar como Toquei?” chama `registrar_cadencia` da F2. Sem F4, `{{porteiro_nome}}`/`{{decisor_nome}}` → `—` se as colunas estiverem vazias. Runbook: `kit-whatsapp-runbook.md`.

O check **Cloudflare Pages** vermelho na #5 é pré-existente: `vite.config` em `main` (`153adab`) abortava o build sem `VITE_SUPABASE_*`; o Preview da PR não tem essas vars. Não é regressão F3. Preferência: Francisco adiciona as vars em Production + Preview. Build sem as duas vars não aborta mais; runtime segue validando. Qualidade verde; check Pages não required. Sem secrets no repo.

## Fila de cadência (F2) — mergeada em main, flag OFF

Implementada a fila “O que fazer hoje” com migration expand-only e flag `VITE_FF_GLC_FILA_CADENCIA` (`ff_glc_fila_cadencia`) default OFF. A flag gateia **somente a UI** (menu Hoje, abas Todos|Hoje|Atrasadas, ações e timeline). Depois do migrate, RPC `registrar_cadencia`, `touches_sem_resposta`, `lead_atividade` e `cadencia_config` existem no servidor independentemente da flag. Motor no servidor: +3/+4/+6 dias, máximo 4 toques, 4º retorna `409/TOUCH_LIMIT`. `respondeu` zera toques e limpa a due date (sai da fila até reagendar). Write-guard: `next_action` / `next_action_due_date` / toques só via GUC (`registrar_cadencia` ou `update_lead_status`). Fila de ativos F1 (inclui `negociacao`, exclui convertido/perdido/pausado_60d) com `next_action_due_date` até o fim do dia em America/Recife; desempate por `created_at`. WhatsApp mascarado na lista; com F3 OFF o fallback é `wa.me` sem template. Cron/badge e kanban ficam fora. Ramp da F2 assume F1 ON (sem hard-block). Runbook: `fila-cadencia-runbook.md`.

## Funil de status (F1) — mergeado em main, flag OFF

F1 entrou em `main` via squash `0ade748` (PR #3). A flag `VITE_FF_GLC_FUNIL_STATUS` (`ff_glc_funil_status`) continua default OFF e gateia **somente a UI**. Depois do migrate, RPC, enum, triggers e histórico existem no servidor independentemente da flag. Migration e ramp da flag não foram executados em produção. Runbook: `funil-status-runbook.md`. A F2 entrou em `main` via PR #4. A F3 rebaseou em cima deste `main`.

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

## Análise de segurança independente — 10/09/2026

Relatório completo em `docs/analysis/seguranca.md` (não altera código). Confirma como crítico enquanto pendente: aplicar a migração de hardening (RLS/grants/sessão anônima) e confirmar signup/login anônimo desativados. Achados novos: dados reais de leads em `exports/` fora do `.gitignore` (risco de exposição em commit) e ausência de trilha de auditoria de dados (`created_by`/`updated_by` ou tabela `audit_log`). `npm audit` sem vulnerabilidades conhecidas.

## Análise de dados — 10/09/2026

Análise somente leitura de modelagem, RLS, conversão de lead, auditoria, paginação, versionamento, testes SQL, backup e evolução futura registrada em `../analysis/dados-supabase.md`. Nenhum código, schema ou migração foi alterado; recomendações aguardam priorização e implementação futura.

## Aplicação das análises — 10/09/2026

As recomendações de segurança, arquitetura, UX/UI, qualidade/testes/CI e dados/Supabase foram parcialmente aplicadas no working tree. Os detalhes estão em `../analysis/aplicacao-seguranca.md`, `../analysis/aplicacao-arquitetura.md`, `../analysis/aplicacao-ux-ui.md`, `../analysis/aplicacao-qualidade-testes-ci.md` e `../analysis/aplicacao-dados-supabase.md`.

Foram aplicados hardening de configuração e sessão, proteção de `exports/`, melhorias de headers e CI, refactors puros e testes adicionais, melhorias de acessibilidade/responsividade e uma migração SQL local com auditoria, índices e testes ampliados. Nenhum commit foi criado; nenhuma migração ou alteração foi executada no Supabase remoto.

O lint do estado verificado está sem erros. A integração corrigiu a importação ESM do serviço de leads e preservou a UX de `ClientDetailsPage.tsx`. A validação integrada passou: lint, typecheck, 20 testes, cobertura e build; a cobertura registrada foi de 81,43% de linhas, 89,41% de branches e 68,42% de funções. A migração SQL ainda precisa ser executada e validada em PostgreSQL descartável antes de promoção.

Pendências relevantes: remover/limpar historicamente os dados reais de `exports/`, confirmar configurações administrativas do Supabase (signup anônimo, MFA, sessões e backup), integrar paginação server-side às páginas, implementar cadastro manual de clientes e navegação pós-conversão, executar os testes SQL em PostgreSQL descartável e revisar o diff antes do commit.

## Entrega final — 10/09/2026

As alterações seguras do trabalho atual foram validadas localmente e estão prontas para commit e push no branch `main`, no remote `origin`. Os três CSVs reais de `exports/` foram removidos do índice com `git rm --cached` e permanecem apenas no armazenamento local, protegidos pelo `.gitignore`; nenhum `.env` real, segredo ou dado pessoal será incluído.

As validações finais passaram: lint, typecheck, 20 testes, cobertura, build, `npm audit` e `git diff --check`. A migração SQL, os testes SQL, as configurações administrativas do Supabase e o deploy continuam pendentes de execução manual conforme o plano de publicação.

Após o push anterior, foi preparado um ajuste local em `src/App.css`: os cartões responsivos de leads agora usam `padding` horizontal de `22px`, melhorando o espaçamento ao redor do nome da empresa. A alteração será incluída nesta entrega final.

Também foi adicionado em `src/pages/LeadsPage.tsx` um contador acessível acima da tabela, usando `visibleLeads.length` para mostrar a quantidade de registros após os filtros. A paginação do rodapé foi preservada. Lint e build passaram; a alteração está preparada para esta entrega.
