# Análise de ferramentas e métricas — CRM de leads e clientes

Data: 10/09/2026. Autor: análise técnica assistida por IA, a pedido do responsável pelo produto.

## Escopo e método

Este relatório analisa o repositório `gerenciamento-clientes` (React 19 + TypeScript + Vite 8, Supabase, Cloudflare Pages, CI via GitHub Actions com oxlint e testes nativos do Node) para propor **novas ferramentas** e **novas métricas** que ajudem um freelancer solo a operar o produto com mais segurança, visibilidade e eficiência.

Fontes consultadas: `docs/ai-context/README.md`, `docs/ai-context/current-state.md`, `docs/ai-context/roadmap.md`, `docs/ai-context/operations-evolution.md`, `docs/operacao.md`, `docs/qualidade.md`, `package.json`, `.github/workflows/quality.yml`, `tests/*.mjs`, `src/pages/DashboardPage.tsx`, `src/features/leads/lead-service.ts`, `src/features/clients/client-service.ts`, `supabase/migrations/*.sql`, `src/pages/CsvImportPage.tsx`, `src/components/ErrorBoundary.tsx`, `src/main.tsx` e os CSVs em `exports/`.

**Não foi feita nenhuma alteração de código.** Este documento é somente análise.

### Diagnóstico rápido do estado atual (para contextualizar as recomendações)

- **Erros em produção:** só existe um `ErrorBoundary` genérico que faz `console.error`; nada é enviado para fora do navegador do usuário. Não há como saber, hoje, se algo quebrou em produção sem o freelancer testar manualmente.
- **Analytics de uso:** inexistente. Não há como saber quais telas são mais usadas, se o dashboard é consultado, ou onde os usuários travam.
- **Testes:** `node --test` nativo (`tests/*.test.mjs`), cobrindo regras de negócio (faturamento, paginação, concorrência) e contratos de serviço via `fetch` simulado. Não há testes de componentes React nem E2E de navegador. `tests/ui.html`/`tests/ui.tsx` são fixtures manuais para inspeção visual, não testes automatizados.
- **CI:** workflow único (`quality.yml`) com dois jobs — um sobe Postgres 17 e roda as migrações + `supabase/tests/audit.sql`; outro roda `npm ci`, `oxlint`, `npm test` e `npm run build`. Não há deploy automatizado, preview de PR, Dependabot, coverage ou scanning de segurança.
- **Backup do Supabase:** processo **manual semanal**, sem evidência registrada de execução ou de teste de restauração (ver `docs/operacao.md` e `docs/qualidade.md`).
- **Follow-up de leads:** o campo `next_action_due_date` existe e a UI permite ordenar/filtrar "Atrasadas", mas tudo depende de o usuário abrir o sistema e olhar — não há nenhum alerta proativo (e-mail, WhatsApp, push).
- **Auditoria:** a migração `20260906180000_audit_hardening.sql` trata de **permissões** (RLS, bloqueio de sessão anônima, limites de texto) — não existe uma tabela de log de auditoria (quem alterou o quê e quando). Não há colunas `created_by`/`updated_by` nas tabelas de negócio.
- **Dados de negócio (via `exports/*.csv`):** leads de clínicas/negócios locais com campos como `company_name`, `whatsapp`, `email`, `segment`, `source`, `next_action`, `next_action_due_date` — volume ainda pequeno (dezenas de linhas por arquivo), compatível com um estágio inicial de prospecção.

---

## PARTE A — Novas ferramentas

### A1. Observabilidade e monitoramento de erros

