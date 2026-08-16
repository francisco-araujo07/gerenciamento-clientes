import type { SupabaseClient } from '@supabase/supabase-js'
import type { Client, ProjectValues } from '../../types/client'

export type ClientValues = Pick<Client, 'company_name' | 'responsible_name' | 'whatsapp' | 'email' | 'instagram' | 'address' | 'google_maps_url' | 'segment' | 'notes'>

export async function listClients(client: SupabaseClient) {
  const { data, error } = await client.from('clients').select('*, projects(*)').order('company_name')
  if (error) throw error
  return (data ?? []).map((item) => ({ ...item, projects: item.projects ?? [] })) as Client[]
}

export async function getClient(client: SupabaseClient, id: string) {
  const { data, error } = await client.from('clients').select('*, projects(*)').eq('id', id).single()
  if (error) throw error
  return { ...data, projects: data.projects ?? [] } as Client
}

export async function createProject(client: SupabaseClient, clientId: string, values: ProjectValues) {
  const { data, error } = await client.from('projects').insert({ client_id: clientId, name: values.name.trim(), price: Number(values.price), deadline: values.deadline || null, status: values.status, completed_at: values.status === 'concluido' ? values.completed_at || new Date().toISOString().slice(0, 10) : null }).select().single()
  if (error) throw error
  return data
}

function projectPayload(values: ProjectValues) {
  return { name: values.name.trim(), price: Number(values.price), deadline: values.deadline || null, status: values.status, completed_at: values.status === 'concluido' ? values.completed_at || new Date().toISOString().slice(0, 10) : null }
}

export async function updateProject(client: SupabaseClient, id: string, values: ProjectValues) {
  const { error } = await client.from('projects').update(projectPayload(values)).eq('id', id)
  if (error) throw error
}

export async function deleteProject(client: SupabaseClient, id: string) {
  const { error } = await client.from('projects').delete().eq('id', id)
  if (error) throw error
}

export async function deleteClient(client: SupabaseClient, id: string) {
  const { error } = await client.from('clients').delete().eq('id', id)
  if (error) throw error
}

export async function updateClient(client: SupabaseClient, id: string, values: ClientValues) {
  const { error } = await client.from('clients').update(values).eq('id', id)
  if (error) throw error
}
