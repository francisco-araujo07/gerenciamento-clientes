# Análise de qualidade, testes e CI/CD — Gerenciamento de clientes

Data da análise: 10/09/2026.
Escopo: estado ATUAL do diretório de trabalho (inclui mudanças não commitadas), referência `docs/ai-context/validation-plan.md`, `docs/ai-context/current-state.md` e `docs/qualidade.md`.
Método: leitura de código-fonte (`src/`, `tests/`, `supabase/tests/`, `.github/workflows/`, configs) e execução local dos comandos de verificação. Nenhum arquivo do projeto foi alterado durante esta análise.

## Execução local realizada

Ambiente: Windows/PowerShell, Node `v24.14.1`, npm `11.11.0`, `node_modules` já instalado.

| Comando | Resultado | Observações |
|---|---|---|
| `npm run lint` (oxlint) | ✅ Sucesso | Sem erros nem avisos reportados. |
| `npm test` (`node --test tests/*.test.mjs`) | ✅ Sucesso | 15/15 testes passaram (mesmo total citado em `qualidade.md`), ~2,1 s. |
| `npm run build` (`tsc -b && vite build`) | ✅ Sucesso | Build com `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` sintéticos (não publicar este artefato). Bundle único de 462,6 kB (130,6 kB gzip); sem code-splitting. |
| Testes SQL (`supabase/tests/*.sql`) | ⚠️ Não executado | Docker Desktop instalado (v29.4.0), mas o daemon não está ativo (`dockerDesktopLinuxEngine` inacessível) e não há `psql` no PATH. Consistente com o relatado em `qualidade.md`. Não tentei subir o daemon nem instalar ferramentas, para não alterar o ambiente do usuário. |

Conclusão prática: os três comandos de JavaScript/TypeScript (lint, test, build) estão **verdes e reproduzíveis** neste ambiente. Os testes SQL continuam **não verificados localmente nesta sessão**, exatamente como a auditoria de 06/09/2026 já registrava.

---

## 1. Cobertura de testes atual

### Fluxos/módulos com teste automatizado

| Fluxo / módulo | Tipo de teste | Arquivo |
|---|---|---|
| Cálculo de faturamento (semana/mês/total, bordas de data, precisão em centavos, rejeição de preço inválido) | Unitário (node:test) | `tests/regressions.test.mjs` → `src/utils/dates.ts` |
| Datas civis (`localDate`, `isDate`, `dateLabel`, meses/dias inexistentes) | Unitário | idem |
| Parser de CSV (BOM, CRLF, aspas escapadas, campo com quebra de linha, limites de tamanho/linhas/colunas) | Unitário | idem → `src/utils/csv.ts` |
| Validação/normalização de payload (contato, lead, projeto — campos administrativos bloqueados, URL `javascript:`, e-mail, limites de texto, preço) | Unitário | idem → `src/utils/validation.ts` |
| Paginação de leitura sem truncamento (`readAll`) — 1.201 registros, falha de contagem, mudança de dados durante leitura | Unitário | idem → `src/lib/read-all.ts` |
| Validação de configuração pública (bloqueio de chave `service_role`/JWT privilegiado antes do build) | Unitário | idem → `src/utils/public-config.ts` |
| Contrato HTTP de edição otimista (`updated_at` esperado, campos `id`/`lead_id`/`role` nunca enviados) | Contrato (fetch simulado via `createClient` real + `global.fetch` mockado) | `tests/services.test.mjs` → `client-service.ts`, `lead-service.ts` |
| Edição concorrente (HTTP 406) e exclusão sem linha retornada não são sucesso falso | Contrato | idem |
| Limite de 500 leads por importação em lote recusado antes da rede | Contrato | idem |

Isso cobre bem a **lógica de negócio pura** citada no `validation-plan.md`: cálculo de faturamento, datas, parsing de CSV e validação de payload. É um conjunto de testes bem direcionado aos bugs que a auditoria de 06/09 encontrou (regressão dirigida a defeito).

### Fluxos/módulos críticos **sem** teste automatizado

