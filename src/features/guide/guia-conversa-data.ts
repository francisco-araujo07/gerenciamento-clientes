import { leadStatusLabels, type LeadStatus } from '../../types/lead.ts'
import { waSpecSeedNames } from '../../types/whatsapp.ts'

export const GUIA_CONVERSA_SOURCE = 'brief PRIMARY GLC-estilo-venda-guia-conversa (corpos do Kit F3 não são atualizados nesta entrega)'

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

export const guiaConversaFazer = [
  'Vender resultado, não “site.” Linguagem: mais contato pelo Google/WhatsApp, paciente/cliente achar a empresa — não “presença digital”, “WordPress”, “responsivo”.',
  'Dever de casa antes do oi. Sempre ter gatilho + print/protótipo da empresa deles quando possível.',
  'Porteiro = aliado. Objetivo: mensagem encaminhável (print + 2 linhas), não reunião e não pitch de empresa.',
  'Pedido pequeno. 1ª abordagem: encaminhar print / olhar prévia. Reunião de 15 min só depois de interesse ou print visto.',
  'Dois horários binários (“amanhã 10h ou 16h?”).',
  'Cadência curta com ângulo novo (máx. 4 toques / ~14 dias), depois pausado_60d ou perdido com motivo.',
  'Tom: direto, informal educado, curto — fornecedor local competente, não call center.',
] as const

export const guiaConversaEvitar = [
  '“Olá, tudo bem?” / “Estão disponíveis pra ligação?” / “Tenho uma proposta” sem contexto',
  'Pitch longo da MF Softwares antes do artefato (print)',
  'Pedir reunião na mesma bolha em que se menciona o protótipo sem anexá-lo',
  'Áudio longo no frio; urgência falsa; emoji em excesso',
  'Tratar porteiro como decisor ou insistir “me passa o dono”',
  'Disparo em massa / template idêntico sem {{gatilho}}',
  'Prometer “1º lugar no Google em 7 dias” ou jargão (UI/UX, omnichannel, etc.)',
] as const

export const guiaConversaFunil = 'Novo → Contato porteiro → Encaminhado → Falando com decisor → Reunião marcada → Proposta enviada → Convertido ↘ Pausado 60d / Perdido'

export const guiaConversaPrinciples = [
  ...guiaConversaFazer,
  ...guiaConversaEvitar,
  guiaConversaFunil,
] as const

