export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function dateLabel(value: string | null) {
  if (!value || !isDate(value)) return 'Sem data válida'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}

export const RECIFE_TIME_ZONE = 'America/Recife'

function recifePart(date: Date, type: Intl.DateTimeFormatPartTypes) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RECIFE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).find((part) => part.type === type)?.value ?? ''
}

export function recifeDate(date = new Date()) {
  return `${recifePart(date, 'year')}-${recifePart(date, 'month')}-${recifePart(date, 'day')}`
}

export function addCalendarDays(value: string, days: number) {
  if (!isDate(value)) throw new Error('Data inválida. Use AAAA-MM-DD.')
  const [year, month, day] = value.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return next.toISOString().slice(0, 10)
}

export function suggestedPauseAction(now = new Date()) {
  return {
    next_action: 'Retomar cadência',
    next_action_due_date: addCalendarDays(recifeDate(now), 60),
  }
}

export function toDateTimeLocal(value: string | null, timeZone = RECIFE_TIME_ZONE) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export function recifeDateTimeToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Data e hora da reunião inválidas.')
  const iso = `${value}:00-03:00`
  if (!Number.isFinite(new Date(iso).getTime())) throw new Error('Data e hora da reunião inválidas.')
  return iso
}

export function dateTimeLabel(value: string | null, timeZone = RECIFE_TIME_ZONE) {
  if (!value) return 'Sem data válida'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Sem data válida'
  return new Intl.DateTimeFormat('pt-BR', { timeZone, dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export type RevenuePeriod = 'semana' | 'mes' | 'total'
export function revenueTotal(projects: { price: number | string; completed_at: string | null }[], period: RevenuePeriod, now = new Date()) {
  const start = new Date(now)
  if (period === 'semana') start.setDate(now.getDate() - now.getDay())
  if (period === 'mes') start.setDate(1)
  const from = localDate(start)
  const to = localDate(now)
  let cents = 0
  for (const project of projects) {
    if (period !== 'total' && (!project.completed_at || project.completed_at < from || project.completed_at > to)) continue
    const amount = Number(project.price)
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Valor de projeto inválido.')
    cents += Math.round(amount * 100)
    if (!Number.isSafeInteger(cents)) throw new Error('Total excede a precisão suportada.')
  }
  return cents / 100
}