| Fluxo | Onde vive | Risco de não corrigir | Esforço para cobrir |
|---|---|---|---|
| **Login** (`supabase.auth.signInWithPassword`, tratamento de erro, timeout de sessão de 25 s, `onAuthStateChange`) — todo o `LoginPage.tsx` e a máquina de estados de sessão em `App.tsx` | `src/pages/LoginPage.tsx`, `src/App.tsx` | Alto — é o "critério de aceite" nº1 do MVP ("dados não forem acessíveis sem login"); regressão aqui bloqueia todo o sistema. Hoje só é verificado manualmente/via `tests/ui.html?fail=login\|session`. | Médio — dá para testar com Testing Library + Supabase client mockado (mesmo padrão de `tests/ui.tsx`), sem subir navegador real. |
| **Detecção de duplicados na importação de CSV** (`mapRows`, `normalize`, `phone`, sets de empresa/e-mail/WhatsApp existentes vs. arquivo) | `src/pages/CsvImportPage.tsx` (função interna, não exportada) | Alto — é requisito explícito do `validation-plan.md` ("Identificação de possíveis duplicados no CSV") e tem lógica não trivial (normalização de telefone, comparação cruzada arquivo×banco×arquivo). Hoje **zero** teste automatizado; só inspeção visual. | Baixo/Médio — basta extrair `mapRows` (e helpers) para um módulo em `src/features/leads/` ou `src/utils/` e testar como função pura, como já é feito com `csv.ts`. |
| **Conversão de lead em cliente** (`convertLeadToClient` → RPC `convert_lead_to_client`) do lado do cliente JS | `src/features/leads/lead-service.ts`, `src/pages/LeadDetailsPage.tsx` | Alto — fluxo de negócio central do produto. A idempotência e as regras de transição só são testadas no SQL (`audit.sql`, não executado) e na página fictícia (manual). Não há teste de contrato JS chamando `.rpc(...)` com sucesso/erro. | Baixo — mesmo padrão de `tests/services.test.mjs`, mockando `client.rpc`. |
| **Paginação de UI** (`Pagination.tsx`, reinício de página ao mudar filtro) | `src/components/Pagination.tsx` e páginas que a usam | Médio — `readAll` (dados) é testado, mas o componente visual (cálculo de `pages`, `disabled` nos limites, `aria-label`) não tem teste próprio. | Baixo — teste de função pura para o cálculo de páginas, ou snapshot simples. |
| Demais funções de serviço sem teste direto: `listClients`, `listLeads`, `getClient`, `getLead`, `createLead`, `createProject`, `deleteProject`, `deleteClient` | `client-service.ts`, `lead-service.ts` | Médio — usam os mesmos padrões já validados (`readAll`, `.select().single()`), mas erros de composição (ex.: `.eq()` errado, ordenação) não seriam pegos. | Baixo — extensão incremental de `tests/services.test.mjs`. |
| Dashboard: composição de carregamento/erro/retry (`DashboardPage.tsx`) | `src/pages/DashboardPage.tsx` | Baixo/Médio — `revenueTotal` já é testado isoladamente; o que falta é o estado de erro "Indisponível" vs. `loading`. | Baixo. |
| RLS/policies reais do Supabase em ambiente de teste | `supabase/migrations/*`, `supabase/tests/*.sql` | Alto (mas fora do controle desta sessão) — nunca foi executado nem localmente nem em CI real; ver seção 4. | Médio-Alto — requer Docker/psql funcionando. |

**Resumo da cobertura**: a base de utilitários puros (datas, CSV parsing, validação, paginação de dados, contrato HTTP) está bem coberta. As lacunas mais importantes são exatamente os fluxos citados no `validation-plan.md` como críticos e ainda sem teste automatizado: **login** e **detecção de duplicados no CSV**. A conversão de lead tem teste no lado do banco (não executado) mas não no lado do cliente JS.

---

## 2. Qualidade e manutenibilidade dos testes existentes

- **Runner nativo (`node:test` + `node:assert/strict`)**, sem dependências extras. Isso é coerente com o projeto ser enxuto (freelancer solo, poucas dependências de produção) e evita mais uma ferramenta para manter.
- Pontos fortes observados:
  - Testes pequenos, um comportamento por `test(...)`, nomes descritivos em português que documentam a regra de negócio (ex.: `"mês inclui primeiro dia inteiro, exclui anterior e futuro"`).
  - Uso de `assert.throws`/`assert.rejects` para validar rejeição, não só o caminho feliz.
  - Testes de contrato HTTP usam o **cliente Supabase real** com `fetch` injetado (`global.fetch`), em vez de mockar o SDK inteiro — isso reduz o risco de o teste ficar "mentindo" sobre a forma real das chamades (URL, método, query params).
- Trade-offs de não usar Vitest/Jest:
  - **A favor do `node:test` atual**: zero dependência de teste, mais rápido para instalar/rodar (~2 s), sem necessidade de configurar transformadores de TS/JSX (os módulos `.ts` são importados com extensão explícita e rodam via type-stripping nativo do Node 24 — aliás isso só funciona porque o código não usa recursos de TS que exigem emissão, ex.: enums, decorators, namespaces).
  - **Contra**: (a) não há suporte nativo a *coverage* granular por linha/branch no formato que os provedores de CI/badges esperam (`node --test --experimental-test-coverage` existe mas é menos maduro que `v8`/`istanbul` do Vitest); (b) não há *watch mode* ergonômico nem UI de teste; (c) testar componentes React (JSX) com `node:test` puro é inviável sem um DOM — por isso o projeto criou a saída alternativa `tests/ui.tsx`/`ui.html` (ver seção 3) em vez de testes de componente reais; (d) sem `vi.mock`/`jest.mock`, mocking mais complexo (ex.: `Date`, temporizadores) fica mais manual.
  - Como o projeto já sente a dor de (c) — precisou construir uma fixture HTML separada para inspecionar UI —, isso é o sinal mais claro de que o runner atual está no limite do que serve bem ao projeto à medida que mais lógica migra para componentes.
