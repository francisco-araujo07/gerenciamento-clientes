# Aplicação das recomendações de UX/UI

**Data:** 10/09/2026
**Relatório de referência:** `docs/analysis/ux-ui.md`

## Alterações implementadas

- `src/components/ConfirmDialog.tsx`: criado diálogo reutilizável baseado em `Modal`, com cancelamento, confirmação, estado ocupado e variante destrutiva.
- `src/pages/LeadsPage.tsx`: exclusão de lead usa diálogo visual; ações da tabela usam ícones com rótulos acessíveis; datas atrasadas exibem badge `Atrasada`; estados vazios diferenciam base vazia de filtros sem resultado; adicionados CTA para limpar filtros, criar lead e importar CSV; feedback de sucesso após salvar; tooltip para próxima ação longa.
- `src/pages/LeadDetailsPage.tsx`: conversão usa diálogo visual; mensagem técnica sobre migração foi simplificada para o usuário final.
- `src/pages/ClientDetailsPage.tsx`: exclusão de cliente e projeto usa diálogo visual; confirmações reforçam a política de exclusão; feedback de sucesso após salvar cliente/projeto.
- `src/pages/CsvImportPage.tsx`: confirmação usa diálogo visual; resumo informa linhas encontradas, prontas e com erro; ícones decorativos foram ocultados de leitores de tela.
- `src/pages/ClientsPage.tsx`: resumo de projetos passou a exibir nome, badge de situação e prazo/data de conclusão; estados vazios diferenciam filtros sem resultado; filtros e tabela receberam melhorias de acessibilidade e atributos para o layout mobile.
- `src/pages/DashboardPage.tsx`: período passou a usar semântica de `radiogroup`/`radio`; ícones decorativos foram ocultados.
- `src/features/leads/LeadForm.tsx` e `src/features/clients/ClientEditor.tsx`: campos receberam limites HTML coerentes com a validação existente, indicação acessível de obrigatoriedade e contadores para anotações/próxima ação.
- `src/App.css`: contraste de textos secundários escurecido; pills de período refinadas; modal adaptado a `dvh`; estilos de confirmação, estados vazios, badges de projetos e ações destrutivas; tabelas de Leads, Clientes e CSV refluem para cartões abaixo de 640px, sem depender de rolagem horizontal.

## Recomendações não aplicadas

- **Cadastro manual de clientes:** não implementado. A API atual de `src/features/clients/client-service.ts` não possui `createClient`, e `ClientEditor` recebe um `Client` completo, incluindo identificador e metadados. Implementar apenas a tela criaria um fluxo incompleto e exigiria alteração de serviço/tipos, fora do escopo solicitado. O botão `+ Novo cliente` permanece pendente até existir contrato de criação aprovado.
- **Navegação direta para o cliente recém-convertido:** não aplicada. O serviço atual `convertLeadToClient` não retorna o cliente criado ao chamador; alterar esse contrato está fora do escopo. A mensagem orienta o usuário a procurar a empresa na área Clientes.
- **Monitoramento/telemetria do ErrorBoundary:** não aplicado, pois exigiria serviço de dados ou infraestrutura fora do escopo visual.
- **Paginação no servidor, atalhos de teclado, ações em lote e contador de atrasados no Dashboard:** permanecem oportunidades futuras, conforme a priorização do relatório.

## Validações

- `npm run build`: aprovado.
- `npm run lint`: aprovado.
- `ReadLints` nos arquivos alterados: nenhum diagnóstico.
- `npm test`: 15 testes passaram; a suíte falhou no teste de serviços por `ERR_MODULE_NOT_FOUND` ao resolver `src/utils/dates` sem extensão em `tests/services.test.mjs`. Nenhum arquivo de serviços, tipos, utilitários ou testes foi alterado nesta entrega.
