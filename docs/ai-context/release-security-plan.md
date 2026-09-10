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

## Requisitos de liberação após a auditoria
- Cadastro público e login anônimo precisam estar desativados; criar membros apenas pelo administrador. As políticas compartilhadas pressupõem esse controle.
- Aplicar e validar a migração 20260906180000_audit_hardening.sql primeiro em teste; não foi aplicada pela auditoria.
- Publicar dist com Node 24 e variáveis publicáveis corretas. Verificar cabeçalhos e renderização na URL final.
- Confirmar MFA administrativo, revogação de sessões, restauração de backup e responsável por incidentes.
- Instruções: ../operacao.md. Evidências e limitações: ../qualidade.md.