- **Risco de não corrigir**: baixo a médio — o runner atual é suficiente para os testes unitários existentes, mas não escala para testes de componente/E2E sem custo de engenharia extra (a própria fixture manual é esse custo).
- **Esforço de migração para Vitest**: baixo-médio. Vitest é compatível com Vite (mesma configuração de `resolve`/`plugins`), suporta `jsdom`/`happy-dom`, tem API muito parecida com `node:assert` (`expect`), e permite reaproveitar os testes atuais quase sem mudança (a API de `test`/`describe` é semelhante). Recomendado no médio prazo — ver seção 10.

---

## 3. Testes de UI/integração (`tests/ui.html`, `tests/ui.tsx`)

O que fazem:
- `tests/ui.html` é uma página HTML isolada que carrega `tests/ui.tsx` como módulo Vite.
- `tests/ui.tsx` cria um `SupabaseClient` **fictício** (`fixture`) que implementa apenas a superfície usada pelo app (`auth.getSession`, `auth.onAuthStateChange`, `auth.signInWithPassword` que sempre falha, `auth.signOut`, `from(table)` com um query builder simulado em memória para `leads`/`clients`/`projects`).
- Permite renderizar o `App` real, com dados fictícios em memória, e simular três classes de falha via query string: `?fail=session`, `?fail=data`, `?fail=write` (e implicitamente `?fail=login`, já que `signInWithPassword` sempre lança).
- É explicitamente **excluído do build de produção** (comentário "não faz parte do build") e citado em `docs/qualidade.md` como usado para inspeção manual no navegador (desktop e 390 px), não para asserções automatizadas.

Avaliação — é sustentável?

- **Pontos positivos**: é uma forma pragmática e de baixo custo de obter um "ambiente de app real" sem tocar o Supabase de verdade, útil para inspeção visual/manual de estados de erro difíceis de forçar contra o backend real (sessão expirada, escrita falhando, dados indisponíveis). Não adiciona dependência de teste E2E pesada (Playwright/Cypress).
- **Limitações relevantes**:
  1. **Não há asserção automatizada** — é só uma página para "olhar". Não roda em CI, não falha build, depende de alguém abrir o navegador manualmente e comparar visualmente. Não escala com o crescimento do time nem previne regressão silenciosa de UI.
  2. **Query builder fictício simplificado**: não replica nuances reais do PostgREST (ex.: paginação por `Range`/`Content-Range`, erros específicos de RLS, código `PGRST116`, comportamento de `.update().eq('updated_at', ...)` sem linha afetada). Ou seja, valida menos do que os testes de contrato de `tests/services.test.mjs`, que usam o SDK real com `fetch` mockado — para escrita/concorrência, os testes de contrato já cobrem melhor esse contrato do que a fixture visual.
  3. **Como não está incluído em nenhum `tsconfig`** (ver seção 6), o arquivo `tests/ui.tsx` **não passa pelo type-check do `tsc -b`** usado no `npm run build`/CI. Um erro de tipo introduzido ali só apareceria ao rodar `npm run dev` manualmente e abrir a página — nunca bloquearia o CI. Isso é uma lacuna concreta de "TypeScript sendo usado em todo o potencial" (cruza com a seção 6).
  4. Não testa **login real**, apenas simula sucesso/falha da chamada — a asserção de que o formulário se comporta corretamente com um backend real (ou mesmo com mensagens de erro do Supabase) não existe.
- **Recomendação concreta**: manter a fixture para inspeção exploratória (é barata e útil), mas não tratá-la como "teste". Prioridades:
  - Incluir `tests/**/*.tsx` em um `tsconfig` (ex.: um `tsconfig.tests.json` referenciado na raiz) para que `tsc -b` also valide esse arquivo — **risco baixo, esforço baixo**.
  - Migrar as interações mais críticas (login, erro de sessão, dashboard indisponível) para testes de componente automatizados com **Vitest + Testing Library + jsdom**, reaproveitando a mesma ideia de `SupabaseClient` fictício já escrita em `ui.tsx` (dá para extrair o fixture builder para um helper compartilhado entre a página manual e os testes automatizados) — **risco médio, esforço médio**.

---

## 4. Testes SQL do Supabase (`audit.sql`, `bootstrap.sql`)

`bootstrap.sql`:
- Cria roles `anon`/`authenticated` (`nologin`), schema `auth` fictício com `auth.jwt()`/`auth.uid()` lendo de `set_config('request.jwt.claims', ...)`, e concede privilégios amplos por padrão nas tabelas criadas depois — simula o ambiente do Supabase (roles + claims) em um Postgres genérico descartável.
- Comentário explícito e correto: "nunca executar no Supabase real".