| Ferramenta | Problema que resolve | Custo aproximado | Esforço de integração |
|---|---|---|---|
| **Sentry** (SaaS, SDK `@sentry/react`) | Captura automática de exceções JS/React não tratadas, falhas de rede ao Supabase, breadcrumbs de navegação e release tracking. Resolve o maior gap atual: hoje um erro em produção só é percebido se o usuário reclamar. | Gratuito até ~5k erros/mês e 1 usuário (plano Developer); acima disso, planos pagos a partir de ~US$26/mês. | **Baixo** — adicionar `Sentry.init()` em `main.tsx`, plugar no `ErrorBoundary` existente (`componentDidCatch`) e nos `catch` dos serviços (`lead-service.ts`, `client-service.ts`). |
| **GlitchTip** (open source, compatível com SDK do Sentry) | Mesma cobertura do Sentry, mas auto-hospedado ou via instância comunitária, evitando limite de eventos. | Gratuito se auto-hospedado (custo de um VPS pequeno, ~US$5/mês); há também hosting gerenciado pago barato. | **Médio** — exige hospedar/gerenciar o serviço, mas o SDK é o mesmo do Sentry (baixo esforço de código). |
| **Logflare** (já integrável ao Supabase) | Centraliza logs do Postgres/Auth/Edge Functions do Supabase, incluindo erros de RLS e falhas de autenticação — útil pois hoje não há visibilidade dessa camada. | Gratuito no tier básico incluso no Supabase; planos pagos para retenção maior. | **Baixo** — é uma integração nativa habilitável no painel do Supabase. |
| **Tabela `client_errors` própria no Supabase** (alternativa "faça você mesmo") | Registrar erros críticos (ex.: falha ao carregar faturamento, falha de importação) direto numa tabela, sem depender de terceiros. | Gratuito (usa a infraestrutura já paga). | **Médio** — exige criar tabela, política de RLS de `insert` restrita e um `try/catch` central para enviar o evento; sem alertas automáticos nativos (precisaria de e-mail/cron adicional). |

**Recomendação:** Sentry (plano gratuito) é o melhor custo-benefício imediato — é o único item desta lista com esforço genuinamente baixo e alertas prontos.

### A2. Analytics de produto/uso

| Ferramenta | Problema que resolve | Custo aproximado | Esforço de integração |
|---|---|---|---|
| **Umami** (open source, self-host ou cloud) | Sem cookies, sem coleta de PII, mostra quais páginas (`Dashboard`, `Leads`, `Clientes`, `Importar CSV`, `Guia de ligação`) são mais usadas e com que frequência. Responde à pergunta "a equipe realmente usa o CRM, e como?". | Gratuito se auto-hospedado; plano cloud a partir de ~US$9/mês (10k eventos/mês). | **Baixo** — um `<script>` no `index.html` mais eventos customizados opcionais nos botões de navegação já existentes. |
| **PostHog** (SaaS ou self-host) | Além de pageviews, oferece funis (ex.: lead criado → convertido), gravação de sessão, e feature flags no mesmo produto (ver item A7) — interessante por resolver dois problemas com uma ferramenta só. | Gratuito até 1M eventos/mês (analytics) no plano free atual; funcionalidades extras (session replay) têm cota própria gratuita menor. | **Médio** — SDK JS simples de instalar, mas para aproveitar funis/eventos de negócio é preciso instrumentar `createLead`, `convertLeadToClient`, `createProject` etc. |
| **Plausible** | Alternativa simples e leve, foco em métricas de tráfego/uso agregadas, painel muito simples de ler. | Sem plano gratuito hospedado (a partir de ~US$9/mês); grátis se auto-hospedado. | **Baixo** (uso hospedado) / **Médio** (self-host). |
| **Tabela `usage_events` própria no Supabase** | Registra eventos de negócio (`lead_criado`, `lead_convertido`, `projeto_concluido`, `dashboard_visualizado`) com total controle do schema e sem enviar dados a terceiros — relevante já que o produto lida com dados de clientes reais (LGPD). | Gratuito (usa a infraestrutura já paga). | **Médio** — exige criar tabela + `insert` nos pontos-chave dos serviços já existentes (`lead-service.ts`, `client-service.ts`) e construir os relatórios você mesmo (ex.: queries SQL ou uma página simples). |

**Recomendação:** para um produto com dados sensíveis de clientes de terceiros, priorize uma ferramenta sem cookies/PII (Umami) ou a tabela própria no Supabase; evite analytics "pesados" de terceiros sem necessidade real ainda.

### A3. Testes automatizados e qualidade

