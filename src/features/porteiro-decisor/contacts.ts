import {
  contatoPrincipalValues,
  type ContatoPrincipal,
  type Lead,
  type LeadStatus,
} from '../../types/lead.ts'
import { toE164Br } from '../cadencia/whatsapp.ts'

export type WaDestinatario = 'principal' | 'porteiro' | 'decisor'

export const waDestinatarioLabels: Record<WaDestinatario, string> = {
  principal: 'Principal',
  porteiro: 'Porteiro',
  decisor: 'Decisor',
}

export function isContatoPrincipal(value: string): value is ContatoPrincipal {
  return (contatoPrincipalValues as readonly string[]).includes(value)
}

export function destinatarioFromContatoPrincipal(value: ContatoPrincipal | null | undefined): WaDestinatario {
  if (value === 'porteiro') return 'porteiro'
  if (value === 'decisor') return 'decisor'
  return 'principal'
}

export function whatsappForDestinatario(
  lead: Pick<Lead, 'whatsapp' | 'porteiro_whatsapp' | 'decisor_whatsapp'>,
  destinatario: WaDestinatario,
) {
  if (destinatario === 'porteiro') return lead.porteiro_whatsapp
  if (destinatario === 'decisor') return lead.decisor_whatsapp
  return lead.whatsapp
}

export function nomeForDestinatario(
  lead: Pick<Lead, 'responsible_name' | 'porteiro_nome' | 'decisor_nome'>,
  destinatario: WaDestinatario,
) {
  if (destinatario === 'porteiro') return lead.porteiro_nome
  if (destinatario === 'decisor') return lead.decisor_nome
  return lead.responsible_name
}

export function principalWhatsapp(
  lead: Pick<Lead, 'whatsapp' | 'porteiro_whatsapp' | 'decisor_whatsapp' | 'contato_principal'>,
) {
  return whatsappForDestinatario(lead, destinatarioFromContatoPrincipal(lead.contato_principal))
}

export function validWaDestinatarios(
  lead: Pick<Lead, 'whatsapp' | 'porteiro_whatsapp' | 'decisor_whatsapp'>,
) {
  return (['principal', 'porteiro', 'decisor'] as const).filter((item) => Boolean(toE164Br(whatsappForDestinatario(lead, item))))
}

export function defaultWaDestinatario(
  lead: Pick<Lead, 'whatsapp' | 'porteiro_whatsapp' | 'decisor_whatsapp' | 'contato_principal'>,
) {
  const valid = validWaDestinatarios(lead)
  const preferred = destinatarioFromContatoPrincipal(lead.contato_principal)
  if (valid.includes(preferred)) return preferred
  return valid[0] ?? null
}

export function contactSpotlight(
  lead: Pick<Lead, 'status' | 'porteiro_nome' | 'decisor_nome'>,
  status: LeadStatus = lead.status,
) {
  if (status === 'contato_porteiro' && !lead.porteiro_nome?.trim()) {
    return 'Lead em contato com o porteiro, mas o nome do porteiro ainda não foi preenchido.'
  }
  if (status === 'falando_decisor' && !lead.decisor_nome?.trim()) {
    return 'Lead falando com o decisor, mas o nome do decisor ainda não foi preenchido.'
  }
  return null
}

export function displayContactName(
  lead: Pick<Lead, 'responsible_name' | 'porteiro_nome' | 'decisor_nome' | 'contato_principal'>,
) {
  return nomeForDestinatario(lead, destinatarioFromContatoPrincipal(lead.contato_principal))?.trim() || null
}
