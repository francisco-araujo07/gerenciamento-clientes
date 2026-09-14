import type { Lead } from '../../types/lead.ts'
import { addCalendarDays, dateLabel, recifeDate } from '../../utils/dates.ts'
import { buildWaTemplateContext } from '../whatsapp/templates.ts'

const MISSING = '—'

export type GuiaConversaVars = Record<string, string>

export function defaultGuiaHorarios(now = new Date()) {
  const tomorrow = addCalendarDays(recifeDate(now), 1)
  const date = dateLabel(tomorrow)
  return {
    horario_1: `amanhã, ${date}, às 10h`,
    horario_2: `amanhã, ${date}, às 16h`,
  }
}

export function isGuiaConversaVarPresent(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 && trimmed !== MISSING
}

export function buildGuiaConversaVars(
  lead: Pick<Lead, 'company_name' | 'responsible_name' | 'gatilho' | 'segment' | 'address' | 'prototipo_url'> &
    Partial<Pick<Lead, 'porteiro_nome' | 'decisor_nome'>> | null | undefined,
  seuNome: string | null | undefined,
  now = new Date(),
): GuiaConversaVars {
  const horarios = defaultGuiaHorarios(now)
  const context = lead
    ? buildWaTemplateContext(lead, seuNome)
    : {
      empresa: MISSING,
      responsavel: MISSING,
      gatilho: MISSING,
      segmento: MISSING,
      bairro_ou_cidade: MISSING,
      prototipo_url: MISSING,
      seu_nome: seuNome?.trim() || MISSING,
      porteiro_nome: MISSING,
      decisor_nome: MISSING,
    }
  return {
    ...context,
    horario_1: horarios.horario_1,
    horario_2: horarios.horario_2,
  }
}

export function interpolateGuiaConversa(corpo: string, vars: GuiaConversaVars) {
  const withBlocks = corpo.replace(/\{\{#se\s+([a-z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/se\}\}/gi, (_match, key: string, inner: string) => (
    isGuiaConversaVarPresent(vars[key.toLowerCase()]) ? inner : ''
  ))
  return withBlocks.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => {
    const value = vars[key.toLowerCase()]
    return value?.trim() ? value : MISSING
  })
}
