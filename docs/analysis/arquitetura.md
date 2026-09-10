# Análise de arquitetura — Gerenciamento de clientes

Data: 10/09/2026. Autor: revisão técnica assistida por IA (arquiteto de software sênior React/TypeScript).
Escopo: estado ATUAL do working directory (inclui alterações não commitadas), repositório `C:\Users\danie\Downloads\FRANCISCO\gerenciamento-clientes`.
Referências lidas: `docs/ai-context/README.md`, `architecture.md`, `file-structure.md`, `data-model.md`, `current-state.md`, `qualidade.md`.
Natureza: **somente leitura**. Nenhum arquivo de código foi alterado durante esta análise.

Convenção de avaliação: cada achado recebe **Impacto** (Alto/Médio/Baixo — efeito no produto/negócio se não corrigido) e **Esforço** (Alto/Médio/Baixo — custo estimado de correção).

---

## 1. Organização de pastas e separação de responsabilidades

A estrutura real (`pages/`, `features/`, `components/`, `lib/`, `types/`, `utils/`) segue o que está aprovado em `file-structure.md`, com uma divergência: o documento prevê uma pasta `hooks/` para "lógica reutilizável da interface", que **não existe** no código atual. Isso não é um erro, mas é uma dívida entre o planejado e o implementado.

Na prática, cada `pages/*.tsx` concentra três responsabilidades no mesmo arquivo: busca de dados (chamando `*-service.ts`), estado de UI (loading/erro/paginação/filtros) e renderização (JSX denso, muitas vezes em uma única linha gigante — ver seção 10). Não há acoplamento indevido entre `features` e `pages` (as páginas importam serviços, nunca o inverso), o que é saudável. O ponto fraco é a ausência de uma camada intermediária de "hooks de dados" que hoje faz com que o mesmo padrão (`useState` + `useCallback(load)` + `useEffect(load)` + `isLoading`/`error`) seja reescrito manualmente em `LeadsPage`, `LeadDetailsPage`, `ClientsPage`, `ClientDetailsPage` e `DashboardPage` — 5 cópias quase idênticas.

| Achado | Impacto | Esforço | Recomendação |
|---|---|---|---|
| Pasta `hooks/` prevista em `file-structure.md` nunca foi criada; padrão de fetch é duplicado manualmente 5 vezes | Médio | Baixo | Criar `src/hooks/useAsyncData.ts` com um hook genérico `function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[])` que centralize `data`, `loading`, `error`, `reload`. Substituir gradualmente nas páginas. |
| Páginas misturam busca de dados, regras de filtro/paginação e JSX no mesmo componente | Médio | Médio | Extrair a lógica de filtragem (ex.: `visibleLeads` em `LeadsPage`) para funções puras em `utils/` (testáveis fora do React), mantendo o componente só com orquestração e renderização. |

Fora isso, a separação `types/` (formato dos dados) vs `utils/` (validação/formatação) vs `lib/` (infraestrutura Supabase) é consistente e é respeitada em todos os arquivos analisados — não há, por exemplo, chamadas diretas a `supabase.from(...)` dentro de componentes de página; tudo passa pelos `*-service.ts`. Isso é o ponto mais forte da arquitetura atual.

## 2. Padrões de acesso a dados (`client-service.ts`, `lead-service.ts`)

Existe, sim, uma camada de serviço clara e bem delimitada: toda leitura/escrita no Supabase passa por `src/features/{clients,leads}/*-service.ts`. Os padrões são consistentes entre os dois arquivos:

- Toda função lança (`throw error`) em vez de engolir erros — quem decide a mensagem de UI é a página chamadora, nunca o serviço. Isso é uma boa prática (serviço fica livre de string de UI/i18n).
- Escrita usa controle de concorrência otimista (`eq('updated_at', expectedUpdatedAt).select('id').single()`), garantindo que updates "silenciosamente perdidos" (0 linhas afetadas) se tornem erro em vez de sucesso falso. Testado em `tests/services.test.mjs`.
- Payloads passam por `contactPayload`/`leadPayload`/`projectPayload` (`utils/validation.ts`) antes de qualquer insert/update — nenhuma função de serviço aceita objeto "spread" livre; isso fecha a porta para campos administrativos (`id`, `lead_id`, `role`) entrarem via payload, o que é validado em teste.

