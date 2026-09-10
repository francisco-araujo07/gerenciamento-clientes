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

export const leadStatuses = ['novo', 'negociacao', 'convertido', 'perdido'] as const

export type LeadStatus = (typeof leadStatuses)[number]

export type Lead = ContactFields & {
  id: string
  source: string | null
  status: LeadStatus
  next_action: string | null
  next_action_due_date: string | null
  created_at: string
  updated_at: string
}

export type LeadFormValues = Omit<Lead, 'id' | 'created_at' | 'updated_at'>

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
}

export const leadStatusLabels: Record<LeadStatus, string> = {
  novo: 'Novo',
  negociacao: 'Negociação',
  convertido: 'Convertido',
  perdido: 'Perdido',
}