export const guiaConversaSays = {
  abertura: `Oi! Sou o {{seu_nome}}.

Separei um print rápido de uma ideia de página pra {{empresa}} (mobile), só pra responsável olhar com calma.

Dá pra encaminhar pra ela? Se não for o momento, sem problema.`,
  varianteGatilho: `Oi! Sou o {{seu_nome}}. Vi a {{empresa}} no Google Maps e notei que {{gatilho}}.

Preparei um print de landing page (mobile) com a cara de vocês — foco em gerar WhatsApp.

Dá pra encaminhar pra responsável? Se não for prioridade, sem problema.`,
  ramoA: `Perfeito, obrigado{{#se porteiro_nome}}, {{porteiro_nome}}{{/se}}.

Sou da MF Softwares. Segue o print do rascunho (mobile) — foco em paciente/cliente achar vocês e chamar no WhatsApp.

Se a responsável quiser ver, me avisam que eu explico em 15 min. Sem compromisso.`,
  ramoB: `Tranquilo. Qual o melhor jeito de deixar o recado — esse WhatsApp mesmo?

Te mando 1 print + 2 linhas pra ficar fácil de encaminhar. Qual seu nome, por favor?

Obrigado, {{porteiro_nome}}! Qualquer dúvida dela, pode me chamar aqui.`,
  ramoC: `Justo — nem expliquei direito.

Não tô pedindo compra. É só 1 print pra responsável ver se faz sentido. Se ela achar que não, eu paro. Pode encaminhar?`,
  ramoCNao: 'Se não: Combinado, valeu pelo tempo. Se no futuro mudarem de ideia, é só chamar.',
  ramoD: `Ótimo. Não preciso trocar nada agora.

O print é só pra comparar: se o site atual já gera contato pelo Google/WhatsApp, ela descarta em 20 segundos. Se notar um gap, a gente conversa. Pode mandar pra ela?`,
  ramoE: `Posso. Pra não mandar genérico, te envio a prévia visual agora por aqui (é o que ela realmente olha).

Proposta fechada eu monto depois de 15 min com ela — senão eu invento escopo. Faz sentido?`,
  ramoF: `Oi{{#se nome}}, {{porteiro_nome}}{{/se}} — só pra não ficar perdido.

O print do protótipo ainda está aí caso a responsável queira olhar. Se não for prioridade, sem problema nenhum.`,
  decisor31: `Que bom. Em 15 min eu te mostro o fluxo completo (como o cliente/paciente chega no WhatsApp) e o que entraria no projeto.

Prefere {{horario_1}} ou {{horario_2}}?`,
  decisor32: `Claro. Resumo em 3 pontos:
1) Página mobile com a cara da {{empresa}}
2) Foco em gerar WhatsApp/ligação (não site “bonito e parado”)
3) Prazo típico alinhado na call

Investimento eu fecho certo depois de 2 perguntas (pra não precificar errado).
Tem 15 min {{horario_1}} ou {{horario_2}}? Mostro na tela e te passo a proposta ali.`,
  decisor33: `Faixa pra esse tipo de landing depende do escopo — te passo o número certo em 15 min com 2 perguntas (de onde vêm os clientes hoje e a meta de contatos).

Prefere {{horario_1}} ou {{horario_2}}?`,
  decisor34: `Instagram é ótimo pra quem já te segue.

Quem pesquisa “[serviço] em [bairro]” cai no Google — aí quem tem página clara leva o WhatsApp. O print que te mandei é essa porta de entrada.

Quer que eu te mostre em 10–15 min uma busca real da região e como a página encaixa?`,
  decisor35: `Entendo — por isso a conversa é curta: 15 min, mostro o protótipo e você decide se faz sentido.

Se for mais fácil, te mando 3 prints comentados por aqui e você responde só com sim/não. Prefere assim ou um horário rápido?`,
  decisor36: `Perfeito. O que ainda ficou em aberto pra decidir — prazo, formato ou investimento?

Posso te mandar o link/print + 3 bullets pra você mostrar pro sócio. E se quiserem, marco 15 min com os dois.`,
  decisor37: `Oi {{decisor_nome}}, confirmando nossa conversa de amanhã às {{hora}} ({{reuniao_link}}).

Se precisar remarcar, me avisa por aqui. Até lá!`,
  cadenciaT3: `{{nome}}, case rápido: negócios no mesmo perfil passam a receber contatos pelo Google com página + WhatsApp no ar.

Se ainda fizer sentido, te mostro o caminho em 15 min — {{horario_1}} ou {{horario_2}}?`,
  cadenciaT4: `{{nome}}, vou pausar pra não atrapalhar a rotina de vocês.

Se um dia quiserem olhar a prévia do protótipo, é só responder aqui.`,
} as const

function glc(status: LeadStatus, next_action: string, next_action_due_date: string, note?: string): GuiaConversaGlcAction {
  return { status, next_action, next_action_due_date, note }
}