| Ferramenta | Problema que resolve | Custo aproximado | Esforço de integração |
|---|---|---|---|
| **Vitest** | Mantém a mesma API do `node:test`/Jest mas roda sobre a config do Vite já existente, com watch mode rápido, mocks mais ricos e **cobertura de código nativa** (via `@vitest/coverage-v8`) — hoje `npm test` não gera nenhum relatório de cobertura. | Gratuito (open source). | **Baixo** — projeto já usa Vite; migração dos 2 arquivos de teste atuais é mecânica. |
| **@testing-library/react** | Testa componentes novos (`Modal.tsx`, `Pagination.tsx`, `ErrorBoundary.tsx`) de forma isolada — hoje só existe teste de regra de negócio/contrato HTTP, não de comportamento de UI/acessibilidade (foco do modal, navegação por teclado). | Gratuito. | **Baixo/Médio** — requer configurar `jsdom` no Vitest. |
| **Playwright** | Testes E2E reais no navegador (login → criar lead → converter → ver no dashboard), substituindo a inspeção manual descrita em `docs/qualidade.md` ("Navegador em desktop e 390 px"). Tem "codegen" que grava interações. | Gratuito (open source); CI já suportado nativamente no GitHub Actions. | **Médio** — fluxo de autenticação real exige usuário de teste no Supabase (ambiente separado, não produção). |
| **axe-core / @axe-core/playwright** | Automatiza verificações de acessibilidade (hoje feitas manualmente, ver auditoria de 06/09) — relevante porque o projeto já demonstrou preocupação com acessibilidade (foco de modal, `aria-live`, `role="alert"`). | Gratuito. | **Baixo**, se combinado ao Playwright acima. |
| **Storybook** | Documentação viva e testes visuais isolados dos componentes reutilizáveis novos (`Modal`, `Pagination`, `ErrorBoundary`) — ver também item A9. | Gratuito. | **Médio** — setup inicial + escrever "stories" para cada componente. |

**Recomendação:** priorizar Vitest (baixo esforço, ganho imediato de cobertura) e, em seguida, Playwright para os fluxos críticos (login, conversão de lead, importação CSV).

### A4. CI/CD e automação

| Ferramenta/melhoria | Problema que resolve | Custo aproximado | Esforço de integração |
|---|---|---|---|
| **Dependabot** (nativo do GitHub) | Atualiza automaticamente `react`, `@supabase/supabase-js`, `vite`, `typescript` etc. via PR, com changelog — hoje as dependências só são atualizadas manualmente. | Gratuito. | **Baixo** — um arquivo `.github/dependabot.yml`. |
| **GitHub CodeQL / Secret scanning** | Detecta vulnerabilidades de código e segredos vazados acidentalmente em commits (ex.: uma chave `service_role` do Supabase) — risco já citado como "achado preventivo" na auditoria de 06/09. | Gratuito para repositórios (secret scanning e Dependabot alerts são gratuitos em repositórios do GitHub, inclusive privados, na oferta atual). | **Baixo** — habilitar nas configurações de segurança do repositório. |
| **Deploy automático + preview por PR no Cloudflare Pages** | Hoje o deploy é manual ("faltou conectar o repositório GitHub no painel", conforme `current-state.md`). Conectar o repo dá deploy automático da `main` e uma URL de preview por PR, permitindo validar visualmente antes de publicar. | Gratuito no plano free do Cloudflare Pages. | **Baixo** — é configuração no painel do Cloudflare, sem mudar código (branch `main`, build `npm run build`, saída `dist`, `NODE_VERSION=24` já documentados em `docs/operacao.md`). |
| **Coverage no CI (`vitest run --coverage` + comentário automático no PR ou Codecov)** | Torna visível, PR a PR, se a cobertura de testes está caindo — hoje não há nenhuma métrica de cobertura. | Gratuito (Codecov é gratuito para uso individual/repos pequenos). | **Baixo/Médio**. |
| **Lighthouse CI** | Mede performance, acessibilidade e boas práticas do build de produção a cada PR, alertando regressões antes do deploy. | Gratuito (GitHub Action). | **Médio**. |
| **Husky + lint-staged** | Roda `oxlint`/testes rápidos antes do commit local, pegando erros antes mesmo do CI. | Gratuito. | **Baixo**. |

**Recomendação imediata e de baixíssimo esforço:** conectar o repositório ao Cloudflare Pages (resolve uma pendência já documentada) + habilitar Dependabot e secret scanning.

### A5. Backup e recuperação automatizados (Supabase)

