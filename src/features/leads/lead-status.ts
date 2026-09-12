import {
  funilLeadStatuses,
  legacyLeadStatuses,
  lossReasons,
  leadStatusLabels,
  type LeadStatus,
  type LegacyLeadStatus,
  type LossReason,
} from '../../types/lead.ts'

export const cadenceStatuses = [
  'novo',
  'contato_porteiro',
  'encaminhado',
  'falando_decisor',
  'reuniao_marcada',
  'proposta_enviada',
] as const satisfies readonly LeadStatus[]

export const inactiveFunilStatuses = ['convertido', 'perdido', 'pausado_60d'] as const satisfies readonly LeadStatus[]

export const createLeadStatuses = [
  'novo',
  'contato_porteiro',
  'encaminhado',
  'falando_decisor',
  'proposta_enviada',
] as const satisfies readonly LeadStatus[]

export const typicalFromNegociacao = [
  'contato_porteiro',
  'encaminhado',
  'falando_decisor',
  'reuniao_marcada',
  'proposta_enviada',
  'pausado_60d',
  'perdido',
] as const satisfies readonly LeadStatus[]

const cadenceNext: Partial<Record<LeadStatus, LeadStatus>> = {
  novo: 'contato_porteiro',
  contato_porteiro: 'encaminhado',
  encaminhado: 'falando_decisor',
  falando_decisor: 'reuniao_marcada',
  reuniao_marcada: 'proposta_enviada',
}

export type LeadStatusFilter =
  | 'ativos'
  | 'todos'
  | 'cadencia'
  | 'pausados'
  | LeadStatus

export type ConversionDecision = 'allow' | 'confirm' | 'block'

export type LeadStatusTransitionInput = {
  confirmAtypical?: boolean
  note?: string | null
  motivoPerda?: string | null
  motivoPerdaDetalhe?: string | null
  reuniaoEm?: string | null
  reuniaoLink?: string | null
  nextAction?: string | null
  nextActionDueDate?: string | null
}

export type LeadStatusTransitionEvaluation = {
  allowed: boolean
  typical: boolean
  requiresMotivo: boolean
  requiresReuniao: boolean
  requiresEncaminhadoNote: boolean
  suggestsPause: boolean
  error?: string
}

export function isLeadStatus(value: string): value is LeadStatus {
  return (funilLeadStatuses as readonly string[]).includes(value)
}

export function isLegacyLeadStatus(value: string): value is LegacyLeadStatus {
  return (legacyLeadStatuses as readonly string[]).includes(value)
}

export function isLossReason(value: string): value is LossReason {
  return (lossReasons as readonly string[]).includes(value)
}

export function writableLeadStatuses(funilEnabled: boolean) {
  return funilEnabled ? funilLeadStatuses : legacyLeadStatuses
}

export function visibleLeadStatuses(funilEnabled: boolean, current?: LeadStatus | null) {
  if (!funilEnabled) {
    return legacyLeadStatuses.filter((status) => status !== 'convertido' || current === 'convertido')
  }
  const options: LeadStatus[] = [...createLeadStatuses]
  if (current && !options.includes(current)) options.unshift(current)
  return options
}

export function detailStatusOptions(current: LeadStatus, funilEnabled: boolean) {
  if (!funilEnabled) return visibleLeadStatuses(false, current)
  return funilLeadStatuses.filter((status) => status !== 'convertido' || current === 'convertido')
}

export function isActiveLeadStatus(status: LeadStatus, funilEnabled: boolean) {
  if (!funilEnabled) return status === 'novo' || status === 'negociacao'
  return !(inactiveFunilStatuses as readonly string[]).includes(status)
}

export function isCadenceStatus(status: LeadStatus) {
  return (cadenceStatuses as readonly string[]).includes(status)
}

export function isTypicalLeadStatusTransition(from: LeadStatus, to: LeadStatus) {
  if (from === to) return true
  if (from === 'convertido' || to === 'convertido') return false
  if (to === 'perdido') return true
  if (to === 'pausado_60d') return isCadenceStatus(from) || from === 'negociacao'
  if (from === 'pausado_60d') return isCadenceStatus(to)
  if (from === 'negociacao') return (typicalFromNegociacao as readonly string[]).includes(to)
  return cadenceNext[from] === to
}