export const guiaConversaTree: GuiaConversaNode = {
  id: 'wa-root',
  title: 'Guia de conversa',
  kind: 'etapa',
  summary: 'Estilo MF Softwares: print encaminhável, pedido pequeno, 15 min depois do interesse. Funil: Novo → Contato porteiro → Encaminhado → Falando com decisor → Reunião marcada → Proposta enviada → Convertido ↘ Pausado 60d / Perdido.',
  glc: {
    note: 'Abra o lead no seletor para interpolar. O Guia não aplica status sozinho. Use next_action e next_action_due_date (nunca nomes de campo do playbook legado).',
  },
  children: [
    {
      id: 'preparacao',
      title: 'Preparação',
      kind: 'etapa',
      summary: 'Dever de casa antes do oi: gatilho + print da empresa deles. Porteiro = aliado. Linguagem de resultado (mais contato), não “site”.',
      glc: glc(
        'novo',
        'Preparar gatilho e print antes da primeira mensagem',
        'Hoje',
        'Status novo — Novo. Confira gatilho e prototipo_url. Só avance para contato_porteiro — Contato com porteiro quando enviar a abertura.',
      ),
      children: [
        {
          id: 'prep-dever-casa',
          title: 'Gatilho + print',
          kind: 'acao',
          summary: 'Sempre ter gatilho + print/protótipo da empresa deles quando possível.',
          glc: glc('novo', 'Registrar gatilho e deixar o print pronto', 'Hoje', 'Preencha gatilho. Anexe o print depois de abrir o WhatsApp — o wa.me só leva o texto.'),
          printReminder: true,
        },
        {
          id: 'prep-porteiro-aliado',
          title: 'Porteiro = aliado',
          kind: 'acao',
          summary: 'Objetivo: mensagem encaminhável (print + 2 linhas), não reunião e não pitch de empresa.',
          glc: glc('novo', 'Enviar abertura encaminhável ao porteiro', 'Hoje', 'Não trate o porteiro como decisor. Com F4, conferir porteiro_nome / porteiro_whatsapp.'),
        },
        {
          id: 'prep-pedido-pequeno',
          title: 'Pedido pequeno',
          kind: 'acao',
          summary: '1ª abordagem: encaminhar print / olhar prévia. Reunião de 15 min só depois de interesse ou print visto.',
          glc: glc('novo', 'Pedir só o encaminhamento do print', 'Hoje', 'Não peça reunião na mesma bolha em que menciona o protótipo sem anexá-lo.'),
        },
      ],
    },
    {
      id: 'mensagem-porteiro',
      title: 'Mensagem ao porteiro',
      kind: 'etapa',
      summary: 'Abertura curta para encaminhar o print. Variante com gatilho se houver observação real no Google Maps.',
      say: guiaConversaSays.abertura,
      glc: glc(
        'contato_porteiro',
        'Aguardar encaminhamento do print pela responsável',
        'D+3 (1º toque / cadência F2)',
        'Status contato_porteiro — Contato com porteiro. Anexe o print na conversa. Não peça reunião nesta bolha.',
      ),
      f3Chip: 'Primeira abordagem (porteiro)',
      printReminder: true,
      children: [
        {
          id: 'variante-gatilho',
          title: 'Variante gatilho',
          kind: 'acao',
          summary: 'Use se houver observação real no Google Maps. Sem {{gatilho}} idêntico em massa.',
          say: guiaConversaSays.varianteGatilho,
          glc: glc('contato_porteiro', 'Aguardar encaminhamento do print pela responsável', 'D+3', 'Status contato_porteiro — Contato com porteiro. Ramo extra do Guia — o corpo do seed F3 não muda.'),
          printReminder: true,
        },
      ],
    },
    {
      id: 'reacoes',
      title: 'Reações A–F',
      kind: 'etapa',
      summary: 'Seis reações do porteiro (§2). Ramos extras só neste Guia. Chip F3 só no ramo F (Follow-up D+3).',
      glc: {
        note: 'Escolha a reação. Atualize status, next_action e next_action_due_date no card. O Guia não aplica sozinho.',
      },
      children: [
        {
          id: 'reacao-a',
          title: 'A — Encaminhou',
          kind: 'decisao',
          summary: 'Porteiro aceitou mandar o print / passou adiante.',
          say: guiaConversaSays.ramoA,
          glc: glc(
            'encaminhado',
            'Esperar a responsável olhar o print e avisar se quer 15 min',
            'Hoje ou amanhã',
            'Status encaminhado — Encaminhado. Anexe o print. Não peça reunião nesta bolha sem o artefato.',
          ),
          printReminder: true,
        },
        {
          id: 'reacao-b',
          title: 'B — Como deixo o recado?',
          kind: 'decisao',
          summary: 'Porteiro pergunta o melhor jeito de deixar recado.',
          say: guiaConversaSays.ramoB,
          glc: glc(
            'contato_porteiro',
            'Mandar 1 print + 2 linhas e gravar porteiro_nome',
            'D+3',
            'Status contato_porteiro — Contato com porteiro. Com F4, grave porteiro_nome. Mensagem encaminhável, não pitch.',
          ),
          printReminder: true,
        },
        {
          id: 'reacao-c',
          title: 'C — Não / sem interesse',
          kind: 'decisao',
          summary: 'Reframe: não é compra, é 1 print. Se ainda não, encerre educado.',
          say: guiaConversaSays.ramoC,
          glc: glc(
            'contato_porteiro',
            'Reframe e pedir só o encaminhamento do print',
            'Hoje',
            'Status contato_porteiro — Contato com porteiro. Se recusar de novo, use o ramo “Se não”.',
          ),
          children: [
            {
              id: 'reacao-c-nao',
              title: 'Se não',
              kind: 'acao',
              summary: 'Porteiro manteve o não depois do reframe.',
              say: guiaConversaSays.ramoCNao,
              glc: glc(
                'pausado_60d',
                'Retomar cadência',
                'D+60',
                'Status pausado_60d — Pausado 60 dias, ou perdido — Perdido se não houver fit. Informe motivo_perda se for perda.',
              ),
            },
          ],
        },
        {
          id: 'reacao-d',
          title: 'D — Já temos site',
          kind: 'decisao',
          summary: 'Site atual existe. Print só para comparar o gap de contato.',
          say: guiaConversaSays.ramoD,
          glc: glc(
            'contato_porteiro',
            'Encaminhar print para comparar com o site atual',
            'D+3',
            'Status contato_porteiro — Contato com porteiro. Não discuta “trocar o site”. Peça para a responsável olhar o print.',
          ),
          printReminder: true,
        },
        {
          id: 'reacao-e',
          title: 'E — Manda a proposta',
          kind: 'decisao',
          summary: 'Pediu proposta sem ver o print. Envie a prévia visual, não escopo inventado.',
          say: guiaConversaSays.ramoE,
          glc: glc(
            'contato_porteiro',
            'Enviar prévia visual e pedir 15 min com a responsável',
            'Hoje',
            'Não registre proposta_enviada — Proposta enviada. Proposta fechada só depois de 15 min com a decisor.',
          ),
          printReminder: true,
        },
        {
          id: 'reacao-f',
          title: 'F — Não responde',
          kind: 'decisao',
          summary: 'Toque curto para não ficar perdido. Chip F3 Follow-up D+3; o corpo do Kit não muda.',
          say: guiaConversaSays.ramoF,
          glc: glc(
            'contato_porteiro',
            'Follow-up: print ainda disponível se a responsável quiser olhar',
            'D+3',
            'Status contato_porteiro — Contato com porteiro. Toques e next_action_due_date só pela fila Hoje / registrar_cadencia.',
          ),
          f3Chip: 'Follow-up D+3',
          printReminder: true,
        },
      ],
    },
    {
      id: 'decisor-responde',
      title: 'Decisor responde',
      kind: 'etapa',
      summary: '§3.1 — 15 min, dois horários binários. Só depois de interesse ou print visto.',
      say: guiaConversaSays.decisor31,
      glc: glc(
        'falando_decisor',
        'Confirmar {{horario_1}} ou {{horario_2}} para 15 min',
        'Hoje',
        'Status falando_decisor — Falando com decisor. Dois horários binários. Não envie proposta genérica nesta bolha.',
      ),
      f3Chip: 'Decisor respondeu — pedir 2 horários',
      printReminder: true,
    },
    {
      id: 'pedir-reuniao',
      title: 'Pedir reunião',
      kind: 'etapa',
      summary: '§3.2–3.6 — resumo em 3 pontos, faixa sem número de pacote, Instagram, sem tempo, vou pensar.',
      say: guiaConversaSays.decisor32,
      glc: glc(
        'falando_decisor',
        'Marcar 15 min em {{horario_1}} ou {{horario_2}} e mostrar na tela',
        'Hoje',
        'Status falando_decisor — Falando com decisor. Só use reuniao_marcada — Reunião marcada com reuniao_em preenchido.',
      ),
      printReminder: true,
      children: [
        {
          id: 'decisor-33',
          title: '3.3 — Pediu faixa / investimento',
          kind: 'decisao',
          summary: 'Sem número de pacote. Dois horários para fechar o valor certo.',
          say: guiaConversaSays.decisor33,
          glc: glc(
            'falando_decisor',
            'Levar faixa para a call de 15 min (2 perguntas)',
            'Hoje',
            'Não envie tabela nem valor de pacote. Não registre proposta_enviada antes da call.',
          ),
        },
        {
          id: 'decisor-34',
          title: '3.4 — Instagram',
          kind: 'decisao',
          summary: 'Instagram não substitui a porta de entrada no Google.',
          say: guiaConversaSays.decisor34,
          glc: glc('falando_decisor', 'Mostrar busca real da região em 10–15 min', 'Hoje', 'Status falando_decisor — Falando com decisor. O print já enviado é a porta de entrada.'),
          printReminder: true,
        },
        {
          id: 'decisor-35',
          title: '3.5 — Sem tempo',
          kind: 'decisao',
          summary: 'Conversa curta de 15 min ou 3 prints comentados.',
          say: guiaConversaSays.decisor35,
          glc: glc('falando_decisor', 'Oferecer 15 min ou 3 prints comentados', 'Hoje', 'Status falando_decisor — Falando com decisor. next_action_due_date = o dia combinado.'),
          printReminder: true,
        },
        {
          id: 'decisor-36',
          title: '3.6 — Vou pensar',
          kind: 'decisao',
          summary: 'Descobrir o que ficou em aberto e incluir o sócio se preciso.',
          say: guiaConversaSays.decisor36,
          glc: glc('falando_decisor', 'Enviar print + 3 bullets e oferecer 15 min com os dois', 'Hoje', 'Status falando_decisor — Falando com decisor. Se outra pessoa decide, atualize decisor_nome (F4).'),
        },
        {
          id: 'reuniao-marcada',
          title: 'Horário combinado',
          kind: 'acao',
          summary: 'Data combinada. Preencha reuniao_em antes de mudar o status.',
          glc: glc(
            'reuniao_marcada',
            'Confirmar reunião D-1 e preparar o print',
            'D-1',
            'Status reuniao_marcada — Reunião marcada. A RPC exige reuniao_em. Preencha reuniao_link se houver.',
          ),
        },
      ],
    },
    {
      id: 'pos-cadencia',
      title: 'Pós/cadência',
      kind: 'etapa',
      summary: 'D-1, T3 (ângulo novo), break-up T4, 4º toque, linhas curtas pós-reunião. Máx. 4 toques / ~14 dias.',
      glc: {
        note: 'A fila Hoje (F2) é a fonte de next_action_due_date. O Guia não chama o motor sozinho.',
      },
      children: [
        {
          id: 'pos-confirmar-d1',
          title: '3.7 — Confirmar D-1',
          kind: 'acao',
          summary: 'Um dia antes da reunião marcada.',
          say: guiaConversaSays.decisor37,
          glc: glc(
            'reuniao_marcada',
            'Confirmar reunião D-1',
            'D-1',
            'Status reuniao_marcada — Reunião marcada. {{hora}} e {{reuniao_link}} vêm de reuniao_em / reuniao_link. Se desmarcar, reagende next_action / next_action_due_date.',
          ),
          f3Chip: 'Confirmar reunião D-1',
        },
        {
          id: 'pos-t3',
          title: 'T3 — Case rápido',
          kind: 'acao',
          summary: 'Ângulo novo da cadência. Ramo extra do Guia — sem chip F3.',
          say: guiaConversaSays.cadenciaT3,
          glc: glc(
            'contato_porteiro',
            'Mostrar o caminho em 15 min ({{horario_1}} ou {{horario_2}})',
            'D+4 a D+6 (2º/3º toque F2)',
            'Sem chip F3. Não atualize o seed Follow-up D+3. Copie daqui.',
          ),
        },
        {
          id: 'pos-breakup',
          title: 'Break-up T4',
          kind: 'acao',
          summary: 'Pausar para não atrapalhar a rotina. Chip F3 Break-up; o corpo do Kit não muda.',
          say: guiaConversaSays.cadenciaT4,
          glc: glc(
            'pausado_60d',
            'Retomar cadência',
            'D+60',
            'Status pausado_60d — Pausado 60 dias, ou perdido — Perdido com motivo. 4º toque na F2 retorna limite.',
          ),
          f3Chip: 'Break-up',
        },
        {
          id: 'pos-compareceu',
          title: '3.8 — Compareceu',
          kind: 'acao',
          summary: 'Reunião aconteceu. Linha curta: seguir para proposta ou próximos materiais.',
          glc: glc(
            'proposta_enviada',
            'Enviar proposta alinhada na call',
            'Hoje ou prazo combinado',
            'Status proposta_enviada — Proposta enviada depois da call. Converter em cliente só pela ação de conversão.',
          ),
        },
        {
          id: 'pos-noshow',
          title: '3.8 — No-show',
          kind: 'acao',
          summary: 'Não compareceu. Reagendar 15 min; não inventar quinta mensagem de pitch.',
          glc: glc(
            'falando_decisor',
            'Reagendar 15 min ({{horario_1}} ou {{horario_2}})',
            'Hoje',
            'Status falando_decisor — Falando com decisor. Use reagendar na F2 para next_action / next_action_due_date.',
          ),
        },
        {
          id: 'pos-proposta',
          title: '3.8 — Proposta',
          kind: 'acao',
          summary: 'Proposta alinhada na call, não genérica no WhatsApp frio.',
          glc: glc('proposta_enviada', 'Acompanhar retorno da proposta', 'Prazo combinado na call', 'Status proposta_enviada — Proposta enviada.'),
        },
        {
          id: 'pos-fechou',
          title: '3.8 — Fechou',
          kind: 'acao',
          summary: 'Converter o lead em cliente. Não mude status para convertido pelo select.',
          glc: {
            note: 'Use a ação Converter em cliente. Status convertido — Convertido sai da RPC de conversão, não deste Guia.',
          },
        },
        {
          id: 'pos-recusou',
          title: '3.8 — Recusou',
          kind: 'acao',
          summary: 'Registrar perda com motivo. Sem insistir no mesmo ângulo.',
          glc: glc(
            'perdido',
            'Registrar motivo da perda e encerrar a cadência',
            '—',
            'Status perdido — Perdido. Informe motivo_perda.',
          ),
        },
        {
          id: 'pos-limite',
          title: '4º toque sem resposta',
          kind: 'acao',
          summary: 'Máx. 4 toques / ~14 dias. Use o modal da F2. Sem quinta mensagem.',
          glc: glc(
            'pausado_60d',
            'Retomar cadência',
            'D+60',
            'A F2 devolve 409/TOUCH_LIMIT. Escolha pausado_60d — Pausado 60 dias ou perdido — Perdido. Sem WhatsApp API e sem auto-status.',
          ),
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
