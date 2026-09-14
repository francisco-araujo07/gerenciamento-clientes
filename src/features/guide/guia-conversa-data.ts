import { leadStatusLabels, type LeadStatus } from '../../types/lead.ts'
import { waSpecSeedNames } from '../../types/whatsapp.ts'

export const GUIA_CONVERSA_SOURCE = 'brief GLC-estilo-venda-guia-conversa + seeds F3 CA-F3-02 (corpos do Kit não são atualizados nesta entrega)'

export const guiaConversaEtapaIds = [
  'preparacao',
  'mensagem-porteiro',
  'reacoes',
  'decisor-responde',
  'pedir-reuniao',
  'pos-cadencia',
] as const

export type GuiaConversaEtapaId = (typeof guiaConversaEtapaIds)[number]

export type GuiaConversaKind = 'etapa' | 'decisao' | 'acao'

export type GuiaConversaGlcAction = {
  status?: LeadStatus
  next_action?: string
  next_action_due_date?: string
  note?: string
}

export type GuiaConversaF3Chip = (typeof waSpecSeedNames)[number]

export type GuiaConversaNode = {
  id: string
  title: string
  kind: GuiaConversaKind
  summary: string
  say?: string
  glc?: GuiaConversaGlcAction
  f3Chip?: GuiaConversaF3Chip
  printReminder?: boolean
  children?: GuiaConversaNode[]
}

export const guiaConversaPrinciples = [
  'O objetivo da conversa é uma reunião curta para mostrar o print do protótipo — não fechar preço pelo WhatsApp.',
  'Use uma observação real (gatilho). Não invente problema nem resultado garantido.',
  'Não envie pacote, tabela ou valor de investimento no WhatsApp. Se pedirem preço, volte para a reunião.',
  'O print do protótipo não vai no wa.me: anexe depois de abrir a conversa.',
  'Registre status, next_action e next_action_due_date no GLC. A cadência F2 usa esses campos; o Guia não aplica sozinho.',
  'Porteiro encaminha; decisor marca horário. Não misture os dois papéis na mesma fala.',
] as const

function glc(status: LeadStatus, next_action: string, next_action_due_date: string, note?: string): GuiaConversaGlcAction {
  return { status, next_action, next_action_due_date, note }
}

