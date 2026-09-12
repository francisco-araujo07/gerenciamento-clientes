# Decisões confirmadas

| Decisão | Detalhe |
|---|---|
| Objetivo do sistema | Aumentar controle, escala e velocidade da aquisição de clientes. |
| Entrada de leads | IA pesquisa; a equipe aprova manualmente; IA cadastra apenas os aprovados. |
| Estrutura principal | Dashboard, tabela de leads e tabela de clientes. |
| Clientes | Clientes ficam em tabela própria; projetos vinculados concentram prazo, preço e situação do serviço. |
| Faturamento | Somar somente projetos concluídos, usando a data de conclusão para os filtros. |
| Situações do projeto | Aguardando início, Em desenvolvimento, Pausado, Concluído e Abandonado. |
| Filtro de clientes | Permitir filtrar a tabela pela situação do projeto. |
| Funil de leads | MVP legado: Novo, Negociação, Convertido e Perdido. F1 (flag `ff_glc_funil_status` / `VITE_FF_GLC_FUNIL_STATUS`, default OFF) gateia **somente a UI**. Após migrate, RPC/triggers/enum existem no servidor. Funil canônico `novo`, `contato_porteiro`, `encaminhado`, `falando_decisor`, `reuniao_marcada`, `proposta_enviada`, `convertido`, `perdido`, `pausado_60d`, mais legado `negociacao` (não é destino de transição nem de create). Sem auto-map de `negociacao` → `falando_decisor`. Sem coluna `status_v2`. UPDATE de `status` só via RPC (`app.via_lead_status_write`). CHECKs NOT VALID; VALIDATE fica para janela futura. |
| Fila de cadência | F2 (flag `ff_glc_fila_cadencia` / `VITE_FF_GLC_FILA_CADENCIA`, default OFF) gateia **somente a UI**. Após migrate, o motor vive na RPC `registrar_cadencia`. Offsets `[3,4,6]`; `max_touches_sem_resposta = 4`; 4º toque retorna `409/TOUCH_LIMIT` (modal Pausar 60d / Perdido / Cancelar). `respondeu` zera toques e limpa `next_action_due_date` até reagendar. Fila: ativos F1 inclusive `negociacao`, due date ≤ fim do dia America/Recife; desempate por `created_at`. WhatsApp mascarado na lista; F3 OFF → `wa.me` sem template. INSERT em `lead_atividade` só via RPC/trigger. UPDATE de `touches_sem_resposta`, `next_action` e `next_action_due_date` só com GUC (`via_cadencia_write` ou `via_lead_status_write` da F1). Contrato de `lead_atividade`: tipo `toque\|resposta\|reagendar`, resultado `toquei\|respondeu\|sem_resposta\|reagendado` (não replica 1:1 o `p_acao`). Ramp da F2 assume F1 ON, sem hard-block se F1 estiver OFF. Sem cron/badge, kanban ou WhatsApp Business API. |
| Kit WhatsApp | F3 (flag `ff_glc_kit_whatsapp` / `VITE_FF_GLC_KIT_WHATSAPP`, default OFF) gateia **somente a UI**. Após migrate, `wa_templates` e as colunas do lead existem no servidor. Envio **somente** `https://wa.me/...` — sem WhatsApp Business API, BSP ou envio server-side. Sem F4, o número é `leads.whatsapp` e `{{porteiro_nome}}`/`{{decisor_nome}}` → `—`. Com F4 ON, o modal pergunta “Para quem?” e usa o E.164 do escolhido; as variáveis vêm das colunas F4. Prévia editável não grava o template. “Considerar como Toquei?” chama o motor F2. Seeds CA-F3-02. Expand-only; sem DROP; sem migrate/promote prod. |
| Porteiro vs decisor | F4 (flag `ff_glc_porteiro_decisor` / `VITE_FF_GLC_PORTEIRO_DECISOR`, default OFF) gateia **somente a UI**. Opção A: campos no `leads` (sem `lead_contato` 1-N). Colunas: `porteiro_nome`, `porteiro_whatsapp`, `decisor_nome`, `decisor_whatsapp`, `decisor_cargo` opcional, `contato_principal` (`porteiro\|decisor\|geral`, default `geral`), `ultimo_combinado_com_porteiro`. Manter `responsible_name` + `whatsapp` (bloco Geral). Sem DROP. `deleted_at` ADD nullable + filtro `IS NULL`. CSV: colunas opcionais `porteiro_*`/`decisor_*`. Spotlight não bloqueante em `contato_porteiro`/`falando_decisor` sem nome. Expand-only; sem migrate/promote prod. |
| Conversão de lead | Criar cliente correspondente e preservar os dados e anotações do lead. |
| Visualização padrão de leads | Ocultar leads convertidos e perdidos, mantendo-os disponíveis para filtros e consulta. |
| Dados dos leads | Empresa, responsável, contatos, endereço/Google Maps, segmento, status, resumo/anotações e próxima ação. |
| Dados dos clientes | Dados de contato do lead, resumo/anotações, projeto, preço, prazo, situação do serviço e data de conclusão. |
| Ações manuais | Permitir cadastrar, editar e excluir leads e clientes, com confirmação antes da exclusão. |
| Exclusão definitiva | Usar somente para registros criados por engano; usar status para registros encerrados. |
| Busca rápida | Permitir busca por empresa ou responsável. |
| Próxima ação | Registrar descrição e data prevista; priorizar registros atrasados. |
| Origem do lead | Registrar a origem, como Google, Instagram ou indicação. |
| Importação de leads | Importar CSV de leads aprovados, com modelo, prévia, validação, confirmação manual e revisão de possíveis duplicados. |
| Duplicados no CSV | Sinalizar possíveis duplicados por WhatsApp, e-mail ou empresa e não importar automaticamente. |
| Acesso da IA ao banco | Não permitir acesso direto no MVP; a IA prepara o CSV estruturado. |
| Navegação | Organizar o sistema em Dashboard, Leads e Clientes. |
| Referência visual | Seguir os mockups de `docs/mockups` para cores, tipografia, estrutura e componentes, sem adicionar ao MVP as áreas extras exibidas neles. |
| Detalhes de registros | Abrir uma página própria com contatos, resumo/anotações e ações ao selecionar uma linha. |
| Colunas visíveis de leads | Empresa, Responsável, WhatsApp, Status, Próxima ação e Ações. |
| Organização de clientes | Um cliente pode ter vários projetos; cada projeto pertence a um único cliente. |
| Colunas visíveis de clientes | Empresa, Responsável, Resumo dos projetos e Ações. |
| Dados de projetos | Exibir projetos, preço, prazo e situação na página de detalhes do cliente. |
| Plataforma | Aplicação web responsiva, acessível em computador e celular. |
| Hospedagem | Cloudflare Pages. Production (`main`) e Preview (PRs) são envs separados. Hard-fail de `VITE_SUPABASE_*` no `vite.config` é pré-existente (`153adab`); sem as duas vars o build não aborta, runtime valida. Preferência: Francisco preenche Production + Preview. Check Pages das PRs não é required. |
| Interface | React com TypeScript. |
| Ferramenta de desenvolvimento | Vite. |
| Banco, autenticação e permissões | Supabase. |
| Estrutura de arquivos | Organizar o projeto em páginas, funcionalidades, componentes, conexão Supabase, tipos, utilitários e migrações. |
| Acesso de usuários | Login e senha próprios para cada membro da equipe. |
| Permissões do MVP | Todos os usuários autenticados da equipe podem visualizar e editar os mesmos dados. |
| Gestão de acessos | Criar e remover usuários manualmente no Supabase, sem tela administrativa no MVP. |
| Backup | O administrador do Supabase exporta os dados semanalmente e guarda o arquivo em local privado com acesso controlado. |
| Custo inicial | Priorizar planos gratuitos e monitorar limites de uso. |
| Automação de mensagens | Evolução futura, fora do MVP. |
| Contratos formais | Não serão incluídos. |
