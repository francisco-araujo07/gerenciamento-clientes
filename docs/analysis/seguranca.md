# Análise de segurança — Gerenciamento de Leads e Clientes

Data da análise: 10/09/2026.
Escopo: estado ATUAL do diretório de trabalho (inclui mudanças não commitadas), não apenas o HEAD do git.
Repositório: `C:\Users\danie\Downloads\FRANCISCO\gerenciamento-clientes`.
Método: leitura de código-fonte, migrações SQL, configuração de build/CI e documentação de contexto (`docs/ai-context/`, `docs/qualidade.md`, `docs/operacao.md`). `npm audit --json` executado (0 vulnerabilidades reportadas em 79 dependências). Nenhuma alteração foi feita no código; nenhum comando foi executado contra o Supabase real.

Esta análise **não substitui** a auditoria técnica interna já registrada em `docs/qualidade.md`; ela a complementa com uma revisão independente focada exclusivamente em segurança, aprofundando riscos que a auditoria original menciona de forma mais operacional (ex.: sessão anônima do Supabase, grants padrão de tabela) e adicionando achados novos (dados reais em `exports/` fora do `.gitignore`, ausência de trilha de auditoria de dados, cadência de dependências).

## Legenda de severidade

| Severidade | Critério |
|---|---|
| Crítico | Compromete integridade/confidencialidade de todos os dados ou permite acesso não autenticado/não autorizado total. Ação imediata. |
| Alto | Compromete dados ou disponibilidade de forma significativa em cenários plausíveis. Corrigir antes de ir para produção. |
| Médio | Risco real, mas com pré-condições (ex.: depende de outra falha, de configuração administrativa, ou é limitado em escopo). Corrigir no curto prazo. |
| Baixo | Hardening defensivo, boa prática ou risco residual pequeno. Corrigir quando conveniente. |

---

## 1. Autenticação e gerenciamento de sessão

| # | Achado | Severidade | Risco concreto | Recomendação |
|---|---|---|---|---|
| 1.1 | Login usa `supabase.auth.signInWithPassword` com e-mail/senha, tela sem cadastro público (`src/pages/LoginPage.tsx`). Nenhuma criação de conta é possível pelo cliente. | Baixo (implementação correta) | — | Manter; garantir no painel Supabase que o provedor de e-mail exige senha forte (mínimo 8+ caracteres, checagem de senha vazada, se disponível no plano). |
| 1.2 | Não há MFA (segundo fator) implementado nem exigido para nenhuma conta, incluindo administrador. | Alto | Uma senha vazada (phishing, reuso, stealer) dá acesso total e imediato a todos os dados de leads/clientes da empresa, sem segunda barreira. | Ativar MFA (TOTP) no Supabase Auth para todas as contas, e ao menos **obrigar** para a conta administradora. Na app, adicionar fluxo de enrollment (`supabase.auth.mfa.enroll`) e exigir `aal2` em `onAuthStateChange`/checagem de `session.user.factors` antes de liberar rotas sensíveis. |
| 1.3 | Nenhum rate limiting ou CAPTCHA visível na tela de login; a proteção depende inteiramente das configurações padrão do GoTrue (Supabase Auth). | Médio | Ataques de força bruta/credential stuffing contra contas conhecidas (e-mails da equipe costumam ser previsíveis). | Confirmar e, se necessário, habilitar CAPTCHA (hCaptcha/Turnstile) no painel Supabase Auth para o endpoint de senha; revisar limites de tentativa por IP. |
| 1.4 | Expiração e revogação de sessão dependem do TTL padrão do JWT do Supabase (geralmente 1h de access token + refresh token de longa duração armazenado no `localStorage`); a aplicação não define uma expiração de sessão por inatividade nem revoga tokens ao desligar um colaborador. `docs/operacao.md` já registra essa lacuna como pendência do administrador. | Alto | Ex-colaborador ou dispositivo comprometido mantém sessão válida por tempo indeterminado após ser removido, pois remover o usuário no painel não invalida automaticamente refresh tokens já emitidos. | Definir processo de offboarding: revogar sessões ativas via `supabase.auth.admin.signOut(userId, 'global')` (ou equivalente na API admin) sempre que uma conta for desativada; considerar reduzir o TTL do access token; documentar SLA de revogação (ex.: "revogar em até 1h após desligamento"). |
| 1.5 | Sessão é mantida em `localStorage` (comportamento padrão do `@supabase/supabase-js`), acessível a qualquer script que rode no contexto da página. | Médio | Qualquer XSS bem-sucedido (ver seção 6) permite roubo de sessão/token, com acesso total à API enquanto o token for válido. | Mitigado principalmente pelo CSP restritivo já presente (seção 5); ainda assim, evitar introduzir bibliotecas de terceiros não auditadas ou `dangerouslySetInnerHTML` no futuro. Nenhuma ocorrência encontrada hoje. |
| 1.6 | Logout (`supabaseClient.auth.signOut()`) chama apenas o signOut padrão (escopo local), sem opção de "sair de todos os dispositivos". | Baixo | Usuário que perde um dispositivo não consegue encerrar sessões em outros aparelhos pela própria interface. | Oferecer opção "Sair de todos os dispositivos" chamando `signOut({ scope: 'global' })`, especialmente útil em caso de dispositivo perdido/roubado. |

