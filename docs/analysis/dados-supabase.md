# Análise de modelagem de dados e PostgreSQL/Supabase

Data: 10/09/2026.
Escopo: estado ATUAL do repositório (incluindo alterações não commitadas), sem executar migrações nem alterar código/schema.

Arquivos revisados:
- `supabase/migrations/20260816193000_initial_schema.sql`
- `supabase/migrations/20260816195000_convert_lead_to_client.sql`
- `supabase/migrations/20260906180000_audit_hardening.sql`
- `supabase/tests/audit.sql`, `supabase/tests/bootstrap.sql`
- `src/types/lead.ts`, `src/types/client.ts`, `src/types/guide.ts`
- `src/features/leads/lead-service.ts`, `src/features/clients/client-service.ts`
- `src/lib/read-all.ts`
- `src/utils/validation.ts`, `src/pages/LeadsPage.tsx`, `src/pages/LeadDetailsPage.tsx` (apoio)
- `exports/*.csv` (apenas formato/volume)
- `docs/ai-context/data-model.md`, `docs/ai-context/architecture.md`, `docs/ai-context/current-state.md`, `docs/operacao.md`, `docs/qualidade.md`, `docs/ai-context/release-security-plan.md`

Convenção usada abaixo: cada achado indica **Tabela/arquivo**, **Risco/limitação** e **Recomendação**.

---

## 1. Modelagem do schema (normalização, tipos, constraints, índices)

**Estrutura geral.** O modelo é simples e adequado ao MVP: `leads`, `clients`, `projects` em 3ª forma normal, sem redundância de dados de negócio (o cliente não duplica campos calculados de projeto). Tipos são bem escolhidos: `uuid` para chaves, `enum` para `lead_status`/`project_status` (evita strings livres), `numeric(12,2)` para preço (evita erros de ponto flutuante), `timestamptz` para auditoria temporal, `date` para prazos.

### 1.1 Constraints de obrigatoriedade e formato
- **Tabela:** `leads`, `clients`, `projects`.
- **Risco:** a maior parte dos campos de contato (`whatsapp`, `email`, `instagram`, `address`, `google_maps_url`) é `text` nulável sem `CHECK` de formato no banco (a validação de e-mail, URL HTTPS etc. só existe em `src/utils/validation.ts`, no cliente). Qualquer inserção via SQL Editor, script ou futura integração (ex.: n8n, Zapier) ignora essas regras. O comentário da própria migração de auditoria já reconhece isso ("A proteção no cliente não substitui controles no banco" — ver `docs/qualidade.md`).
- **Recomendação:** mover as validações críticas (formato de e-mail, protocolo do link do mapa) para `CHECK` no banco, complementando o que `20260906180000_audit_hardening.sql` já fez para tamanho/URL/NaN. Exemplo:

```sql
alter table public.leads add constraint leads_email_format check (
  email is null or email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
) not valid;
alter table public.clients add constraint clients_email_format check (
  email is null or email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
) not valid;
```

### 1.2 Índices para filtro/ordenação — leads
- **Tabela:** `leads`.
- **Risco:** os índices atuais cobrem bem os casos de uso hoje visíveis no código:
  - `leads_status_next_action_due_date_idx (status, next_action_due_date)` — usado implicitamente pelo filtro "ativos" + ordenação por próxima ação em `LeadsPage.tsx`/`lead-service.ts` (`order('next_action_due_date', ...).order('id')`).
  - `leads_company_name_idx`, `leads_responsible_name_idx` — hoje **não ajudam** a busca da UI, porque `LeadsPage.tsx` carrega tudo via `readAll` e filtra no cliente com `ILIKE`/`includes` em JavaScript (ver item 6). Enquanto a busca for client-side, esses índices não são exercitados por nenhuma query real; eles só se tornam úteis se a busca migrar para o servidor.
  - Falta índice em `leads.created_at` (usado implicitamente por qualquer ordenação futura por "mais recentes") e em `leads.source` (para relatórios de origem, mencionados no `data-model.md` como regra de negócio relevante).
  - O filtro "apenas atrasadas" (`next_action_due_date < hoje`) não tem um índice parcial dedicado; o índice composto `(status, next_action_due_date)` ajuda, mas um índice parcial seria mais seletivo quando a maioria dos leads estiver com `next_action_due_date` preenchido.
- **Recomendação:**

```sql
-- Ordenação "mais recentes primeiro" e relatórios por origem.
create index leads_created_at_idx on public.leads (created_at desc);
create index leads_source_idx on public.leads (source);

-- Índice parcial para "próxima ação atrasada", mais seletivo que o composto.
create index leads_overdue_idx on public.leads (next_action_due_date)
  where status in ('novo', 'negociacao') and next_action_due_date is not null;
```

