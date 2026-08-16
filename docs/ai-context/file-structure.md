# Estrutura de arquivos aprovada

```text
src/
  pages/          telas: dashboard, leads, clientes e login
  features/       regras de leads, clientes, projetos e importação
  components/     botões, tabelas, filtros e elementos reutilizáveis
  lib/            conexão com o Supabase
  hooks/          lógica reutilizável da interface
  types/          formatos dos dados
  utils/          validações e funções auxiliares

supabase/
  migrations/     alterações estruturadas do banco de dados

public/           arquivos estáticos
docs/ai-context/  planejamento e contexto da IA
```

## Ferramenta de desenvolvimento

Usar Vite para criar, desenvolver localmente e preparar a aplicação React com TypeScript para publicação.
