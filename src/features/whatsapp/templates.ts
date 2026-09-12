import type { Lead, LeadStatus } from '../../types/lead.ts'
import {
  waTemplateEtapas,
  type WaTemplate,
  type WaTemplateContext,
  type WaTemplateEtapa,
  type WaTemplateVariable,
} from '../../types/whatsapp.ts'
import { whatsappMeUrl } from '../cadencia/whatsapp.ts'

export const statusToWaEtapa: Record<LeadStatus, WaTemplateEtapa> = {
  novo: 'abertura',
  contato_porteiro: 'follow_up',
  encaminhado: 'case_nicho',
  falando_decisor: 'prototipo',
  reuniao_marcada: 'prototipo',
  proposta_enviada: 'prototipo',
  negociacao: 'follow_up',
  pausado_60d: 'follow_up',
  perdido: 'break_up',
  convertido: 'prototipo',
}

const MISSING = '—'

export function isWaTemplateEtapa(value: string): value is WaTemplateEtapa {
  return (waTemplateEtapas as readonly string[]).includes(value)
}

export function bairroOuCidadeFromAddress(address: string | null | undefined) {
  if (!address?.trim()) return MISSING
  const cleaned = address.trim()
  const dashParts = cleaned.split(/\s+-\s+/)
  if (dashParts.length >= 2) {
    const beforeUf = dashParts[dashParts.length - 2] ?? ''
    const lastComma = beforeUf.split(',').map((part) => part.trim()).filter(Boolean)
    return lastComma[lastComma.length - 1] || MISSING
  }
  const commaParts = cleaned.split(',').map((part) => part.trim()).filter(Boolean)
  if (commaParts.length >= 2) return commaParts[commaParts.length - 1] ?? MISSING
  return cleaned.length > 80 ? MISSING : cleaned
}

export function displayNameFromUser(user: {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
} | null | undefined) {
  const meta = user?.user_metadata ?? {}
  for (const key of ['full_name', 'name', 'display_name']) {
    const value = meta[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  const email = user?.email?.trim()
  if (email) return email.split('@')[0] || MISSING
  return MISSING
}

export function buildWaTemplateContext(
  lead: Pick<Lead, 'company_name' | 'responsible_name' | 'gatilho' | 'segment' | 'address' | 'prototipo_url'>,
  seuNome: string | null | undefined,
): WaTemplateContext {
  const value = (raw: string | null | undefined) => raw?.trim() || MISSING
  return {
    empresa: value(lead.company_name),
    responsavel: value(lead.responsible_name),
    gatilho: value(lead.gatilho),
    segmento: value(lead.segment),
    bairro_ou_cidade: bairroOuCidadeFromAddress(lead.address),
    prototipo_url: value(lead.prototipo_url),
    seu_nome: value(seuNome),
    porteiro_nome: MISSING,
    decisor_nome: MISSING,
  }
}

export function interpolateWaTemplate(corpo: string, vars: Partial<Record<WaTemplateVariable | string, string>>) {
  return corpo.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => {
    const value = vars[key.toLowerCase()]
    return value?.trim() ? value : MISSING
  })
}

export function suggestWaTemplate(
  templates: readonly WaTemplate[],
  status: LeadStatus,
  onlyActive = true,
) {
  const pool = onlyActive ? templates.filter((item) => item.ativo) : [...templates]
  const etapa = statusToWaEtapa[status] ?? 'abertura'
  return pool.find((item) => item.etapa === etapa) ?? pool[0] ?? null
}

export function buildWhatsappMeUrl(whatsapp: string | null | undefined, message: string) {
  return whatsappMeUrl(whatsapp, message)
}