Se a busca textual migrar para o servidor (recomendado no item 6), trocar `leads_company_name_idx`/`clients_company_name_idx` (btree simples, só serve para `=`/prefixo) por índices `pg_trgm` que suportem `ILIKE '%termo%'`:

```sql
create extension if not exists pg_trgm;
create index leads_company_name_trgm_idx on public.leads using gin (company_name gin_trgm_ops);
create index leads_responsible_name_trgm_idx on public.leads using gin (responsible_name gin_trgm_ops);
create index clients_company_name_trgm_idx on public.clients using gin (company_name gin_trgm_ops);
```

### 1.3 Índices — projects
- **Tabela:** `projects`.
- **Risco:** `projects_client_id_idx` (FK) e `projects_status_completed_at_idx` cobrem bem o dashboard de faturamento (filtra `status = 'concluido'` e soma por período de `completed_at`). Falta índice em `projects.deadline`, usado na página de detalhes do cliente para destacar prazos — hoje sem impacto porque a consulta já filtra por `client_id` (poucas linhas por cliente), mas se um relatório global de "projetos com prazo vencido em todos os clientes" for criado, precisará de índice dedicado.
- **Recomendação:** adicionar somente se/quando existir uma consulta global por prazo:

```sql
create index projects_deadline_idx on public.projects (deadline)
  where status not in ('concluido', 'abandonado');
```

### 1.4 Duplicidade de dados de contato entre leads e clients
- **Tabela:** `leads` / `clients`.
- **Risco:** é uma duplicação **intencional** (documentada em `data-model.md`: "Um lead convertido gera um cliente e preserva seus dados") e não um problema de normalização — o lead permanece histórico e o cliente é a fonte viva. Ainda assim, colunas como `segment`, `address`, `google_maps_url` ficam duplicadas em duas tabelas sem nenhum mecanismo de sincronização caso o cliente atualize esses dados após a conversão (o lead original não é mais tocado, o que é aceitável, mas vale registrar como decisão consciente).
- **Recomendação:** nenhuma mudança estrutural necessária; apenas documentar explicitamente em `data-model.md` que pós-conversão o lead é somente histórico/read-only para esses campos, evitando que alguém "conserte" dados no lead esperando refletir no cliente.

---

## 2. Integridade referencial e cascatas

- **Tabela/arquivo:** `20260816193000_initial_schema.sql`.
- **`clients.lead_id → leads.id` com `ON DELETE SET NULL`:** correto — excluir um lead antigo não deve destruir o cliente convertido; apenas perde-se o vínculo histórico. Único (`unique`) garante 1:1 lead↔cliente, coerente com a regra de negócio.
- **`projects.client_id → clients.id` com `ON DELETE CASCADE`:** correto para o MVP (excluir um cliente remove seus projetos), mas é uma operação **destrutiva e silenciosa** do ponto de vista de auditoria: não há registro de que N projetos foram removidos em cascata.
  - **Risco:** um administrador que exclui um cliente por engano perde todo o histórico de projetos sem aviso explícito no banco (a UI hoje pede confirmação, mas isso não é uma garantia de banco).
  - **Recomendação:** manter `CASCADE` (é a escolha correta para o modelo atual), mas registrar a exclusão em um log de auditoria antes de cascatear (ver item 5) e considerar, na evolução do produto, substituir exclusão física por *soft delete* (`deleted_at`) nas tabelas principais, mantendo `CASCADE` apenas como salvaguarda final.
- **Nenhum `ON UPDATE` foi definido**, mas como todas as PKs são `uuid` gerados por `default gen_random_uuid()` e nunca atualizados pela aplicação, isso não representa risco prático.
- **Ausência de FK explícita para `updated_by`/`created_by`:** não há coluna que registre qual usuário autenticado criou/alterou um registro. Isso limita a auditoria por autor (ver item 5) e a futura evolução para multiempresa (item 10).
  - **Recomendação:**

```sql
alter table public.leads add column created_by uuid references auth.users(id);
alter table public.leads add column updated_by uuid references auth.users(id);
-- repetir para clients e projects; popular via trigger com auth.uid() ou set nas escritas da aplicação.
```

---

## 3. Políticas RLS por tabela

**Cobertura de comandos.** As três tabelas (`leads`, `clients`, `projects`) têm políticas explícitas para `SELECT`, `INSERT`, `UPDATE` e `DELETE`, todas `to authenticated using (true)`/`with check (true)` — coerente com o modelo "toda a equipe compartilha o mesmo acesso" descrito em `architecture.md`. A migração `20260906180000_audit_hardening.sql` acrescenta corretamente:
- Políticas `restrictive` que bloqueiam sessões `is_anonymous = true` (Supabase Anonymous Sign-in) mesmo que tecnicamente autenticadas.
- `revoke all ... from public, anon, authenticated` seguido de `grant select, insert, update, delete` — isto é o ponto mais importante da migração: **RLS não protege `TRUNCATE`/`REFERENCES`/`TRIGGER`**, então sem esse `revoke`/`grant` explícito, qualquer conta autenticada teria privilégios de schema (herdados do `grant all` padrão do Postgres/Supabase) muito além do CRUD pretendido. Isso está corretamente coberto e testado em `supabase/tests/audit.sql`.

