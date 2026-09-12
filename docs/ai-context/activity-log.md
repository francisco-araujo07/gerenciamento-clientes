# Diário de atividades

## 2026-09-12 — Remediação P1 da F2 (PR #4)

- Fechado mass-assign de `next_action*`: payload de update omite os campos; UPDATE direto sem GUC falha.
- `respondeu` pausa a cadência de fato (due date nula + modal de reagendar).
- P2 baratos: desempate por `created_at`, contrato de `lead_atividade` no runbook, CTA de novos sem data visível com fila não vazia.
- Próxima atividade: testes verdes e PR #4 contra `main`, ready. Sem migrate/promote prod e sem F3.

## 2026-09-12 — F2 rebaseada em main

- PR #3 da F1 foi squash-mergeada em `main` (`0ade748`). A branch da F2 foi rebaseada em cima desse `main`; a PR #4 passa a apontar para `main`.
- Flag `VITE_FF_GLC_FILA_CADENCIA` continua OFF; motor no servidor; sem DROP, migrate/promote ou F3.

## 2026-09-12 — Fila de cadência (F2)

- Implementada a SPEC F2 em branch nova, sem misturar commits na PR #3 da F1.
- Motor no servidor, flag default OFF, 3º toque +6d, máximo 4, modal de limite sem avanço silencioso.
- Próxima atividade: aplicar a migration em banco de teste, validar a flag ligada localmente (com F1 ON) e só então promover. Não executar migrate em produção nesta entrega.

## 2026-09-12 — Remediação P0/P1 do funil (PR #3)

- Fechado o write path de status fora da RPC (trigger + GUC). Histórico sem INSERT direto. Create rejeita `negociacao`; update genérico não envia `status`.
- Docs e runbook alinhados ao modelo real: flag só na UI; rollback = revogar EXECUTE, não desligar a flag.
- Próxima atividade: reabrir review da PR #3. Não migrar nem promover a flag em produção nesta entrega.

## 2026-09-12 — Funil de status (F1)

- Implementada a SPEC F1 com flag default OFF, migration aditiva, RPC de status + histórico e testes da matriz de transição.
- Leads em `negociacao` permanecem no valor legado; criação de lead não oferece `negociacao`.
- Próxima atividade: aplicar a migration em banco de teste, validar a flag ligada localmente e só então promover. Não executar migrate em produção nesta entrega.

## 2026-09-10 — Contador de leads

- Adicionado contador acessível acima da tabela de Leads, refletindo a quantidade após os filtros atuais.
- Lint e build aprovados; alteração preparada para esta entrega.

## 2026-09-10 — Ajuste visual pós-push

- Aumentado o padding horizontal dos cartões responsivos de leads em `src/App.css` para dar mais respiro ao nome da empresa.
- Alteração preparada para o commit e push desta entrega.

## 2026-09-10 — Aplicação das análises

- Aplicadas melhorias de segurança, arquitetura, UX/UI, qualidade/testes/CI e dados/Supabase, sem commit e sem alterações remotas.
- Criados relatórios de execução em `docs/analysis/aplicacao-*.md`, com arquivos alterados, validações e pendências de cada frente.
- `ReadLints` não encontrou erros nos arquivos verificados.
- Corrigida a importação ESM sem extensão no serviço de leads; a melhoria de UX de `ClientDetailsPage.tsx` foi preservada.
- Validação integrada concluída com sucesso: lint, typecheck, 20 testes, cobertura e build passaram. Cobertura: 81,43% de linhas, 89,41% de branches e 68,42% de funções.
- Próxima atividade: revisar e executar as migrações SQL em PostgreSQL descartável, confirmar configurações administrativas/backup no Supabase e então avaliar o commit.

## 2026-09-10

- Feita análise de segurança independente do estado atual do repositório (sem alterar código); relatório em `docs/analysis/seguranca.md`.
- Confirmado com `npm audit` que não há vulnerabilidades conhecidas nas dependências.
- Próxima atividade: administrador aplicar a migração de hardening em teste/produção, confirmar signup/login anônimo desativados e remover `exports/` do repositório versionado.

## 2026-09-10 — Preparação da entrega final

- Executadas as validações finais: lint, typecheck, 20 testes, cobertura, build, `npm audit` e `git diff --check`, todas aprovadas.
- Removidos do índice os três CSVs com dados reais de `exports/`; os arquivos locais foram preservados e não serão enviados.
- Revisada a lista de arquivos seguros para commit e push em `main`/`origin`; migração SQL, configurações administrativas e deploy permanecem ações manuais.

## 2026-08-16