---

## 2. Autorização e RLS no Supabase

Este é o ponto mais crítico do sistema porque o modelo de dados é **compartilhado por toda a equipe autenticada** (decisão de produto documentada), então a única barreira entre "qualquer visitante da internet" e "acesso total a todos os leads e clientes" é a fronteira de autenticação + RLS.

| # | Achado | Severidade | Risco concreto | Recomendação |
|---|---|---|---|---|
| 2.1 | **Migração de hardening (`20260906180000_audit_hardening.sql`) ainda não foi aplicada em produção**, conforme confirmado em `docs/ai-context/current-state.md`, `docs/qualidade.md` e `docs/operacao.md`. Ela é quem revoga grants excessivos, bloqueia sessões anônimas e adiciona limites de tamanho. | **Crítico** (enquanto não aplicada) | Ver detalhamento nos itens 2.2 a 2.5 abaixo — todos os riscos daquela lista permanecem ativos em produção até a migração ser aplicada e validada. | Executar o checklist de `docs/operacao.md` (backup → banco descartável → `supabase/tests/audit.sql` → aplicar em produção → revalidar com contas de teste) o quanto antes. Tratar como bloqueador de "produção pronta". |
| 2.2 | A migração inicial (`20260816193000_initial_schema.sql`) só define *policies* (`using (true)`/`with check (true)` para `to authenticated`), mas **não revoga os grants padrão de tabela** que o Postgres/Supabase concede na criação (`GRANT ALL` via `ALTER DEFAULT PRIVILEGES` para `anon`/`authenticated` em projetos Supabase). RLS **não** controla `TRUNCATE`. | **Crítico** (enquanto 2.1 não for corrigido) | Qualquer conta autenticada da equipe (ou uma sessão anônima, ver 2.3) pode executar `TRUNCATE public.leads;` via RPC/SQL ou até acidentalmente por meio de uma ferramenta administrativa mal configurada, apagando toda a base sem passar pelas policies de RLS. | A migração `20260906180000` já resolve isso (`revoke all ... grant select, insert, update, delete ... to authenticated`). Aplicar e depois confirmar com `has_table_privilege(..., 'TRUNCATE') = false` para `authenticated` e `anon`, exatamente como testado em `supabase/tests/audit.sql`. |
| 2.3 | As policies usam `to authenticated using (true)` **sem checar `is_anonymous`**. O recurso "Anonymous Sign-ins" do Supabase, se habilitado no projeto, emite um JWT com `role: authenticated` para visitantes sem credenciais — ou seja, uma policy `to authenticated` **não distingue** um membro real de um visitante anônimo por padrão. | **Crítico** (depende de configuração do projeto, não verificável a partir do código) | Se o login anônimo estiver ativo no painel Supabase (não é possível confirmar isso pela leitura do repositório), **qualquer pessoa na internet** pode chamar `supabase.auth.signInAnonymously()` a partir do domínio público (ou de outra origem, já que a API do Supabase não é restrita por CORS de app) e obter leitura/escrita total de leads e clientes sem nenhuma credencial. | 1) Confirmar no painel Supabase → Authentication → Providers que "Allow anonymous sign-ins" está **desabilitado** (ação administrativa, fora do código). 2) Independentemente disso, aplicar a policy restritiva já preparada em `20260906180000_audit_hardening.sql`, que bloqueia explicitamente `is_anonymous = true`, como defesa em profundidade caso o provedor seja reativado no futuro por engano. |
| 2.4 | Não há segmentação alguma por usuário (nenhuma coluna `owner_id`/`created_by` usada em `using`/`with check`). | Médio — **por design**, não é uma falha de implementação | Uma única conta comprometida (ver seção 1) expõe 100% da base. É o trade-off aceito explicitamente em `docs/ai-context/architecture.md` ("todos os usuários autenticados podem visualizar e editar os mesmos dados"). | Aceitar o risco é uma decisão de produto válida, mas ela eleva a importância dos controles da seção 1 (MFA, revogação, sem sessão anônima). Registrar essa dependência explicitamente em `docs/ai-context/decisions.md` como risco aceito. |
| 2.5 | A função `convert_lead_to_client` usa `security invoker` (não `security definer`) e revoga `execute` de `public`/`anon`, concedendo apenas a `authenticated`. | Baixo (implementação correta) | — | Manter o padrão `security invoker` em futuras funções RPC para evitar escalonamento de privilégio via `security definer` desnecessário. |
| 2.6 | `supabase/tests/audit.sql` e `supabase/tests/bootstrap.sql` simulam RLS/claims em um Postgres isolado (papéis `anon`/`authenticated` fictícios, `auth.jwt()` mockado), **não** testam o serviço HTTP real do GoTrue/PostgREST nem CORS. | Médio | RLS pode se comportar de forma sutilmente diferente contra o Supabase real (ex.: papéis adicionais como `service_role` acessando via painel, extensões de auth, replicação). Testes atuais não cobrem concorrência real com duas conexões. | Antes de declarar produção pronta, validar manualmente com contas de teste reais via `curl`/Postman contra a API REST do projeto (não só via SQL simulado), cobrindo: leitura/escrita de cada tabela, tentativa de `TRUNCATE`, e chamada da RPC com e sem sessão válida. |
| 2.7 | Constraints de limite de texto e de URL HTTPS (`leads_input_limits`, `clients_input_limits`, `projects_input_limits`) são criadas com `NOT VALID` na migração de hardening — corretas para não quebrar dados legados, mas **ainda não aplicadas** (ver 2.1) e, mesmo quando aplicadas, continuam como `NOT VALID` até `VALIDATE CONSTRAINT` ser executado deliberadamente. | Médio | Enquanto não aplicadas, não há limite de tamanho no banco: um cliente de API (não o app) pode gravar textos arbitrariamente grandes (`notes`, `address`) — risco de abuso de armazenamento/DoS de custo. | Aplicar a migração e, após revisão de dados legados, rodar `VALIDATE CONSTRAINT` para fechar a lacuna também para linhas antigas. |