### 3.1 Granularidade — ponto de atenção real
- **Tabela/arquivo:** `leads`, `clients`, `projects` — policies `using (true)`.
- **Risco:** não há granularidade por usuário nem por operação sensível (ex.: qualquer membro autenticado pode excluir qualquer lead/cliente/projeto, mesmo criado por outra pessoa). Isso é uma decisão consciente e documentada ("toda a equipe compartilha os dados"), então não é um defeito de implementação, mas é um risco operacional: **não há trilha para saber quem excluiu o quê** (ver item 5) e nenhuma policy diferencia leitura de exclusão por papel (ex.: um "estagiário" não poderia ter as mesmas permissões de exclusão que o administrador).
- **Recomendação (se o produto crescer para ter papéis):** introduzir uma tabela `team_members(user_id, role)` e políticas por operação:

```sql
create table public.team_members (
  user_id uuid primary key references auth.users(id),
  role text not null check (role in ('admin', 'membro'))
);

create policy "Somente admin exclui leads" on public.leads
for delete to authenticated using (
  exists (select 1 from public.team_members tm where tm.user_id = auth.uid() and tm.role = 'admin')
);
```

### 3.2 Policies restritivas dependem de `auth.jwt()` estável
- **Tabela/arquivo:** `20260906180000_audit_hardening.sql`, linhas 10-22.
- **Risco:** a policy usa `(select auth.jwt()->>'is_anonymous')::boolean` — se o claim não existir (JWT antigo emitido antes de uma mudança de configuração do Supabase, ou provider que não popula esse campo), `coalesce(..., false)` assume "não anônimo" por padrão, ou seja, **falha aberta** (permite acesso) em vez de falha fechada. Isso é mitigado desde que "signup público e login anônimo estejam desativados no painel" (pré-requisito documentado em `release-security-plan.md` e `qualidade.md`), mas o controle real de "conta anônima" depende de configuração externa ao banco, não apenas da policy.
- **Recomendação:** manter a policy como camada defensiva (correta), mas tratar a desativação de signup público/anônimo no painel do Supabase como controle primário e obrigatório antes de produção — já sinalizado como pendência em `release-security-plan.md`. Adicionalmente, monitorar periodicamente `auth.users` para detectar contas inesperadas (ex.: `provider = 'anonymous'` ou e-mails fora do domínio da equipe).

### 3.3 Falta de teste de RLS via API HTTP real
- **Arquivo:** `supabase/tests/audit.sql`, `supabase/tests/bootstrap.sql`.
- **Risco:** os testes simulam claims JWT diretamente no Postgres (`set_config('request.jwt.claims', ...)`), o que valida a lógica das policies, mas **não** valida o comportamento do PostgREST/Supabase Auth real (ex.: como o `service_role` interage, como tokens expirados são tratados, se o Realtime respeita RLS da mesma forma). Isso já está documentado como limitação conhecida em `qualidade.md`.
- **Recomendação:** antes de produção, executar ao menos um teste de fumaça via `curl`/Postman contra o projeto Supabase de staging com uma conta de teste real, cobrindo os 4 verbos nas 3 tabelas e o RPC de conversão, como já é uma pendência anotada em `docs/operacao.md` item 4.

---

## 4. Função de conversão de lead em cliente

Arquivo: `20260816195000_convert_lead_to_client.sql` (versão inicial) substituída por `20260906180000_audit_hardening.sql` (versão corrigida, ainda não aplicada em produção segundo `current-state.md`).

### 4.1 Atomicidade
- A função é uma única transação implícita de `plpgsql` (`SELECT ... FOR UPDATE` → `INSERT` → `UPDATE`), executada como um RPC do Supabase (que já roda em uma transação por padrão). Está correta: se o `INSERT` falhar, o `UPDATE` do lead não ocorre.
- **Risco menor:** `security invoker` (em vez de `security definer`) faz a função herdar as permissões do chamador — correto para não escalar privilégio, mas significa que a função depende inteiramente das RLS/policies de `leads` e `clients` estarem certas. Isso está OK hoje, porém deve ser revalidado a cada mudança de policy.