Riscos observados:

- **Tipagem não gerada a partir do schema real.** `createClient` é instanciado sem o genérico `Database` (não há `supabase gen types typescript`). Isso significa que `client.from('leads').select('*')` não é verificado pelo compilador contra as colunas reais da tabela — a "fonte da verdade" dos campos vive em **três lugares independentes e mantidos manualmente**: a migração SQL, `src/types/{lead,client}.ts` e `contactPayload`/`leadPayload` em `validation.ts`. Se alguém adicionar uma coluna no banco, nada no TypeScript avisa sobre a divergência.
- Uso de `as Lead` / `as Client` / `as Project` em vários pontos (`getLead`, `updateLead`, `getClient`) para "confiar" no formato retornado pelo Supabase, em vez de o compilador inferir isso de um tipo gerado.
- `listClients` faz duas consultas paralelas (`clients` e **todos** os `projects` da equipe) e junta em memória — funciona bem hoje, mas cresce linearmente com o número total de projetos, não com o de clientes exibidos (ver seção 9).

| Achado | Impacto | Esforço | Recomendação |
|---|---|---|---|
| Tipos de `Lead`/`Client`/`Project` mantidos manualmente em 3 lugares (SQL, `types/*.ts`, `validation.ts`) sem geração automática | Médio | Médio | Adotar `supabase gen types typescript --local` (ou via CLI conectado ao projeto) num script `npm run types:sync`, gerando `src/types/database.ts` e usando `SupabaseClient<Database>`. Os tipos "de domínio" (`Lead`, `Client`) podem continuar existindo, mas derivados de `Database['public']['Tables']['leads']['Row']` em vez de redigitados. |
| `as Lead`/`as Client` sem validação de shape em runtime | Baixo | Baixo | Ao adotar tipos gerados, os `as` deixam de ser necessários na maioria dos casos; onde ainda existirem, documentar por que a validação de runtime já ocorreu (payload) e o `as` é seguro. |
| `listClients` sempre lê **todos** os projetos da equipe para montar o resumo por cliente | Médio | Médio | Ver seção 9 (agregação no servidor). |

## 3. Gerenciamento de estado

Não há Context API nem store global (Redux/Zustand/Jotai) — e, para o tamanho atual do app (5 páginas, 1 sessão, dados compartilhados por toda a equipe), isso é uma escolha adequada, não uma falha. O estado é 100% local (`useState`/`useEffect`) por componente, e o "prop drilling" é raso: `supabase` desce apenas um nível (de `App` para cada `Page`), o que é aceitável.

O ponto que **vai** ficar frágil com o crescimento é a máquina de navegação em `App.tsx`: a página atual é um `useState<'dashboard' | 'leads' | 'clients' | 'guide'>`, e cada botão do menu repete manualmente a mesma sequência de 4 `setState`:

```1:1:src/App.tsx
onClick={() => { setPage('dashboard'); setSelectedLeadId(null); setIsImportingLeads(false); setSelectedClientId(null) }}
```

Esse bloco aparece **4 vezes** (uma por botão de navegação) só variando o valor de `setPage`. Além da duplicação, essa abordagem não usa a URL do navegador: não há deep-link para um lead/cliente específico, o botão "voltar" do navegador não funciona como o usuário espera, e não é possível compartilhar um link direto para `ClientDetailsPage`. Isso é aceitável com 5 páginas, mas cada nova tela (ex.: "Projetos", "Configurações", "Relatórios") vai exigir mais `useState` e mais repetição desse padrão.

| Achado | Impacto | Esforço | Recomendação |
|---|---|---|---|
| Navegação via `useState` de string, sem URL/roteador; reset de seleção duplicado 4x em `App.tsx` | Médio (hoje) → Alto (se o app crescer para 8-10+ telas) | Baixo agora / Médio se adiado | Curto prazo: extrair uma função única `navigate(page: Page)` que centraliza o reset de `selectedLeadId`/`selectedClientId`/`isImportingLeads`. Médio prazo: migrar para `react-router` (ou `wouter`, mais leve) quando surgir a 2ª exigência real de deep-link (ex.: abrir um cliente a partir de uma notificação/e-mail). |
| Nenhuma camada de cache/compartilhamento de dados entre páginas (cada página refaz o fetch completo ao montar) | Baixo (hoje) | Médio | Se o volume de dados crescer, considerar `@tanstack/react-query` ou um cache simples em `lib/` para evitar refetch completo a cada troca de aba. Não é urgente para o volume atual (dezenas/centenas de registros). |