`audit.sql`:
- Roda em duas transações com `rollback` no final (não deixa dados residuais mesmo em banco descartável).
- **Bloco 1** (RLS funcional): testa que o autor de um lead e outro membro autenticado enxergam o mesmo lead (dado compartilhado, coerente com a decisão de produto "CRM compartilhado, não multiempresa"); que sessão anônima autenticada (`is_anonymous: true`) não lê nem insere; que role `anon` pura não lê. Também testa **idempotência da conversão** (`convert_lead_to_client` chamado duas vezes retorna o mesmo cliente) e o **limite de texto** (`company_name` de 201 caracteres deve violar constraint).
- **Bloco 2** (matriz de segurança): confere ausência de privilégios excessivos (`TRUNCATE`, `TRIGGER`, `REFERENCES`) para `authenticated` nas três tabelas; rejeita inserção de lead já `convertido` diretamente (deve exigir o fluxo transacional); rejeita URL `javascript:` e preço `NaN` via constraint; testa que sessão anônima autenticada não lê/edita/exclui/insere em nenhuma das três tabelas; testa que role `authenticated` **sem** `sub` no JWT (sessão "quebrada") não acessa dados; testa que a role `anon` não tem nenhum privilégio de tabela nem `EXECUTE` na RPC de conversão.

Avaliação:
- **A abordagem é sólida em desenho**: simular claims via `set_config`/`set local role` é exatamente a técnica recomendada para testar RLS do Postgres/Supabase sem precisar de um servidor de autenticação real, e a cobertura de casos (dono, outro membro, anônimo autenticado, anônimo puro, autenticado sem identidade) já vai além do básico. O uso de `rollback` para isolamento é correto.
- **O que falta / limitações reconhecidas pela própria documentação (`docs/qualidade.md`, `docs/operacao.md`)**:
  1. **Nunca foi executado** — nem localmente (confirmado nesta sessão: sem Docker daemon ativo/psql), nem em CI (o workflow existe mas não há evidência de execução bem-sucedida registrada, e não está commitado ainda). É um teste "de papel" até a primeira execução real.
  2. Não cobre **UPDATE** e **DELETE** com verificação de retorno de linha por outro usuário não autorizado tentando editar registro alheio via RLS direta (a matriz testa `authenticated` sem identidade e `anon`, mas não testa, por exemplo, se um `authenticated` com identidade tenta um `UPDATE`/`DELETE` que deveria falhar em alguma condição futura mais granular — hoje o modelo é "todo autenticado vê tudo", então o teste atual é suficiente para o modelo *atual*, mas não vai pegar regressão se o modelo mudar para dados segregados por usuário).
  3. Não testa **concorrência real com duas conexões simultâneas** (ex.: duas transações chamando `convert_lead_to_client` ao mesmo tempo para o mesmo lead) — a idempotência testada é sequencial, não concorrente. Isso é uma lacuna explicitamente reconhecida em `docs/operacao.md` ("Expandir a validação para... conversão concorrente em duas sessões").
  4. Não testa autenticação HTTP real (PostgREST/GoTrue) — é simulação de claims no Postgres puro, então não pega bugs de configuração do lado da API do Supabase (ex.: JWT secret errado, exp expirado, `Authorization` mal formado), só bugs de RLS/constraints do schema.
  5. Não há teste de **migração aplicada em cima de dados legados** (constraints `NOT VALID` mencionadas em `qualidade.md`) — ou seja, não simula "banco com dados antigos que violam a nova regra" para confirmar que só bloqueia *novas* escritas.
- **Risco de não corrigir (não executar)**: **Alto** — é a maior lacuna de todo o pipeline de qualidade. Toda a garantia de RLS/segurança de dados hoje é teórica (SQL escrito, não rodado). Se a migração de hardening tiver um erro de sintaxe, de lógica de policy, ou uma regressão, isso só será descoberto manualmente pelo administrador do Supabase, sem rede de segurança automatizada.
- **Esforço de corrigir**: **Médio** — depende de infraestrutura fora do controle deste ambiente de análise (Docker Desktop funcionando localmente para reprodução manual; no CI, o job `database-security` do `.github/workflows/quality.yml` já está desenhado corretamente com `services: postgres:17` e deveria funcionar assim que o workflow for commitado e rodar pela primeira vez em um push/PR real do GitHub Actions).

---

## 5. Pipeline de CI (`.github/workflows/quality.yml`)

Estrutura atual — dois jobs independentes, ambos em `ubuntu-latest`, disparados em `push` e `pull_request`, com `permissions: contents: read` (boa prática de menor privilégio):

- **`database-security`**: sobe `postgres:17` como serviço, aguarda saúde via `pg_isready`, roda `bootstrap.sql`, aplica todas as migrações de `supabase/migrations/*.sql` em ordem, roda `audit.sql`. Sequência tecnicamente correta.
- **`checks`**: `actions/setup-node@v4` com Node 24 e cache de npm, `npm ci`, `npm run lint`, `npm test`, `npm run build` com variáveis `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` sintéticas e comentário explícito de que o artefato não deve ser publicado.

