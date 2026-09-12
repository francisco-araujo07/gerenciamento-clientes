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

## Aceite da fila de cadência (F2, Must)

- CA-F2-01: visão Hoje (menu acima de Leads) com abas Todos|Hoje|Atrasadas.
- CA-F2-02: fila de ativos F1 (inclui `negociacao`, exclui convertido/perdido/pausado_60d) com due date ≤ hoje em Recife.
- CA-F2-03: atrasadas (mais antigas) depois as de hoje.
- CA-F2-04: colunas empresa, status, WhatsApp mascarado, próxima ação, data com badge vermelho se atrasada, toques e ações.
- CA-F2-05: Toquei, Respondeu, Sem resposta, Reagendar, Perdido/Pausar e Abrir WhatsApp (`wa.me` sem template).
- CA-F2-06/07/08: motor +3d follow-up, +4d case/nicho, +6d break-up. `respondeu` zera toques, limpa a due date (sai da fila) e a UI pede reagendamento.
- CA-F2-09: 4º toque → `409/TOUCH_LIMIT` e modal Pausar 60d | Perdido | Cancelar.
- CA-F2-10/11: `lead_atividade` e `touches_sem_resposta` default 0.
- CA-F2-12: CTA de leads `novo` sem `next_action_due_date` visível no empty state e com fila não vazia.
- CA-F2-13: timeline de atividades no detalhe do lead.
- CA-F2-14: flag OFF por padrão; F2 OFF não quebra o legado.

## Aceite do Kit WhatsApp (F3, Must)

- CA-F3-01: flag `VITE_FF_GLC_KIT_WHATSAPP` OFF por padrão; OFF oculta botão/modal/config.
- CA-F3-02: colunas `gatilho` (≤280), `prototipo_url`, `prototipo_notas`, `wa_ultimo_template_id`.
- CA-F3-03: tabela `wa_templates` com RLS deny-by-default; autenticados leem/criam/editam; sem DELETE.
- CA-F3-04: 5 templates seed ativos (abertura, follow-up, case/nicho, break-up, protótipo).
- CA-F3-05: config CRUD (lista, criar/editar, desativar); inativos só na config.
- CA-F3-06: modal Abrir WhatsApp no detalhe e na fila Hoje.
- CA-F3-07: template sugerido pelo status do lead.
- CA-F3-08: prévia editável não grava o template.
- CA-F3-09: aviso para anexar o print do protótipo.
- CA-F3-10: normalizar E.164 BR e abrir `https://wa.me/{numero}?text=` URL-encoded em nova aba.
- CA-F3-11: “Considerar como Toquei?” Sim → motor F2 `registrar_cadencia`.
- CA-F3-12: variáveis empresa/responsável/gatilho/segmento/bairro_ou_cidade/protótipo/seu_nome; porteiro/decisor → `—`.
- CA-F3-13: nenhum cliente WhatsApp Cloud API nesta feature; só `wa.me`.

## Evidências da auditoria de 06/09/2026
- npm test: 15 testes locais; datas, dinheiro, CSV, configuração, paginação e contratos de escrita.
- npm run lint e npm run build aprovados com TypeScript strict.
- tests/ui.html permite inspecionar fluxos com dados fictícios; não valida persistência nem RLS.
- supabase/tests/audit.sql é um teste inicial preparado, NÃO executado. Requer banco descartável com migrações.
- Fluxo remoto, permissões reais, carga, leitor de tela e restauração continuam pendentes; ver ../qualidade.md.
