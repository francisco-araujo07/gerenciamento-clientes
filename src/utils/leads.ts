import type { Lead } from '../types/lead'
import { isGlcFunilStatusEnabled, isGlcPorteiroDecisorEnabled } from './feature-flags.ts'
import { localDate } from './dates.ts'
import {
  isActiveLeadStatus,
  matchesLeadStatusFilter,
  type LeadStatusFilter,
} from '../features/leads/lead-status.ts'

export type { LeadStatusFilter }

export function isActiveLead(lead: Pick<Lead, 'status'>, funilEnabled = isGlcFunilStatusEnabled()) {
  return isActiveLeadStatus(lead.status, funilEnabled)
}

export function isOverdueLead(
  lead: Pick<Lead, 'status' | 'next_action_due_date'>,
  today?: string,
  funilEnabled = isGlcFunilStatusEnabled(),
) {
  const day = today ?? localDate()
  return Boolean(lead.next_action_due_date && lead.next_action_due_date < day && isActiveLead(lead, funilEnabled))
}

export function filterLeads(
  leads: readonly Lead[],
  options: { search: string; status: LeadStatusFilter; onlyOverdue: boolean; funilEnabled?: boolean; porteiroEnabled?: boolean },
  today = localDate(),
) {
  const term = options.search.trim().toLocaleLowerCase('pt-BR')
  const funilEnabled = options.funilEnabled ?? isGlcFunilStatusEnabled()
  const porteiroEnabled = options.porteiroEnabled ?? isGlcPorteiroDecisorEnabled()
  return leads.filter((lead) => {
    const found = !term
      || lead.company_name.toLocaleLowerCase('pt-BR').includes(term)
      || lead.responsible_name?.toLocaleLowerCase('pt-BR').includes(term)
      || (porteiroEnabled && (
        lead.porteiro_nome?.toLocaleLowerCase('pt-BR').includes(term)
        || lead.decisor_nome?.toLocaleLowerCase('pt-BR').includes(term)
      ))
    const statusMatches = matchesLeadStatusFilter(lead.status, options.status, funilEnabled)
    return Boolean(found && statusMatches && (!options.onlyOverdue || isOverdueLead(lead, today, funilEnabled)))
  })
}