Context API só se justificaria se: (a) a sessão do Supabase precisasse ser lida em muitos componentes profundos (hoje só em `App.tsx`), ou (b) surgir necessidade de preferências de usuário/tema compartilhadas. Nenhuma das duas existe hoje — **não recomendamos introduzir Context/Redux prematuramente**.

## 4. Componentização e reuso (`Modal`, `Pagination`, `ErrorBoundary`)

Os três componentes genéricos existentes são pequenos, focados e bem projetados:

- `Modal.tsx` usa `<dialog>` nativo (`showModal()`), o que dá foco modal, `Escape` e devolução de foco "de graça" (correção documentada na auditoria de 06/09). É genérico (`children`, `labelledBy`, `busy`, `onClose`) e reutilizado tanto em `LeadsPage` quanto implicitamente no padrão de formulário de `ClientDetailsPage`.
- `Pagination.tsx` é puro, sem estado interno, com `PAGE_SIZE` exportado como constante compartilhada — bom exemplo de componente "burro" reutilizável.
- `ErrorBoundary.tsx` é simples e cumpre o papel de rede de segurança para erros de renderização.

O que falta é reuso em um nível abaixo: **campos de formulário e tabelas**. `LeadForm.tsx` e `ClientEditor.tsx` repetem, campo a campo, o mesmo padrão `<label className="field">Rótulo<input value=... onChange=.../></label>`, com pequenas variações (uso de `??` vs `||`, `required`, `type`). O formulário de projeto (dentro de `ClientDetailsPage.tsx`) repete o padrão de novo, inline. Da mesma forma, `LeadsPage` e `ClientsPage` reimplementam, cada uma à sua maneira, a mesma combinação busca + filtro + tabela + paginação.

```29:29:src/features/leads/LeadForm.tsx
<label className="field">Responsável<input value={values.responsible_name ?? ''} onChange={(e) => field('responsible_name', e.target.value)} /></label>
```
```8:8:src/features/clients/ClientEditor.tsx
<label className="field">Responsável<input value={values.responsible_name || ''} onChange={(e) => field('responsible_name', e.target.value)} /></label>
```

| Achado | Impacto | Esforço | Recomendação |
|---|---|---|---|
| Campos de formulário duplicados entre `LeadForm`, `ClientEditor` e o formulário de projeto inline em `ClientDetailsPage` | Médio | Baixo/Médio | Criar `components/Field.tsx` genérico: `<Field label="Responsável" value={...} onChange={...} type="text" />`. Reduz ~15 blocos repetidos para chamadas de 1 linha, e centraliza acessibilidade (`label`+`input` sempre associados). |
| Tabela + busca + filtro + paginação reimplementada de forma diferente em `LeadsPage` e `ClientsPage` | Médio | Médio | Extrair um componente `components/DataTable.tsx` (colunas, linhas, `renderRow`) combinado com um hook `useFilteredList(items, { search, matchers })`, mantendo cada página responsável só por *quais* colunas/filtros usar. |
| Não há Storybook/catálogo de componentes, então o "contrato" de `Modal`/`Pagination` só é visível lendo o código-fonte | Baixo | Baixo | Não crítico neste estágio (poucos componentes). Se `Field`/`DataTable` forem criados, documentar o contrato com comentário JSDoc curto acima do componente já é suficiente para o tamanho do time. |

## 5. Tratamento de erros e resiliência

Este é um ponto historicamente forte do projeto (fruto da auditoria de 06/09/2026): existe um `ErrorBoundary` no topo (`main.tsx`), tratamento de timeout de sessão (25s) em `App.tsx`, timeout de rede de 20s em todo fetch do Supabase (`lib/supabase.ts`), e `readAll` que nunca devolve resultado parcial como se fosse completo (`lib/read-all.ts`). Mensagens de erro são sempre em português, genéricas o suficiente para não expor detalhes internos, e diferenciam estados (`Indisponível` vs `R$ 0,00` no dashboard, por exemplo).

Pontos a evoluir:

