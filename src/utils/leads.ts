import type { Lead, LeadStatus } from '../types/lead'
import { localDate } from './dates.ts'

export type LeadStatusFilter = 'ativos' | 'todos' | LeadStatus

export function isActiveLead(lead: Pick<Lead, 'status'>) {
  return lead.status === 'novo' || lead.status === 'negociacao'
}

export function isOverdueLead(lead: Pick<Lead, 'status' | 'next_action_due_date'>, today = localDate()) {
  return Boolean(lead.next_action_due_date && lead.next_action_due_date < today && isActiveLead(lead))
}

export function filterLeads(
  leads: readonly Lead[],
  options: { search: string; status: LeadStatusFilter; onlyOverdue: boolean },
  today = localDate(),
) {
  const term = options.search.trim().toLocaleLowerCase('pt-BR')
  return leads.filter((lead) => {
    const found = !term
      || lead.company_name.toLocaleLowerCase('pt-BR').includes(term)
      || lead.responsible_name?.toLocaleLowerCase('pt-BR').includes(term)
    const statusMatches = options.status === 'todos'
      || (options.status === 'ativos' ? isActiveLead(lead) : lead.status === options.status)
    return Boolean(found && statusMatches && (!options.onlyOverdue || isOverdueLead(lead, today)))
  })
}