export function evaluateLeadStatusTransition(from: LeadStatus, to: LeadStatus): LeadStatusTransitionEvaluation {
  if (from === to) {
    return {
      allowed: true,
      typical: true,
      requiresMotivo: false,
      requiresReuniao: false,
      requiresEncaminhadoNote: false,
      suggestsPause: false,
    }
  }
  if (to === 'convertido') {
    return {
      allowed: false,
      typical: false,
      requiresMotivo: false,
      requiresReuniao: false,
      requiresEncaminhadoNote: false,
      suggestsPause: false,
      error: 'Use a ação Converter em cliente para marcar o lead como convertido.',
    }
  }
  if (from === 'convertido') {
    return {
      allowed: false,
      typical: false,
      requiresMotivo: false,
      requiresReuniao: false,
      requiresEncaminhadoNote: false,
      suggestsPause: false,
      error: 'Lead convertido não muda de status por aqui.',
    }
  }
  return {
    allowed: true,
    typical: isTypicalLeadStatusTransition(from, to),
    requiresMotivo: to === 'perdido',
    requiresReuniao: to === 'reuniao_marcada',
    requiresEncaminhadoNote: to === 'encaminhado',
    suggestsPause: to === 'pausado_60d',
  }
}

export function needsTransitionDialog(evaluation: LeadStatusTransitionEvaluation) {
  return Boolean(
    !evaluation.typical
    || evaluation.requiresMotivo
    || evaluation.requiresReuniao
    || evaluation.requiresEncaminhadoNote
    || evaluation.suggestsPause,
  )
}

export function validateHttpsLink(value: string, field = 'O link') {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${field} deve usar HTTPS sem credenciais.`)
  return url.toString()
}

export function validateLeadStatusTransition(
  from: LeadStatus,
  to: LeadStatus,
  input: LeadStatusTransitionInput = {},
) {
  const evaluation = evaluateLeadStatusTransition(from, to)
  if (!evaluation.allowed) throw new Error(evaluation.error ?? 'Transição de status inválida.')
  if (!evaluation.typical && !input.confirmAtypical) throw new Error('Confirme a transição atípica para continuar.')
  if (evaluation.requiresMotivo) {
    if (!input.motivoPerda || !isLossReason(input.motivoPerda)) throw new Error('Informe o motivo da perda.')
    if (input.motivoPerda === 'outro' && !input.motivoPerdaDetalhe?.trim()) {
      throw new Error('Descreva o motivo da perda.')
    }
  }
  if (evaluation.requiresReuniao && !input.reuniaoEm?.trim()) {
    throw new Error('Informe data e hora da reunião.')
  }
  if (input.reuniaoLink?.trim()) validateHttpsLink(input.reuniaoLink.trim(), 'O link da reunião')
  if (evaluation.requiresEncaminhadoNote && !input.note?.trim()) {
    throw new Error('Descreva para quem ou o que foi encaminhado.')
  }
  return evaluation
}

export function conversionDecision(status: LeadStatus, funilEnabled: boolean): ConversionDecision {
  if (!funilEnabled) return status === 'novo' || status === 'negociacao' ? 'allow' : 'block'
  if (status === 'perdido' || status === 'pausado_60d' || status === 'convertido') return 'block'
  if (status === 'proposta_enviada' || status === 'reuniao_marcada' || status === 'falando_decisor' || status === 'negociacao') {
    return 'allow'
  }
  return 'confirm'
}

export function conversionBlockMessage(status: LeadStatus) {
  if (status === 'perdido') return 'Leads perdidos não podem ser convertidos.'
  if (status === 'pausado_60d') return 'Retome o lead pausado antes de converter em cliente.'
  if (status === 'convertido') return 'Este lead já foi convertido.'
  return 'Este lead não pode ser convertido agora.'
}

export function matchesLeadStatusFilter(status: LeadStatus, filter: LeadStatusFilter, funilEnabled: boolean) {
  if (filter === 'todos') return true
  if (filter === 'ativos') return isActiveLeadStatus(status, funilEnabled)
  if (filter === 'cadencia') return funilEnabled && isCadenceStatus(status)
  if (filter === 'pausados') return funilEnabled && status === 'pausado_60d'
  return status === filter
}

export function statusFilterOptions(funilEnabled: boolean) {
  if (!funilEnabled) {
    return [
      { value: 'ativos' as const, label: 'Ativos (Novo e Negociação)' },
      { value: 'todos' as const, label: 'Todos os status' },
      ...legacyLeadStatuses.map((status) => ({ value: status, label: leadStatusLabels[status] })),
    ]
  }
  return [
    { value: 'ativos' as const, label: 'Ativos' },
    { value: 'cadencia' as const, label: 'Em cadência' },
    { value: 'negociacao' as const, label: 'Em Negociação' },
    { value: 'pausados' as const, label: 'Pausados' },
    { value: 'perdido' as const, label: 'Perdidos' },
    { value: 'todos' as const, label: 'Todos os status' },
    ...funilLeadStatuses
      .filter((status) => status !== 'negociacao' && status !== 'perdido' && status !== 'pausado_60d')
      .map((status) => ({ value: status, label: leadStatusLabels[status] })),
  ]
}

export function activeStatusesForQuery(funilEnabled: boolean) {
  return funilEnabled
    ? funilLeadStatuses.filter((status) => isActiveLeadStatus(status, true))
    : (['novo', 'negociacao'] as const)
}