O que já está bem coberto: instalação reprodutível (`npm ci`), lint, testes unitários/contrato, **build de produção com `tsc -b` incluído** (o script `build` já faz type-check antes do bundle — isso é positivo e às vezes é esquecido em outros projetos que rodam só `vite build`), e agora também os testes SQL de RLS em banco descartável real (não simulado em memória).

O que falta ou é digno de nota:

| Lacuna | Risco | Esforço | Recomendação |
|---|---|---|---|
| Arquivo `.github/workflows/quality.yml` ainda **não commitado** (aparece como `??` no git status) | Alto — nenhuma das garantias acima vale nada até o workflow existir no repositório remoto e rodar de fato | Baixo — `git add`/commit/push | Commitar e observar a primeira execução real no GitHub Actions antes de confiar nela. |
| Sem cache/verificação de que `package-lock.json` está sincronizado com `package.json` além do que `npm ci` já garante (ok, `npm ci` já falha se desincronizado — ponto neutro) | Baixo | — | Nenhuma ação necessária. |
| Sem **cobertura de teste** (coverage) reportado nem limite mínimo | Médio — não há visibilidade sobre "quanto" do código está exercitado, dificulta perceber lacunas como as da seção 1 antes de acontecerem | Baixo (com Vitest) / médio (com `node --test --experimental-test-coverage`) | Adicionar `--experimental-test-coverage` ao `npm test` ou migrar para Vitest com `--coverage` e publicar o resumo como *step summary* do Actions. |
| Sem **cache** de artefato/otimização adicional para o job SQL (ok para o tamanho atual do projeto) | Baixo | — | Não prioritário agora. |
| Sem **verificação de formatação** (Prettier) — ver seção 7 | Baixo/Médio | Baixo | Ver seção 7. |
| Sem **deploy automatizado** no fluxo do GitHub Actions — publicação no Cloudflare Pages continua manual/via ferramenta oficial, sem gatilho automático a partir do `main` aprovado no CI | Médio — aumenta o risco de deploy manual esquecer uma etapa (ex.: variáveis de ambiente de produção) e quebra o objetivo de "publicar após cada atualização aprovada" citado em `release-security-plan.md` | Médio — Cloudflare Pages suporta integração direta com GitHub (deploy automático ao push em `main`, sem Action customizada) **ou** um job `deploy` usando `cloudflare/pages-action` após os `checks` passarem | Ver seção 8. |
| Sem **auditoria de dependências** automatizada (`npm audit` não roda no CI; foi rodado manualmente na auditoria de 06/09) | Médio | Baixo | Adicionar `npm audit --audit-level=high` como step não bloqueante, ou adotar Dependabot/Renovate (seção 10). |
| Nenhum step de **`npm run lint` para tsconfig/tests** nem `tsc --noEmit` cobrindo `tests/ui.tsx` (decorre da lacuna da seção 6) | Baixo/Médio | Baixo | Incluir `tests/**/*.tsx` em um projeto TS referenciado. |
| Sem badge de status do workflow no `README.md` | Baixo | Baixo | Cosmético, mas ajuda visibilidade. |

---

## 6. Configuração de TypeScript (strict mode, project references)