### 4.2 Condição de corrida — resolvida na versão de `audit_hardening.sql`
- A versão inicial (`20260816195000`) tinha uma falha de corrida real: duas chamadas concorrentes ao RPC para o mesmo lead poderiam ambas passar pelo `for update` (que serializa a segunda chamada até a primeira commitar) e a segunda, ao ver `status = 'convertido'`, cairia no `raise exception 'Somente leads novos ou em negociação...'` — ou seja, **não era idempotente**, apenas seguro contra duplicação de cliente. A versão em `audit_hardening.sql` corrige isso adicionando:

```sql
select * into new_client from public.clients where lead_id = p_lead_id;
if found and source_lead.status = 'convertido' then return new_client; end if;
```

  Isso é uma correção boa e testada em `supabase/tests/audit.sql` (`first_id`/`second_id` devem ser iguais). O `for update` na primeira linha continua garantindo serialização entre chamadas simultâneas — a segunda chamada aguarda o lock, depois lê o estado já convertido e apenas retorna o cliente existente. **Avaliação: robusto para o cenário de dupla chamada no mesmo lead.**

### 4.3 Tratamento de erro / idempotência — pontos ainda não cobertos
- **Risco 1 — retorno após timeout de rede:** o comentário do próprio SQL já reconhece ("Repetir após timeout devolve o mesmo cliente"), mas isso só é verdade se o **primeiro** `INSERT`/`UPDATE` já tiver sido commitado. Se o timeout ocorrer *durante* a transação (antes do commit), a transação é abortada pelo Postgres e uma nova chamada repete o fluxo normalmente — comportamento correto, mas não está testado explicitamente (só o caso de "já convertido" está testado, não o caso "conexão caiu no meio, sem commit").
- **Risco 2 — chave de idempotência client-side:** `convertLeadToClient` em `lead-service.ts` não usa um identificador de tentativa (idempotency key); se o app permitir múltiplos cliques rápidos antes do primeiro retornar, cada clique é uma chamada RPC separada, mas o `for update` serializa e o resultado é seguro pela lógica do item 4.2 — então não há bug, mas vale reforçar no frontend o bloqueio de duplo clique (mencionado como já implementado em `qualidade.md`: "interface bloqueia repetição durante execução").
- **Risco 3 — validação de status insuficiente para reversão:** não existe caminho para "desconverter" um cliente de volta a lead (não é um requisito hoje, mas se um cliente for excluído por engano após conversão, o lead permanece com `status = 'convertido'` e o trigger `leads_require_client_on_conversion` impede reverter manualmente para `'novo'`/`'negociacao'` sem escrever SQL direto, pois a policy de UPDATE aceita qualquer coisa mas o trigger bloqueia a transição inconsistente). Isso é **correto como proteção**, mas não há caminho de recuperação documentado para esse cenário de erro operacional.
- **Recomendação:** documentar em `docs/operacao.md` o procedimento manual para o cenário "cliente excluído por engano pós-conversão" (ex.: `update leads set status = 'novo' where id = ...` executado diretamente pelo administrador, já que o trigger só bloqueia via API padrão, não via SQL direto com privilégio suficiente). Também recomenda-se adicionar um teste em `audit.sql` cobrindo o caminho "conversão falha porque o INSERT em clients viola uma constraint" (ex.: nome vazio após trim), garantindo que o lead **não** fica marcado como convertido nesse caso:

```sql
-- Sugestão de teste adicional em audit.sql
do $$
begin
  -- Forçar falha do INSERT em clients (ex.: nome inválido não deveria ocorrer via app,
  -- mas serve para provar que o rollback da função preserva o status do lead).
  begin
    perform public.convert_lead_to_client('00000000-0000-0000-0000-000000000000'::uuid);
    raise exception 'Deveria falhar para lead inexistente';
  exception when others then null;
  end;
end $$;
```

---

## 5. Mecanismo de "auditoria" (`audit_hardening.sql`)

- **Observação importante de nomenclatura:** apesar do nome do arquivo, `20260906180000_audit_hardening.sql` **não é um sistema de trilha de auditoria de dados** (não existe tabela `audit_log`, nem trigger que registre quem alterou o quê e quando). "Auditoria" aqui se refere à **auditoria técnica de segurança** realizada em 06/09/2026 (ver `docs/qualidade.md`) — o arquivo é o *hardening* de RLS/constraints decorrente dessa auditoria, e `supabase/tests/audit.sql` é o teste dessa migração.
- **O que existe hoje, na prática:**
  - `created_at`/`updated_at` com trigger `set_updated_at` em todas as tabelas — dá rastreabilidade mínima de "quando" mas não de "quem" nem "o que mudou".
  - `updated_at` é reaproveitado como token de *optimistic locking* (ver item 7).
  - Nenhuma tabela guarda o histórico de valores anteriores (ex.: não é possível saber que `status` de um lead mudou de `'novo'` para `'negociacao'` em determinada data, apenas que o registro foi tocado por último em `updated_at`).
