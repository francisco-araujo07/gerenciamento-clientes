# Registro de alterações

## Guia de conversa (F11) — remediação P1-001..007 (PR #9) — 14/09/2026

- P1: `ramoCNao` sem prefixo; Ramo B em dois nós; §1.1 com `“site”.`, exemplos de gatilho, “com atendente”, “quando for pedir call”; títulos A–F da SPEC; `{{nome}}` = decisor → porteiro → responsável; “Se não” = `perdido`+`sem_decisor`; Ramo A due date D+3.
- Sem atualizar `wa_templates`. Residual de copy documentado no runbook (sem claim de residual zero).

## Guia de conversa (F11) — remediação copy brief PRIMARY — 14/09/2026

- Tab WhatsApp: “O que dizer” e checklists GLC alinhados letra a letra ao brief PRIMARY (abertura + variante gatilho, ramos A–F, §3.1–3.8, T3/T4, princípios §1.1/1.2, funil §1.3).
- Chips F3 só nos 5 mapeamentos (1 por seed). Sem atualizar corpos `wa_templates`. Sem R$ / faixa numérica de pacote (§3.3).
- Checklist GLC usa `next_action` / `next_action_due_date`. Residual de copy F3/legado fechado.

## Guia de conversa (F11) — 14/09/2026

- Feature flag `VITE_FF_GLC_GUIA_CONVERSA` (nome interno `ff_glc_guia_conversa`), default OFF: gateia a **UI** do rename, da tab WhatsApp e da rota `/guia-conversa`.
- Flag OFF: chrome **Guia de ligação**, árvore legada, sem tab WhatsApp.
- Tabs `Ligação | WhatsApp` (default WhatsApp). Seis etapas estáticas. Chips F3 só nos 5 mapeamentos. Sem R$ de pacote. Sem `proxima_acao_*`.
- `/guia-ligacao` permanece e, com a flag ON, redireciona para `/guia-conversa`. Sem migrate; sem atualizar seeds F3; F5/F6 fora.

## F4 remediação P1-001 (payload e deleted_at) — 12/09/2026

- `leadPayload` / `leadUpdatePayload` só espalham campos F4 com a flag ON (como `kitWhatsappLeadFields` na F3).
- `listLeads` / `listLeadsPage` / `getLead` / cadência só filtram `deleted_at IS NULL` com a flag ON; busca em `porteiro_nome`/`decisor_nome` idem.
- Flag OFF volta a ser compatível com schema sem colunas F4. Flag OFF da PR #6 **não** era deploy seguro pré-migrate.
- Ordem correta no runbook: migrate expand F4 → só então deploy do app. Default OFF. Sem migrate/promote prod.

## Porteiro vs Decisor (F4) — 12/09/2026

- Feature flag `VITE_FF_GLC_PORTEIRO_DECISOR` (nome interno `ff_glc_porteiro_decisor`), default OFF: gateia a **UI** dos blocos de contato, radio do WhatsApp padrão, seletor F3 e spotlight.
- Colunas no lead: `porteiro_nome`, `porteiro_whatsapp`, `decisor_nome`, `decisor_whatsapp`, `decisor_cargo`, `contato_principal` (default `geral`), `ultimo_combinado_com_porteiro`, `deleted_at` nullable.
- Sem DROP de `whatsapp`/`responsible_name`. Sem tabela `lead_contato`. Listagens filtram `deleted_at IS NULL`. Payload cadastral não envia `deleted_at`.
- Modal F3 pergunta “Para quem?” só com número válido; `wa.me` usa o E.164 do escolhido; variáveis F4 nas colunas.
- CSV: colunas opcionais `porteiro_*`/`decisor_*`. Sem migrate/promote prod.

## Cloudflare Pages Preview (PRs) — 12/09/2026

- Confirmado pré-existente: `vite.config` em `main` (`153adab`) hard-fail sem `VITE_SUPABASE_*`. Preview da #5 não tem as vars. Não é F3.
- Preferência: Francisco adiciona as vars no dashboard (Production + Preview). Sem secrets no repo.
- Build sem as duas vars não aborta; chave privilegiada/par incompleto continua falhando. `.nvmrc` = 24.

## F3 remediação P1 (seeds SPEC CA-F3-02) — 12/09/2026

- Seeds alinhados à SPEC: Primeira abordagem (porteiro), Follow-up D+3, Break-up, Decisor respondeu — pedir 2 horários, Confirmar reunião D-1.
- `etapa` passa a ser status F1 ou `qualquer`. Sugestão: `novo`/`contato_porteiro`→primeira abordagem; `falando_decisor`→2 horários; `reuniao_marcada`→D-1; demais→Follow-up D+3.
- Migration aditiva `20260912170000_kit_whatsapp_spec_seeds.sql` (UPDATE por id; CHECK expandido depois contraído; sem DROP de tabela).
- P2-001/002: número inválido → null; normalizer aceita prefixo `00`.

## Kit WhatsApp (F3) — 12/09/2026

- Feature flag `VITE_FF_GLC_KIT_WHATSAPP` (nome interno `ff_glc_kit_whatsapp`), default OFF: gateia a **UI** do kit. Após o migrate, colunas e `wa_templates` existem no servidor mesmo com a flag OFF.
- Colunas `gatilho` (≤280), `prototipo_url`, `prototipo_notas` e `wa_ultimo_template_id` (FK ON DELETE SET NULL).
- Tabela `wa_templates` (nome, etapa, corpo, ativo) com RLS deny-by-default; autenticados leem/criam/editam; sem DELETE/TRUNCATE. 5 seeds ativos.
- Modal Abrir WhatsApp no detalhe e na fila Hoje: template sugerido por status, prévia editável, aviso de print, E.164 BR, `wa.me` com texto, “Considerar como Toquei?” → `registrar_cadencia`.
- Config CRUD de templates; inativos só na config. Sem WhatsApp Business API / Cloud API / envio server-side.
- Sem DROP/RENAME; sem migrate/promote prod; sem UI de porteiro/decisor (F4).

## F2 remediação P1 (write-guard e Respondeu) — 12/09/2026

- `next_action` / `next_action_due_date` deixam de ir no update cadastral; trigger exige GUC de cadência ou de status (F1).
- `respondeu` limpa a due date no servidor e a UI abre o modal de reagendar; cancelar deixa o lead fora da fila Hoje.
- Fila de hoje desempata por `created_at`. Contrato real de `lead_atividade` documentado no runbook.

## F2 rebaseada em main — 12/09/2026

- Branch `cursor/fila-cadencia-438c` rebaseada no `main` que já contém o squash da F1 (`0ade748`, PR #3).
- PR da F2 retargetada para `main`.

## Fila de cadência (F2) — 12/09/2026

- Feature flag `VITE_FF_GLC_FILA_CADENCIA` (nome interno `ff_glc_fila_cadencia`), default OFF: gateia a **UI** da fila. Após o migrate, RPC/triggers existem no servidor mesmo com a flag OFF.
- Coluna `touches_sem_resposta` (default 0), tabelas `lead_atividade` e `cadencia_config` (offsets `[3,4,6]`, máximo 4, pausa 60d).
- RPC `registrar_cadencia` com motor server-side; UPDATE direto de toques falha sem GUC; INSERT de atividade só via trigger.
- UI: menu Hoje, abas Todos|Hoje|Atrasadas, ações Toquei/Respondeu/Sem resposta/Reagendar/Perdido/Pausar, `wa.me` sem template, timeline no detalhe.
- Sem DROP/RENAME; sem F3; sem cron/badge.

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
