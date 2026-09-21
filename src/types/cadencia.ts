export const cadenciaAcoes = ['toquei', 'respondeu', 'sem_resposta', 'reagendar'] as const
export type CadenciaAcao = (typeof cadenciaAcoes)[number]

export const cadenciaTipos = ['toque', 'resposta', 'reagendar', 'reuniao'] as const
export type CadenciaTipo = (typeof cadenciaTipos)[number]

export const cadenciaResultados = [
  'toquei',
  'respondeu',
  'sem_resposta',
  'reagendado',
  'marcada',
  'compareceu',
  'no_show',
  'pediu_proposta',
  'fechou',
  'recusou',
  'reagendou',
] as const
export type CadenciaResultado = (typeof cadenciaResultados)[number]

export const cadenciaCanais = ['whatsapp', 'ligacao', 'outro'] as const
export type CadenciaCanal = (typeof cadenciaCanais)[number]

export const cadenciaQueueTabs = ['todos', 'hoje', 'atrasadas'] as const
export type CadenciaQueueTab = (typeof cadenciaQueueTabs)[number]

export type CadenciaConfig = {
  id: string
  max_touches_sem_resposta: number
  offset_dias_apos_toque: number[]
  offset_pausado_dias: number
}

export type LeadAtividade = {
  id: string
  lead_id: string
  tipo: CadenciaTipo
  resultado: CadenciaResultado
  canal: CadenciaCanal | null
  nota: string | null
  created_at: string
  created_by: string | null
}

export const cadenciaTipoLabels: Record<CadenciaTipo, string> = {
  toque: 'Toque',
  resposta: 'Resposta',
  reagendar: 'Reagendamento',
  reuniao: 'Reunião',
}

export const cadenciaResultadoLabels: Record<CadenciaResultado, string> = {
  toquei: 'Toquei',
  respondeu: 'Respondeu',
  sem_resposta: 'Sem resposta',
  reagendado: 'Reagendado',
  marcada: 'Marcada',
  compareceu: 'Compareceu',
  no_show: 'Não compareceu',
  pediu_proposta: 'Pediu proposta',
  fechou: 'Fechou',
  recusou: 'Recusou',
  reagendou: 'Reagendou',
}

export const cadenciaCanalLabels: Record<CadenciaCanal, string> = {
  whatsapp: 'WhatsApp',
  ligacao: 'Ligação',
  outro: 'Outro',
}

export const defaultCadenciaConfig: CadenciaConfig = {
  id: 'global',
  max_touches_sem_resposta: 4,
  offset_dias_apos_toque: [3, 4, 6],
  offset_pausado_dias: 60,
}

export const CADENCIA_FOLLOW_UP_TEXTS = [
  'Follow-up: reforçar o contato e confirmar se receberam a mensagem.',
  'Enviar case ou exemplo do nicho para gerar contexto.',
  'Break-up: última tentativa educada antes de pausar ou marcar perdido.',
] as const
