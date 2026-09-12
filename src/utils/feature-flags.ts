const ENABLED_VALUES = new Set(['1', 'true', 'on', 'yes'])

export function parseFeatureFlag(raw: unknown) {
  return typeof raw === 'string' && ENABLED_VALUES.has(raw.trim().toLowerCase())
}

export function isGlcFunilStatusEnabled(raw?: unknown) {
  if (typeof raw !== 'undefined') return parseFeatureFlag(raw)
  try {
    return parseFeatureFlag(import.meta.env?.VITE_FF_GLC_FUNIL_STATUS)
  } catch {
    return false
  }
}

export function isGlcFilaCadenciaEnabled(raw?: unknown) {
  if (typeof raw !== 'undefined') return parseFeatureFlag(raw)
  try {
    return parseFeatureFlag(import.meta.env?.VITE_FF_GLC_FILA_CADENCIA)
  } catch {
    return false
  }
}