---

## 3. Exposição de segredos/chaves

| # | Achado | Severidade | Risco concreto | Recomendação |
|---|---|---|---|---|
| 3.1 | `src/utils/public-config.ts` valida ativamente que a chave usada no cliente é `anon`/`sb_publishable_...` e **rejeita** chaves `service_role`/`secret` antes mesmo de criar o client Supabase; `vite.config.ts` chama essa mesma validação no momento do `build`, falhando o build se a chave for privilegiada. | Baixo (controle bem implementado) | — | Manter. Esse é um dos pontos mais fortes do repositório: um erro humano de colar a `service_role key` no `.env` de produção é pego em build-time, não em runtime no navegador de um usuário. |
| 3.2 | `.env.example` contém apenas placeholders (`https://seu-projeto.supabase.co`, `sua-chave-anonima-publica`), sem segredo real. `.gitignore` cobre `*.local` (cobre `.env.local`, convenção usada no projeto). | Baixo | — | Reforçar o `.gitignore` com padrões explícitos (`.env`, `.env.*`, exceto `!.env.example`) para não depender apenas da convenção de nome `*.local`. |
| 3.3 | CI (`quality.yml`) usa exclusivamente uma chave `sb_publishable_fixture_not_a_real_key` sintética para o job de build; nenhum segredo real trafega pelo workflow. | Baixo | — | Manter. Se no futuro for necessário testar contra um projeto Supabase real de staging, usar GitHub Encrypted Secrets e nunca logar seu valor (`echo`/`print`). |
| 3.4 | Não há `.env` real nem chaves reais versionadas no repositório (verificado). | Baixo | — | — |

---

## 4. Validação e sanitização de entradas

