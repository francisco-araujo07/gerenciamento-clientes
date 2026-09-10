import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lead, LeadFormValues } from '../../types/lead'
import { readAll } from '../../lib/read-all.ts'
import { leadPayload as payload } from '../../utils/validation.ts'

export async function listLeads(client: SupabaseClient) {
  return readAll<Lead>((from, to) => client.from('leads').select('*', { count: 'exact' }).order('next_action_due_date', { ascending: true, nullsFirst: false }).order('id').range(from, to))
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
