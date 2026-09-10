# Aplicação das recomendações de segurança

Data: 10/09/2026

## Arquivos alterados

- `.gitignore`
- `public/_headers`
- `src/utils/public-config.ts`
- `src/lib/supabase.ts`
- `src/App.tsx`
- `.github/dependabot.yml`
- `.github/workflows/quality.yml`

Os três arquivos existentes em `exports/` não foram apagados nem movidos: a inspeção confirmou que contêm dados reais de prospecção. A pasta agora está protegida contra novos commits por `.gitignore`; a remoção para armazenamento privado e qualquer limpeza histórica devem ser feitas manualmente pelo responsável, após verificar eventual publicação em remoto.

## Mudanças concretas

- `.gitignore`: adicionados `.env`, `.env.*` com exceção de `.env.example`, e `exports/`.
- `public/_headers`: adicionados HSTS com `includeSubDomains` e `preload`, `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Resource-Policy: same-origin`.
- `src/utils/public-config.ts`: URL e chave são normalizadas antes da validação; URLs com caminho, credenciais, query ou hash são rejeitadas; JWTs precisam ter três partes e `role: anon`; chaves privilegiadas continuam proibidas.
- `src/lib/supabase.ts`: autenticação configurada explicitamente com fluxo PKCE, renovação automática, persistência compatível com o comportamento atual e sem aceitar sessão OAuth/token na URL.
- `src/App.tsx`: sessões Supabase marcadas como anônimas são rejeitadas e encerradas localmente antes de liberar a aplicação. Isso é defesa em profundidade e não substitui RLS nem a desativação do provedor anônimo.
- `.github/dependabot.yml`: atualizações semanais de dependências npm e GitHub Actions, agrupadas e limitadas a cinco PRs abertos por ecossistema.
- `.github/workflows/quality.yml`: CI passa a executar `npm audit --audit-level=high` após `npm ci`.

## Validações executadas

- `ReadLints` nos arquivos alterados: nenhum erro novo.
- `npm run build`: passou com Node 24.14.1 e gerou `dist`; `dist/_headers` contém os novos cabeçalhos.
- `npm run lint`: terminou com sucesso, mas reportou três avisos preexistentes em `src/pages/ClientDetailsPage.tsx` (`ConfirmDialog`, `successMessage` e `showClientDeletion` não utilizados). Esse arquivo não foi alterado.
- `npm test`: 5 testes passaram e 1 arquivo de testes falhou antes da execução por resolução ESM preexistente: `src/utils/leads.ts` importa `src/utils/dates` sem extensão. A falha não foi introduzida por esta alteração.
- `npm audit --audit-level=high`: não foi executado separadamente nesta sessão; foi adicionado ao CI para as próximas execuções.

## Recomendações não aplicadas

- Migração `supabase/migrations/20260906180000_audit_hardening.sql`, RLS, grants, bloqueio de `TRUNCATE`, constraints e trigger de conversão: fora do escopo solicitado; deve ser aplicada e validada pelo administrador em banco de teste e depois no Supabase real.
- Desativação de cadastro público e login anônimo, revisão de contas e políticas de senha: dependem do painel Supabase e não são verificáveis nem alteráveis com segurança pelo frontend.
- MFA/TOTP e exigência de `aal2`: requer enrollment, challenge e confirmação das contas no Supabase; não foi adicionada uma tela incompleta que poderia bloquear usuários sem configuração prévia.
- Rate limiting/CAPTCHA do login: depende da configuração do provedor Supabase Auth.
- Revogação global de sessões no desligamento, TTL e processo de offboarding: dependem de operação privilegiada/admin; o logout normal continua local para preservar o comportamento do MVP.
- Trilha de auditoria (`created_by`/`updated_by` ou `audit_log`): exige alteração de schema/triggers e foi explicitamente excluída deste escopo.
- Validação presencial da API REST/CORS, backup/restauração, RPO/RTO e monitoramento de logs: exigem ambiente Supabase e procedimento operacional; não foram executados contra dados reais.
- CSV Injection: não existe gerador de exportação na aplicação para alterar neste escopo. Os CSVs operacionais existentes foram apenas protegidos contra versionamento; qualquer exportador futuro deve neutralizar células iniciadas por `=`, `+`, `-`, `@`, tab ou CR.
- Scanner Gitleaks/TruffleHog no CI: não adicionado para evitar introduzir uma ação externa adicional sem validar sua política de execução e falsos positivos; Dependabot e `npm audit` foram aplicados como controles de dependências.