- `tsconfig.json` raiz usa **project references** (`tsconfig.app.json` para `src/`, `tsconfig.node.json` para `vite.config.ts`), e `npm run build` chama `tsc -b` (build incremental orquestrado pelas referências) antes de `vite build`. Essa é a configuração recomendada oficialmente pelo template Vite+TS mais recente, bem aplicada aqui.
- `tsconfig.app.json` tem `strict: true` mais um conjunto de flags de "linting" adicionais bem escolhidas: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly` (interessante — impede uso de sintaxe TS que exigiria emissão/transformação, alinhado ao fato de que o projeto roda `.ts` diretamente no Node 24 via type-stripping nativo em `tests/*.mjs`), `verbatimModuleSyntax` (evita ambiguidade em imports type-only, boa prática com `isolatedModules` do Vite/esbuild).
- **Lacuna real encontrada nesta análise**: nem `tsconfig.app.json` (`include: ["src"]`) nem `tsconfig.node.json` (`include: ["vite.config.ts"]`) incluem a pasta `tests/`. Isso significa que:
  - `tests/ui.tsx` (o único arquivo `.tsx`/`.ts` de teste que usa tipos do projeto, incluindo um `as unknown as SupabaseClient` que poderia esconder incompatibilidades reais) **nunca é type-checado** por `tsc -b`, nem em desenvolvimento nem no CI. Um erro de tipo ali só quebraria a experiência ao abrir manualmente `/tests/ui.html` no navegador (via transpile isolado do Vite, sem checagem de tipos).
  - `tests/*.test.mjs` são JavaScript puro (não TypeScript), então não seriam pegos de qualquer forma — mas isso é esperado e aceitável, pois `node:test` os executa diretamente.
  - **Risco de não corrigir**: Baixo/Médio — o arquivo é pequeno e mudou pouco, mas conforme a fixture cresce (ver recomendação da seção 3 de extrair mais lógica para lá ou promovê-la a testes reais), o risco de tipos incorretos passarem despercebidos cresce.
  - **Esforço de corrigir**: Baixo — criar um `tsconfig.tests.json` (ou ajustar `tsconfig.app.json`/adicionar novo projeto referenciado) com `include: ["tests"]`, adicionar a referência em `tsconfig.json` raiz, e rodar `tsc -b` (já é chamado pelo build) passaria a cobri-lo. Alternativa mínima: adicionar um `npm run typecheck` (`tsc --noEmit -p tsconfig.tests.json`) e incluí-lo no job `checks` do CI.
- **Está sendo usado em todo o potencial?** Em `src/`, sim — strict + flags extras + references + build incremental é uma configuração madura para o tamanho do projeto. A única lacuna material é a exclusão de `tests/*.tsx` do type-checking automatizado.

---

## 7. Linting (oxlint)

- `.oxlintrc.json` habilita os plugins `react`, `typescript`, `oxc` e define explicitamente apenas duas regras: `react/rules-of-hooks: error` e `react/only-export-components: warn` (com `allowConstantExport: true`). Isso significa que o projeto está usando majoritariamente os **presets padrão** desses plugins (oxlint já vem com um conjunto de regras "correctness" habilitado por padrão mesmo sem listá-las), e apenas customizando duas.
- `oxlint` é uma escolha pragmática: extremamente rápido (Rust), zero configuração pesada, boa cobertura de regras de correção de React/TS sem precisar da árvore de plugins do ESLint. Rodar `npm run lint` localmente levou ~9 s incluindo o boot do processo Node/npm — o lint em si é praticamente instantâneo.
- **Lacunas**:
  - Não há regras de **acessibilidade** (`jsx-a11y`) explicitamente habilitadas/verificadas — relevante porque a auditoria de 06/09 tratou vários achados de acessibilidade (foco de modal, `aria-live`, `role="alert"`) manualmente, sem uma rede de proteção automatizada equivalente. oxlint tem suporte experimental a regras de a11y; vale avaliar se o preset atual já cobre isso (não é possível confirmar 100% sem consultar a versão exata de regras padrão do oxlint 1.75, mas nenhuma regra de a11y aparece explicitamente na config).
  - **Sem Prettier** (nem outro formatador automático) configurado no repositório (`.prettierrc*`, `.editorconfig` — nenhum encontrado). O estilo de código atual (linhas muito longas, JSX denso em uma única linha) é consistente ao longo do projeto, sugerindo disciplina manual do desenvolvedor, mas não há **imposição automática** — qualquer PR futuro (inclusive de outro colaborador ou de uma IA) pode divergir de estilo sem que o CI reclame, e revisões de diff ficam mais difíceis com linhas extensas.
  - oxlint tem um formatador experimental (`oxfmt`)/pode ser usado em conjunto com Prettier; hoje nenhum dos dois está configurado.
  - Sem `--max-warnings 0` explícito no script `lint` — hoje não há warnings, mas se um `warn` (como `react/only-export-components`) aparecer no futuro, o CI não vai falhar nele (`oxlint` retorna código de saída 0 em `warn`? seria preciso confirmar, mas por padrão a maioria dos linters só falha em `error`). Vale considerar `oxlint --deny-warnings` ou equivalente para manter o padrão de zero avisos.
- **Risco de não corrigir**: Baixo — o projeto está estilisticamente consistente hoje porque tem um único mantenedor ativo; o risco cresce se mais pessoas (ou mais IAs) contribuírem em paralelo.
- **Esforço de corrigir**: Baixo — adicionar Prettier com uma config mínima (`.prettierrc`) e um script `format`/`format:check`, incluindo o check no CI, é trabalho de poucos minutos e não deveria conflitar com oxlint (que hoje não implementa formatação obrigatória).

---

## 8. Processo de release/deploy

- **Estado documentado** (`docs/operacao.md`, `docs/ai-context/release-security-plan.md`): deploy no Cloudflare Pages, atualmente feito "pela ferramenta oficial da Cloudflare" (deploy manual/CLI), com nota explícita de que falta "conectar o repositório GitHub no painel para automatizar as próximas publicações". Ou seja, **o próprio time já identificou e documentou que o deploy não é automatizado hoje**.
- O CI (`quality.yml`) só valida (`checks`) e testa segurança de banco (`database-security`); **não há job de deploy** nele. Isso é coerente com a decisão registrada de que a publicação segue manual por enquanto, mas é uma lacuna caso o objetivo seja "publicar após cada atualização aprovada".
- **Testes de fumaça pós-deploy**: não existem, automatizados ou manuais versionados. `docs/operacao.md` pede para "Na URL final, conferir login, assets, MIME, cabeçalhos, ações e refresh" — isso é uma checklist manual, não um script. Não há, por exemplo, um `curl`/script simples que valide HTTP 200 + cabeçalhos de `public/_headers` + ausência de erros de console após cada deploy.
- Backup/rollback: rollback de aplicação é "retornar ao artefato anterior" (Cloudflare Pages mantém histórico de deployments, o que ajuda), mas não há script/automação para isso, nem para rollback de migração de banco (fora do escopo de CI, mas vale registrar).
- **Risco de não corrigir**:
  - Deploy manual: **Médio** — funciona para um freelancer solo em baixo volume de mudanças, mas é o único ponto do pipeline inteiramente dependente de execução humana correta (variáveis de ambiente certas, branch certa, Node 24), sem qualquer verificação automatizada de que o artefato publicado corresponde ao commit aprovado no CI.
  - Ausência de smoke test pós-deploy: **Médio** — o próprio `qualidade.md` registra "Resposta HTTP 200 sozinha não comprova renderização" como lição aprendida; hoje não há nada que substitua a inspeção manual.
- **Esforço de corrigir**:
  - Conectar o repositório GitHub ao Cloudflare Pages pelo painel (não é uma mudança de código, é configuração) — **Baixo**, e é literalmente o "próximo passo" já anotado no `current-state.md`/`operacao.md`.
  - Adicionar um job `deploy` no GitHub Actions (usando `cloudflare/pages-action@v1` ou a integração nativa do Pages) condicionado a `checks` e `database-security` passarem — **Baixo/Médio**.
  - Smoke test pós-deploy: um script simples (`curl -sf https://.../ | grep ...` ou um teste Playwright mínimo que abre a URL de produção, verifica ausência de erro de console e presença do formulário de login) — **Baixo/Médio**, alto valor.

---

## 9. Gestão de dívida técnica e rastreamento

- Não há marcadores `TODO`/`FIXME`/`XXX` em `src/` (busca não encontrou nenhum) — ou a dívida é tratada fora do código, ou simplesmente não é marcada inline.
- O rastreamento de dívida técnica hoje vive em **documentos Markdown versionados**, não em um issue tracker dedicado:
  - `docs/qualidade.md` — relatório de auditoria com achados corrigidos, pendências ("Fronteira da equipe", "Banco", "Publicação", "Backup/recuperação", "Acesso e operação", "Privacidade", "Cabeçalhos", "Monitoramento") e limites técnicos conhecidos.
  - `docs/operacao.md` — playbook operacional com pendências acionáveis (ex.: "Expandir a validação para INSERT/UPDATE/DELETE de todas as tabelas... conversão concorrente em duas sessões").
  - `docs/ai-context/current-state.md` — "Próxima etapa" como uma lista de pendências priorizadas.
  - `docs/ai-context/decisions.md`/`change-log.md` (não lidos em detalhe nesta análise, mas fazem parte do mesmo sistema de documentação viva).
- **Avaliação**: para um projeto solo, esse sistema de "documentos vivos" é uma abordagem razoável e efetivamente funciona como rastreamento de dívida — é melhor do que nada, é lido por humanos e por IA (via `AGENTS.md`), e está em texto simples versionado no Git (auditável, com histórico). A recorrência de "não executado", "pendente", "pendência" nesses arquivos mostra que o processo de fato está sendo usado para registrar o que falta.
- **Lacunas**:
  - Não há **priorização estruturada** (severidade × esforço × prazo) em formato consultável (é tudo prosa em Markdown); esta análise usa essa estrutura pontualmente, mas não é o padrão do projeto.
  - Sem **rastreabilidade item-a-item** (ex.: não é fácil ver de forma automatizada "quantas pendências abertas existem hoje" ou marcar uma como concluída sem editar prosa).
  - Não há integração com Issues do GitHub, mesmo que informal (ex.: converter os itens de "Pendências antes de declarar produção pronta" do `qualidade.md` em Issues rastreáveis, com labels de prioridade).
- **Risco de não corrigir**: Baixo — funciona hoje porque há um único responsável e o volume de pendências é gerenciável; tende a piorar se o backlog crescer ou mais pessoas passarem a contribuir.
- **Esforço de corrigir**: Baixo — não é preciso abandonar os Markdowns (eles continuam sendo a fonte de verdade legível), apenas espelhar os itens acionáveis como Issues do GitHub com labels (`risco:alto`, `esforco:baixo`, etc.), o que também prepara o terreno para usar Projects/boards se o time crescer.

---

## 10. Recomendações de ferramentas/práticas adicionais

| Ferramenta/prática | Problema que resolve | Risco de não adotar | Esforço | Prioridade sugerida |
|---|---|---|---|---|
| **Commitar `.github/workflows/quality.yml`** | Hoje o CI inteiro (incluindo o job de segurança de banco) só existe localmente, sem nenhuma proteção real em PRs | Alto | Muito baixo | 1 (imediata) |
| **Extrair `mapRows`/detecção de duplicados do CSV para um módulo testável** + testes unitários | Fecha a maior lacuna funcional de cobertura (seção 1) | Alto | Baixo | 1 |
| **Testes de login/sessão** (Vitest + Testing Library + jsdom, reaproveitando o fixture de `tests/ui.tsx`) | Cobre o critério de aceite nº1 do MVP, hoje só validado manualmente | Alto | Médio | 2 |
| **Executar de fato os testes SQL** (garantir que o job `database-security` roda com sucesso na primeira execução real do Actions; localmente, subir Docker Desktop e rodar `bootstrap.sql`+migrações+`audit.sql`) | Hoje toda a garantia de RLS é teórica | Alto | Médio (depende de infraestrutura, não de código) | 1 |
| **Vitest + coverage** (`@vitest/coverage-v8`), mantendo os testes atuais quase inalterados | Visibilidade de cobertura real, habilita testar componentes React de forma sustentável, watch mode | Médio | Baixo-Médio | 2 |
| **Playwright** para 2–3 fluxos E2E críticos (login, cadastro+conversão de lead, importação CSV) contra um Supabase de teste dedicado (não produção) | Rede de segurança de ponta a ponta que nenhuma camada atual cobre | Médio-Alto (mas só se o produto crescer em uso) | Médio-Alto | 3 |
| **Prettier** (+ `format:check` no CI) | Consistência de estilo à prova de múltiplos contribuidores/IAs | Baixo | Baixo | 3 |
| **Husky + lint-staged** para pre-commit (`lint`, `format:check`, talvez `test` para arquivos afetados) | Move o feedback de qualidade para antes do push, reduz iterações de CI vermelho | Baixo | Baixo | 4 |
| **Dependabot ou Renovate** para `npm` e para a Action `actions/setup-node`/`actions/checkout` | Hoje as versões de dependência são atualizadas manualmente; `npm audit` só foi rodado uma vez, manualmente | Médio (superfície de dependências desatualizadas/vulneráveis cresce silenciosamente) | Baixo (configuração automatizada) | 2 |
| **Deploy automatizado** (conectar Cloudflare Pages ao GitHub ou job `deploy` no Actions, gated por `checks`+`database-security`) | Remove o único elo manual do pipeline hoje | Médio | Baixo-Médio | 2 |
| **Smoke test pós-deploy** (script simples ou Playwright mínimo contra a URL publicada) | Detecta falhas de deploy que HTTP 200 sozinho não pega (lição já documentada em `qualidade.md`) | Médio | Baixo-Médio | 3 |
| **Incluir `tests/**/*.tsx` em um projeto TS referenciado** | Fecha a lacuna de type-check da seção 6 | Baixo-Médio | Baixo | 4 |
| **Espelhar pendências dos docs em GitHub Issues com labels de risco/esforço** | Rastreabilidade estruturada de dívida técnica | Baixo | Baixo | 5 |

---

## Resumo executivo

Principais achados: o CI proposto ainda não está commitado; a maior garantia de segurança do produto (RLS/SQL) nunca foi executada; a detecção de duplicados no CSV e o fluxo de login — ambos citados como críticos no `validation-plan.md` — não têm nenhum teste automatizado; e o deploy continua manual, sem smoke test pós-publicação. Local, `npm run lint`, `npm test` (15/15) e `npm run build` passaram sem erros nesta análise.

**Top 5 recomendações priorizadas:**

1. **Commitar `.github/workflows/quality.yml` e validar sua primeira execução real** (incluindo o job `database-security`) — sem isso, nenhuma das garantias de teste vale para PRs/pushes reais. *Risco alto, esforço muito baixo.*
2. **Executar de fato os testes SQL de RLS** (`bootstrap.sql` + migrações + `audit.sql`) em Postgres descartável local e/ou confirmar sucesso no Actions — hoje é a única camada de segurança de dados totalmente não verificada. *Risco alto, esforço médio (infraestrutura).*
3. **Extrair e testar a lógica de detecção de duplicados do CSV** (`mapRows` em `CsvImportPage.tsx`) e **adicionar testes de contrato para `convertLeadToClient`** — fecha as duas lacunas de cobertura mais alinhadas a requisitos explícitos do MVP. *Risco alto, esforço baixo.*
4. **Cobrir o fluxo de login/sessão com testes automatizados** (Vitest + Testing Library, reaproveitando o padrão de `tests/ui.tsx`) em vez de depender só de inspeção manual via fixture — é o critério de aceite nº1 do produto. *Risco alto, esforço médio.*
5. **Automatizar o deploy (Cloudflare Pages ↔ GitHub) e adicionar um smoke test pós-deploy simples** — remove o elo manual restante do pipeline e detecta falhas que "HTTP 200" não revela, conforme já registrado em `docs/qualidade.md`. *Risco médio, esforço baixo-médio.*

Recomendações complementares de médio prazo, em ordem de valor: Dependabot/Renovate para dependências, Prettier no CI, Husky + lint-staged para pre-commit, inclusão de `tests/**/*.tsx` no type-check, Playwright para 2–3 fluxos E2E críticos, e migração gradual para Vitest com relatório de cobertura.
