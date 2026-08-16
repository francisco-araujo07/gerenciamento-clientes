# Publicação, segurança e backup

## Publicação

- Publicar no Cloudflare Pages a partir do repositório GitHub.
- Criar uma nova publicação após atualizações aprovadas.
- Usar inicialmente o endereço gratuito `*.pages.dev`.

## Segurança

- Exigir login para acessar o sistema.
- Proteger todas as tabelas do Supabase com regras de acesso.
- Permitir que todos os usuários autenticados da equipe visualizem e editem os mesmos dados no MVP.
- Não expor chaves secretas no código ou no navegador.

## Backup

- Exportar os dados manualmente uma vez por semana.
- Exportar os dados antes de alterações estruturais no banco.
- Não depender de backups automáticos no plano gratuito.
- Deixar a exportação sob responsabilidade do administrador do Supabase e guardar os arquivos em local privado com acesso controlado.