- **Risco:** para um CRM compartilhado por toda a equipe sem segregação de acesso (item 3), a ausência de log de autor é o maior gap de rastreabilidade: se um registro for alterado ou excluído indevidamente, não há como saber quem fez isso nem reverter.
- **Recomendação — introduzir tabela de auditoria real (histórico de alterações):**

```sql
create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);
create index audit_log_row_idx on public.audit_log (table_name, row_id, changed_at desc);

create function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (table_name, row_id, operation, changed_by, old_data, new_data)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    auth.uid(),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger leads_audit after insert or update or delete on public.leads
for each row execute function public.write_audit_log();
create trigger clients_audit after insert or update or delete on public.clients
for each row execute function public.write_audit_log();
create trigger projects_audit after insert or update or delete on public.projects
for each row execute function public.write_audit_log();

-- audit_log só é legível/gravável pela própria função (security definer);
-- ninguém deve poder editar o histórico diretamente.
alter table public.audit_log enable row level security;
create policy "Equipe consulta auditoria" on public.audit_log
for select to authenticated using (true);
revoke insert, update, delete on public.audit_log from authenticated, anon;
```

  Consulta de histórico ficaria simples, por exemplo: `select * from public.audit_log where table_name = 'leads' and row_id = '<id>' order by changed_at desc;`.

- **Custo/trade-off:** cada UPDATE grava uma linha JSON completa (before/after) — para o volume atual (dezenas/centenas de leads, ver CSVs em `exports/`) o custo de armazenamento é desprezível; vale revisitar se o volume crescer para dezenas de milhares de edições/mês (retenção/particionamento).

---

## 6. Paginação e performance de leitura (`read-all.ts`)

- **Arquivo:** `src/lib/read-all.ts`, consumido por `listLeads`/`listClients`/`getClient` em `lead-service.ts`/`client-service.ts`, e pela UI (`LeadsPage.tsx`, `ClientsPage.tsx`) via `Pagination`/`PAGE_SIZE`.
- **Como funciona hoje:** `readAll` busca em lotes de 500 registros (`range(from, to)`), valida que a contagem não excedeu `limit` (padrão 20.000), detecta se a contagem mudou entre lotes (proteção contra leitura inconsistente sob escrita concorrente) e devolve o array completo. A partir daí, **toda** filtragem (busca por texto, filtro de status, "apenas atrasadas") e a paginação visual (`Pagination`) acontecem **no cliente**, sobre o array já carregado por completo na memória do navegador.
- **Risco de escalabilidade:**
  1. **Custo de rede/memória cresce linearmente com o total de linhas**, não com o que é exibido. Com centenas de leads (como nos CSVs em `exports/`, que já somam decenas de registros por lote de importação) o impacto é pequeno, mas com "milhares de registros" (cenário citado na pergunta) o tempo de carregamento inicial de cada página (Leads, Clientes) cresce proporcionalmente, mesmo que o usuário só veja 50 linhas.
  2. **Duas leituras completas em paralelo em `listClients`** (`clients` + `projects` inteiros) para montar o agrupamento em memória — o custo dobra e cresce com o total de projetos, não só de clientes.
  3. **O limite de 20.000 falha "fechado"** (lança erro) em vez de degradar graciosamente — comportamento correto e intencional (documentado em `qualidade.md`: "não mostra total parcial como completo"), mas significa que ao ultrapassar 20k linhas em qualquer uma das listagens a aplicação para de funcionar até haver filtro/paginação no servidor.
  4. **Busca textual client-side com `includes`** não escala e não é acentuação/typo-tolerante além do `toLocaleLowerCase('pt-BR')` — não usa os índices do banco (item 1.2).
- **Recomendação (evolução recomendada, sem quebrar o MVP atual):**
  - Mover filtro de `status`, busca textual e paginação para o servidor, usando `range()` real com os filtros aplicados na query, por exemplo:

```ts
function listLeadsPage(client: SupabaseClient, { search, status, page, pageSize }: LeadsQuery) {
  let query = client.from('leads').select('*', { count: 'exact' })
  if (status !== 'todos') query = query.eq('status', status)
  if (search) query = query.or(`company_name.ilike.%${search}%,responsible_name.ilike.%${search}%`)
  return query
    .order('next_action_due_date', { ascending: true, nullsFirst: false })
    .order('id')
    .range(page * pageSize, page * pageSize + pageSize - 1)
}
```

  - Para o dashboard/faturamento, mover a agregação para o banco (uma `view` ou função `sum(price) ... group by` com filtro de data), eliminando a necessidade de trazer todos os `projects` para o cliente:

```sql
create or replace view public.project_revenue_by_month as
select date_trunc('month', completed_at)::date as month, sum(price) as total
from public.projects
where status = 'concluido'
group by 1;
```

  - Manter `readAll` como *fallback* apenas para operações administrativas pequenas (ex.: exportação CSV completa), não como estratégia principal de listagem.

---

## 7. Optimistic locking em edições concorrentes

- **Arquivo:** `lead-service.ts` (`updateLead`), `client-service.ts` (`updateClient`, `updateProject`).
- **Mecanismo:** o update inclui `.eq('updated_at', expectedUpdatedAt)`. Se outra sessão já tiver alterado o registro (mudando `updated_at` via o trigger `set_updated_at`), o `WHERE` não casa nenhuma linha, `.single()` do PostgREST retorna erro (0 ou >1 linhas), e o serviço lança exceção — a UI (`LeadDetailsPage.tsx`) captura e exibe: "o registro pode ter sido alterado por outra pessoa... preserve seu texto e atualize antes de repetir." Isso é uma implementação correta e testada (mencionada em `qualidade.md`: "Testes de contrato com HTTP simulado").
- **Pontos fortes:** simples, não exige coluna extra de versão, reaproveita `updated_at` que já existe para outros fins, funciona bem com o volume atual.
- **Limitações / riscos residuais:**
  1. **Precisão de timestamp:** `timestamptz` no Postgres tem precisão de microssegundos, e o valor é serializado como string ISO pelo PostgREST; na prática o risco de colisão é baixíssimo, mas o campo é reaproveitado para dois propósitos (auditoria temporal *e* controle de concorrência) — uma coluna dedicada seria mais explícita e imune a qualquer futura mudança que retoque `updated_at` sem intenção de versionamento (ex.: uma migração de dados em massa que faça `update ... set updated_at = now()`).
  2. **Nenhuma proteção equivalente para `DELETE`:** `deleteLead`/`deleteClient`/`deleteProject` não verificam `updated_at` antes de excluir — duas pessoas podem excluir a mesma linha (a segunda apenas recebe "0 linhas afetadas", tratado como erro, então não há corrupção, mas também não há aviso de "alguém já editou este registro antes de você excluir").
  3. **Sem versão numérica monotônica:** um contador `version integer` seria mais robusto que depender de `now()` (evita edge cases de clock skew entre réplicas, embora o Supabase use um único primary Postgres, então isso é teórico hoje).
- **Recomendação (reforço opcional, não urgente no volume atual):** migrar para uma coluna `version integer not null default 1`, incrementada pelo mesmo trigger:

```sql
alter table public.leads add column version integer not null default 1;
alter table public.clients add column version integer not null default 1;
alter table public.projects add column version integer not null default 1;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$;
```

  E o update no cliente passaria a usar `.eq('version', expectedVersion)` em vez de `updated_at`. **Avaliação geral:** a solução atual já é "robusta o suficiente" para o volume e o time pequeno do MVP; a migração para `version` é uma melhoria de robustez de longo prazo, não uma correção urgente.

---

## 8. Qualidade dos testes SQL (`bootstrap.sql` / `audit.sql`)

- **`bootstrap.sql`:** cria roles `anon`/`authenticated` e as funções `auth.jwt()`/`auth.uid()` simuladas via `current_setting('request.jwt.claims')`. É uma simulação fiel do *comportamento de RLS* do Supabase (que é exatamente como o PostgREST expõe claims para o Postgres), mas — como o próprio comentário do arquivo diz — **não testa a camada HTTP/Auth real** (emissão/expiração de JWT, refresh token, rate limiting de login, comportamento do GoTrue).
- **Cenários cobertos em `audit.sql`:**
  - Membro autenticado A cria um lead, converte-o (2x, provando idempotência), tenta violar o limite de tamanho de texto (`check_violation` esperado).
  - Membro autenticado B lê o mesmo lead (prova de "equipe compartilhada", não multiempresa).
  - Sessão `is_anonymous: true` autenticada: não deve ler nem inserir (`insufficient_privilege`).
  - Role `anon` puro (visitante sem sessão): não deve ler.
  - Segunda transação: matriz cobrindo `leads`/`clients`/`projects` × `SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` para `anon` e para uma sessão `authenticated` sem `sub` (token válido mas sem identidade) — boa cobertura de "menor privilégio".
  - Validações de negócio: `google_maps_url` com esquema `javascript:` deve falhar; `price = 'NaN'` deve falhar; inserir lead direto com `status = 'convertido'` deve falhar (trigger).