| Ferramenta/abordagem | Problema que resolve | Custo aproximado | Esforço de integração |
|---|---|---|---|
| **Backups diários + PITR nativos do Supabase (plano Pro)** | Substitui o processo manual semanal (sem evidência de execução/teste, conforme `docs/qualidade.md`) por backups diários automáticos geridos pelo provedor, com retenção configurável e Point-in-Time Recovery. | Plano Pro do Supabase a partir de ~US$25/mês (PITR é um add-on adicional, cobrado à parte). | **Baixo** — é uma troca de plano + configuração no painel, sem código. |
| **GitHub Actions agendado (`pg_dump` via `cron`) + armazenamento externo (Cloudflare R2)** | Alternativa de baixo custo ao plano Pro: um job agendado roda `pg_dump`/`supabase db dump` e envia o arquivo para um bucket privado (R2 tem 10 GB grátis). Cria evidência automática (log de execução) do que hoje é manual. | Gratuito (dentro dos limites do GitHub Actions e do free tier do R2). | **Médio** — exige guardar a `service_role key` como *secret* do GitHub com escopo mínimo e testar a restauração periodicamente (ponto já cobrado pela auditoria: "verificar se a restauração funciona"). |
| **Script de restauração testável (`supabase db reset` + dump em ambiente descartável)** | Fecha a lacuna citada na auditoria: hoje existe backup declarado, mas não há evidência de teste de restauração. Um script documentado e agendado (ex.: trimestral) resolve isso. | Gratuito. | **Médio** — trabalho de escrita/documentação mais do que de ferramenta. |
| **Alertas de espaço/quota do Supabase (via Logflare/e-mail)** | Avisa antes de estourar o limite de 20.000 linhas por consulta mencionado na auditoria, ou os limites do plano free. | Gratuito. | **Baixo**. |

**Recomendação:** antes de assinar um plano pago, resolver a lacuna com um workflow agendado de `pg_dump` para R2 (baixo custo) e documentar/testar a restauração — é exatamente a pendência "alta" já registrada em `docs/qualidade.md`.

### A6. Notificações/automação de follow-up de leads

| Ferramenta | Problema que resolve | Custo aproximado | Esforço de integração |
|---|---|---|---|
| **Supabase Edge Function + `pg_cron` + Resend (e-mail transacional)** | Roda diariamente, consulta leads com `next_action_due_date <= hoje` e `status` em `novo`/`negociação`, e envia um e-mail-resumo — hoje isso depende 100% do usuário lembrar de abrir o sistema. | Resend: gratuito até 3.000 e-mails/mês; Edge Functions/`pg_cron` inclusos no Supabase. | **Médio** — nova função server-side, mas reaproveita a mesma query que já ordena por `next_action_due_date`. |
| **WhatsApp Cloud API (Meta)** | Envia lembrete/alerta via WhatsApp — canal mais natural para o público-alvo (clínicas, restaurantes, barbearias) do que e-mail. | Gratuito até 1.000 conversas iniciadas por mês (tier atual da Meta); acima disso, custo por conversa. | **Alto** — exige aprovação de conta comercial Meta, templates de mensagem aprovados e um backend leve (Edge Function) para chamar a API. |
| **Zapier / Make.com (no-code)** | Conecta um *webhook* do Supabase (ex.: `pg_net`/trigger) a e-mail, WhatsApp (via Twilio) ou Slack sem escrever backend novo. | Planos gratuitos limitados (ex.: 100 tarefas/mês no Zapier free); acima disso a partir de ~US$20/mês. | **Baixo** — mais rápido para prototipar do que a opção anterior, mas menos flexível e com limite de execuções gratuitas. |
| **Notificação in-app no próprio Dashboard** (contagem de leads atrasados em destaque) | Solução mínima, sem serviço externo: mostrar no Dashboard "N leads com ação atrasada" ao abrir o sistema — já há dado suficiente (`next_action_due_date`) e é citado como rotina em `operations-evolution.md` ("revisar diariamente"). | Gratuito. | **Baixo** — é uma nova consulta agregada reaproveitando `listLeads`. |

**Recomendação:** começar pelo item mais simples (contador de atrasados no Dashboard, esforço baixo) e evoluir para e-mail diário via Resend antes de investir em WhatsApp automatizado (que tem esforço/custo bem maiores e requer aprovação da Meta).

### A7. Feature flags / rollout controlado

| Ferramenta | Problema que resolve | Custo aproximado | Esforço de integração |
|---|---|---|---|
| **PostHog Feature Flags** | Se PostHog já for adotado para analytics (item A2), os feature flags vêm "de graça" no mesmo produto — útil para testar uma funcionalidade nova (ex.: notificações automáticas) só com o próprio freelancer antes de liberar para a equipe. | Incluso no plano gratuito do PostHog (limite generoso de solicitações de flag/mês). | **Baixo**, se PostHog já estiver instalado. |
| **Flag simples via variável de ambiente/config** | Para o estágio atual (poucos usuários, mesma equipe compartilhando dados), um `boolean` em `public-config.ts` ou uma linha numa tabela `app_settings` já resolve 90% do caso de uso, sem novo serviço. | Gratuito. | **Baixo**. |
| **Unleash (open source)** | Feature flags mais robustos (rollout percentual, segmentação) — hoje **não se justifica**: o produto tem uma equipe pequena e compartilhada, sem necessidade de rollout gradual sofisticado. | Gratuito (self-host) / pago (cloud). | **Alto** — esforço não compensa o estágio atual do produto. |

