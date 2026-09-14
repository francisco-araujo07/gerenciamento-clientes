import {
  GUIDE_PATH_CANONICAL,
  GUIDE_PATH_LEGACY,
  canonicalGuidePath,
  isGuidePath,
  normalizeAppPath,
  parseGuideTab,
  shouldRedirectLegacyGuidePath,
  type GuideTab,
} from '../features/guide/guide-chrome.ts'

export type AppPage = 'dashboard' | 'hoje' | 'leads' | 'clients' | 'guide' | 'wa-templates'

export type AppLocationState = {
  page: AppPage
  leadId: string | null
  guideTab: GuideTab
  replacePath: string | null
}

export function parseLeadId(raw: string | null | undefined) {
  const value = raw?.trim() ?? ''
  return value.length > 0 ? value : null
}

export function parseAppLocation(
  href: string,
  options: { guiaEnabled: boolean; cadenciaEnabled: boolean } = { guiaEnabled: false, cadenciaEnabled: false },
): AppLocationState {
  const url = new URL(href, 'https://glc.local')
  const path = normalizeAppPath(url.pathname)
  const leadId = parseLeadId(url.searchParams.get('leadId'))
  const guideTab = parseGuideTab(url.searchParams.get('tab'), options.guiaEnabled)

  if (isGuidePath(path)) {
    return {
      page: 'guide',
      leadId,
      guideTab,
      replacePath: shouldRedirectLegacyGuidePath(path, options.guiaEnabled) ? GUIDE_PATH_CANONICAL : null,
    }
  }
  if (path === '/hoje' && options.cadenciaEnabled) {
    return { page: 'hoje', leadId: null, guideTab, replacePath: null }
  }
  return { page: 'dashboard', leadId: null, guideTab, replacePath: null }
}

export function buildGuideHref(options: {
  enabled: boolean
  leadId?: string | null
  tab?: GuideTab
}) {
  const path = canonicalGuidePath(options.enabled)
  const params = new URLSearchParams()
  if (options.enabled && options.tab && options.tab !== 'whatsapp') params.set('tab', options.tab)
  if (!options.enabled && options.tab && options.tab !== 'ligacao') params.set('tab', options.tab)
  if (options.leadId?.trim()) params.set('leadId', options.leadId.trim())
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function buildHojeHref() {
  return '/hoje'
}

export { GUIDE_PATH_CANONICAL, GUIDE_PATH_LEGACY }