- **Lacunas identificadas** (a maioria já reconhecida em `docs/operacao.md` item 4 e `docs/qualidade.md`):
  1. **Não testa `UPDATE`/`DELETE` cross-registro** para membro B sobre o lead criado por A com o *optimistic lock* (`updated_at`) — ou seja, não há teste SQL para a mecânica de concorrência do item 7 (essa é testada apenas via HTTP simulado no `tests/services.test.mjs`, não em SQL).
  2. **Não testa conversão concorrente com duas transações reais simultâneas** (duas conexões/duas sessões `psql` disputando o mesmo `for update`) — o teste atual chama a função duas vezes *sequencialmente* na mesma transação/role, o que prova idempotência lógica mas não prova o comportamento do `for update` sob lock real contestado.
  3. **Não testa RLS de `UPDATE`/`DELETE` para `clients`/`projects`** com a mesma profundidade dada a `leads` no primeiro bloco (o segundo bloco/matriz cobre `anon`, mas o "membro B pode editar cliente/projeto de outro" não tem um teste equivalente ao do lead).
  4. **Não testa o trigger `require_client_on_conversion` no caminho de `UPDATE`** de um lead já `'negociacao'` para `'convertido'` sem cliente associado (só cobre `INSERT` direto com `status = 'convertido'`).
- **Recomendação:** expandir `audit.sql` com os cenários 1-4 acima, e — quando possível — criar um segundo script de teste que abra duas sessões `psql` reais (ex.: via `\connect` em dois terminais ou `pg_bench`/script shell) para validar o `for update` sob contenção genuína, não apenas idempotência sequencial. Exemplo mínimo do gap 4:

```sql
-- Gap: UPDATE de status para 'convertido' sem cliente associado deve falhar
do $$
declare v_id uuid;
begin
  insert into public.leads(company_name, status) values ('Trigger update', 'negociacao') returning id into v_id;
  begin
    update public.leads set status = 'convertido' where id = v_id;
    raise exception 'UPDATE para convertido sem cliente deveria falhar';
  exception when raise_exception then null;
  end;
end $$;
```

---

## 9. Backup/restore e disaster recovery

- **Arquivo/contexto:** `docs/ai-context/release-security-plan.md`, `docs/operacao.md`.
- **Situação atual:** exportação manual semanal (e antes de mudanças estruturais), responsabilidade do administrador, armazenada "em local privado com acesso controlado". Não há dependência de backup automático do plano gratuito do Supabase.
- **Riscos:**
  1. **RPO de até 7 dias** (ou mais, se a exportação semanal atrasar) — para um CRM de vendas, perder uma semana de leads/negociações é um risco de negócio relevante, não apenas técnico.
  2. **Processo manual sem evidência de execução:** `docs/qualidade.md` já registra que "não há evidência de exportação ou restauração recente" — risco operacional clássico de backup "que existe no papel mas nunca foi testado".
  3. **Formato do backup não especificado:** não há um script/comando documentado (`pg_dump`, exportação CSV pela própria aplicação, ou snapshot do Supabase) — sem padronização, a restauração pode ser incompleta (ex.: esquecer sequências, `enum`s, policies, ou perder o vínculo `lead_id` se restaurado fora de ordem).
  4. **Sem RTO/RPO formalmente acordado** — já sinalizado como pendência em `docs/operacao.md`.
- **Recomendações concretas:**
  1. Automatizar exportação diária via `pg_dump` (ou o recurso de backup do Supabase, se disponível no plano usado) com destino a um armazenamento privado versionado (ex.: bucket S3/Backblaze com criptografia e política de retenção de 30 dias), reduzindo RPO de ~7 dias para ~1 dia sem custo relevante:

```powershell
# Exemplo de comando (executar pelo administrador, fora do repositório):
pg_dump "postgresql://<usuario>:<senha>@<host>:5432/postgres" `
  --format=custom --file="backup-$(Get-Date -Format yyyyMMdd).dump"
