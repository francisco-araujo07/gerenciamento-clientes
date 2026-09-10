# Aplicação das recomendações de arquitetura

Data: 10/09/2026

## Mudanças realizadas

- Extraídos `filterLeads`, `isActiveLead` e `isOverdueLead` para `src/utils/leads.ts`, preservando a busca por empresa/responsável, os filtros de status e a regra de atraso.
- Extraídos `filterClients` e `groupProjectsByClient` para `src/utils/clients.ts`. O serviço de clientes passou a reutilizar o agrupamento puro de projetos, sem alterar o resultado da listagem.
- Criado `ContactFields` compartilhado em `src/types/lead.ts` e reutilizado por `Client`/`ClientValues` em `src/types/client.ts`.
- Centralizados o contrato de página e os limites da leitura em `src/lib/read-all.ts` (`ReadPage`, `ReadPageFetcher`, `READ_ALL_PAGE_SIZE` e `MAX_READ_ALL_ROWS`).
- Validações de status passaram a reutilizar `leadStatuses` e `projectStatuses`, evitando listas literais duplicadas em `src/utils/validation.ts`.
- Adicionados testes de regressão para filtros, atrasos e agrupamento em `tests/regressions.test.mjs`.

## Arquivos alterados nesta aplicação

- `src/types/lead.ts`
- `src/types/client.ts`
- `src/utils/leads.ts`
- `src/utils/clients.ts`
- `src/utils/validation.ts`
- `src/lib/read-all.ts`
- `src/features/clients/client-service.ts`
- `tests/regressions.test.mjs`

O working tree já continha outras alterações de outros trabalhos; elas foram preservadas. Nenhuma migração SQL, página, `App.tsx`, CSS, componente ou formulário restrito foi alterado por esta aplicação.

## Validações

- `npm test`: aprovado, 20 testes.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `tsc -b` e build Vite.
- Diagnósticos dos arquivos refatorados: nenhum erro reportado.
- `git diff --check` nos arquivos desta aplicação: sem erro de whitespace.

## Pendências

- A integração dos helpers de filtro e paginação nas páginas permanece pendente porque o escopo desta tarefa proibiu alterações em `src/pages/*`. Os componentes ainda calculam suas listas localmente.
- Busca, filtros e paginação no servidor continuam pendentes e dependem de alteração dos serviços, das páginas e da estratégia de consulta; não foram inventados parâmetros novos.
- A agregação de faturamento no servidor/RPC continua pendente por depender de banco, schema e migração.
- Tipos gerados pelo Supabase (`Database`/`SupabaseClient<Database>`) continuam pendentes e não foram simulados manualmente.
- `useAsyncData`, `Field`, `DataTable`, navegação por URL e observabilidade não foram introduzidos porque sua adoção exigiria alterar páginas, componentes, `App.tsx` ou áreas fora do escopo exclusivo.