- **`ErrorBoundary` único, no topo da árvore.** Um erro de renderização em `GuidePage` (por exemplo, um bug no `guide-data.ts`) derruba a aplicação inteira, incluindo a navegação — o usuário perde acesso a Leads/Clientes até recarregar. Não há boundary por página/rota.
- **Erros são descartados sem log estruturado.** Todo `catch { setErrorMessage(...) }` ignora o valor do erro (nem `console.error`, nem envio a um serviço de observabilidade). Isso é aceitável para o MVP, mas `qualidade.md` já registra "não há monitoramento externo configurado" como pendência — é uma lacuna real para diagnosticar problemas em produção sem acesso ao navegador do usuário.
- Os `catch` são, quase todos, "cegos" (`catch { ... }` sem parâmetro), então não é possível diferenciar uma falha de rede de uma falha de validação de uma falha de RLS — a mensagem é sempre a mesma ("não foi possível salvar/carregar"). Isso é uma decisão consciente de UX (mensagens uniformes, ver `services.test.mjs`), mas tem custo de diagnóstico.

| Achado | Impacto | Esforço | Recomendação |
|---|---|---|---|
| Um único `ErrorBoundary` global; falha em uma página derruba toda a navegação | Médio | Baixo | Envolver cada `{page === 'x' && <XPage/>}` em `App.tsx` com um `<ErrorBoundary>` próprio (o componente já existe e é reutilizável), preservando o header/nav visível mesmo se uma página quebrar. |
| Nenhum log estruturado ou serviço de observabilidade (Sentry/LogRocket/etc.) para erros capturados | Alto (para operação em produção real) | Médio | Adicionar, no mínimo, `console.error(error)` nos `catch` (hoje descartado) e avaliar um serviço gratuito de error tracking (ex.: Sentry free tier) antes de declarar "produção pronta" — já listado como pendência em `qualidade.md`, reforçamos aqui do ponto de vista de arquitetura. |
| Mensagens de erro não diferenciam causa (rede vs validação vs conflito) | Baixo | Baixo | Tradeoff aceitável para o MVP; revisar somente se usuários reportarem confusão real. |

## 6. Qualidade de tipos TypeScript

`tsconfig.app.json` está com `"strict": true`, mais `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` e `erasableSyntaxOnly` — configuração rigorosa e adequada para um projeto que preza por confiabilidade. Não foi encontrado nenhum uso de `any` explícito em `src/` (confirmado por busca em todo o diretório). O único "escape hatch" de tipos é o `as unknown as SupabaseClient` em `tests/ui.tsx` — mas isso é uma fixture de teste/demonstração, fora do build de produção, então é aceitável.

Duplicação de tipos já foi coberta na seção 2 (o schema vive em 3 lugares). Vale reforçar aqui, do ponto de vista puramente de tipos:

- `LeadFormValues = Omit<Lead, 'id' | 'created_at' | 'updated_at'>` e `ClientValues = Pick<Client, ...>` são bons exemplos de tipos **derivados**, não duplicados — isso é o padrão certo e deveria ser replicado quando os tipos base vierem de schema gerado (seção 2).
- `Client['projects']` embutido no tipo `Client` mistura uma entidade de "leitura agregada" com a linha crua da tabela `clients` (que não tem coluna `projects`). Não é um problema em si, mas caso um tipo `Database` gerado seja adotado, esse campo precisará ser explicitamente excluído/estendido (`Omit<Row, never> & { projects: Project[] }`) para não confundir com a linha real do banco.

| Achado | Impacto | Esforço | Recomendação |
|---|---|---|---|
| Nenhum `any`, `strict` ativo — ponto positivo, sem ação necessária | — | — | Manter e considerar adicionar `noUncheckedIndexedAccess` no futuro para reforçar ainda mais o acesso a arrays/objetos indexados (ex.: `cells[headers.indexOf(header)]` em `CsvImportPage.tsx`, que hoje é `string | undefined` só implicitamente coberto pelo `?.trim() ?? ''`). |
| `Client.projects` mistura linha de tabela com dado agregado | Baixo | Baixo | Ao introduzir tipos gerados, modelar explicitamente como `type ClientWithProjects = Tables['clients']['Row'] & { projects: Tables['projects']['Row'][] }`. |

## 7. Configuração de build/tooling (Vite, TS project references, oxlint)

A configuração é enxuta e moderna:

- `tsconfig.json` usa **project references** (`tsconfig.app.json` para o app, `tsconfig.node.json` para `vite.config.ts`), o padrão recomendado atual do Vite/TS — correto.
- `vite.config.ts` valida a configuração pública (`publicConfig`) **em tempo de build**, rejeitando chave privilegiada antes de gerar o artefato — uma proteção de segurança incorporada ao próprio pipeline de build, não apenas em runtime. Isso é uma boa prática pouco comum em projetos desse tamanho.
- `oxlint` está configurado (`.oxlintrc.json`), mas com apenas 2 regras explícitas (`react/rules-of-hooks`, `react/only-export-components`) além dos plugins habilitados (`react`, `typescript`, `oxc`). O oxlint tem regras "recommended" ativadas por padrão mesmo sem listagem explícita, mas a ausência de um `extends`/preset documentado no arquivo torna implícito **quais** regras estão de fato ativas — depende de conhecer o comportamento padrão da ferramenta.
- Não há Prettier (ou config de formatação) — o estilo de código denso observado em várias páginas (ver seção 10) não é combatido por nenhuma ferramenta automática hoje.
- CI (`.github/workflows/quality.yml`, ainda não commitado) já cobre lint + test + build + uma verificação de migração SQL contra Postgres 17 efêmero — é um pipeline sólido para o tamanho do projeto, incluindo o caso raro (e valioso) de testar as políticas de RLS em banco descartável a cada push/PR.

| Achado | Impacto | Esforço | Recomendação |
|---|---|---|---|
| Regras do `oxlint` ativas dependem do padrão implícito da ferramenta, sem preset explícito documentado | Baixo | Baixo | Adicionar comentário no `.oxlintrc.json` (ou `extends`) explicitando qual conjunto de regras é a base, para newcomers/IA não precisarem inferir o comportamento padrão da versão instalada. |
| Nenhuma ferramenta de formatação automática (Prettier/`oxlint format`) | Médio | Baixo | Adicionar Prettier (ou o formatter do próprio oxc, se disponível na versão instalada) com regra de largura de linha razoável (ex.: 120-160 colunas) e rodar uma vez sobre o repositório — resolve boa parte da seção 10 quase de graça. |
| CI cobre lint/test/build/SQL, mas não tem etapa de auditoria de dependências (`npm audit`) automatizada | Baixo | Baixo | Adicionar `npm audit --audit-level=high` (não-bloqueante ou com `continue-on-error`, para não travar o CI por vulnerabilidades de terceiros fora de controle) como etapa informativa no job `checks`. |

## 8. Testabilidade da arquitetura atual

A arquitetura **facilita bem** testes de lógica pura e de camada de serviço, e isso já está sendo bem aproveitado:

- `tests/regressions.test.mjs` testa `csv.ts`, `dates.ts`, `validation.ts`, `read-all.ts` e `public-config.ts` — todas funções puras/sem dependência de DOM, fáceis de importar e testar com `node --test`, sem necessidade de framework de teste pesado.
- `tests/services.test.mjs` testa `client-service.ts`/`lead-service.ts` com um `SupabaseClient` real, mas com `fetch` mockado — uma abordagem elegante que testa o **contrato HTTP** real (query params, method, body) sem precisar de rede ou de um Supabase local.
- `tests/ui.tsx`/`ui.html` é uma fixture manual de inspeção visual (não é teste automatizado), útil para QA exploratório de estados de falha (`?fail=session`, `?fail=data`, `?fail=write`), mas não substitui teste de componente.

O que a arquitetura **não facilita hoje** é teste automatizado de componentes React (renderização, interação de formulário, comportamento de filtro/paginação na tela). Isso acontece porque:

1. Não há `@testing-library/react` (ou equivalente) nas dependências — só `node --test` puro.
2. A lógica de filtro (`visibleLeads` em `LeadsPage`, cálculo de `overdue` duplicado 2x dentro do mesmo arquivo) está **inline dentro do componente**, então só pode ser exercitada renderizando o componente inteiro — que hoje não tem ferramenta de teste para isso.