```

  2. Testar a restauração completa (schema + dados + policies) em um banco descartável **a cada mudança relevante de schema**, não apenas confiar no dump existir. Documentar o passo a passo em `docs/operacao.md`.
  3. Definir formalmente RPO (ex.: 24h) e RTO (ex.: 4h úteis) e revisar o plano gratuito do Supabase quanto a retenção de backups automáticos (Point-in-Time Recovery normalmente é recurso de plano pago) — se o negócio crescer, migrar para um plano com PITR é a melhoria mais custo-efetiva de DR.
  4. Nunca versionar dumps/exports no repositório Git — os arquivos hoje em `exports/*.csv` já estão no working tree do projeto (aparecem no `git status` como untracked); confirmar que `exports/` está no `.gitignore` antes de qualquer commit, para não expor dados de leads reais no histórico do repositório.

---

## 10. Evolução futura do modelo

| Necessidade futura | Impacto no schema atual | Recomendação |
|---|---|---|
| **Múltiplas equipes/tenants** | Hoje toda linha é implicitamente "global"; não há coluna de propriedade. | Introduzir `organization_id uuid` em `leads`/`clients`/`projects` (ou um esquema por tenant, se o volume justificar), e trocar as policies `using (true)` por `using (organization_id = (select organization_id from public.team_members where user_id = auth.uid()))`. Migração de dados: popular `organization_id` com um valor único de "organização padrão" antes de tornar a coluna `not null`. |
| **Mais status de projeto** | `project_status` é um `enum` fixo — adicionar um valor é simples (`alter type ... add value`), mas remover ou reordenar é custoso. | Para status voláteis/configuráveis pelo próprio usuário, considerar trocar o `enum` por uma tabela `project_statuses(code, label, sort_order, is_terminal)` com FK, mantendo a constraint de `completed_at` via trigger em vez de `check` fixo. Para o volume atual, o `enum` continua sendo a escolha mais simples e correta — só migrar se a lista de status precisar ser editável em runtime. |
| **Histórico de atividades (timeline de interações)** | Não existe hoje; `notes`/`next_action` são campos únicos sobrescritos a cada edição — perde-se o histórico de anotações anteriores. | Criar tabela `activities` (ou reaproveitar o `audit_log` do item 5 para leitura, mas para uma timeline de negócio dedicada é melhor ter uma tabela própria): `activities(id, lead_id/client_id, author_id, kind, description, created_at)`, permitindo múltiplas interações por lead/cliente sem perder as anteriores. |
| **Tags** | Não existe hoje; `segment`/`source` são campos de texto livre 1:1. | Modelo N:N clássico: `tags(id, name unique)` + `lead_tags(lead_id, tag_id)` / `client_tags(client_id, tag_id)`, com índice composto `(tag_id, lead_id)` para filtros por tag. |
| **Anexos (contratos, prints, PDFs)** | Não existe hoje; não há integração com Supabase Storage no schema. | Tabela `attachments(id, owner_table, owner_id, storage_path, uploaded_by, uploaded_at, size_bytes, mime_type)` + bucket no Supabase Storage com policy própria (`storage.objects`) restringindo por `owner_id`/equipe. Evitar salvar arquivos binários diretamente em colunas do Postgres. |
| **Papéis/permissões diferenciadas** | Pré-requisito comum às linhas acima (tenants, exclusões restritas). | Ver tabela `team_members` sugerida no item 3.1 — é a peça central para qualquer evolução de granularidade de acesso. |
| **Relatórios/BI mais pesados** | `readAll` + agregação client-side (item 6) não escalará. | Views materializadas (`materialized view`) para agregações recorrentes (faturamento mensal, funil de conversão por origem), atualizadas via `refresh materialized view concurrently` em job agendado (pg_cron, se disponível, ou função Edge agendada). |

**Nota geral sobre evolução:** o schema atual é deliberadamente minimalista e alinhado ao escopo do MVP documentado em `docs/ai-context/mvp-scope.md`/`data-model.md`. Nenhuma das evoluções acima exige reescrever o modelo existente — todas são extensões aditivas (novas colunas/tabelas), o que é um sinal de que a modelagem inicial foi bem pensada para crescer incrementalmente.

---

## Resumo executivo

As 5 recomendações prioritárias, em ordem de impacto/urgência:

1. **Mover paginação, busca e agregação para o servidor** (`read-all.ts`/`lead-service.ts`/`client-service.ts`): hoje tudo é carregado por completo e filtrado no navegador, o que não escala para "milhares de registros" e é o item de maior risco de performance identificado.
2. **Criar uma tabela real de trilha de auditoria** (`audit_log` com trigger `AFTER INSERT/UPDATE/DELETE`, incluindo autor via `auth.uid()`): o arquivo `audit_hardening.sql` atual é hardening de segurança, não um histórico de alterações — hoje não é possível saber quem alterou ou excluiu um registro.
3. **Aplicar e validar `20260906180000_audit_hardening.sql` em ambiente de teste antes de produção**, expandindo `supabase/tests/audit.sql` para cobrir concorrência real com duas conexões, UPDATE/DELETE cross-usuário em `clients`/`projects`, e o caminho de `UPDATE` para `'convertido'` sem cliente — conforme já apontado em `docs/operacao.md`.
4. **Automatizar e testar backup/restore diário** (ex.: `pg_dump` agendado com retenção), reduzindo o RPO da exportação manual semanal atual e validando ao menos uma restauração completa em banco descartável.
5. **Adicionar índices de suporte à busca e à ordenação por texto** (`pg_trgm` em `company_name`/`responsible_name`) e reforçar constraints de formato (e-mail) no banco, já que hoje essas validações existem só no cliente e ficam sem efeito para qualquer escrita fora da aplicação.
