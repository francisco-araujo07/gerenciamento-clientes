import type { SupabaseClient } from '@supabase/supabase-js'
import type { Client, ClientValues as ClientValuesType, Project, ProjectStatus, ProjectValues } from '../../types/client'
import { readAll, type PageResult } from '../../lib/read-all.ts'
import { contactPayload, projectPayload } from '../../utils/validation.ts'
import { groupProjectsByClient } from '../../utils/clients.ts'

export type { ClientValues } from '../../types/client'
export type ClientListQuery = {
  search?: string
  status?: 'todos' | ProjectStatus
  page?: number
  pageSize?: number
}

export async function listClients(client: SupabaseClient) {
  const [clients, projects] = await Promise.all([
    readAll<Omit<Client, 'projects'>>((from, to) => client.from('clients').select('*', { count: 'exact' }).order('company_name').order('id').range(from, to)),
    readAll<Project>((from, to) => client.from('projects').select('*', { count: 'exact' }).order('id').range(from, to)),
  ])
  const byClient = groupProjectsByClient(projects)
  return clients.map((item) => ({ ...item, projects: byClient.get(item.id) ?? [] }))
}

const searchValue = (value: string) => value.replace(/[\\%_*(),]/g, '\\$&')

export async function listClientsPage(client: SupabaseClient, options: ClientListQuery = {}): Promise<PageResult<Client>> {
  const page = Number.isInteger(options.page) && (options.page ?? 0) >= 0 ? options.page ?? 0 : 0
  const pageSize = Number.isInteger(options.pageSize) && (options.pageSize ?? 50) > 0 && (options.pageSize ?? 50) <= 100 ? options.pageSize ?? 50 : 50
  const status = options.status ?? 'todos'
  const selection = status === 'todos' ? '*, projects(*)' : '*, projects!inner(*)'
  let query = client.from('clients').select(selection, { count: 'exact' })
  const search = options.search?.trim()
  if (search) {
    const term = searchValue(search)
    query = query.or(`company_name.ilike.%${term}%,responsible_name.ilike.%${term}%`)
  }
  if (status !== 'todos') query = query.eq('projects.status', status)
  const from = page * pageSize
  const { data, error, count } = await query
    .order('company_name')
    .order('id')
    .range(from, from + pageSize - 1)
  if (error) throw error
  if (count === null || !Number.isSafeInteger(count) || count < 0) throw new Error('Contagem de registros indisponível.')
  return { data: (data ?? []) as Client[], count }
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

export async function updateClient(client: SupabaseClient, id: string, values: ClientValuesType, expectedUpdatedAt: string) {
  const { error } = await client.from('clients').update(contactPayload(values)).eq('id', id).eq('updated_at', expectedUpdatedAt).select('id').single()
  if (error) throw error
}
