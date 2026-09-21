import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lead, LeadFormValues, LeadStatusHistoryEntry } from '../../types/lead'
import { readAll, type PageResult } from '../../lib/read-all.ts'
import { localDate } from '../../utils/dates.ts'
import { isGlcFunilStatusEnabled, isGlcPorteiroDecisorEnabled, isGlcReuniaoEnabled } from '../../utils/feature-flags.ts'
import { leadPayload, leadUpdatePayload } from '../../utils/validation.ts'
import {
  activeStatusesForQuery,
  validateLeadStatusTransition,
  type LeadStatusFilter,
  type LeadStatusTransitionInput,
} from './lead-status.ts'
import { marcarReuniao, shouldMarcarReuniao } from '../reuniao/reuniao-service.ts'

export type LeadListQuery = {
  search?: string
  status?: LeadStatusFilter
  onlyOverdue?: boolean
  page?: number
  pageSize?: number
  funilEnabled?: boolean
  porteiroEnabled?: boolean
}

export async function listLeads(client: SupabaseClient, porteiroEnabled = isGlcPorteiroDecisorEnabled()) {
  return readAll<Lead>((from, to) => {
    let query = client.from('leads').select('*', { count: 'exact' })
    if (porteiroEnabled) query = query.is('deleted_at', null)
    return query.order('next_action_due_date', { ascending: true, nullsFirst: false }).order('id').range(from, to)
  })
}

const searchValue = (value: string) => value.replace(/[\\%_*(),]/g, '\\$&')

function leadSearchFilter(term: string, porteiroEnabled: boolean) {
  const fields = ['company_name', 'responsible_name']
  if (porteiroEnabled) fields.push('porteiro_nome', 'decisor_nome')
  return fields.map((field) => `${field}.ilike.%${term}%`).join(',')
}

export async function listLeadsPage(client: SupabaseClient, options: LeadListQuery = {}): Promise<PageResult<Lead>> {
  const page = Number.isInteger(options.page) && (options.page ?? 0) >= 0 ? options.page ?? 0 : 0
  const pageSize = Number.isInteger(options.pageSize) && (options.pageSize ?? 50) > 0 && (options.pageSize ?? 50) <= 100 ? options.pageSize ?? 50 : 50
  const funilEnabled = options.funilEnabled ?? isGlcFunilStatusEnabled()
  const porteiroEnabled = options.porteiroEnabled ?? isGlcPorteiroDecisorEnabled()
  let query = client.from('leads').select('*', { count: 'exact' })
  if (porteiroEnabled) query = query.is('deleted_at', null)
  const search = options.search?.trim()
  const status = options.status ?? 'ativos'
  if (search) {
    query = query.or(leadSearchFilter(searchValue(search), porteiroEnabled))
  }
  if (status === 'ativos') query = query.in('status', [...activeStatusesForQuery(funilEnabled)])
  else if (status === 'cadencia') query = query.in('status', ['novo', 'contato_porteiro', 'encaminhado', 'falando_decisor', 'reuniao_marcada', 'proposta_enviada'])
  else if (status === 'pausados') query = query.eq('status', 'pausado_60d')
  else if (status !== 'todos') query = query.eq('status', status)
  if (options.onlyOverdue) {
    query = query.in('status', [...activeStatusesForQuery(funilEnabled)]).lt('next_action_due_date', localDate())
  }
  const from = page * pageSize
  const { data, error, count } = await query
    .order('next_action_due_date', { ascending: true, nullsFirst: false })
    .order('id')
    .range(from, from + pageSize - 1)
  if (error) throw error
  if (count === null || !Number.isSafeInteger(count) || count < 0) throw new Error('Contagem de registros indisponível.')
  return { data: (data ?? []) as Lead[], count }
}

export async function getLead(client: SupabaseClient, id: string, porteiroEnabled = isGlcPorteiroDecisorEnabled()) {
  let query = client.from('leads').select('*').eq('id', id)
  if (porteiroEnabled) query = query.is('deleted_at', null)
  const { data, error } = await query.single()
  if (error) throw error
  return data as Lead
}

export async function createLead(client: SupabaseClient, values: LeadFormValues) {
  const { data, error } = await client.from('leads').insert(leadPayload(values)).select().single()
  if (error) throw error
  return data as Lead
}

export async function createLeads(client: SupabaseClient, values: LeadFormValues[]) {
  if (!values.length || values.length > 500) throw new Error('Importe entre 1 e 500 leads por arquivo.')
  const { error } = await client.from('leads').insert(values.map((item) => leadPayload(item)))
  if (error) throw error
}

export async function updateLead(client: SupabaseClient, id: string, values: LeadFormValues, expectedUpdatedAt: string) {
  const { data, error } = await client.from('leads').update(leadUpdatePayload(values)).eq('id', id).eq('updated_at', expectedUpdatedAt).select().single()
  if (error) throw error
  return data as Lead
}

export async function deleteLead(client: SupabaseClient, id: string) {
  const { error } = await client.from('leads').delete().eq('id', id).select('id').single()
  if (error) throw error
}

export async function convertLeadToClient(client: SupabaseClient, leadId: string) {
  const { error } = await client.rpc('convert_lead_to_client', { p_lead_id: leadId })
  if (error) throw error
}

export async function updateLeadStatus(
  client: SupabaseClient,
  lead: Pick<Lead, 'id' | 'status' | 'updated_at'>,
  toStatus: Lead['status'],
  input: LeadStatusTransitionInput = {},
) {
  validateLeadStatusTransition(lead.status, toStatus, input)
  if (shouldMarcarReuniao(toStatus, isGlcReuniaoEnabled())) {
    return marcarReuniao(client, lead, input)
  }
  const { data, error } = await client.rpc('update_lead_status', {
    p_lead_id: lead.id,
    p_to_status: toStatus,
    p_expected_updated_at: lead.updated_at,
    p_confirm_atypical: Boolean(input.confirmAtypical),
    p_note: input.note?.trim() || null,
    p_motivo_perda: input.motivoPerda || null,
    p_motivo_perda_detalhe: input.motivoPerdaDetalhe?.trim() || null,
    p_reuniao_em: input.reuniaoEm || null,
    p_reuniao_link: input.reuniaoLink?.trim() || null,
    p_next_action: input.nextAction?.trim() || null,
    p_next_action_due_date: input.nextActionDueDate || null,
  })
  if (error) throw error
  return data as Lead
}

export async function listLeadStatusHistory(client: SupabaseClient, leadId: string) {
  const { data, error } = await client
    .from('lead_status_history')
    .select('id, lead_id, from_status, to_status, changed_at, changed_by, note')
    .eq('lead_id', leadId)
    .order('changed_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return (data ?? []) as LeadStatusHistoryEntry[]
}