```35:42:src/pages/LeadsPage.tsx
const visibleLeads = useMemo(() => leads.filter((lead) => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    const found = !term || lead.company_name.toLocaleLowerCase('pt-BR').includes(term) || lead.responsible_name?.toLocaleLowerCase('pt-BR').includes(term)
    const active = lead.status === 'novo' || lead.status === 'negociacao'
    const statusMatches = statusFilter === 'todos' || (statusFilter === 'ativos' ? active : lead.status === statusFilter)
    const overdue = Boolean(lead.next_action_due_date && lead.next_action_due_date < today() && active)
    return found && statusMatches && (!onlyOverdue || overdue)
  }), [leads, onlyOverdue, search, statusFilter])
```

| Achado | Impacto | Esforço | Recomendação |
|---|---|---|---|
| Lógica de filtro/"atrasado" embutida no componente, sem cobertura de teste automatizado | Médio | Baixo | Extrair para `utils/leads.ts`: `export function filterLeads(leads, { search, statusFilter, onlyOverdue })` e `export function isOverdue(lead, today)`. Passa a ser testável em `regressions.test.mjs` sem precisar renderizar React, e elimina a duplicação do cálculo de `overdue` que hoje aparece 2x no mesmo arquivo (linha 40 e linha 75, aproximadamente). |
| Ausência de testes de componente React (formulários, tabelas, modais) | Médio | Médio | Adicionar `@testing-library/react` + `jsdom` (ou usar o runner nativo do Vite/`vitest` só para esses casos) cobrindo: submissão de `LeadForm`/`ClientEditor` com campos obrigatórios, abertura/fechamento do `Modal` (Escape, foco), paginação do `Pagination`. Não precisa cobrir tudo de uma vez — priorizar `Modal` e `Pagination` primeiro, por serem os componentes mais reutilizados. |
| `tests/ui.tsx` é valiosa para QA manual, mas não roda em CI como verificação automatizada de comportamento | Baixo | — | Manter como está; é intencionalmente uma fixture de inspeção manual, documentada como tal. Não recomendamos convertê-la em teste automatizado — teria custo alto para pouco ganho frente à opção acima (testing-library). |

## 9. Escalabilidade e dívida técnica

Este é o bloco mais importante para decisões de médio prazo. A arquitetura atual foi construída, de forma consciente e documentada (`qualidade.md`), para o volume de um freelancer/pequena equipe — e funciona bem nesse volume. Os pontos abaixo indicam **onde ela vai quebrar primeiro** se o produto crescer (mais linhas, mais usuários simultâneos, mais tabelas/features).

**a) Leitura completa de tabelas no cliente.** `listLeads` e `listClients` usam `readAll` para buscar **toda** a tabela (até o teto de 20.000 registros) e filtram/paginam no navegador. Isso é simples e correto hoje, mas:
- Cresce o tempo de carregamento inicial de cada página linearmente com o total de linhas, não com o que é exibido.
- Ao atingir 20.000 registros em qualquer uma das tabelas, a aplicação **para de funcionar** para aquela tela (erro deliberado, "Volume excede o limite de leitura"), documentado como proteção transitória em `qualidade.md`.
- `DashboardPage` soma o faturamento no navegador a partir de **todos** os projetos concluídos — mesmo problema.

| Achado | Impacto | Esforço | Recomendação |
|---|---|---|---|
| Busca/filtro/paginação de Leads e Clientes ocorre 100% no cliente, sobre a tabela inteira | Alto (bloqueia crescimento de dados) | Alto | Mover filtro e paginação para o servidor: `client.from('leads').select('*', { count: 'exact' }).ilike('company_name', ...).eq('status', ...).range(from, to)`. Isso exige refazer `listLeads`/`listClients` para aceitar parâmetros de filtro/página, e mover a UI de filtro de `useMemo` local para "refetch ao mudar filtro" (debounce na busca textual). É um refactor de esforço alto, mas **não urgente** enquanto o volume estiver na casa de centenas/poucos milhares de registros. |
| Faturamento do Dashboard somado no navegador sobre todos os projetos concluídos | Alto (mesmo motivo acima, e é justamente o número que a diretoria/usuário mais consulta) | Médio | Criar uma function/view SQL (`select sum(price) from projects where status = 'concluido' and completed_at between $1 and $2`) e uma RPC exposta via RLS, substituindo `readAll` + soma no `DashboardPage`. Reduz o problema de "20.000 linhas" a uma única linha de resultado agregado, e resolve, de uma vez, um risco de segurança de "vazar" todos os preços de projetos ao navegador para calcular uma soma local. |

