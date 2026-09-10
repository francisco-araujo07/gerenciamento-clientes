# Gerenciamento de clientes

Aplicação interna para controle de leads, clientes e projetos de uma empresa de desenvolvimento de software.

## Desenvolvimento local

```bash
npm ci
npm run dev
```

## Referências do projeto

Usar Node 24 e configurar .env.local com as variáveis publicáveis indicadas em .env.example. Nunca usar service_role/secret no frontend. O build rejeita configuração ausente ou privilegiada.

Validação: npm test, npm run lint e npm run build. A publicação estática deve enviar dist, nunca a raiz com src/main.tsx.

As decisões e o estado do MVP estão em [`docs/ai-context/README.md`](docs/ai-context/README.md).
Consulte [auditoria e evidências](docs/qualidade.md) e [operação, migração e deploy](docs/operacao.md).