| # | Achado | Severidade | Risco concreto | Recomendação |
|---|---|---|---|---|
| 4.1 | `src/utils/validation.ts` centraliza a montagem do payload (`contactPayload`, `leadPayload`, `projectPayload`) com lista explícita de campos, limites de tamanho, validação de e-mail, data (`AAAA-MM-DD`), preço (regex `\d{1,10}(\.\d{1,2})?`) e URL do Google Maps (HTTPS, sem credenciais na URL). Isso evita *mass assignment* via spread de objetos inteiros no cliente. | Baixo (boa prática) | — | Manter o padrão de "payload builder" explícito para qualquer tabela nova. |
| 4.2 | A validação da seção 4.1 é **apenas client-side**. Como a API é o PostgREST do Supabase (aceita diretamente o schema da tabela), um usuário autenticado que use a REST API diretamente (curl/Postman) com seu próprio JWT pode enviar campos fora da whitelist do app (ex.: `leads.status = 'convertido'` sem passar pela RPC de conversão) enquanto os controles de banco (constraints/trigger) não estiverem aplicados (ver 2.1/2.7). | Alto (correlacionado com 2.1) | Bypass de regra de negócio (conversão de lead sem cliente correspondente) e de limites de tamanho, diretamente pela API, sem precisar de nenhuma falha de front-end. | Mesma recomendação de 2.1: aplicar `20260906180000_audit_hardening.sql`, que adiciona o trigger `leads_require_client_on_conversion` e as constraints de tamanho — essa é a camada que realmente fecha o mass assignment a nível de dado, pois valida no servidor independentemente do cliente usado. |
| 4.3 | `src/utils/csv.ts` implementa parser CSV manual e estrito: limite de 2 MB (`MAX_CSV_BYTES`), até 500 linhas (`MAX_CSV_ROWS`), até 50 colunas e 10.000 caracteres por célula, rejeita aspas malformadas/mal fechadas. `src/pages/CsvImportPage.tsx` também limita pelo tamanho do arquivo antes de ler (`file.size > MAX_CSV_BYTES`) e reaplica `leadPayload` linha a linha na prévia. | Baixo (boa prática) | — | Manter. É um parser mais rígido que a maioria dos parsers CSV ingênuos baseados em `split(',')`, o que evita CSV injection estrutural (linhas malformadas confundindo colunas). |
| 4.4 | Importação de CSV não sanitiza células para o padrão de **CSV Injection / Formula Injection** (células começando com `=`, `+`, `-`, `@`, que podem ser interpretadas como fórmulas se o dado for reexportado e aberto no Excel/Sheets por um humano). Isso é relevante porque o próprio sistema também **gera** exports (pasta `exports/`) que podem ser reabertos em planilhas. | Médio | Um lead malicioso registrado com `company_name` = `=HYPERLINK(...)` ou similar, se exportado depois para CSV e aberto no Excel por um colaborador, pode disparar uma fórmula/link malicioso (vetor conhecido como "CSV Injection"). | Ao gerar exports (`exports/*.csv`), prefixar células que comecem com `=`, `+`, `-`, `@`, tab ou CR com um apóstrofo (`'`) ou envolver em aspas neutralizando o caractere de fórmula. Aplicar o mesmo cuidado a qualquer exportação futura feita pela própria aplicação. |
| 4.5 | Campos de texto livre (`notes`, `address`, etc.) não têm sanitização de HTML, mas isso é seguro **porque** o React escapa por padrão e não há `dangerouslySetInnerHTML` em nenhum componente (verificado via busca no código). | Baixo | — | Manter a política de nunca introduzir `dangerouslySetInnerHTML` sem revisão de segurança dedicada. |
| 4.6 | `src/lib/read-all.ts` limita leitura a 20.000 registros por consulta lógica e falha explicitamente (em vez de mostrar total parcial) se o volume ultrapassar o limite ou mudar durante a paginação. | Baixo (boa prática) | — | Reavaliar o limite quando o volume de dados real se aproximar de 20.000 registros; para relatórios financeiros “oficiais”, considerar agregação no servidor (função Postgres) em vez de paginação client-side, como já observado em `docs/qualidade.md`. |

---

## 5. Cabeçalhos HTTP de segurança