export const guiaConversaTree: GuiaConversaNode = {
  id: 'wa-root',
  title: 'Guia de conversa',
  kind: 'etapa',
  summary: 'Playbook de WhatsApp em seis etapas: preparar, falar com o porteiro, tratar a reação, falar com o decisor, pedir a reunião e seguir a cadência. Sem preço de pacote no chat.',
  glc: {
    note: 'Abra o lead no seletor acima para interpolar empresa, gatilho e nomes. O Guia não altera status sozinho.',
  },
  children: [
    {
      id: 'preparacao',
      title: 'Preparação',
      kind: 'etapa',
      summary: 'Chegue à primeira mensagem com gatilho verificável, print pronto e cadastro conferido.',
      glc: glc('novo', 'Preparar gatilho e print antes da primeira mensagem', 'Hoje', 'Status novo — Novo. Só avance para contato_porteiro quando enviar a primeira fala.'),
      children: [
        {
          id: 'prep-observar',
          title: 'Observar a empresa',
          kind: 'acao',
          summary: 'Uma frase de gatilho: site, Instagram, Google ou anúncio.',
          say: 'Gatilho da {{empresa}}{{#se segmento}} ({{segmento}}){{/se}}{{#se bairro_ou_cidade}} em {{bairro_ou_cidade}}{{/se}}: {{gatilho}}.',
          glc: glc('novo', 'Registrar gatilho no lead', 'Hoje', 'Preencha gatilho (e, se a F4 estiver ligada, porteiro_nome / decisor_nome) no cadastro. Não invente o problema.'),
        },
        {
          id: 'prep-print',
          title: 'Preparar o print do protótipo',
          kind: 'acao',
          summary: 'O print é hipótese de estrutura, não promessa de resultado.',
          say: 'Print da {{empresa}} pronto para anexar depois de abrir o WhatsApp.{{#se prototipo_url}} Referência: {{prototipo_url}}.{{/se}}',
          glc: glc('novo', 'Deixar print e prototipo_url prontos', 'Hoje', 'O wa.me só leva texto. Anexe o print na conversa depois de abrir.'),
          printReminder: true,
        },
        {
          id: 'prep-cadastro',
          title: 'Conferir o cadastro no GLC',
          kind: 'acao',
          summary: 'Empresa, WhatsApp, responsável e, se houver, porteiro e decisor.',
          say: 'Lead {{empresa}} conferido. Responsável: {{responsavel}}. Porteiro: {{porteiro_nome}}. Decisor: {{decisor_nome}}.',
          glc: glc('novo', 'Enviar primeira abordagem ao porteiro', 'Hoje', 'Use o seletor de lead deste Guia. Sem lead aberto, as variáveis ficam em — e blocos {{#se …}} somem.'),
        },
      ],
    },
    {
      id: 'mensagem-porteiro',
      title: 'Mensagem ao porteiro',
      kind: 'etapa',
      summary: 'Primeira abordagem curta: quem você é, o que viu, pedir encaminhamento para quem decide marketing/site.',
      say: 'Oi! Aqui é {{seu_nome}}. Vi a {{empresa}} ({{segmento}} em {{bairro_ou_cidade}}) e {{gatilho}}. Você poderia me encaminhar para quem decide a parte de marketing/site?',
      glc: glc('contato_porteiro', 'Aguardar resposta do porteiro', 'D+3 (cadência F2, 1º toque)', 'Status contato_porteiro — Contato com porteiro. Depois de enviar, registre o toque na fila Hoje se a F2 estiver ligada.'),
      f3Chip: 'Primeira abordagem (porteiro)',
      printReminder: true,
      children: [
        {
          id: 'porteiro-enviou',
          title: 'Mensagem enviada',
          kind: 'acao',
          summary: 'Siga para as reações A–F conforme o que o porteiro fizer.',
          glc: glc('contato_porteiro', 'Aguardar resposta do porteiro', 'D+3', 'Não avance para falando_decisor sem sinal de encaminhamento ou do próprio decisor.'),
        },
      ],
    },
    {
      id: 'reacoes',
      title: 'Reações A–F',
      kind: 'etapa',
      summary: 'Seis reações do porteiro. Ramos extras ficam só neste Guia; os chips F3 aparecem só nos 5 mapeamentos.',
      glc: {
        note: 'Escolha a reação. O Guia não aplica o status — copie a fala e atualize o lead no card.',
      },
      children: [
        {
          id: 'reacao-a',
          title: 'A — Encaminhou para o decisor',
          kind: 'decisao',
          summary: 'Porteiro passou o contato ou avisou que vai transferir.',
          say: 'Perfeito, obrigado. Pode me passar o nome e o WhatsApp de quem decide a parte de marketing/site da {{empresa}}? Assim eu falo direto e não te tomo mais tempo.',
          glc: glc('encaminhado', 'Falar com o decisor e pedir 2 horários', 'Hoje ou amanhã', 'Status encaminhado — Encaminhado. Anote o encaminhamento (para quem). Com F4, grave decisor_nome e decisor_whatsapp.'),
        },
        {
          id: 'reacao-b',
          title: 'B — Pediu o print / “como ficaria”',
          kind: 'decisao',
          summary: 'Curiosidade pelo visual. Anexe o print e peça o decisor.',
          say: 'Claro — te mando o print de como ficaria para a {{empresa}}.{{#se prototipo_url}} Referência: {{prototipo_url}}.{{/se}} Se fizer sentido, pode me encaminhar para quem decide marketing/site?',
          glc: glc('contato_porteiro', 'Enviar print e pedir encaminhamento', 'D+3', 'Status contato_porteiro — Contato com porteiro. Anexe o print na conversa; o wa.me não leva imagem.'),
          printReminder: true,
        },
        {
          id: 'reacao-c',
          title: 'C — Pediu preço, proposta ou “manda o valor”',
          kind: 'decisao',
          summary: 'Não envie pacote nem valor. Convide para a reunião do print.',
          say: 'Entendo. Para não mandar um número genérico, prefiro te mostrar o print e alinhar o objetivo em 25 minutos. Tenho {{horario_1}} ou {{horario_2}} — qual encaixa melhor para quem decide?',
          glc: glc('contato_porteiro', 'Converter pedido de preço em reunião com o decisor', 'Hoje', 'Não registre proposta_enviada. Sem reunião e sem print, não há proposta. Peça o decisor ou os dois horários.'),
        },
        {
          id: 'reacao-d',
          title: 'D — Não tem interesse agora',
          kind: 'decisao',
          summary: 'Respeite. Descubra se é timing ou se já resolveram.',
          say: 'Tudo bem, obrigado pela sinceridade. Para eu não insistir no assunto errado: isso não é prioridade agora na {{empresa}} ou vocês já resolveram a parte de site/marketing?',
          glc: glc('pausado_60d', 'Retomar cadência', 'D+60 (pausado_60d) ou motivo_perda se for Perdido', 'Status pausado_60d — Pausado 60 dias, ou perdido — Perdido se deixar claro que não há fit. Não force nova mensagem no mesmo dia.'),
          children: [
            {
              id: 'reacao-d-timing',
              title: 'É timing / orçamento comprometido',
              kind: 'acao',
              summary: 'Pausar e combinar retomada.',
              say: 'Perfeito. Posso retomar mais à frente. Quando fizer sentido olhar o print da {{empresa}} de novo, me avisa.',
              glc: glc('pausado_60d', 'Retomar cadência', 'D+60', 'Use a ação Pausar 60 dias no card. next_action e next_action_due_date saem pelo motor F1/F2, não por campo legado.'),
            },
            {
              id: 'reacao-d-fit',
              title: 'Não há fit',
              kind: 'acao',
              summary: 'Encerrar e registrar perda.',
              say: 'Entendi. Obrigado pelo seu tempo — não vou insistir.',
              glc: {
                status: 'perdido',
                next_action: 'Registrar motivo da perda e encerrar a cadência',
                next_action_due_date: '—',
                note: 'Status perdido — Perdido. Informe motivo_perda (sem_fit, timing, tem_fornecedor, etc.).',
              },
            },
          ],
        },
        {
          id: 'reacao-e',
          title: 'E — Não responde',
          kind: 'decisao',
          summary: 'Siga a cadência F2. Não invente uma quarta mensagem fora do motor.',
          say: 'Oi, {{seu_nome}} de novo. Conseguiu passar o contato de quem decide sobre a {{empresa}}? Se preferir, te mando um print de como ficaria.',
          glc: glc('contato_porteiro', 'Follow-up: reforçar o contato e confirmar se receberam a mensagem.', 'D+3, depois D+4 (case/nicho) e D+6 (break-up)', 'Status contato_porteiro — Contato com porteiro. Toques e next_action_due_date só pela fila Hoje / registrar_cadencia.'),
          f3Chip: 'Follow-up D+3',
          printReminder: true,
        },
        {
          id: 'reacao-f',
          title: 'F — “Quem é você?” / pediu contexto',
          kind: 'decisao',
          summary: 'Reapresente em uma frase e volte a pedir o decisor.',
          say: 'Combinado: sou {{seu_nome}}. Ajudo empresas{{#se segmento}} de {{segmento}}{{/se}} a deixar a oferta e o próximo passo mais claros no site/Instagram. Vi a {{empresa}} e {{gatilho}}. Você pode me encaminhar para quem decide marketing/site?',
          glc: glc('contato_porteiro', 'Reapresentar e pedir encaminhamento', 'D+3', 'Status contato_porteiro — Contato com porteiro. Continue no porteiro até haver encaminhamento.'),
        },
      ],
    },
    {
      id: 'decisor-responde',
      title: 'Decisor responde',
      kind: 'etapa',
      summary: 'Agora a conversa é com quem decide. Peça dois horários para mostrar o print — não mande proposta genérica.',
      say: 'Oi {{decisor_nome}}! Que bom falar sobre a {{empresa}}. Para te mostrar o print, quais dois horários nesta semana ficam melhores pra você?',
      glc: glc('falando_decisor', 'Pedir 2 horários para mostrar o print', 'Hoje', 'Status falando_decisor — Falando com decisor. Chip F3 deste mapeamento; não grave o template ao editar a prévia.'),
      f3Chip: 'Decisor respondeu — pedir 2 horários',
      printReminder: true,
      children: [
        {
          id: 'decisor-print-primeiro',
          title: 'Pediu o print antes de marcar',
          kind: 'decisao',
          summary: 'Envie o print e volte aos dois horários.',
          say: 'Te mando o print da {{empresa}} para você ver a estrutura.{{#se prototipo_url}} Referência: {{prototipo_url}}.{{/se}} Se fizer sentido, encaixo {{horario_1}} ou {{horario_2}} — qual fica melhor?',
          glc: glc('falando_decisor', 'Enviar print e confirmar um dos dois horários', 'Hoje', 'Status falando_decisor — Falando com decisor. Anexe o print; não envie valor de pacote.'),
          printReminder: true,
        },
        {
          id: 'decisor-ocupado',
          title: 'Está ocupado agora',
          kind: 'decisao',
          summary: 'Ofereça os dois horários concretos.',
          say: 'Sem problema. Para eu te mostrar o print da {{empresa}} em 25 minutos, tenho {{horario_1}} ou {{horario_2}}. Qual funciona melhor?',
          glc: glc('falando_decisor', 'Reagendar conversa com o decisor', '{{horario_1}} ou {{horario_2}}', 'Status falando_decisor — Falando com decisor. next_action_due_date = o dia do horário combinado.'),
        },
        {
          id: 'decisor-nao-prioridade',
          title: 'Não é prioridade',
          kind: 'decisao',
          summary: 'Não force fechamento. Combine retomada ou pause.',
          say: 'Entendo. Posso te enviar só o print da {{empresa}} e retomar quando essa prioridade voltar. Prefere que eu volte em outra data?',
          glc: glc('pausado_60d', 'Retomar cadência com o decisor', 'D+60 ou data combinada', 'Se houver data real, use reagendar na F2 em vez de pausar. Status pausado_60d — Pausado 60 dias só quando não há data.'),
        },
      ],
    },
    {
      id: 'pedir-reuniao',
      title: 'Pedir reunião',
      kind: 'etapa',
      summary: 'Reunião de 25 minutos, dois horários, print como pauta. Confirme data, canal e quem entra.',
      say: 'Posso te mostrar esse protótipo em uma reunião de 25 minutos. Você avalia a estrutura, me diz o que faz sentido e, se houver interesse, conversamos sobre escopo, prazo e investimento. Tenho {{horario_1}} ou {{horario_2}}. Qual funciona melhor?',
      glc: glc('falando_decisor', 'Confirmar um dos dois horários da reunião', 'Hoje', 'Ainda não use reuniao_marcada — Reunião marcada sem reuniao_em. Só avance quando a data estiver combinada.'),
      printReminder: true,
      children: [
        {
          id: 'reuniao-marcada',
          title: 'Horário combinado',
          kind: 'acao',
          summary: 'Confirme e peça materiais se precisar.',
          say: 'Confirmado: reunião sobre a {{empresa}} em {{horario_1}}. Vamos olhar o print, o objetivo e o que entra na primeira versão. Qualquer imprevisto, me avisa.',
          glc: glc('reuniao_marcada', 'Confirmar reunião D-1 e preparar o print', 'D-1 da reunião', 'Status reuniao_marcada — Reunião marcada. A RPC exige reuniao_em. Preencha também reuniao_link se houver.'),
        },
        {
          id: 'reuniao-outra-pessoa',
          title: 'Outra pessoa precisa participar',
          kind: 'decisao',
          summary: 'Inclua quem decide e ofereça de novo os dois horários.',
          say: 'Perfeito. Quem mais precisa ver o print da {{empresa}}? Encaixo {{horario_1}} ou {{horario_2}} para vocês dois.',
          glc: glc('falando_decisor', 'Incluir o outro decisor e confirmar horário', 'Hoje', 'Status falando_decisor — Falando com decisor até a data existir. Com F4, atualize decisor_nome se mudar o interlocutor.'),
        },
      ],
    },
    {
      id: 'pos-cadencia',
      title: 'Pós/cadência',
      kind: 'etapa',
      summary: 'Depois do toque: D+3, case/nicho, break-up, confirmar D-1. Quarto toque sem resposta vai para o limite da F2.',
      glc: {
        note: 'A fila Hoje (F2) é a fonte da due date. Abra Hoje para ver vazia/ajuda e registrar toques. O Guia não chama o motor sozinho.',
      },
      children: [
        {
          id: 'pos-follow-d3',
          title: 'Follow-up D+3',
          kind: 'acao',
          summary: 'Primeiro retorno da cadência se não houve resposta.',
          say: 'Oi, {{seu_nome}} de novo. Conseguiu passar o contato de quem decide sobre a {{empresa}}? Se preferir, te mando um print de como ficaria.',
          glc: glc('contato_porteiro', 'Follow-up: reforçar o contato e confirmar se receberam a mensagem.', 'D+3', 'Status conforme o lead (em geral contato_porteiro — Contato com porteiro). Use Toquei / Sem resposta na fila Hoje.'),
          f3Chip: 'Follow-up D+3',
          printReminder: true,
        },
        {
          id: 'pos-case-nicho',
          title: 'Case / nicho (D+4 do 2º toque)',
          kind: 'acao',
          summary: 'Ramo extra do Guia. Não há seed F3 desta fala — o Kit continua com os 5 templates.',
          say: 'Oi, {{seu_nome}} aqui. {{#se segmento}}Para {{segmento}}, {{/se}}preparei um exemplo de estrutura parecida com a da {{empresa}}{{#se bairro_ou_cidade}} em {{bairro_ou_cidade}}{{/se}}. Posso te mandar o print e, se fizer sentido, você me encaminha para quem decide?',
          glc: glc('contato_porteiro', 'Enviar case ou exemplo do nicho para gerar contexto.', 'D+4 (2º toque F2)', 'Sem chip F3. Copie daqui. Não crie template novo nesta entrega.'),
          printReminder: true,
        },
        {
          id: 'pos-breakup',
          title: 'Break-up',
          kind: 'acao',
          summary: 'Última tentativa educada antes de pausar ou marcar perdido.',
          say: 'Oi, última tentativa da minha parte sobre a {{empresa}}. Se não for o momento, sem problema — posso retomar depois.',
          glc: glc('contato_porteiro', 'Break-up: última tentativa educada antes de pausar ou marcar perdido.', 'D+6 (3º toque F2)', 'Status contato_porteiro — Contato com porteiro (ou o status atual do lead). O 4º toque na F2 retorna limite: Pausar 60d ou Perdido.'),
          f3Chip: 'Break-up',
        },
        {
          id: 'pos-confirmar-d1',
          title: 'Confirmar reunião D-1',
          kind: 'acao',
          summary: 'Um dia antes da reunião marcada.',
          say: 'Oi {{decisor_nome}}, confirmando nossa conversa sobre a {{empresa}} amanhã. Qualquer imprevisto, me avisa que encaixo outro horário.',
          glc: glc('reuniao_marcada', 'Confirmar reunião D-1', 'D-1', 'Status reuniao_marcada — Reunião marcada. Se desmarcar, reagende (next_action / next_action_due_date) em vez de deixar a fila órfã.'),
          f3Chip: 'Confirmar reunião D-1',
        },
        {
          id: 'pos-limite',
          title: '4º toque sem resposta',
          kind: 'acao',
          summary: 'Não invente quinta mensagem. Use o modal da F2.',
          glc: glc('pausado_60d', 'Retomar cadência', 'D+60', 'A F2 devolve 409/TOUCH_LIMIT. Escolha pausado_60d — Pausado 60 dias ou perdido — Perdido. Sem WhatsApp API e sem auto-status neste Guia.'),
        },
      ],
    },
  ],
}

