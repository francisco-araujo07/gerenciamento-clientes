import { displayContactName } from '../porteiro-decisor/contacts.ts'
import { recifeDate } from '../../utils/dates.ts'
import { leadStatusLabels, type Lead, type LeadStatus } from '../../types/lead.ts'
import {
  evaluateLeadStatusTransition,
  needsTransitionDialog,
  type LeadStatusTransitionEvaluation,
  type LeadStatusTransitionInput,
} from './lead-status.ts'

export const kanbanFixedColumnStatuses = [
  'novo',
  'contato_porteiro',
  'encaminhado',
  'falando_decisor',
  'reuniao_marcada',
  'proposta_enviada',
] as const satisfies readonly LeadStatus[]

export type KanbanColumnStatus = (typeof kanbanFixedColumnStatuses)[number] | 'negociacao'

export const KANBAN_COLUMN_PAGE_SIZE = 30
export const NEXT_ACTION_PREVIEW_MAX = 80

export type KanbanColumn = {
  status: KanbanColumnStatus
  label: string
  count: number
}

export type KanbanPendingMove = {
  leadId: string
  toStatus: LeadStatus
}

export type KanbanDropDecision =
  | { kind: 'noop' }
  | { kind: 'reject'; error: string }
  | { kind: 'apply'; toStatus: LeadStatus }
  | { kind: 'dialog'; toStatus: LeadStatus; evaluation: LeadStatusTransitionEvaluation }

export function isKanbanColumnStatus(value: string): value is KanbanColumnStatus {
  return (kanbanFixedColumnStatuses as readonly string[]).includes(value) || value === 'negociacao'
}

export function kanbanColumnCount(leads: readonly Pick<Lead, 'status'>[], status: LeadStatus) {
  return leads.reduce((total, lead) => total + (lead.status === status ? 1 : 0), 0)
}

export function kanbanColumns(leads: readonly Pick<Lead, 'status'>[]): KanbanColumn[] {
  const columns: KanbanColumn[] = kanbanFixedColumnStatuses.map((status) => ({
    status,
    label: leadStatusLabels[status],
    count: kanbanColumnCount(leads, status),
  }))
  const negociacaoCount = kanbanColumnCount(leads, 'negociacao')
  if (negociacaoCount > 0) {
    columns.push({
      status: 'negociacao',
      label: leadStatusLabels.negociacao,
      count: negociacaoCount,
    })
  }
  return columns
}

export function compareKanbanCards(a: Pick<Lead, 'id' | 'next_action_due_date'>, b: Pick<Lead, 'id' | 'next_action_due_date'>) {
  const dueA = a.next_action_due_date ?? '9999'
  const dueB = b.next_action_due_date ?? '9999'
  const due = dueA.localeCompare(dueB)
  if (due !== 0) return due
  return a.id.localeCompare(b.id)
}

export function leadsWithPendingMove(leads: readonly Lead[], pending: KanbanPendingMove | null) {
  if (!pending) return [...leads]
  return leads.map((lead) => lead.id === pending.leadId ? { ...lead, status: pending.toStatus } : lead)
}

export function groupKanbanLeads(leads: readonly Lead[], pending: KanbanPendingMove | null = null) {
  const visible = leadsWithPendingMove(leads, pending)
  const grouped = Object.fromEntries(
    kanbanColumns(visible).map((column) => [column.status, [] as Lead[]]),
  ) as Record<KanbanColumnStatus, Lead[]>
  for (const lead of visible) {
    if (isKanbanColumnStatus(lead.status)) grouped[lead.status].push(lead)
  }
  for (const cards of Object.values(grouped)) cards.sort(compareKanbanCards)
  return grouped
}

export function visibleKanbanCards(leads: readonly Lead[], limit = KANBAN_COLUMN_PAGE_SIZE) {
  const size = Number.isInteger(limit) && limit > 0 ? limit : KANBAN_COLUMN_PAGE_SIZE
  return {
    items: leads.slice(0, size),
    remaining: Math.max(0, leads.length - size),
  }
}

export function nextKanbanColumnLimit(current: number, pageSize = KANBAN_COLUMN_PAGE_SIZE) {
  return current + pageSize
}

export function truncateNextAction(value: string | null | undefined, max = NEXT_ACTION_PREVIEW_MAX) {
  const text = value?.trim() ?? ''
  if (!text) return null
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`
}

export function kanbanContactName(
  lead: Pick<Lead, 'responsible_name' | 'porteiro_nome' | 'decisor_nome' | 'contato_principal'>,
  porteiroEnabled: boolean,
) {
  if (porteiroEnabled) return displayContactName(lead) || lead.responsible_name?.trim() || null
  return lead.responsible_name?.trim() || null
}

export function kanbanInitials(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = Array.from(parts[0])
  if (parts.length === 1) return `${first[0] ?? '?'}${first[1] ?? ''}`.toUpperCase()
  const last = Array.from(parts[parts.length - 1])
  return `${first[0] ?? '?'}${last[0] ?? ''}`.toUpperCase()
}

export function isKanbanOverdue(
  lead: Pick<Lead, 'next_action_due_date'>,
  today = recifeDate(),
) {
  return Boolean(lead.next_action_due_date && lead.next_action_due_date < today)
}

export function decideKanbanDrop(from: LeadStatus, to: LeadStatus): KanbanDropDecision {
  if (from === to) return { kind: 'noop' }
  const evaluation = evaluateLeadStatusTransition(from, to)
  if (!evaluation.allowed) {
    return { kind: 'reject', error: evaluation.error ?? 'Transição de status inválida.' }
  }
  if (needsTransitionDialog(evaluation)) return { kind: 'dialog', toStatus: to, evaluation }
  return { kind: 'apply', toStatus: to }
}

export const KANBAN_STATUS_UPDATE_ERROR = 'Não foi possível atualizar o status.'

export type KanbanStatusApplyResult =
  | { ok: true; lead: Lead; error: null }
  | { ok: false; lead: null; error: string }

export async function applyKanbanStatusMove(
  update: (lead: Lead, toStatus: LeadStatus, input: LeadStatusTransitionInput) => Promise<Lead>,
  lead: Lead,
  toStatus: LeadStatus,
  input: LeadStatusTransitionInput = {},
): Promise<KanbanStatusApplyResult> {
  try {
    const saved = await update(lead, toStatus, input)
    return { ok: true, lead: saved, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message.trim() : ''
    return { ok: false, lead: null, error: message || KANBAN_STATUS_UPDATE_ERROR }
  }
}

export function pendingAfterKanbanStatusApply(_result: KanbanStatusApplyResult): KanbanPendingMove | null {
  return null
}