Arquivo `public/_headers` (Cloudflare Pages):

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Robots-Tag: noindex, nofollow
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
```

| # | Achado | Severidade | Risco concreto | Recomendação |
|---|---|---|---|---|
| 5.1 | CSP restritiva com `default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `connect-src` limitado ao próprio domínio Supabase. | Baixo (implementação forte) | — | Manter. Se um domínio customizado de API/CDN for adicionado no futuro, atualizar `connect-src` explicitamente (já observado em `docs/operacao.md`). |
| 5.2 | Ausência do cabeçalho `Strict-Transport-Security` (HSTS). | Médio | `*.pages.dev` já está na lista de HSTS preload dos principais navegadores, então o risco atual é baixo; porém, se um **domínio customizado** for configurado (comum em produção real), ele não herda esse preload automaticamente, abrindo uma janela para downgrade attack (HTTP→HTTPS) na primeira visita. | Adicionar `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` a `public/_headers` desde já, e submeter o domínio customizado futuro à lista de preload HSTS quando for definido. |
| 5.3 | `style-src 'self' 'unsafe-inline'` permite estilos inline. | Baixo | Reduz um pouco a eficácia da CSP contra XSS baseado em `style` injection (vetor menos comum que `script-src`, que já está restrito a `'self'`). | Aceitável para o MVP (React usa estilos inline internamente); migrar para CSS-in-JS com nonce ou CSS Modules puro elimina a necessidade de `'unsafe-inline'` no futuro. |
| 5.4 | Ausência de `Cross-Origin-Opener-Policy` e `Cross-Origin-Resource-Policy`. | Baixo | Hardening adicional contra ataques de canal lateral (Spectre-like) e isolamento de origem cruzada; risco baixo para este tipo de aplicação. | Adicionar `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Resource-Policy: same-origin` como reforço de defesa em profundidade. |
| 5.5 | `X-Robots-Tag: noindex, nofollow` presente, evitando indexação do CRM por buscadores. | Baixo (boa prática) | — | Manter. |

---

## 6. Proteção contra ataques comuns

| # | Vetor | Achado | Severidade | Recomendação |
|---|---|---|---|---|
| 6.1 | XSS | Nenhum uso de `dangerouslySetInnerHTML`, `innerHTML` ou `eval` encontrado no código-fonte (`src/`). React escapa strings por padrão. O único ponto que renderiza uma URL fornecida pelo usuário como `href` (link do Google Maps em `LeadDetailsPage.tsx`) valida `protocol === 'https:'` antes de usar (`safeMapUrl`), bloqueando `javascript:`/`data:` URIs. | Baixo | Manter os mesmos cuidados (`safeMapUrl`) ao adicionar qualquer novo campo do tipo link em `ClientDetailsPage.tsx` ou telas futuras — hoje o link em `ClientEditor`/detalhes do cliente deve ser conferido para garantir o mesmo padrão ao ser renderizado. |
| 6.2 | CSRF | A aplicação usa tokens Bearer (JWT) via `Authorization` header, não cookies de sessão automáticos, para autenticar chamadas ao Supabase (`@supabase/supabase-js` padrão usa `localStorage`). CSRF clássico depende do navegador enviar credenciais automaticamente (cookies); isso não se aplica da mesma forma a um esquema de Bearer token manual. | Baixo | Confirmar que nenhuma integração futura passe a usar cookies HttpOnly para a sessão Supabase sem also implementar proteção CSRF (SameSite=Strict/Lax + token). Não é necessário hoje. |
| 6.3 | IDOR | IDs de leads/clientes/projetos são UUIDs v4 acessíveis por qualquer conta autenticada da equipe — isso é **esperado pelo modelo de dados compartilhado** (não há noção de "dado privado de outro usuário" no MVP). Não constitui vulnerabilidade de IDOR no sentido clássico, pois o controle de acesso pretendido é "qualquer membro vê tudo". | Informativo | Caso o produto evolua para múltiplas equipes/organizações no futuro, essa arquitetura precisará ser revisitada com um `tenant_id`/`organization_id` e RLS por organização — registrar como dependência arquitetural em `docs/ai-context/decisions.md`. |
| 6.4 | Injeção SQL via RPC | Única função RPC exposta é `convert_lead_to_client(p_lead_id uuid)`, chamada via `client.rpc('convert_lead_to_client', { p_lead_id: leadId })` — parâmetro tipado e passado via protocolo do PostgREST (parametrizado), sem concatenação de strings SQL em nenhum lugar do código PL/pgSQL revisado. | Baixo | Manter o padrão de parâmetros tipados em qualquer função nova; nunca usar `execute format('...%s...', input)` com entrada de usuário sem `%L`/`%I` e validação de allowlist (as poucas ocorrências de `execute format` no projeto estão em `supabase/tests/audit.sql`, usando apenas nomes de tabela fixos de um array literal, não entrada externa). |
| 6.5 | Mass assignment | Ver itens 4.1/4.2. Mitigado no cliente; depende da migração de hardening (2.1) para ser mitigado também no servidor. | Alto (até 2.1 ser resolvido) | Ver recomendação do item 4.2. |
| 6.6 | Clickjacking | `X-Frame-Options: DENY` e `frame-ancestors 'none'` presentes. | Baixo | Manter. |