**Recomendação:** não investir em feature flags dedicados agora. Uma flag simples em configuração (baixo esforço) é suficiente até o produto ter múltiplas equipes/clientes usando instâncias diferentes.

### A8. Gestão de erros de importação CSV / qualidade de dados

| Ferramenta/abordagem | Problema que resolve | Custo aproximado | Esforço de integração |
|---|---|---|---|
| **Zod (ou Valibot) para validação de schema do CSV** | Hoje a validação em `CsvImportPage.tsx`/`utils/validation.ts` é feita "na mão" (regex, `try/catch`); uma lib de schema reduz duplicação entre validação de formulário e de CSV, e gera mensagens de erro mais estruturadas por campo. | Gratuito. | **Médio** — refatoração de `leadPayload`/`mapRows` para usar um schema único. |
| **Papa Parse** | Parser de CSV mais robusto que o parser customizado atual (`utils/csv.ts`), com melhor suporte a edge cases (aspas, delimitadores, encoding) sem reescrever a lógica do zero. | Gratuito. | **Baixo** — troca pontual da função de parsing, mantendo a camada de validação de negócio já existente. |
| **Tabela `import_log`** | Registra cada importação (data, nº de linhas, nº de erros, nº de duplicidades, usuário) — hoje essa informação existe só na tela, no momento da importação, e se perde depois. Permite calcular a métrica "taxa de falha de importação" (ver Parte B). | Gratuito (usa a infraestrutura já paga). | **Médio** — um `insert` ao final de `confirmImport` em `CsvImportPage.tsx`. |
| **Deduplicação mais robusta (fuzzy matching, ex. via `fuse.js` ou função `similarity` no Postgres/`pg_trgm`)** | A checagem atual de duplicidade é por igualdade exata normalizada (nome/e-mail/telefone). Nomes de empresas com pequenas variações de escrita (muito comum nos dados reais de `exports/*.csv`, ex. "Clínica X" vs "Clinica X Ltda") passariam despercebidos. | Gratuito (`pg_trgm` é extensão nativa do Postgres/Supabase). | **Médio**. |

**Recomendação:** o parser/validação atuais já são cuidadosos (ver limites de tamanho, validação de URL/HTTPS, detecção de duplicidade); o ganho de maior custo-benefício é registrar as importações em `import_log` para poder medir qualidade ao longo do tempo, e considerar `pg_trgm` para duplicidade aproximada dado o padrão de nomes observado nos CSVs de exemplo.

### A9. Documentação viva

| Ferramenta | Problema que resolve | Custo aproximado | Esforço de integração |
|---|---|---|---|
| **Storybook** | Documenta visualmente e interativamente os componentes novos e reutilizáveis (`Modal.tsx`, `Pagination.tsx`, `ErrorBoundary.tsx`), incluindo estados de erro/loading — hoje eles só são visíveis rodando a aplicação inteira. | Gratuito. | **Médio**. |
| **OpenAPI/Swagger UI para a API do Supabase (PostgREST)** | O Supabase **já gera automaticamente** uma especificação OpenAPI da API REST (endpoint `.../rest/v1/` com header `Accept: application/openapi+json`), então não é necessário criar uma API própria para ter documentação — basta expor essa spec num Swagger UI se algum dia for útil para outro desenvolvedor consultar os endpoints/tabelas. | Gratuito (recurso nativo do Supabase). | **Baixo**, e só relevante se o projeto ganhar uma API própria ou outro integrador externo — hoje o frontend fala direto com o Supabase, então o ganho é limitado. |
| **TypeDoc** | Gera documentação a partir dos tipos/comentários já existentes em `src/types/*.ts`, `lead-service.ts`, `client-service.ts` — útil se o projeto crescer e precisar de referência rápida das funções de domínio. | Gratuito. | **Baixo**. |
| **Manter e expandir os arquivos `docs/ai-context/*`** | Já é a prática adotada pelo projeto (e exigida pelo `AGENTS.md`) — o maior ganho de "documentação viva" aqui é continuar disciplinado nisso, mais do que adotar uma ferramenta nova. | Gratuito. | Já em uso. |

