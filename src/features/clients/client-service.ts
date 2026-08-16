import type { SupabaseClient } from '@supabase/supabase-js'
import type { Client, ProjectValues } from '../../types/client'

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
