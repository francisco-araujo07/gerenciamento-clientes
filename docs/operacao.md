# Operação e liberação das correções da auditoria

## Desenvolvimento e CI

Usar Node 24. Instalar com npm ci; executar npm test, npm run lint e npm run build.
O build exige VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY publicável/anon; ele rejeita segredo privilegiado. .env.local não deve ser versionado. O workflow de CI usa configuração sintética apenas para compilar; seu artefato não é produção.

## Supabase — execução pelo administrador

1. Confirmar que signup público e login anônimo estão desativados e revisar a lista de contas autorizadas. No MVP, todos esses membros compartilham os dados.
2. Realizar backup privado antes de mudar o schema. Não colocar exports em public/ ou no repositório. Verificar se a restauração do backup funciona antes de depender dele.
3. Em banco descartável com schema equivalente, aplicar as migrações em ordem e executar supabase/tests/audit.sql com psql e ON_ERROR_STOP. Não usar o teste em produção.
4. Expandir a validação para INSERT/UPDATE/DELETE de todas as tabelas, valores inválidos e conversão concorrente em duas sessões. O teste fornecido é inicial e não comprova tudo isso.
5. Revisar registros antigos contra os novos limites. A migration usa NOT VALID para preservar dados legados; novas escritas já serão checadas. Executar VALIDATE CONSTRAINT apenas após a revisão dos dados, sem limpeza destrutiva automática.
6. Após aprovação, aplicar 20260906180000_audit_hardening.sql em produção. Conferir RLS com contas de teste autorizadas e sem chave service_role mascarando restrições.

Não substituir policies por using(true) para resolver erro. Para rollback da aplicação, retornar ao artefato anterior; migrações precisam de análise própria e não devem ser removidas automaticamente. Caso os novos limites rejeitem dados legítimos, rever a constraint específica de forma controlada, preservando RLS e backup.

## Cloudflare Pages

- Produção: branch `main`, build `npm run build`, output `dist`, raiz do repositório e Node 24 (`.nvmrc` + `NODE_VERSION=24` no painel).
- **Production vs Preview são ambientes separados.** O hard-fail do `vite.config` (sem `VITE_SUPABASE_*`) é **pré-existente** (`153adab` em `main`), não da F3. O Preview da #5 falha porque essas vars não estão no escopo Preview. Preferência: Francisco as adiciona em Production **e** Preview (teste no Preview; nunca `service_role`; sem secrets no repo).
- Sem as duas vars o build **não** aborta (Preview publica a tela “Conecte o Supabase”). Chave privilegiada ou par incompleto continua abortando. Qualidade injeta fixtures e não publica o artefato. O check Pages **não** é required e não substitui Qualidade.
- Configurar as variáveis públicas no ambiente que será publicado. Preview deve usar Supabase de **teste**, nunca `service_role` nem dados reais. Flags `VITE_FF_GLC_*` vazias/false até o ramp.
- Verificar `dist/_headers` e o HTML apontando a `/assets/*.js`. Deploy manual deve enviar `dist`, nunca a raiz do projeto.
- Na URL final, conferir login, assets, MIME, cabeçalhos, ações e refresh. Resposta HTTP 200 sozinha não comprova renderização.
- `_headers` vale para assets estáticos no Pages; ao migrar para Functions/outro host, verificar regras equivalentes. Se houver domínio customizado de API, ajustar `connect-src`.

### O que Francisco precisa no dashboard (Preview vermelho)

1. Workers & Pages → `gerenciamento-clientes` → Deployments → abrir o Preview que falhou (não o de `main`) e ler a última linha do log.
2. Settings → Environment variables → escopo **Preview** (além de Production):
   - `VITE_SUPABASE_URL` — HTTPS do projeto de teste, sem user/senha na URL
   - `VITE_SUPABASE_ANON_KEY` — só `sb_publishable_…` ou JWT `anon`
   - `NODE_VERSION=24`
   - Não definir `VITE_FF_GLC_FUNIL_STATUS` / `VITE_FF_GLC_FILA_CADENCIA` / `VITE_FF_GLC_KIT_WHATSAPP` / `VITE_FF_GLC_PORTEIRO_DECISOR` / `VITE_FF_GLC_GUIA_CONVERSA` / `VITE_FF_GLC_REUNIAO` / `VITE_FF_GLC_MINI_KANBAN` (default OFF)
3. Settings → Builds: comando `npm run build`, output `dist`, root `/`, production branch `main`, Preview deployments ligados.
4. Retry do Preview desta branch. Sem as vars o Preview sobe a tela de configuração; com vars de teste o Preview fica usável. Sem secrets no repositório.

## Incidentes

- Tela branca/carregamento permanente: inspecionar console, assets e configuração do deploy; comparar com último artefato funcionando; não expor .env ou chaves em capturas.
- Faturamento indisponível: verificar disponibilidade Supabase, RLS, limite de 20.000 linhas e erros de rede. Não substituir ausência de dados por zero.
- Falha após salvar/importar: conferir se a operação persistiu antes de tentar novamente. Não repetir automaticamente uma escrita ambígua.
- Conflito de edição: preservar o texto digitado, recarregar a versão atual e reconciliar antes de salvar.
- Chave privilegiada exposta: revogar/rotacionar no provedor, retirar o artefato, revisar logs e acessos, recompilar com chave pública. Apagar do código não revoga acesso.
- Banco indisponível/perda de dados: seguir plano de restauração testado, com responsável e destino privado. A exportação semanal registrada no MVP precisa de execução e evidência; não pressupor recurso do plano gratuito.

## Pendências operacionais

Definir responsável por incidentes, retenção dos contatos, limites/alertas de custo e monitor externo. Confirmar MFA administrativo e revogação de sessões. Acordar RPO e RTO; a rotina semanal de exportação não comprova por si só esses objetivos.
# Atualização da validação de segurança — 06/09/2026

Migrações e matriz SQL aprovadas em PostgreSQL isolado (PGlite, claims simuladas), sem acesso ao banco real. CI PostgreSQL 17 preparado, não executado remotamente. `supabase/tests/bootstrap.sql` cria roles/auth fictícios SOMENTE em banco descartável: nunca executar em Supabase real. A migração de endurecimento também revoga TRUNCATE e demais privilégios além de CRUD. Signup, backup e aplicação remota continuam pendentes.
