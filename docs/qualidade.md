# Auditoria técnica — Gerenciamento de clientes

Data: 06/09/2026. Base: Contexto geral de aplicações web, versão 1.2.
Repositório: C:\Users\danie\Downloads\FRANCISCO\gerenciamento-clientes.
Referência inicial: commit b3f14f0, branch main. Correções no diretório de trabalho, sem commit/push/deploy nesta auditoria.

## Resultado e alcance

Foram corrigidos problemas reproduzíveis no código e acrescentados testes, validações de configuração e uma migração de endurecimento. A versão local passa em build, lint e 15 testes automatizados. Isso NÃO significa que o ambiente publicado já esteja corrigido ou que a aplicação cumpra integralmente a base.

Perfis aplicáveis: B+A+D, com importação local CSV (parte de U) e dependência do Supabase (parte de I). Não há pagamentos, upload persistente, formulário público, multiempresa nem ferramentas de IA no produto. Foram preservados o acesso compartilhado da equipe, a identidade visual e o escopo do MVP.

Não foram lidos registros reais nem executados comandos no banco remoto. A documentação do projeto reserva a operação do banco ao administrador. A migração e o teste SQL foram preparados, mas NÃO executados. O Docker local estava sem daemon e não havia psql disponível.

## Achados corrigidos no código

| Prioridade | Achado / base | Correção e evidência |
|---|---|---|
| Alta | Faturamento mensal/semanal excluía o primeiro dia depois da meia-noite — DA-03 | Comparação de datas civis, início de semana no domingo, mês desde dia 1, até hoje; testes de borda. Soma em centavos e rejeição de valores inválidos. |
| Alta | Consultas sem paginação podiam truncar receitas, clientes, projetos e detecção de duplicados — DA-04/PE-06 | Leitura em lotes ordenados, contagem exata e recusa de resultado incompleto; teste com 1.201 registros e teto de servidor inferior ao lote. Projetos obtidos separadamente para evitar truncamento de relação embutida. |
| Média | Tabelas renderizavam todo o conjunto de uma vez — PE-06 | Paginação visual de 50 registros e reinício ao alterar filtros. |
| Média | Edição concorrente podia sobrescrever mudanças da equipe — DA-02 | Atualizações enviam updated_at esperado e exigem uma linha retornada; conflito gera erro e preserva formulário. Testes de contrato com HTTP simulado. |
| Média | Campos adicionais poderiam entrar no payload por spread/objeto integral — SE-04/AR-03 | Lista explícita de campos editáveis, normalização e validações em runtime. Testes de campos extras. A proteção no cliente não substitui controles no banco. |
| Média | Configuração inválida e falhas de sessão podiam impedir abertura ou manter carregamento — AR-04/FE-01 | Validação na inicialização, timeout, tratamento de rejeições, tela de erro com nova tentativa e boundary para falhas de renderização. |
| Alta preventiva | Chave privilegiada poderia ser embutida em build mal configurado — SE-11/OP-04 | Build rejeita chave secret/service_role ou configuração ausente antes de gerar novo artefato; teste de configuração. Isso não remove artefatos antigos nem revoga segredos já expostos. |
| Média | Login/saída e exclusão tinham falhas sem feedback — FE-01/UX-09 | Tratamento de erros, desbloqueio de estado e mensagens; exclusão sem linha retornada não é sucesso falso. |
| Média | Cliente podia ter company_name nulo no editor; erro ao salvar ficava oculto — AR-03/UX-09 | Campo obrigatório permanece string; mensagem visível no formulário e valores preservados. Verificação no navegador com falha simulada. |
| Média | Formulário de projeto não aceitava centavos corretamente e omitia prazo/conclusão — DA-03/UX-09 | step 0.01, limites monetários, campos de data e exibição de prazo/conclusão. Testes e inspeção móvel. |
| Média | CSV sem limites, sintaxe estrita ou datas reais — FU-04/SE-10 | Até 2 MB e 500 leads, limites de célula/colunas, aspas malformadas rejeitadas, cabeçalhos duplicados/linhas inconsistentes rejeitados, validação de datas e URLs HTTPS. |
| Média | Leitura concorrente de arquivos e instrução de arrastar sem suporte — UX-09 | Seletor acessível, estado de leitura, controle de versão da prévia, seleção bloqueada durante operação e orientação correta. |
| Média | Modal sem foco modal nativo; layout móvel e foco deficientes — FE-02/UX-06/UX-07 | dialog nativo, Escape e retorno de foco, foco visível, navegação móvel rolável, projetos em coluna, quebra de textos e movimento reduzido. |
| Baixa | Notificações/ajuda sem ação — UX-08 | Removidos controles decorativos que pareciam funcionais. |
| Média | Ausência de checks reproduzíveis e hardening do host — AR-05/OP-06/SE-16 | CI com npm ci, lint, testes e build; TypeScript strict; arquivo _headers para Cloudflare. CI remoto ainda não executado. |
| Baixa | Idioma HTML incorreto e root vazio antes do JavaScript — FE-01/FE-02 | pt-BR, mensagem inicial de carregamento e noscript. |

