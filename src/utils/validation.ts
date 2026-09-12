import { isDate, localDate } from './dates.ts'
import { isGlcFunilStatusEnabled } from './feature-flags.ts'
import {
  createLeadStatuses,
  isLeadStatus,
  isLegacyLeadStatus,
  isLossReason,
  validateHttpsLink,
} from '../features/leads/lead-status.ts'
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

function assertCreateLeadStatus(status: string, funilEnabled: boolean, values: Record<string, unknown>) {
  if (status === 'negociacao') throw new Error('Não é possível criar lead em negociação.')
  if (funilEnabled) {
    if (!(createLeadStatuses as readonly string[]).includes(status)) {
      throw new Error('Status não permitido na criação do lead.')
    }
  } else if (!isLegacyLeadStatus(status)) {
    throw new Error('Status inválido.')
  }
  if (status === 'perdido') {
    const motivo = values.motivo_perda == null || values.motivo_perda === '' ? null : String(values.motivo_perda)
    if (!motivo || !isLossReason(motivo)) throw new Error('Informe o motivo da perda.')
    if (motivo === 'outro' && !String(values.motivo_perda_detalhe ?? '').trim()) {
      throw new Error('Descreva o motivo da perda.')
    }
  }
  if (status === 'reuniao_marcada' && (values.reuniao_em == null || values.reuniao_em === '')) {
    throw new Error('Informe a data da reunião.')
  }
}

export function leadPayload(values: Record<string, unknown>, funilEnabled = isGlcFunilStatusEnabled()) {
  const status = String(values.status)
  if (funilEnabled ? !isLeadStatus(status) : !isLegacyLeadStatus(status)) throw new Error('Status inválido.')
  assertCreateLeadStatus(status, funilEnabled, values)
  const payload = {
    ...contactPayload(values),
    status,
    source: textValue(values.source, 200),
    next_action: textValue(values.next_action, 2000),
    next_action_due_date: optionalDate(values.next_action_due_date),
  }
  if (!funilEnabled) return payload
  const motivo = values.motivo_perda == null || values.motivo_perda === '' ? null : String(values.motivo_perda)
  if (motivo && !isLossReason(motivo)) throw new Error('Motivo da perda inválido.')
  const reuniaoLink = textValue(values.reuniao_link, 2048)
  if (reuniaoLink) validateHttpsLink(reuniaoLink, 'O link da reunião')
  return {
    ...payload,
    motivo_perda: motivo,
    motivo_perda_detalhe: textValue(values.motivo_perda_detalhe, 2000),
    reuniao_em: values.reuniao_em == null || values.reuniao_em === '' ? null : String(values.reuniao_em),
    reuniao_link: reuniaoLink,
  }
}

export function leadUpdatePayload(values: Record<string, unknown>) {
  return {
    ...contactPayload(values),
    source: textValue(values.source, 200),
    next_action: textValue(values.next_action, 2000),
    next_action_due_date: optionalDate(values.next_action_due_date),
  }
}

export function projectPayload(values: { name: string; price: string; deadline: string; status: string; completed_at: string }) {
  if (!projectStatuses.includes(values.status as ProjectStatus)) throw new Error('Situação inválida.')
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(values.price)) throw new Error('Preço inválido. Use até duas casas decimais.')
  return { name: textValue(values.name, 200, true)!, price: values.price, deadline: optionalDate(values.deadline), status: values.status as ProjectStatus, completed_at: values.status === 'concluido' ? optionalDate(values.completed_at) || localDate() : null }
}