**Recomendação:** baixa prioridade agora. Vale mais reforçar a prática já existente de `docs/ai-context/` do que adotar Storybook/Swagger antes de haver mais componentes reutilizáveis ou uma API própria.

### A10. Outras ferramentas relevantes identificadas na exploração

| Ferramenta | Problema que resolve | Custo aproximado | Esforço de integração |
|---|---|---|---|
| **UptimeRobot / Better Uptime** | Monitora se `https://gerenciamento-clientes.pages.dev` está no ar e alerta por e-mail/SMS em caso de queda — hoje não há nenhum monitor externo (pendência já listada em `docs/operacao.md`: "monitor externo"). | Gratuito (planos free cobrem 1 a 50 monitores a cada 1–5 min). | **Baixo**. |
| **Gitleaks (GitHub Action)** | Varre commits/PRs em busca de segredos vazados (chaves Supabase, tokens) antes do merge — reforça o achado preventivo "SE-11/OP-04" da auditoria de 06/09 sobre chave privilegiada em build. | Gratuito (Action open source). | **Baixo**. |
| **Supabase Auth Hooks + tabela `login_attempts`** | Registra tentativas de login falhas para detectar força bruta — hoje não há visibilidade sobre isso (ver métrica de segurança na Parte B). | Gratuito. | **Médio**. |
| **Renovate** (alternativa ao Dependabot) | Mesma função do Dependabot, com mais controle de agrupamento de PRs de dependências. | Gratuito. | **Baixo**. |
| **size-limit / vite-bundle-visualizer** | Evita que o bundle cresça sem controle conforme novas telas/libs forem adicionadas (relevante para o público de conexões móveis mais lentas, comum entre pequenos negócios). | Gratuito. | **Baixo**. |

---

## PARTE B — Novas métricas

### B1. Métricas de produto/negócio

| Métrica | Como coletar no stack atual | Por que é valiosa para o freelancer |
|---|---|---|
| **Taxa de conversão lead → cliente** (já parcialmente possível hoje) | Já existe o suficiente no schema: `count(*) group by status` na tabela `leads` (`novo`, `negociação`, `convertido`, `perdido`). **Falta** apenas expor isso numa tela/consulta — hoje só se vê a lista de leads, não o funil agregado. | Mostra se o esforço de prospecção (como os CSVs em `exports/`) está de fato virando cliente pagante, e ajuda a decidir se vale investir mais em geração de leads ou em melhorar o fechamento. |
| **Tempo médio até conversão** (falta hoje) | Calculável via `clients.created_at - leads.created_at` (join por `clients.lead_id`), com uma view SQL simples (`avg(clients.created_at - leads.created_at)`). | Indica quanto tempo o ciclo de vendas está levando; útil para saber se o "Guia de ligação" está ajudando a acelerar o fechamento. |
| **Taxa e motivo de perda de leads** (falta hoje — não há campo de motivo) | O status `perdido` já existe, mas não há um campo `motivo_perda`. Recomenda-se adicionar essa coluna (texto curto ou enum) e agregá-la por `count(*) group by motivo_perda`. | Sem o "porquê" da perda, é impossível melhorar o discurso de vendas ou o produto oferecido; é a lacuna mais importante do funil hoje. |
| **Ticket médio por projeto/cliente** (falta hoje — dashboard só soma total) | `avg(price)` na tabela `projects` filtrando `status = 'concluido'`, por período — reaproveita exatamente a mesma consulta que já existe em `DashboardPage.tsx`/`utils/dates.ts`. | Ajuda a precificar propostas futuras e a identificar se o ticket médio está subindo (sinal de negócio amadurecendo) ou caindo. |
| **Faturamento por período com histórico/comparação** (parcialmente existe — só "agora") | O dashboard hoje mostra semana/mês/total "até agora"; falta comparar com o período anterior (ex.: mês atual vs. mês passado). Dá para calcular com a mesma função `revenueTotal` aplicada a uma janela deslocada. | Sem comparação, o número "R$ X este mês" não diz se o negócio está crescendo ou encolhendo. |
| **Pipeline de valor potencial** (falta hoje) | `count(leads em negociação) × ticket médio histórico` — estimativa simples usando dados já existentes. | Dá uma previsão de receita futura, útil para planejamento financeiro pessoal do freelancer. |
| **Leads por origem/canal (`source`)** (campo já existe, mas não é agregado) | `count(*) group by source`, cruzando com `status = 'convertido'` para taxa de conversão por canal. | Mostra qual canal de prospecção (ex.: "Pesquisa web", "Pesquisa validada", indicação) traz mais clientes, orientando onde investir tempo. |
| **Leads com ação atrasada (contagem no tempo)** (existe só como filtro pontual na UI, não como métrica histórica) | Consulta diária agendada (Edge Function/`pg_cron`) que grava `count(*) where next_action_due_date < hoje and status not in (convertido, perdido)` numa tabela de série temporal simples. | Permite ver se o hábito operacional recomendado em `operations-evolution.md` ("revisar diariamente") está de fato sendo seguido, ou se o backlog de atrasados está crescendo. |

