export type ContactFields = {
  company_name: string
  responsible_name: string | null
  whatsapp: string | null
  email: string | null
  instagram: string | null
  address: string | null
  google_maps_url: string | null
  segment: string | null
  notes: string | null
}

export const legacyLeadStatuses = ['novo', 'negociacao', 'convertido', 'perdido'] as const

export const funilLeadStatuses = [
  'novo',
  'contato_porteiro',
  'encaminhado',
  'falando_decisor',
  'reuniao_marcada',
  'proposta_enviada',
  'convertido',
  'perdido',
  'pausado_60d',
  'negociacao',
] as const

export const leadStatuses = funilLeadStatuses

export type LegacyLeadStatus = (typeof legacyLeadStatuses)[number]
export type LeadStatus = (typeof funilLeadStatuses)[number]

export const lossReasons = [
  'sem_resposta',
  'timing',
  'preco',
  'tem_fornecedor',
  'sem_fit',
  'sem_decisor',
  'concorrente',
  'outro',
] as const

export type LossReason = (typeof lossReasons)[number]

export type Lead = ContactFields & {
  id: string
  source: string | null
  status: LeadStatus
  next_action: string | null
  next_action_due_date: string | null
  touches_sem_resposta: number
  motivo_perda: LossReason | null
  motivo_perda_detalhe: string | null
  reuniao_em: string | null
  reuniao_link: string | null
  gatilho: string | null
  prototipo_url: string | null
  prototipo_notas: string | null
  wa_ultimo_template_id: string | null
  created_at: string
  updated_at: string
}

export type LeadFormValues = Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'touches_sem_resposta' | 'wa_ultimo_template_id'>

export type LeadStatusHistoryEntry = {
  id: string
  lead_id: string
  from_status: string | null
  to_status: string
  changed_at: string
  changed_by: string | null
  note: string | null
}

export const emptyLeadFormValues: LeadFormValues = {
  company_name: '',
  responsible_name: '',
  whatsapp: '',
  email: '',
  instagram: '',
  address: '',
  google_maps_url: '',
  segment: '',
  source: '',
  status: 'novo',
  notes: '',
  next_action: '',
  next_action_due_date: '',
  motivo_perda: null,
  motivo_perda_detalhe: '',
  reuniao_em: '',
  reuniao_link: '',
  gatilho: '',
  prototipo_url: '',
  prototipo_notas: '',
}

export const leadStatusLabels: Record<LeadStatus, string> = {
  novo: 'Novo',
  contato_porteiro: 'Contato com porteiro',
  encaminhado: 'Encaminhado',
  falando_decisor: 'Falando com decisor',
  reuniao_marcada: 'Reunião marcada',
  proposta_enviada: 'Proposta enviada',
  convertido: 'Convertido',
  perdido: 'Perdido',
  pausado_60d: 'Pausado 60 dias',
  negociacao: 'Negociação',
}

export const lossReasonLabels: Record<LossReason, string> = {
  sem_resposta: 'Sem resposta',
  timing: 'Timing',
  preco: 'Preço',
  tem_fornecedor: 'Já tem fornecedor',
  sem_fit: 'Sem fit',
  sem_decisor: 'Sem decisor',
  concorrente: 'Concorrente',
  outro: 'Outro',
}
