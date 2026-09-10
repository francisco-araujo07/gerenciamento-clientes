# Aplicação das recomendações de dados do Supabase

Data: 10/09/2026.

## Resultado

Foram preparadas alterações locais para reforçar o banco e disponibilizar consultas
paginadas, sem executar migrações no Supabase remoto, sem ler dados reais e sem
alterar páginas, componentes, configuração frontend ou testes JavaScript.

## Arquivos alterados

- `supabase/migrations/20260910180000_data_hardening.sql`
- `supabase/tests/bootstrap.sql`
- `supabase/tests/audit.sql`
- `src/lib/read-all.ts`
- `src/features/leads/lead-service.ts`
- `src/features/clients/client-service.ts`

O arquivo `docs/ai-context/current-state.md`, `change-log.md` e `activity-log.md`
não foi alterado, conforme solicitado.

## Migrações preparadas

`20260906180000_audit_hardening.sql` continua pendente e não foi executada. Ela
mantém o hardening de RLS, revoga privilégios além de CRUD, bloqueia sessões
anônimas autenticadas, aplica limites básicos e protege a conversão de lead.

`20260910180000_data_hardening.sql` depende do schema inicial e do hardening
anterior. Ela:

- adiciona checks `NOT VALID` para formato básico de e-mail em leads e clientes;
- adiciona índices para `created_at`, `source` e leads ativos atrasados;
- habilita `pg_trgm` e cria índices GIN para buscas `ILIKE` por empresa e responsável;
- cria `audit_log` com operação, linha, autor, horário e valores anterior/novo;
- instala triggers de auditoria em leads, clientes e projetos;
- restringe a auditoria a membros autenticados identificados, revogando escrita
  direta por `anon` e `authenticated`.

As constraints `NOT VALID` protegem novas escritas sem presumir que dados legados
já estejam limpos. Depois da revisão dos dados, o administrador deve executar
`VALIDATE CONSTRAINT` separadamente. A migração contém orientação de rollback
manual e não remove a extensão `pg_trgm`, pois ela pode ser compartilhada por
outros objetos.

## Acesso e consultas

`listLeadsPage` agora suporta busca por empresa/responsável, status, atrasadas,
ordenação estável, `range` server-side e contagem exata. `listClientsPage`
suporta busca, filtro por status de projeto, relação de projetos, ordenação,
paginação e contagem exata.

`listLeads` e `listClients` foram preservadas para os consumidores atuais,
incluindo importação e páginas existentes. Como páginas e componentes estavam
fora do escopo, elas ainda usam a leitura completa; a adoção das novas funções
na UI é uma etapa posterior necessária para eliminar definitivamente o custo de
carregar todos os registros.

O dashboard e sua agregação de faturamento não foram alterados porque a página
correspondente está fora do escopo exclusivo. Backup diário, retenção, RPO/RTO e
restauração também permanecem operacionais, pois exigem decisão e credenciais
do administrador, não uma alteração segura no repositório.

## Testes SQL preparados

`supabase/tests/bootstrap.sql` agora cria uma tabela `auth.users` fictícia e
usuários de teste para validar a FK `audit_log.changed_by`.

`supabase/tests/audit.sql` foi ampliado para verificar:

- registro do autor na criação do cliente e conversão do lead;
- auditoria de UPDATE e DELETE;
- acesso de leitura por membro identificado e bloqueio para sessão anônima;
- ausência de INSERT/UPDATE/DELETE direto em `audit_log`;
- e-mails inválidos rejeitados nas duas tabelas;
- tentativa de alterar lead para `convertido` sem cliente.

Os testes continuam destinados exclusivamente a PostgreSQL descartável e fazem
rollback. Não validam autenticação HTTP, restauração, concorrência entre duas
conexões ou configuração do painel Supabase.

## Validação realizada

- Leitura obrigatória de `docs/ai-context/README.md`,
  `current-state.md`, `dados-supabase.md`, `data-model.md` e `architecture.md`.
- Diagnósticos do editor: nenhum erro nos três arquivos TypeScript alterados.
- Nenhuma migração remota, deploy ou acesso a dados reais foi realizado.

Não foi possível executar `npm test`, `npm run lint`, `npm run build` ou `psql`
neste ambiente porque o terminal local não estava disponível. O SQL deve ser
executado pelo administrador em um PostgreSQL descartável com `ON_ERROR_STOP=1`
antes de qualquer promoção.

## Pendências

1. Aplicar primeiro as duas migrações em banco de teste, revisar dados legados,
   executar `audit.sql` e só então promover ao Supabase.
2. Integrar `listLeadsPage` e `listClientsPage` às páginas em uma mudança futura
   que possa alterar UI/estado de filtros.
3. Mover o faturamento para agregação server-side quando a página do dashboard
   puder entrar no escopo.
4. Fazer teste HTTP com contas fictícias de staging e confirmar signup público,
   login anônimo, MFA, backup/restauração e retenção da auditoria.
5. Definir retenção/particionamento de `audit_log` se o volume de alterações
   crescer; o desenho atual armazena snapshots JSON completos.
