# Estado atual

## Etapas concluídas

Parte 1 — Descoberta do produto.

Parte 2 — Requisitos detalhados do MVP.

Parte 3 — Experiência do usuário.

Parte 4 — Arquitetura técnica.

Parte 5 — Modelo de dados.

Parte 6 — Estrutura de arquivos.

Parte 7 — Ordem de construção do MVP.

Parte 8 — Testes e validação.

Parte 9 — Publicação, segurança e backup.

Parte 10 — Operação e evolução futura.

Base da aplicação — React, TypeScript e Vite configurados; estrutura de pastas aprovada criada.

Base do Supabase — cliente, variáveis de ambiente de exemplo e migração inicial com tabelas e permissões criados. A migração foi aplicada e os endpoints das tabelas foram verificados no projeto remoto.

Login — tela de acesso por e-mail e senha criada e integrada ao Supabase. A criação dos usuários permanece manual no painel do Supabase.

Leads — tabela e página individual conectadas ao Supabase, com cadastro, edição, exclusão confirmada, busca, filtros, ordenação por próxima ação e visualização dos dados completos.

Importação de leads — modelo CSV, prévia, validação, detecção de possíveis duplicidades, seleção manual e confirmação antes da inclusão no banco implementados.

Conversão de lead — ação e função transacional implementadas para criar o cliente e marcar o lead como convertido. A migração correspondente ainda precisa ser aplicada no Supabase.

## Próxima etapa

Aplicar a migração `20260816195000_convert_lead_to_client.sql` no Supabase e validar a conversão com um lead fictício.
