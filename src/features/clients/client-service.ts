import type { SupabaseClient } from '@supabase/supabase-js'
import type { Client, Project, ProjectValues } from '../../types/client'
import { readAll } from '../../lib/read-all.ts'
import { contactPayload, projectPayload } from '../../utils/validation.ts'

export type ClientValues = Pick<Client, 'company_name' | 'responsible_name' | 'whatsapp' | 'email' | 'instagram' | 'address' | 'google_maps_url' | 'segment' | 'notes'>

export async function listClients(client: SupabaseClient) {
  const [clients, projects] = await Promise.all([
    readAll<Omit<Client, 'projects'>>((from, to) => client.from('clients').select('*', { count: 'exact' }).order('company_name').order('id').range(from, to)),
    readAll<Project>((from, to) => client.from('projects').select('*', { count: 'exact' }).order('id').range(from, to)),
  ])
  const byClient = new Map<string, Project[]>()
  for (const project of projects) byClient.set(project.client_id, [...(byClient.get(project.client_id) ?? []), project])
  return clients.map((item) => ({ ...item, projects: byClient.get(item.id) ?? [] }))
}

export async function getClient(client: SupabaseClient, id: string) {
  const { data, error } = await client.from('clients').select('*').eq('id', id).single()
  if (error) throw error
  const projects = await readAll<Project>((from, to) => client.from('projects').select('*', { count: 'exact' }).eq('client_id', id).order('id').range(from, to))
  return { ...data, projects } as Client
}

export async function createProject(client: SupabaseClient, clientId: string, values: ProjectValues) {
  const { data, error } = await client.from('projects').insert({ client_id: clientId, ...projectPayload(values) }).select().single()
  if (error) throw error
  return data
}

export async function updateProject(client: SupabaseClient, id: string, values: ProjectValues, expectedUpdatedAt: string) {
  const { error } = await client.from('projects').update(projectPayload(values)).eq('id', id).eq('updated_at', expectedUpdatedAt).select('id').single()
  if (error) throw error
}

export async function deleteProject(client: SupabaseClient, id: string) {
  const { error } = await client.from('projects').delete().eq('id', id).select('id').single()
  if (error) throw error
}

export async function deleteClient(client: SupabaseClient, id: string) {
  const { error } = await client.from('clients').delete().eq('id', id).select('id').single()
  if (error) throw error
}

export async function updateClient(client: SupabaseClient, id: string, values: ClientValues, expectedUpdatedAt: string) {
  const { error } = await client.from('clients').update(contactPayload(values)).eq('id', id).eq('updated_at', expectedUpdatedAt).select('id').single()
  if (error) throw error
}
