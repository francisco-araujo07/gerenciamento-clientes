import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lead, LeadFormValues } from '../../types/lead'
import { readAll, type PageResult } from '../../lib/read-all.ts'
import { localDate } from '../../utils/dates.ts'
import { leadPayload as payload } from '../../utils/validation.ts'

export type LeadListQuery = {
  search?: string
  status?: 'ativos' | 'todos' | Lead['status']
  onlyOverdue?: boolean
  page?: number
  pageSize?: number
}

export async function listLeads(client: SupabaseClient) {
  return readAll<Lead>((from, to) => client.from('leads').select('*', { count: 'exact' }).order('next_action_due_date', { ascending: true, nullsFirst: false }).order('id').range(from, to))
}

const searchValue = (value: string) => value.replace(/[\\%_*(),]/g, '\\$&')

export async function listLeadsPage(client: SupabaseClient, options: LeadListQuery = {}): Promise<PageResult<Lead>> {
  const page = Number.isInteger(options.page) && (options.page ?? 0) >= 0 ? options.page ?? 0 : 0
  const pageSize = Number.isInteger(options.pageSize) && (options.pageSize ?? 50) > 0 && (options.pageSize ?? 50) <= 100 ? options.pageSize ?? 50 : 50
  let query = client.from('leads').select('*', { count: 'exact' })
  const search = options.search?.trim()
  const status = options.status ?? 'ativos'
  if (search) {
    const term = searchValue(search)
    query = query.or(`company_name.ilike.%${term}%,responsible_name.ilike.%${term}%`)
  }
  if (status === 'ativos') query = query.in('status', ['novo', 'negociacao'])
  else if (status !== 'todos') query = query.eq('status', status)
  if (options.onlyOverdue) {
    query = query.in('status', ['novo', 'negociacao']).lt('next_action_due_date', localDate())
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

export async function getLead(client: SupabaseClient, id: string) {
  const { data, error } = await client.from('leads').select('*').eq('id', id).single()
  if (error) throw error
  return data as Lead
}

export async function createLead(client: SupabaseClient, values: LeadFormValues) {
  const { data, error } = await client.from('leads').insert(payload(values)).select().single()
  if (error) throw error
  return data as Lead
}

export async function createLeads(client: SupabaseClient, values: LeadFormValues[]) {
  if (!values.length || values.length > 500) throw new Error('Importe entre 1 e 500 leads por arquivo.')
  const { error } = await client.from('leads').insert(values.map(payload))
  if (error) throw error
}

export async function updateLead(client: SupabaseClient, id: string, values: LeadFormValues, expectedUpdatedAt: string) {
  const { data, error } = await client.from('leads').update(payload(values)).eq('id', id).eq('updated_at', expectedUpdatedAt).select().single()
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
