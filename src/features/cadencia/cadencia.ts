import type { Lead, LeadStatus } from '../../types/lead.ts'
import {
  CADENCIA_FOLLOW_UP_TEXTS,
  defaultCadenciaConfig,
  type CadenciaConfig,
  type CadenciaQueueTab,
} from '../../types/cadencia.ts'
import { addCalendarDays, recifeDate } from '../../utils/dates.ts'

export const cadenciaQueueStatuses = [
  'novo',
  'contato_porteiro',
  'encaminhado',
  'falando_decisor',
  'reuniao_marcada',
  'proposta_enviada',
  'negociacao',
] as const satisfies readonly LeadStatus[]

export class CadenciaTouchLimitError extends Error {
  readonly code = 'TOUCH_LIMIT'
  constructor(message = 'TOUCH_LIMIT') {
    super(message)
    this.name = 'CadenciaTouchLimitError'
  }
}

export function isCadenciaQueueStatus(status: LeadStatus) {
  return (cadenciaQueueStatuses as readonly string[]).includes(status)
}

export function inCadenciaQueue(
  lead: Pick<Lead, 'status' | 'next_action_due_date'>,
  today = recifeDate(),
) {
  return Boolean(
    isCadenciaQueueStatus(lead.status)
    && lead.next_action_due_date
    && lead.next_action_due_date <= today,
  )
}

export function sortCadenciaQueue<T extends Pick<Lead, 'next_action_due_date' | 'id'>>(leads: readonly T[]) {
  return [...leads].sort((a, b) => {
    const dateCmp = (a.next_action_due_date ?? '9999').localeCompare(b.next_action_due_date ?? '9999')
    if (dateCmp !== 0) return dateCmp
    return a.id.localeCompare(b.id)
  })
}

export function filterCadenciaQueue<T extends Pick<Lead, 'status' | 'next_action_due_date' | 'id'>>(
  leads: readonly T[],
  tab: CadenciaQueueTab = 'todos',
  today = recifeDate(),
) {
  return sortCadenciaQueue(leads.filter((lead) => {
    if (!inCadenciaQueue(lead, today)) return false
    if (tab === 'hoje') return lead.next_action_due_date === today
    if (tab === 'atrasadas') return Boolean(lead.next_action_due_date && lead.next_action_due_date < today)
    return true
  }))
}

export function novosSemProximaAcao<T extends Pick<Lead, 'status' | 'next_action_due_date'>>(leads: readonly T[]) {
  return leads.filter((lead) => lead.status === 'novo' && !lead.next_action_due_date)
}

export function nextCadenciaStep(
  touches: number,
  config: CadenciaConfig = defaultCadenciaConfig,
  today = recifeDate(),
) {
  if (!Number.isInteger(touches) || touches < 0) throw new Error('Contagem de toques inválida.')
  const next = touches + 1
  if (next >= config.max_touches_sem_resposta) {
    return { limit: true as const }
  }
  const offset = config.offset_dias_apos_toque[next - 1]
  if (offset == null) return { limit: true as const }
  return {
    limit: false as const,
    touches: next,
    next_action: CADENCIA_FOLLOW_UP_TEXTS[next - 1] ?? CADENCIA_FOLLOW_UP_TEXTS[CADENCIA_FOLLOW_UP_TEXTS.length - 1],
    next_action_due_date: addCalendarDays(today, offset),
    offset_days: offset,
  }
}

export function isCadenciaTouchLimitError(error: unknown) {
  if (error instanceof CadenciaTouchLimitError) return true
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string }
  return candidate.code === 'PT409'
    || candidate.code === 'TOUCH_LIMIT'
    || candidate.message === 'TOUCH_LIMIT'
    || Boolean(candidate.message?.includes('TOUCH_LIMIT'))
}
