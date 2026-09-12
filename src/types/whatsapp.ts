export const waTemplateEtapas = [
  'abertura',
  'follow_up',
  'case_nicho',
  'break_up',
  'prototipo',
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
  abertura: 'Abertura',
  follow_up: 'Follow-up',
  case_nicho: 'Case / nicho',
  break_up: 'Break-up',
  prototipo: 'Protótipo',
}

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
  etapa: 'abertura',
  corpo: '',
  ativo: true,
}
