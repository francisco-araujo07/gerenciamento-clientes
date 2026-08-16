# Arquitetura técnica aprovada

## Plataforma

- Aplicação web responsiva, acessível por navegador em computador e celular.
- Hospedada online para uso de qualquer lugar.

## Tecnologias

- Interface: React com TypeScript.
- Ferramenta de desenvolvimento e build: Vite.
- Hospedagem: Cloudflare Pages.
- Banco de dados, autenticação e permissões: Supabase.

## Acesso

- Cada membro da equipe terá login e senha próprios.
- A autenticação será fornecida pelo Supabase.
- Todos os usuários autenticados da equipe poderão visualizar e editar os mesmos dados no MVP.

## Dados e importação

- O Supabase armazenará os dados de leads, clientes e projetos.
- A importação de CSV será feita pela aplicação, com prévia, validação e confirmação manual.
- A IA não terá acesso direto ao banco de dados no MVP.
- As regras de acesso do Supabase restringirão os dados a usuários autenticados da equipe.

## Custo inicial

- Priorizar os planos gratuitos do Cloudflare Pages e do Supabase.
- Monitorar limites e disponibilidade dos planos antes de qualquer crescimento de uso.