### B2. Métricas operacionais/técnicas

| Métrica | Como coletar no stack atual | Por que é valiosa |
|---|---|---|
| **Erros em produção (contagem e tipo)** | Requer a ferramenta do item A1 (Sentry/GlitchTip) ou uma tabela `client_errors` própria, alimentada pelos `catch` já existentes em `lead-service.ts`, `client-service.ts` e `DashboardPage.tsx`. | Hoje um erro só é percebido se o usuário avisar; essa métrica é pré-requisito para qualquer meta de confiabilidade. |
| **Tempo de resposta do Supabase (latência de queries)** | O próprio painel do Supabase já expõe latência agregada por endpoint (gratuito, sem código). Para granularidade por tela, medir `performance.now()` antes/depois das chamadas em `readAll`/serviços e enviar para a tabela de eventos (item A2). | Ajuda a diagnosticar lentidão percebida pela equipe antes que vire reclamação, especialmente à medida que o volume de leads/clientes cresce além do limite de 20.000 linhas já mapeado na auditoria. |
| **Taxa de falha de importação CSV** | Depende da tabela `import_log` (item A8): `linhas_com_erro / total_linhas` por importação e ao longo do tempo. | Indica se o modelo de CSV/instruções para quem prepara os arquivos (ver `exports/*.csv`) precisa melhorar, ou se erros recorrentes vêm de uma fonte específica de dados. |
| **Uso de cada tela (pageviews/eventos)** | Ferramenta do item A2 (Umami/PostHog) ou tabela `usage_events` própria, com um evento por navegação (`onNavigate` em `DashboardPage.tsx`/`App.tsx`). | Mostra se o "Guia de ligação" e o "Dashboard" são realmente usados no dia a dia — informação hoje inexistente e citada implicitamente como incerteza em `operations-evolution.md` ("validar o uso do MVP pela equipe"). |
| **Disponibilidade (uptime) da aplicação** | Ferramenta do item A10 (UptimeRobot), sem necessidade de código no projeto. | Fecha a pendência "monitor externo" já registrada como pendência operacional em `docs/operacao.md`. |
| **Consumo de cota do plano gratuito do Supabase (linhas, banda, storage)** | Painel do Supabase (gratuito), com alerta configurável por e-mail. | Evita surpresas de custo ou bloqueio de acesso quando o volume de dados crescer (o limite de 20.000 linhas por consulta já é uma restrição ativa no código). |

### B3. Métricas de qualidade de código

| Métrica | Como coletar no stack atual | Por que é valiosa |
|---|---|---|
| **Cobertura de testes (%)** | Hoje não é gerada. Ao migrar para Vitest (item A3), rodar `vitest run --coverage` no CI e opcionalmente publicar no PR via Codecov. | Mostra objetivamente se novas funcionalidades (ex.: futuras automações de follow-up) estão sendo testadas, evitando repetir a situação pré-auditoria em que vários defeitos (faturamento, concorrência, CSV) não tinham testes. |
| **Complexidade/tamanho de arquivos** | Algumas páginas hoje concentram muito JSX numa única linha/arquivo (ex.: `DashboardPage.tsx`, `CsvImportPage.tsx`), como o próprio `qualidade.md` observa ("JSX denso"). Pode ser medido com `oxlint` (regras de complexidade, se suportadas) ou uma ferramenta dedicada como `eslint-plugin-sonarjs`/SonarCloud (gratuito para uso individual/open source). | Sinaliza, de forma objetiva, quando um arquivo está difícil de manter antes que vire um problema para futuras mudanças. |
| **Duplicidade de código** | `jscpd` (gratuito, roda via `npx`) no CI, comparando `src/pages/*.tsx` (padrões repetidos de tabela/paginação/filtro aparecem em várias páginas). | Ajuda a decidir quando vale a pena extrair um componente/hook compartilhado (o projeto já começou esse movimento com `Modal.tsx`/`Pagination.tsx`). |
| **Idade/quantidade de dependências desatualizadas ou com vulnerabilidade conhecida** | `npm audit` já é citado como executado manualmente na auditoria; automatizar via Dependabot (item A4) transforma isso numa métrica contínua (nº de PRs de segurança pendentes). | Evita que uma vulnerabilidade conhecida fique meses sem correção só por falta de rotina de checagem manual. |
| **Tamanho do bundle final** | `vite build` já gera estatísticas; `size-limit` (item A10) no CI compara PR a PR. | Importante para o público-alvo (clínicas/restaurantes/barbearias) que pode acessar de conexões móveis mais lentas. |