- Atualizado o título exibido na aba do navegador para GLC - Gerenciamento de Leads e Clientes.
- Corrigido o destino inicial da sessão autenticada: o Dashboard agora é a primeira tela exibida.
- Criado o projeto Cloudflare Pages `gerenciamento-clientes` e publicada a primeira versão em produção. Confirmada resposta HTTP 200 no endereço principal; a vinculação automática ao GitHub permanece pendente.
- Bloqueio de revisão visual automatizada: o navegador do ambiente não conseguiu estabelecer a conexão local. O servidor temporário foi encerrado; a compilação e a análise estática seguem válidas.
- Refinadas as telas de Leads, Clientes e Importação CSV com base nos mockups aprovados; a compilação e a análise estática foram validadas.
- Implementado o dashboard de faturamento com os filtros semanal, mensal e total e acessos às tabelas principais.
- Validadas a compilação de produção e as regras de qualidade do dashboard.
- Próxima atividade: validar o fluxo completo com dados fictícios, incluindo conversão, projeto concluído e faturamento.

- Concluída a descoberta do produto.
- Confirmados objetivo, fluxo de entrada de leads, escopo inicial do MVP, regra de faturamento e situações dos projetos.
- Confirmado o funil de leads e a preservação dos dados e anotações após conversão ou perda.
- Confirmadas as colunas iniciais das tabelas de leads e clientes.
- Confirmadas ações manuais e busca rápida nas tabelas.
- Confirmada a importação de leads por CSV, sem acesso direto da IA ao banco.
- Concluída a definição dos requisitos detalhados do MVP.
- Confirmada a navegação principal e a página de detalhes de leads e clientes.
- Confirmada a organização visual do dashboard e das tabelas.
- Concluída a definição da experiência do usuário do MVP.
- Confirmada a arquitetura técnica: React, TypeScript, Cloudflare Pages e Supabase.
- Concluídas as quatro partes iniciais do planejamento.
- Confirmada a relação de um cliente com vários projetos e a organização da tabela de clientes.
- Confirmado que o MVP terá resumo/anotações, sem histórico cronológico de atividades.
- Concluída a definição do modelo de dados do MVP.
- Confirmados Vite e a estrutura de arquivos do projeto.
- Confirmada a ordem de construção do MVP.
- Confirmado o plano de testes e validação do MVP.
- Confirmado o plano de publicação, segurança e backup.
- Confirmadas as regras operacionais e a evolução futura do produto.
- Concluído o plano de planejamento do MVP.
- Criada a base do projeto com React, TypeScript e Vite.
- Criada a estrutura inicial de pastas para páginas, funcionalidades, componentes, conexão com Supabase, tipos, utilitários e migrações.
- Validadas a compilação de produção e as regras de qualidade do código.
- Adicionados o cliente local do Supabase, o arquivo de variáveis de ambiente de exemplo e a migração inicial das tabelas com permissões.
- Bloqueio: falta criar ou acessar o projeto remoto do Supabase para aplicar a migração e preencher as variáveis locais.
- Configuradas localmente as variáveis de conexão do projeto remoto do Supabase.
- Criada a tela de login por e-mail e senha e o controle de sessão da aplicação.
- Bloqueio: a migração precisa ser aplicada no painel do Supabase, pois a chave publicável não pode alterar a estrutura do banco.
- Próxima atividade: aplicar a migração, criar acessos da equipe e validar o login.
- Verificada a aplicação da migração no projeto remoto pelos endpoints das tabelas de leads, clientes e projetos.
- Criada a tabela de leads com cadastro, edição, exclusão, busca, filtros e priorização de próxima ação atrasada.
- Validadas a compilação e as regras de qualidade da implementação de leads.
- Próxima atividade: concluir a página individual de detalhes e testar o fluxo com um lead fictício.
- Criada a página individual de detalhes do lead e integrada à tabela.
- Validadas a compilação e as regras de qualidade da página de detalhes.
- Próxima atividade: implementar a importação de leads aprovados por CSV.
- Implementada a importação de leads aprovados por CSV com modelo, prévia, validação, revisão de duplicidades e confirmação manual.
- Validadas a compilação e as regras de qualidade da importação.
- Próxima atividade: implementar a conversão de lead em cliente.
- Criada a conversão transacional de lead em cliente, preservando os dados e anotações do lead.
- Validadas a compilação e as regras de qualidade da conversão.
- Próxima atividade: aplicar a migração de conversão no Supabase e validar o fluxo com um lead fictício.
- Confirmada a disponibilidade da função de conversão no Supabase após a aplicação da migração.
- Criadas a área de clientes, a página de detalhes e o cadastro de projetos.
- Validadas a compilação e as regras de qualidade desta etapa.
- Próxima atividade: concluir edição e exclusão de clientes e projetos.
- Adicionadas edição e exclusão de projetos e exclusão confirmada de clientes.
- Validadas a compilação e as regras de qualidade das ações manuais.
- Próxima atividade: implementar a edição dos dados cadastrais do cliente.
- Confirmado que os mockups de interface serão seguidos visualmente sem incluir as áreas extras no escopo do MVP.
- Implementada a edição cadastral de clientes e validada a compilação.
- Próxima atividade: construir o dashboard de faturamento.
- Adicionada a aba interativa Guia de ligação com caminhos clicáveis para conduzir a conversa comercial até a reunião de protótipo e a negociação.
- Feita análise de segurança da nova implementação; links de mapa passaram a validar o protocolo HTTPS e as permissões amplas do MVP foram registradas como risco conhecido.
