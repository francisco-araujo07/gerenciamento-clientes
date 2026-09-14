export const GUIDE_PATH_CANONICAL = '/guia-conversa'
export const GUIDE_PATH_LEGACY = '/guia-ligacao'
export const GUIDE_TITLE_ON = 'Guia de conversa'
export const GUIDE_TITLE_OFF = 'Guia de ligação'
export const APP_DOCUMENT_TITLE = 'GLC - Gerenciamento de Leads e Clientes'

export type GuideTab = 'ligacao' | 'whatsapp'

export function guidePageTitle(enabled: boolean) {
  return enabled ? GUIDE_TITLE_ON : GUIDE_TITLE_OFF
}

export function guideDocumentTitle(enabled: boolean) {
  return `${guidePageTitle(enabled)} — ${APP_DOCUMENT_TITLE}`
}

export function guideTabs(enabled: boolean): GuideTab[] {
  return enabled ? ['ligacao', 'whatsapp'] : ['ligacao']
}

export function defaultGuideTab(enabled: boolean): GuideTab {
  return enabled ? 'whatsapp' : 'ligacao'
}

export function normalizeAppPath(pathname: string) {
  const trimmed = pathname.trim()
  if (!trimmed || trimmed === '/') return '/'
  return trimmed.replace(/\/+$/, '') || '/'
}

export function isGuidePath(pathname: string) {
  const path = normalizeAppPath(pathname)
  return path === GUIDE_PATH_CANONICAL || path === GUIDE_PATH_LEGACY
}

export function canonicalGuidePath(enabled: boolean) {
  return enabled ? GUIDE_PATH_CANONICAL : GUIDE_PATH_LEGACY
}

export function shouldRedirectLegacyGuidePath(pathname: string, enabled: boolean) {
  return enabled && normalizeAppPath(pathname) === GUIDE_PATH_LEGACY
}

export function parseGuideTab(raw: string | null | undefined, enabled: boolean): GuideTab {
  if (!enabled) return 'ligacao'
  if (raw === 'ligacao') return 'ligacao'
  if (raw === 'whatsapp') return 'whatsapp'
  return defaultGuideTab(enabled)
}

export function displayGuideNodeTitle(title: string, enabled: boolean) {
  if (enabled && title === GUIDE_TITLE_OFF) return GUIDE_TITLE_ON
  return title
}