## Migração preparada — não aplicada

Arquivo: supabase/migrations/20260906180000_audit_hardening.sql.

- Mantém as políticas permissivas de compartilhamento da equipe e acrescenta política restritiva contra sessões de usuários anônimos autenticados.
- Acrescenta limites de texto, protocolo HTTPS do mapa e rejeição de preço NaN no banco.
- Constraints NOT VALID não alteram dados antigos, mas se aplicam às novas escritas. Dados legados precisam ser revisados antes de VALIDATE CONSTRAINT; editar um registro legado inválido pode falhar até ele ser corrigido.
- Conversão transacional preserva o lock e passa a retornar o cliente existente numa repetição após sucesso, evitando erro por retry.
- Trigger impede transição para convertido sem cliente correspondente; o frontend também não oferece conversão direta no cadastro.
- Teste em supabase/tests/audit.sql cobre permissões simuladas de membro A/B, visitante, sessão anônima, limite de texto e repetição de conversão, com rollback.

O SQL ainda precisa ser executado em banco de teste. Esse teste não cobre autenticação HTTP, todos os tipos de DML, concorrência com duas conexões nem todas as tabelas/policies. Expandir e executar esses casos antes de promover a migração.

## Evidências executadas

- npm run build: aprovado, incluindo TypeScript strict e validação de configuração pública.
- npm run lint: aprovado.
- npm test: 15 testes aprovados; nenhum acesso ao banco real. Testes de persistência usam HTTP simulado, não provam RLS.
- npm audit --json: 0 vulnerabilidades conhecidas reportadas nesta consulta; não equivale a auditoria de código ou garantia futura.
- git diff --check: sem erros de whitespace.
- Navegador em desktop e 390 px: dashboard, leads, modal, clientes, edição de projeto, edição de cliente com falha, importação e falhas de sessão/dados.
- Modal: abre com foco interno, fecha por Escape e devolve foco ao botão de abertura; largura da página móvel igual à largura da viewport.
- Falha de faturamento mostra Indisponível, não R$ 0 como se fosse receita carregada.
- Build real servido localmente com os cabeçalhos de public/_headers: login renderizado, sem erros/warnings capturados no console.
- Fixture tests/ui.html usa dados fictícios e não faz parte do build de produção. A persistência nessa fixture é simulada.
- Não executado: leitor de tela completo, axe, Lighthouse, carga real, Core Web Vitals de campo e fluxo autenticado em produção.

## Pendências antes de declarar produção pronta