**b) Modelo de acesso "toda a equipe vê tudo".** As policies de RLS atuais (`for all to authenticated using (true)`) são adequadas para uma equipe única compartilhando dados — decisão documentada e correta para o MVP. Se o produto evoluir para atender **múltiplos clientes/empresas** (multi-tenant SaaS), isso exige uma coluna `tenant_id`/`organization_id` em todas as tabelas, novas policies por tenant, e provavelmente Postgres RLS baseado em `auth.jwt()` claims customizadas — uma mudança estrutural de banco, não incremental.

| Achado | Impacto | Esforço | Recomendação |
|---|---|---|---|
| Ausência de segregação por tenant/empresa no modelo de dados | Alto **somente se** o produto for oferecido a múltiplos clientes/empresas (SaaS) | Alto | Não agir agora (contradiria a decisão explícita de dados compartilhados do MVP). Registrar como decisão arquitetural pendente em `docs/ai-context/decisions.md`, para não ser esquecida caso o modelo de negócio mude de "uso interno de uma equipe" para "produto vendido a várias empresas". |

**c) Exclusão física (hard delete) sem trilha de auditoria.** `deleteLead`/`deleteClient`/`deleteProject` removem a linha definitivamente. Não há tabela de auditoria, `deleted_at` (soft delete) ou log de quem excluiu o quê. Para uma equipe pequena isso é aceitável; conforme o histórico de dados cresce em valor (relatórios anuais, disputas com cliente, etc.), a perda de "quem excluiu e quando" pode ser custosa.

| Achado | Impacto | Esforço | Recomendação |
|---|---|---|---|
| Exclusões são físicas e sem trilha de auditoria (quem/quando) | Médio (cresce com o tempo de operação) | Médio | Se o custo de manter histórico for aceitável, migrar para soft delete (`deleted_at timestamptz`) nas 3 tabelas + filtro `is null` nas policies/serviços; alternativamente, uma tabela `audit_log` simples (trigger `AFTER DELETE`) registrando `table_name`, `row_id`, `user_id`, `deleted_at`. Não é urgente, mas cresce em prioridade com o tempo de uso real do sistema. |

**d) Custo marginal de novas entidades.** Adicionar uma nova entidade (ex.: "Contratos", "Tarefas") hoje exige repetir manualmente o padrão inteiro: tipo em `types/`, funções em um novo `*-service.ts`, formulário dedicado, página dedicada, entradas de navegação em `App.tsx`. Não há nenhuma abstração de "CRUD genérico" reaproveitável — o que é aceitável com 3 entidades (Lead/Cliente/Projeto), mas o custo de cada nova entidade não diminui com o tempo.

| Achado | Impacto | Esforço | Recomendação |
|---|---|---|---|
| Nenhuma abstração de "serviço CRUD genérico" — cada nova entidade repete o padrão do zero | Baixo/Médio (custo cresce linearmente, não é bloqueante) | Médio | Ao adicionar a 4ª entidade com padrão semelhante (contato + status + `updated_at`), extrair uma fábrica `createCrudService<T>(table: string)` que gere `list/get/create/update/delete` com o mesmo tratamento de concorrência/paginação já validado em `read-all.ts`. Não recomendamos fazer isso preventivamente para só 3 entidades — o custo de abstração prematura seria maior que o ganho hoje. |

**e) Limite de 20.000 registros do `readAll` como "parede".** Comportamento correto de falha explícita (não retorna dado parcial), mas é uma parede dura: ao atingir o limite, a tela simplesmente para de funcionar até alguém aumentar a constante ou reescrever a leitura como paginada no servidor. Vale monitorar o crescimento real de linhas por tabela (ex.: revisão trimestral) para não ser surpreendido em produção.

## 10. Convenções de código e consistência

Nomenclatura é consistente e bem pensada: funções de serviço seguem sempre `list/get/create/update/delete + Entidade` (`listLeads`, `getClient`, `createProject`...); tipos seguem `PascalCase` (`Lead`, `ClientValues`); campos de banco em `snake_case` são preservados tal como estão no Postgres diretamente nos tipos TS (`company_name`, `next_action_due_date`), evitando uma camada de mapeamento — escolha pragmática e consistente em 100% dos arquivos revisados.

Duas inconsistências pontuais, de baixo impacto:

- **Extensão de import inconsistente.** Alguns arquivos importam módulos locais com extensão explícita (`from '../../lib/read-all.ts'`, `from './dates.ts'`), outros sem (`from '../utils/dates'`, `from '../components/Modal'`). Ambos funcionam (`allowImportingTsExtensions` está habilitado), mas a mistura é inconsistente dentro do mesmo projeto.
- **Estilo de formatação extremamente denso.** Vários arquivos (`ClientsPage.tsx`, `ClientDetailsPage.tsx`, `ClientEditor.tsx`, `App.tsx` em parte) têm o corpo do componente inteiro — às vezes 500+ caracteres — em uma única linha de `return`. Isso comprime o arquivo, mas prejudica: leitura em code review, diffs do git (uma alteração de um campo produz um diff de linha inteira, difícil de revisar), e a capacidade de um novo colaborador (humano) entender rapidamente a árvore de JSX. Não há indício de que isso seja limitação de ferramenta — parece uma escolha de estilo deliberada para reduzir contagem de linhas.

| Achado | Impacto | Esforço | Recomendação |
|---|---|---|---|
| Mistura de imports com/sem extensão `.ts` explícita | Baixo | Baixo | Padronizar (recomendado: sem extensão, mais comum no ecossistema React/Vite) e aplicar de forma consistente; um formatter/lint rule pode automatizar isso. |
| JSX/lógica de componente condensada em linhas únicas muito longas em várias páginas | Médio (manutenção/revisão de código, principalmente se mais pessoas passarem a contribuir) | Baixo | Passar os arquivos por um formatter (Prettier ou `oxlint`/`oxc format`, se disponível) com `printWidth` razoável (120–160). É uma correção mecânica, de baixo risco, que não altera comportamento — bom primeiro passo antes de qualquer refactor estrutural das seções 1, 3 e 4. |

---

## Resumo executivo

A arquitetura atual é **coerente com o estágio do projeto** (pós-MVP, equipe pequena, dados compartilhados): camada de serviço bem isolada, tipagem forte sem `any`, tratamento de erro e concorrência maduro para o tamanho do time, e uma suíte de testes leve mas bem direcionada (lógica pura + contrato HTTP + Postgres efêmero em CI). Os principais riscos não são estruturais/urgentes — são pontos de atenção para quando o volume de dados, o número de telas ou o número de contribuidores crescerem. As 5 recomendações abaixo estão priorizadas por relação impacto × esforço (as mais "baratas e valiosas" primeiro):

1. **Formatar o código com Prettier/oxc-format** (Impacto Médio, Esforço Baixo) — resolve boa parte da legibilidade/diffs hoje prejudicados pelas linhas JSX gigantes, sem alterar comportamento.
2. **Extrair a lógica de filtro/paginação de Leads e Clientes para funções puras testáveis** em `utils/` (Impacto Médio, Esforço Baixo) — elimina duplicação (cálculo de "atrasado" repetido, filtros reimplementados por página) e viabiliza teste automatizado sem precisar de `testing-library`.
3. **Criar um hook `useAsyncData` e um componente `Field` genérico** (Impacto Médio, Esforço Baixo/Médio) — remove a repetição do padrão fetch+loading+erro em 5 páginas e da repetição de campos de formulário em `LeadForm`/`ClientEditor`/formulário de projeto.
4. **Mover agregação de faturamento (Dashboard) e, depois, filtros de Leads/Clientes para o servidor** (Impacto Alto, Esforço Alto) — é o item que efetivamente vai "quebrar" primeiro conforme o volume de dados crescer; não é urgente hoje, mas deve ser planejado antes que qualquer tabela se aproxime de milhares de linhas.
5. **Adotar tipos gerados a partir do schema do Supabase** (`supabase gen types`) (Impacto Médio, Esforço Médio) — elimina a manutenção manual de 3 fontes de verdade para o formato dos dados (SQL, `types/*.ts`, `validation.ts`) e passa a pegar divergências de schema em tempo de compilação.

Nenhum dos achados desta análise é bloqueante para a operação atual; todos são dívidas técnicas geríveis, com o item 4 sendo o único de **impacto alto** e que deve ser monitorado continuamente (volume de registros por tabela) para disparar o refactor no momento certo — nem prematuramente, nem tarde demais.