---

## 7. Auditoria e trilha de logs

| # | Achado | Severidade | Risco concreto | Recomendação |
|---|---|---|---|---|
| 7.1 | **Não existe nenhuma tabela ou mecanismo de auditoria de dados** (quem alterou o quê e quando) no schema. As únicas colunas de rastreio são `created_at`/`updated_at`, mantidas por trigger (`set_updated_at`), sem `created_by`/`updated_by`. O nome da migração `20260906180000_audit_hardening.sql` é sobre **hardening de permissões**, não sobre auditoria de dados de negócio — pode gerar confusão de nomenclatura. | Alto | Em um CRM compartilhado por toda a equipe (qualquer um pode editar/excluir qualquer registro), não há como identificar quem excluiu um cliente, quem alterou um preço de projeto ou quem "perdeu" um lead indevidamente. Isso dificulta investigação de incidentes (erro humano ou malicioso) e responsabilização. | Adicionar `created_by uuid references auth.users(id)` e `updated_by uuid references auth.users(id)` (preenchidos via `auth.uid()` em trigger, não confiando no valor enviado pelo cliente) em `leads`, `clients` e `projects`; e/ou criar uma tabela `audit_log` (append-only, sem `UPDATE`/`DELETE` concedido a `authenticated`) alimentada por triggers `AFTER INSERT/UPDATE/DELETE` registrando `table_name`, `record_id`, `actor`, `action`, `old_data`/`new_data` (jsonb) e `changed_at`. |
| 7.2 | Logs de autenticação (login/logout, tentativas falhas) existem apenas no nível da plataforma Supabase (Auth Logs), com retenção tipicamente curta em planos gratuitos, e não são coletados/monitorados pela aplicação. | Médio | Sem retenção/monitoramento configurado, um incidente de acesso indevido pode não deixar rastro suficiente para investigação após alguns dias. | Definir responsável por revisar periodicamente os logs do painel Supabase (Auth + Postgres logs); avaliar exportação para um destino externo (ex.: webhook de Auth Events) se a retenção do plano atual for insuficiente para o SLA de investigação desejado. |
| 7.3 | Erros de UI (`ErrorBoundary`, mensagens de falha de sessão/dados) não vazam detalhes sensíveis: mensagens genéricas em português, sem stack trace nem payload de erro exibido ao usuário; `componentDidCatch` só loga uma string fixa no console. | Baixo (boa prática) | — | Manter esse padrão ao adicionar novos `catch`; nunca fazer `console.error(error)` com objetos que possam conter tokens/dados sensíveis do usuário. |

---

## 8. Backup, recuperação de desastres e continuidade

