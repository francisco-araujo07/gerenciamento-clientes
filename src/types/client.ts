import type { ContactFields } from './lead'

export const projectStatuses = ['aguardando_inicio', 'em_desenvolvimento', 'pausado', 'concluido', 'abandonado'] as const
export type ProjectStatus = (typeof projectStatuses)[number]
export const projectStatusLabels: Record<ProjectStatus, string> = { aguardando_inicio: 'Aguardando início', em_desenvolvimento: 'Em desenvolvimento', pausado: 'Pausado', concluido: 'Concluído', abandonado: 'Abandonado' }

export type Project = { id: string; client_id: string; name: string; price: number; deadline: string | null; status: ProjectStatus; completed_at: string | null; created_at: string; updated_at: string }
export type Client = ContactFields & { id: string; lead_id: string | null; created_at: string; updated_at: string; projects: Project[] }
export type ClientValues = Pick<ContactFields, 'company_name' | 'responsible_name' | 'whatsapp' | 'email' | 'instagram' | 'address' | 'google_maps_url' | 'segment' | 'notes'>
export type ProjectValues = { name: string; price: string; deadline: string; status: ProjectStatus; completed_at: string }
export const emptyProjectValues: ProjectValues = { name: '', price: '', deadline: '', status: 'aguardando_inicio', completed_at: '' }
