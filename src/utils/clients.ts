import type { Client, Project, ProjectStatus } from '../types/client'

export type ClientStatusFilter = 'todos' | ProjectStatus

export function filterClients(clients: readonly Client[], search: string, status: ClientStatusFilter): Client[] {
  const term = search.trim().toLocaleLowerCase('pt-BR')
  return clients.filter((client) => {
    const found = !term
      || client.company_name.toLocaleLowerCase('pt-BR').includes(term)
      || client.responsible_name?.toLocaleLowerCase('pt-BR').includes(term)
    const statusMatches = status === 'todos' || client.projects.some((project) => project.status === status)
    return Boolean(found && statusMatches)
  })
}

export function groupProjectsByClient(projects: readonly Project[]) {
  const byClient = new Map<string, Project[]>()
  for (const project of projects) {
    const clientProjects = byClient.get(project.client_id)
    if (clientProjects) clientProjects.push(project)
    else byClient.set(project.client_id, [project])
  }
  return byClient
}