| # | Achado | Severidade | Risco concreto | Recomendação |
|---|---|---|---|---|
| 8.1 | Política documentada é exportação **manual semanal** pelo administrador, sem backup automático (plano gratuito do Supabase não inclui PITR), e sem evidência registrada de teste de restauração (`docs/qualidade.md`, item "Backup/recuperação"). | Alto | Em caso de exclusão acidental/maliciosa em massa (agravado pelo risco de `TRUNCATE` do item 2.2) ou corrupção de dados, não há garantia de que a restauração funcione nem de quanto tempo/dado seria perdido (RPO/RTO indefinidos). | Definir e testar RPO/RTO formalmente; testar uma restauração completa (incluindo relações entre `leads`/`clients`/`projects`) em ambiente isolado; considerar upgrade para um plano Supabase com backups diários/PITR dado que o sistema já lida com dados de negócio reais (endereços, contatos de prospects/clientes). |
| 8.2 | **Achado novo — dados reais de leads presentes no diretório de trabalho do repositório, fora do `.gitignore`.** A pasta `exports/` (ex.: `exports/leads-clinicas-alta-prioridade-2026-08-16.csv`, `exports/leads-parcial-38-importacao-2026-09-10.csv`, `exports/leads-parcial-38-revisao-2026-09-10.csv`) contém nomes de empresas, endereços completos e números de WhatsApp reais de prospecção (clínicas em Recife/PE, confirmado por amostragem), e **não está listada no `.gitignore`**. O `git status` no início desta análise mostra esses arquivos como não rastreados (`??`), ou seja, a um único `git add .`/`git add -A` de serem commitados permanentemente ao histórico do repositório. | Alto | Se o repositório for público, for compartilhado com terceiros (ex.: outro freelancer, cliente, ferramenta de CI de terceiros) ou simplesmente commitado sem revisão, dados pessoais de prospecção (LGPD: nome de responsável, telefone, endereço são dados pessoais) ficam expostos permanentemente no histórico do Git, mesmo que o arquivo seja removido depois (histórico do Git preserva blobs antigos). | 1) Adicionar `exports/` ao `.gitignore` imediatamente. 2) Confirmar que nenhum desses arquivos já foi commitado em algum branch/tag (`git log --all --full-history -- exports/`); se já tiver sido, reescrever histórico (`git filter-repo`/BFG) e considerar o dado como potencialmente exposto se o repositório já foi enviado a um remoto. 3) Mover exports operacionais para fora da pasta do repositório (ex.: pasta local sincronizada com backup privado, como já orienta `docs/operacao.md` "não colocar exports em `public/` ou no repositório" — reforçar que isso também vale para a raiz do repo, não só para `public/`). |
| 8.3 | `docs/mockups/*.png` foram adicionados ao repositório (não sensíveis, apenas telas de referência visual) — mencionado apenas para registro, sem ação necessária. | Baixo | — | — |

---

## 9. Dependências e supply chain

| # | Achado | Severidade | Risco concreto | Recomendação |
|---|---|---|---|---|
| 9.1 | `npm audit --json` executado nesta análise: **0 vulnerabilidades** em 79 dependências (14 prod, 66 dev, 45 optional). | Baixo | — | Repetir periodicamente; não é garantia permanente (novas CVEs podem surgir para versões já instaladas). |
| 9.2 | Stack em versões recentes: React 19.2.8, Vite 8.2.0, TypeScript ~6.0.2, `@supabase/supabase-js` ^2.112.3, `oxlint` ^1.75.0. | Baixo | — | Manter atualização regular; `^` no `package.json` permite atualizações de minor/patch automaticamente em `npm install` — garantir que o `package-lock.json` seja sempre commitado (está presente) para builds reprodutíveis. |
| 9.3 | Não há Dependabot (`.github/dependabot.yml`) nem outra automação de atualização/alerta de dependências configurada no repositório. | Médio | `npm audit` só roda quando alguém lembra de executar; sem Dependabot/Renovate, vulnerabilidades novas em dependências existentes podem passar despercebidas por longos períodos. | Adicionar `.github/dependabot.yml` com `package-ecosystem: npm` e `package-ecosystem: github-actions`, com atualização semanal e agrupamento de PRs; opcionalmente adicionar um job de `npm audit --audit-level=high` ao `quality.yml` para falhar o CI em vulnerabilidades altas/críticas. |
| 9.4 | CI usa `actions/checkout@v4` e `actions/setup-node@v4` fixados por tag major (não por SHA de commit). | Baixo | Tags major podem, em teoria, ser movidas (embora as actions oficiais do GitHub sejam consideradas de baixo risco); prática recomendada de supply chain é fixar por SHA. | Opcional para este porte de projeto: fixar actions por SHA completo (`actions/checkout@<sha>`) para máxima resistência a supply-chain attack; ou manter tags de actions oficiais do GitHub (risco já baixo) e focar esforço em 9.3. |

---

## 10. CI/CD e segredos no GitHub Actions

