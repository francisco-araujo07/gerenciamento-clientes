export const waTemplateEtapas = [
  'novo',
  'contato_porteiro',
  'encaminhado',
  'falando_decisor',
  'reuniao_marcada',
  'proposta_enviada',
  'negociacao',
  'qualquer',
] as const

export type WaTemplateEtapa = (typeof waTemplateEtapas)[number]

export type WaTemplate = {
  id: string
  nome: string
  etapa: WaTemplateEtapa
  corpo: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export type WaTemplateFormValues = {
  nome: string
  etapa: WaTemplateEtapa
  corpo: string
  ativo: boolean
}

export const waTemplateEtapaLabels: Record<WaTemplateEtapa, string> = {
  novo: 'Novo',
  contato_porteiro: 'Contato com porteiro',
  encaminhado: 'Encaminhado',
  falando_decisor: 'Falando com decisor',
  reuniao_marcada: 'Reunião marcada',
  proposta_enviada: 'Proposta enviada',
  negociacao: 'Negociação',
  qualquer: 'Qualquer etapa',
}

export const waSpecSeedNames = [
  'Primeira abordagem (porteiro)',
  'Follow-up D+3',
  'Break-up',
  'Decisor respondeu — pedir 2 horários',
  'Confirmar reunião D-1',
] as const

export const waTemplateVariables = [
  'empresa',
  'responsavel',
  'gatilho',
  'segmento',
  'bairro_ou_cidade',
  'prototipo_url',
  'seu_nome',
  'porteiro_nome',
  'decisor_nome',
] as const

export type WaTemplateVariable = (typeof waTemplateVariables)[number]

export type WaTemplateContext = Record<WaTemplateVariable, string>

export const emptyWaTemplateFormValues: WaTemplateFormValues = {
  nome: '',
  etapa: 'qualquer',
  corpo: '',
  ativo: true,
}
