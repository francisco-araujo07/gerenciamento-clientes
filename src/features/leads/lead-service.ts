import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lead, LeadFormValues } from '../../types/lead'

function nullable(value: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function payload(values: LeadFormValues) {
  return {
    ...values,
    company_name: values.company_name.trim(),
    responsible_name: nullable(values.responsible_name),
    whatsapp: nullable(values.whatsapp),
    email: nullable(values.email),
    instagram: nullable(values.instagram),
    address: nullable(values.address),
    google_maps_url: nullable(values.google_maps_url),
    segment: nullable(values.segment),
    source: nullable(values.source),
    notes: nullable(values.notes),
    next_action: nullable(values.next_action),
    next_action_due_date: values.next_action_due_date || null,
  }
}

export async function listLeads(client: SupabaseClient) {
  const { data, error } = await client.from('leads').select('*').order('next_action_due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as Lead[]
}

export async function createLead(client: SupabaseClient, values: LeadFormValues) {
  const { data, error } = await client.from('leads').insert(payload(values)).select().single()
  if (error) throw error
  return data as Lead
}

export async function updateLead(client: SupabaseClient, id: string, values: LeadFormValues) {
  const { data, error } = await client.from('leads').update(payload(values)).eq('id', id).select().single()
  if (error) throw error
  return data as Lead
}

export async function deleteLead(client: SupabaseClient, id: string) {
  const { error } = await client.from('leads').delete().eq('id', id)
  if (error) throw error
}