| # | Achado | Severidade | Risco concreto | Recomendação |
|---|---|---|---|---|
| 10.1 | `permissions: contents: read` definido no nível do workflow (`quality.yml`), aplicando o princípio de menor privilégio ao `GITHUB_TOKEN` por padrão. | Baixo (boa prática) | — | Manter; se um job futuro precisar publicar comentários em PR ou releases, conceder permissão adicional **apenas naquele job**, não no workflow inteiro. |
| 10.2 | Job `database-security` sobe um Postgres 17 efêmero com senha fixa (`disposable_ci_password`) apenas para o container de CI — não é um segredo real, apenas texto usado internamente ao runner. | Baixo | — | Manter como está; não reaproveitar essa senha para qualquer outro ambiente. |
| 10.3 | Job `checks` usa chave `VITE_SUPABASE_ANON_KEY: sb_publishable_fixture_not_a_real_key` sintética hardcoded no YAML (não é segredo, é intencionalmente falsa) apenas para permitir que o build TypeScript/Vite complete. Comentário no arquivo já alerta que esse artefato não deve ser publicado. | Baixo | Risco residual: se algum dia alguém alterar o workflow para fazer deploy automático a partir desse artefato de CI (que usa chave falsa e não aponta para o Supabase real), o deploy quebraria silenciosamente ou apontaria para lugar nenhum — não é um risco de segurança, mas vale nota operacional. | Ao configurar deploy automático (Cloudflare Pages ↔ GitHub, ainda pendente por `docs/ai-context/current-state.md`), usar variáveis de ambiente reais **apenas no ambiente de deploy do Cloudflare Pages** (não no workflow do GitHub Actions), como já orienta `docs/operacao.md`. |
| 10.4 | Não há verificação de segredos vazados (ex.: Gitleaks/TruffleHog) no CI. | Baixo | Um segredo commitado por engano (ex.: alguém cola a `service_role key` num commit de emergência) só seria pego manualmente. | Adicionar um job leve de `gitleaks` (ou `trufflehog --only-verified`) ao `quality.yml`, rodando em `pull_request` para bloquear merges com segredos detectados. |
| 10.5 | Workflow roda em `on: [push, pull_request]` sem restrição de branch, o que é aceitável para um repositório privado de um único freelancer/equipe pequena. | Baixo | — | — |

---

## Resumo consolidado por severidade

| Severidade | Quantidade de achados | Itens |
|---|---|---|
| Crítico | 3 (todos correlacionados à mesma causa raiz) | 2.1, 2.2, 2.3 |
| Alto | 7 | 1.2, 1.4, 4.2, 6.5, 7.1, 8.1, 8.2 |
| Médio | 10 | 1.3, 2.4 (aceito por design), 2.6, 2.7, 4.4, 5.2, 7.2, 9.3, 1.5 (parcial) |
| Baixo | ~20 | Demais itens (implementações corretas registradas para reforço/manutenção) |

---

## Resumo executivo

**Top 5 prioridades, em ordem de urgência:**

1. **Aplicar e validar `supabase/migrations/20260906180000_audit_hardening.sql` em produção** (Crítico). Ela é a única barreira contra `TRUNCATE`/grants excessivos e contra sessões anônimas herdando `role: authenticated` — até ser aplicada, o sistema está tecnicamente exposto a perda total de dados ou acesso não autorizado caso login anônimo esteja habilitado.
2. **Confirmar no painel Supabase que cadastro público e login anônimo estão desativados** (Crítico, ação administrativa fora do código) — é o pressuposto do qual toda a estratégia de RLS compartilhada depende.
3. **Remover `exports/` do controle de versão e do diretório do repositório** (Alto) — arquivos com dados reais de prospects (nome, endereço, WhatsApp) estão a um `git add` de serem commitados permanentemente; adicionar ao `.gitignore` e mover para armazenamento privado fora do repo.
4. **Ativar MFA para contas administrativas e definir processo de revogação de sessão no offboarding** (Alto) — hoje uma única senha vazada dá acesso total e indefinido a todos os dados da equipe.
5. **Adicionar trilha de auditoria de dados (`created_by`/`updated_by` ou tabela `audit_log`)** (Alto) — sem isso, é impossível investigar quem alterou/excluiu um registro em um CRM onde toda a equipe compartilha acesso total de escrita.

Pontos fortes já implementados que merecem ser preservados: bloqueio de chave privilegiada no build (`public-config.ts`/`vite.config.ts`), CSP restritiva em `public/_headers`, parser de CSV rigoroso com limites de tamanho, payloads explícitos contra mass assignment no cliente, função RPC com `security invoker`, e `npm audit` limpo (0 vulnerabilidades).
