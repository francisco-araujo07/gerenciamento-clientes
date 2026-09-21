import { addCalendarDays, recifeDate } from '../../utils/dates.ts'
import {
  reuniaoResultados,
  type Lead,
  type LossReason,
  type ReuniaoResultado,
} from '../../types/lead.ts'

export const CONFIRMAR_REUNIAO_NEXT_ACTION = 'Confirmar reunião no WhatsApp'

export type { ReuniaoResultado }
export { reuniaoResultados }

export const reuniaoResultadoAcoes = [
  'compareceu',
  'no_show',
  'pediu_proposta',
  'fechou',
  'recusou',
  'reagendou',
] as const satisfies readonly Exclude<ReuniaoResultado, 'pendente'>[]

export type ReuniaoResultadoAcao = (typeof reuniaoResultadoAcoes)[number]

export const reuniaoResultadoLabels: Record<ReuniaoResultado, string> = {
  pendente: 'Pendente',
  compareceu: 'Compareceu',
  no_show: 'Não compareceu',
  pediu_proposta: 'Pediu proposta',
  fechou: 'Fechou',
  recusou: 'Recusou',
  reagendou: 'Reagendou',
}

export type ReuniaoResultadoInput = {
  resultado: ReuniaoResultadoAcao
  notas?: string | null
  reuniaoEm?: string | null
  reuniaoLink?: string | null
  reuniaoLocal?: string | null
  motivoPerda?: string | null
  motivoPerdaDetalhe?: string | null
}

export function isReuniaoResultado(value: string): value is ReuniaoResultado {
  return (reuniaoResultados as readonly string[]).includes(value)
}

export function isReuniaoResultadoAcao(value: string): value is ReuniaoResultadoAcao {
  return (reuniaoResultadoAcoes as readonly string[]).includes(value)
}

export function reuniaoResultadoOf(lead: Pick<Lead, 'reuniao_resultado'>): ReuniaoResultado {
  return lead.reuniao_resultado ?? 'pendente'
}

export function isReuniaoPendente(lead: Pick<Lead, 'status' | 'reuniao_resultado'>) {
  return lead.status === 'reuniao_marcada' && reuniaoResultadoOf(lead) === 'pendente'
}

/** D-1 = dia civil anterior a reuniao_em em America/Recife (não −24h exatos nem data UTC). */
export function reuniaoConfirmDueDate(reuniaoEm: string) {
  const date = new Date(reuniaoEm)
  if (!Number.isFinite(date.getTime())) throw new Error('Data e hora da reunião inválidas.')
  return addCalendarDays(recifeDate(date), -1)
}

export function reuniaoJaPassou(reuniaoEm: string | null | undefined, now = new Date()) {
  if (!reuniaoEm) return false
  const date = new Date(reuniaoEm)
  if (!Number.isFinite(date.getTime())) return false
  return date.getTime() <= now.getTime()
}

export type ReuniaoHojeCtas = {
  confirmar: boolean
  registrar: boolean
}

export function reuniaoHojeCtas(
  lead: Pick<Lead, 'status' | 'reuniao_em' | 'reuniao_resultado'>,
  now = new Date(),
): ReuniaoHojeCtas {
  if (!isReuniaoPendente(lead)) return { confirmar: false, registrar: false }
  if (reuniaoJaPassou(lead.reuniao_em, now)) return { confirmar: false, registrar: true }
  return { confirmar: true, registrar: false }
}

export type ReuniaoCountdown = {
  past: boolean
  label: string
  days: number
  hours: number
  minutes: number
}

export function reuniaoCountdown(reuniaoEm: string, now = new Date()): ReuniaoCountdown {
  const date = new Date(reuniaoEm)
  if (!Number.isFinite(date.getTime())) {
    return { past: false, label: 'Data inválida', days: 0, hours: 0, minutes: 0 }
  }
  const diff = date.getTime() - now.getTime()
  const past = diff <= 0
  const abs = Math.abs(diff)
  const days = Math.floor(abs / 86_400_000)
  const hours = Math.floor((abs % 86_400_000) / 3_600_000)
  const minutes = Math.floor((abs % 3_600_000) / 60_000)
  let span = `${minutes} min`
  if (days > 0) span = hours > 0 ? `${days} dia${days === 1 ? '' : 's'} e ${hours} h` : `${days} dia${days === 1 ? '' : 's'}`
  else if (hours > 0) span = `${hours} h e ${minutes} min`
  return {
    past,
    label: past ? `A reunião passou há ${span}` : `Faltam ${span}`,
    days,
    hours,
    minutes,
  }
}

export function validateReuniaoResultado(input: ReuniaoResultadoInput, lossReasons: readonly LossReason[]) {
  if (!isReuniaoResultadoAcao(input.resultado)) throw new Error('Informe o resultado da reunião.')
  if (input.resultado === 'reagendou' && !input.reuniaoEm?.trim()) {
    throw new Error('Informe a nova data e hora da reunião.')
  }
  if (input.resultado === 'recusou') {
    if (!input.motivoPerda || !(lossReasons as readonly string[]).includes(input.motivoPerda)) {
      throw new Error('Informe o motivo da perda.')
    }
    if (input.motivoPerda === 'outro' && !input.motivoPerdaDetalhe?.trim()) {
      throw new Error('Descreva o motivo da perda.')
    }
  }
}
