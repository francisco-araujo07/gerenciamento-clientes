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