1. **Fronteira da equipe (alta):** confirmar no painel Supabase que cadastro público e login anônimo estão desativados, provedores não usados estão desativados e só membros autorizados existem. As políticas atuais permitem todos os authenticated; se signup público estiver aberto, um estranho com conta pode acessar dados. Não há evidência nesta auditoria de que signup esteja aberto ou fechado. Política is_anonymous não bloqueia uma conta pública permanente.
2. **Banco (alta):** administrador deve revisar backup, aplicar migração em teste, executar/expandir testes SQL e validar RLS de leads, clientes e projetos via API com identidades de teste. Depois aplicar a migração em produção em janela apropriada.
3. **Publicação (alta):** confirmar build npm run build, saída dist, Node 24 e variáveis públicas de produção. O diagnóstico anterior encontrou publicação de fonte; a URL pública não foi revalidada nesta auditoria. Não houve deploy.
4. **Backup/recuperação:** existe política de exportação semanal, mas não há evidência de exportação ou restauração recente. Acordar perda de dados e prazo de recuperação aceitáveis, testar restauração privada com relações e configurações.
5. **Acesso e operação:** confirmar MFA administrativo, expiração/revogação de sessões, processo de desligamento, rate limits de autenticação, alertas e responsável. Remoção de usuário pode não invalidar imediatamente todos os JWTs existentes; validar comportamento/TTL do ambiente.
6. **Privacidade:** definir retenção de contatos, exportações e logs. Preservadas as pastas exports/ e docs/mockups/ preexistentes; não foram publicadas ou alteradas.
7. **Cabeçalhos:** validar no domínio final. connect-src permite o domínio padrão Supabase; domínio customizado exige ajuste explícito. style-src permite inline por uso atual de estilos React. CSP foi conferida no login local, não em todos os fluxos autenticados do host.
8. **Monitoramento:** não há monitor externo/telemetria operacional configurada nesta entrega. O boundary registra uma mensagem genérica local, sem detalhes de clientes.

## Limites e próximos incrementos técnicos

- Leitura completa foi limitada a 20.000 registros por consulta lógica. Acima disso a UI informa falha, não mostra total parcial. É uma proteção transitória para o MVP; crescimento exige filtros/paginação no servidor e agregação de receita no banco.
- Paginação por offset não é snapshot transacional. Mudança de contagem é detectada, mas modificações simultâneas mantendo a mesma contagem podem afetar consistência da leitura. Para relatório financeiro autoritativo, usar agregação transacional no servidor.
- Controle de updated_at protege as edições feitas por esta aplicação. Não é uma nova política de autorização nem obriga outros clientes da API a usar controle de versão.
- Não há chave idempotente persistente para criação comum/importação. A interface bloqueia repetição durante execução e orienta revisão depois de erro ambíguo; a conversão será idempotente após a migração. Importação ainda deve ser conferida após timeout antes de repetir.
- Validação de texto/URLs no cliente melhora UX; os limites de banco somente entram em vigor com a migração. O regex de URL no banco é restrição de formato básica; o renderizador continua validando protocolo.
- Recuperação de senha segue operação administrativa existente; não foi criado novo fluxo de e-mail/reset sem configuração do produto.
- Algumas páginas ainda têm JSX denso e filtragem local; a auditoria priorizou defeitos e controles verificáveis, sem reescrever a arquitetura.
- Não foi adicionada segregação por usuário/empresa porque contradiz a decisão explícita de dados compartilhados no MVP.

## Como reproduzir

Use Node 24, npm ci, variáveis publicáveis em .env.local, npm test, npm run lint e npm run build.
Para interface fictícia: npm run dev -- --host 127.0.0.1 e abrir /tests/ui.html; ?fail=session, ?fail=data, ?fail=write simulam falhas.
Nunca publicar a fixture de testes ou o artefato compilado no CI com as variáveis sintéticas.
Para banco: seguir docs/operacao.md; os testes SQL são destinados exclusivamente a ambiente descartável.

## Fontes técnicas consultadas

- https://supabase.com/docs/guides/auth/auth-anonymous
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/reference/javascript/using-modifiers-range
- https://developers.cloudflare.com/pages/configuration/headers/

A fonte de requisitos principal foi a base geral local fornecida pelo usuário, conciliada com as decisões existentes em docs/ai-context/.