export function findGuiaConversaNode(node: GuiaConversaNode, id: string): GuiaConversaNode | null {
  if (node.id === id) return node
  for (const child of node.children ?? []) {
    const match = findGuiaConversaNode(child, id)
    if (match) return match
  }
  return null
}

export function findGuiaConversaPath(node: GuiaConversaNode, id: string, path: GuiaConversaNode[] = []): GuiaConversaNode[] | null {
  const nextPath = [...path, node]
  if (node.id === id) return nextPath
  for (const child of node.children ?? []) {
    const match = findGuiaConversaPath(child, id, nextPath)
    if (match) return match
  }
  return null
}

export function flattenGuiaConversaNodes(node: GuiaConversaNode = guiaConversaTree): GuiaConversaNode[] {
  return [node, ...(node.children ?? []).flatMap((child) => flattenGuiaConversaNodes(child))]
}

export function guiaConversaEtapas() {
  return (guiaConversaTree.children ?? []).filter((node) => (guiaConversaEtapaIds as readonly string[]).includes(node.id))
}

export function guiaConversaF3Chips() {
  return flattenGuiaConversaNodes().filter((node) => node.f3Chip)
}

export function searchGuiaConversaNodes(term: string, node: GuiaConversaNode = guiaConversaTree) {
  const needle = term.trim().toLocaleLowerCase('pt-BR')
  if (!needle) return flattenGuiaConversaNodes(node).filter((item) => item.id !== node.id)
  return flattenGuiaConversaNodes(node).filter((item) => {
    if (item.id === node.id) return false
    const haystack = [item.title, item.summary, item.say, item.f3Chip, item.glc?.next_action, item.glc?.status ? leadStatusLabels[item.glc.status] : '']
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('pt-BR')
    return haystack.includes(needle)
  })
}

export function formatGuiaConversaStatus(status: LeadStatus) {
  return `${status} — ${leadStatusLabels[status]}`
}
