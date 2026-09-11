# Aplicação — contador de Leads

## Alterações

- `src/pages/LeadsPage.tsx`: adiciona, acima da tabela, um parágrafo semântico com `role="status"` e `aria-live="polite"`, usando `visibleLeads.length` para refletir busca, status e filtro de atrasadas. A paginação existente continua usando o mesmo total.
- `src/App.css`: adiciona estilo discreto ao contador, com contraste, peso visual e espaçamento antes da tabela.

## Validações

- `npm run lint` — aprovado.
- `npm run build` — aprovado (`tsc -b` e `vite build` concluídos).

Alteração preparada para commit e push nesta entrega.
