import { isDate, localDate } from './dates.ts'
import { leadStatuses, type LeadStatus } from '../types/lead.ts'
import { projectStatuses, type ProjectStatus } from '../types/client.ts'

export function textValue(value: unknown, max = 500, required = false): string | null {
  if (value == null && !required) return null
  if (typeof value !== 'string') throw new Error('Texto inválido.')
  const text = value.trim()
  if ((required && !text) || text.length > max) throw new Error(`Preencha o campo com até ${max} caracteres.`)
  return text || null
}

export function optionalDate(value: unknown) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !isDate(value)) throw new Error('Data inválida. Use AAAA-MM-DD.')
  return value
}

export function contactPayload(values: Record<string, unknown>) {
  const email = textValue(values.email, 254)
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error('E-mail inválido.')
  const map = textValue(values.google_maps_url, 2048)
  if (map) {
    const url = new URL(map)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('O link deve usar HTTPS sem credenciais.')
  }
  return {
    company_name: textValue(values.company_name, 200, true)!,
    responsible_name: textValue(values.responsible_name, 200),
    whatsapp: textValue(values.whatsapp, 50), email,
    instagram: textValue(values.instagram, 200),
    address: textValue(values.address, 1000), google_maps_url: map,
    segment: textValue(values.segment, 200), notes: textValue(values.notes, 10000),
  }
}

export function leadPayload(values: Record<string, unknown>) {
  if (!leadStatuses.includes(String(values.status) as LeadStatus)) throw new Error('Status inválido.')
  return { ...contactPayload(values), status: values.status as LeadStatus, source: textValue(values.source, 200), next_action: textValue(values.next_action, 2000), next_action_due_date: optionalDate(values.next_action_due_date) }
}

export function projectPayload(values: { name: string; price: string; deadline: string; status: string; completed_at: string }) {
  if (!projectStatuses.includes(values.status as ProjectStatus)) throw new Error('Situação inválida.')
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(values.price)) throw new Error('Preço inválido. Use até duas casas decimais.')
  return { name: textValue(values.name, 200, true)!, price: values.price, deadline: optionalDate(values.deadline), status: values.status as ProjectStatus, completed_at: values.status === 'concluido' ? optionalDate(values.completed_at) || localDate() : null }
}
