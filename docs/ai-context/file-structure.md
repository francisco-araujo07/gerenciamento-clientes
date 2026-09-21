# Estrutura de arquivos aprovada

```text
src/
  pages/          telas: dashboard, hoje (fila F2), leads, clientes, templates WA (F3), guia de conversa (F11) e login
  features/       regras de leads (inclui funil/status e mini-kanban F6), cadência (F2), kit WhatsApp (F3), porteiro/decisor (F4), reunião F5, guia de conversa (F11), clientes, projetos e importação
  components/     botões, tabelas, filtros e elementos reutilizáveis
  lib/            conexão com o Supabase
  hooks/          lógica reutilizável da interface
  types/          formatos dos dados
  utils/          validações e funções auxiliares

supabase/
  migrations/     alterações estruturadas do banco de dados

public/           arquivos estáticos
docs/ai-context/  planejamento e contexto da IA (inclui runbooks F1/F2/F3/F4/F5/F6/F11)
```

## Ferramenta de desenvolvimento

Usar Vite para criar, desenvolver localmente e preparar a aplicação React com TypeScript para publicação.
