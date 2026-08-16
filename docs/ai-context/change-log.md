# Registro de alterações

## 2026-08-16

- Registrado o planejamento oficial da descoberta do produto e do escopo inicial do MVP.
- Registradas as regras de conversão, perda e visualização de leads.
- Registradas as colunas iniciais das tabelas de leads e clientes.
- Registradas ações manuais, confirmação de exclusão e busca rápida.
- Registrada a importação de leads por CSV com validação e confirmação manual.
- Registrada a navegação principal e a página de detalhes de registros.
- Registrada a organização visual do dashboard e das tabelas.
- Registrada a arquitetura técnica da aplicação.
- Registrado o modelo inicial de dados e a relação de um cliente com vários projetos.
- Removido o histórico de atividades do MVP; mantido o campo de resumo/anotações.
- Registrados Vite e a estrutura de arquivos do projeto.
- Registrada a ordem de construção do MVP.
- Registrados testes, validação e critérios de aceite do MVP.
- Registrados o plano de publicação, segurança e backup.
- Corrigida a documentação para refletir a ausência de histórico de atividades e os projetos vinculados a clientes.
- Registradas as regras operacionais, de acesso, duplicidade, exclusão, backup e evolução após o MVP.
- Criada a base da aplicação com React, TypeScript e Vite, incluindo a estrutura de pastas aprovada.
- Adicionada a base local do Supabase: cliente, variáveis de ambiente de exemplo e migração inicial de dados com RLS.
- Integrada a tela de login por e-mail e senha ao Supabase, com controle de sessão e saída.
- Criada a tabela de leads conectada ao Supabase, com cadastro, edição, exclusão confirmada, busca e filtros.
- Criada a página individual de detalhes do lead, com contatos, localização, próxima ação e anotações.
- Implementada a importação de leads por CSV com modelo, prévia, validação, duplicidades e confirmação manual.
- Implementada a conversão transacional de lead em cliente, pendente de aplicação da nova migração no Supabase.
- Criadas a tabela de clientes, o filtro por situação de projeto, os detalhes do cliente e o cadastro de projetos.
- Adicionadas edição e exclusão de projetos e exclusão confirmada de clientes.
