# Testes e validação do MVP

## Testes automáticos

Validar as regras críticas:

- Login e permissões.
- Conversão de lead em cliente.
- Importação de CSV.
- Identificação de possíveis duplicados no CSV.
- Cálculo do faturamento.
- Filtro de status e situação.

## Teste prático da equipe

Usar dados fictícios em computador e celular para validar:

1. Cadastrar um lead.
2. Importar um CSV.
3. Buscar e filtrar registros.
4. Conferir a priorização de próxima ação atrasada.
5. Converter um lead em cliente.
6. Criar um projeto.
7. Marcar o projeto como concluído.
8. Conferir o faturamento no dashboard.

## Critérios de aceite

O MVP estará pronto quando o faturamento estiver correto, dados não forem acessíveis sem login e os dois usuários conseguirem concluir o fluxo sem ajuda.

## Evidências da auditoria de 06/09/2026
- npm test: 15 testes locais; datas, dinheiro, CSV, configuração, paginação e contratos de escrita.
- npm run lint e npm run build aprovados com TypeScript strict.
- tests/ui.html permite inspecionar fluxos com dados fictícios; não valida persistência nem RLS.
- supabase/tests/audit.sql é um teste inicial preparado, NÃO executado. Requer banco descartável com migrações.
- Fluxo remoto, permissões reais, carga, leitor de tela e restauração continuam pendentes; ver ../qualidade.md.
