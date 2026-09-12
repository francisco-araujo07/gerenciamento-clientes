export function normalizeWhatsappDigits(value: string | null | undefined) {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 13) return null
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return null
}

export function maskWhatsapp(value: string | null | undefined) {
  if (!value?.trim()) return '—'
  const digits = value.replace(/\D/g, '')
  if (digits.length < 4) return '••••'
  return `••••-${digits.slice(-4)}`
}

export function toE164Br(value: string | null | undefined) {
  const digits = normalizeWhatsappDigits(value)
  return digits ? `+${digits}` : null
}

export function whatsappMeUrl(value: string | null | undefined, text?: string | null) {
  const digits = normalizeWhatsappDigits(value)
  if (!digits) return null
  const base = `https://wa.me/${digits}`
  const message = text?.trim()
  if (!message) return base
  return `${base}?text=${encodeURIComponent(message)}`
}