### B4. Métricas de segurança/auditoria

| Métrica | Como coletar no stack atual | Por que é valiosa |
|---|---|---|
| **Tentativas de login falhas (por conta/período)** | O Supabase Auth já registra tentativas nos logs internos; expor isso requer ativar Logflare (item A1) ou consumir os *Auth Hooks*/logs via API e gravar num painel simples. Hoje **não há nenhuma captura** disso na aplicação. | Detecta tentativas de força bruta contra as contas da equipe — relevante porque a auditoria de 06/09 já apontou "rate limits de autenticação" como pendência não confirmada. |
| **Uso da trilha de auditoria (quem alterou o quê)** | **Hoje não existe trilha de auditoria de dados** — a migração `20260906180000_audit_hardening.sql` cobre permissões (RLS, bloqueio de sessão anônima), não um log de mudanças. Recomenda-se criar uma tabela `audit_log` (via trigger `AFTER INSERT/UPDATE/DELETE` nas tabelas `leads`, `clients`, `projects`) registrando `table_name`, `record_id`, `operation`, `changed_by` (via `auth.uid()`), `changed_at` e o diff relevante. | Como a equipe toda compartilha o mesmo acesso a todos os dados (decisão explícita do MVP), a trilha de auditoria é o único jeito de saber quem excluiu ou alterou um registro específico em caso de erro ou disputa — hoje isso é impossível de reconstruir. |
| **Colunas `created_by`/`updated_by`** | Não existem hoje nas tabelas de negócio (`leads`, `clients`, `projects`); podem ser adicionadas via migração simples usando `auth.uid()` como `default`. | Complementa a trilha de auditoria com uma resposta rápida ("quem criou/editou por último este registro") sem precisar consultar a tabela de log completa. |
| **Sessões ativas / adoção de MFA** | Disponível via API administrativa do Supabase Auth (`auth.admin.listUsers`, com metadados de MFA) — hoje não é consultado por nenhuma rotina do projeto. | A auditoria de 06/09 listou "confirmar MFA administrativo" como pendência de alta prioridade; medir a adoção real (quantas contas têm MFA ativo) é pré-requisito para fechar essa pendência com evidência. |
| **Exportações/backups executados (data, responsável, sucesso da restauração testada)** | Um log simples (planilha, tabela `backup_log`, ou registro no `activity-log.md`) alimentado pelo workflow agendado do item A5. | Fecha a lacuna já citada na auditoria: hoje "existe política de exportação semanal, mas não há evidência de exportação ou restauração recente". |

---

## Resumo executivo

Cinco recomendações priorizadas para um freelancer solo com orçamento limitado, ordenadas por relação custo/benefício e urgência dos riscos já identificados na auditoria de 06/09:

1. **Sentry (plano gratuito)** para captura de erros em produção — hoje o time descobre problemas por acaso; é a lacuna de maior risco e menor custo de correção.
2. **Backup automatizado via GitHub Actions (`pg_dump` → Cloudflare R2) com teste periódico de restauração** — resolve a pendência de risco alto já registrada em `docs/qualidade.md`, sem exigir plano pago do Supabase.
3. **Trilha de auditoria (`audit_log` + colunas `created_by`/`updated_by`)** — como toda a equipe compartilha acesso total aos dados, é hoje impossível saber quem alterou ou excluiu um registro; é uma migração simples de alto valor.
4. **Conectar o repositório ao Cloudflare Pages (deploy e preview automáticos) + Dependabot/secret scanning** — fecha uma pendência já documentada, com esforço quase nulo e sem custo.
5. **Funil de conversão + contador de leads atrasados no Dashboard** — usa dados que já existem no schema (`status`, `next_action_due_date`) para responder à pergunta mais importante do negócio ("os leads estão virando cliente, e a que ritmo?"), sem depender de nenhuma ferramenta nova.
