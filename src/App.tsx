import { useEffect, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { CalendarClock, GitBranch, LayoutDashboard, MessageCircle, UserCircle, UserRound, UsersRound } from 'lucide-react'
import './App.css'
import { supabase } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { LeadsPage } from './pages/LeadsPage'
import { LeadDetailsPage } from './pages/LeadDetailsPage'
import { CsvImportPage } from './pages/CsvImportPage'
import { ClientsPage } from './pages/ClientsPage'
import { ClientDetailsPage } from './pages/ClientDetailsPage'
import { DashboardPage } from './pages/DashboardPage'
import { GuidePage } from './pages/GuidePage'
import { HojePage } from './pages/HojePage'
import { WaTemplatesPage } from './pages/WaTemplatesPage'
import { guidePageTitle, type GuideTab } from './features/guide/guide-chrome'
import { isGlcFilaCadenciaEnabled, isGlcGuiaConversaEnabled, isGlcKitWhatsappEnabled } from './utils/feature-flags'
import { buildGuideHref, buildHojeHref, parseAppLocation, type AppPage } from './utils/app-location'

function readInitialLocation(guiaEnabled: boolean, cadenciaEnabled: boolean) {
  if (typeof window === 'undefined') {
    return { page: 'dashboard' as AppPage, leadId: null as string | null, guideTab: (guiaEnabled ? 'whatsapp' : 'ligacao') as GuideTab, replacePath: null as string | null }
  }
  return parseAppLocation(window.location.href, { guiaEnabled, cadenciaEnabled })
}

function App({ client = supabase }: { client?: SupabaseClient | null }) {
  const supabaseClient = client
  const cadenciaEnabled = isGlcFilaCadenciaEnabled()
  const kitWhatsappEnabled = isGlcKitWhatsappEnabled()
  const guiaEnabled = isGlcGuiaConversaEnabled()
  const initialLocation = readInitialLocation(guiaEnabled, cadenciaEnabled)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [page, setPage] = useState<AppPage>(initialLocation.page)
  const [guideTab, setGuideTab] = useState<GuideTab>(initialLocation.guideTab)
  const [guideLeadId, setGuideLeadId] = useState<string | null>(initialLocation.leadId)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [isImportingLeads, setIsImportingLeads] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const guideLabel = guidePageTitle(guiaEnabled)

  function syncPath(nextPage: AppPage, next: { leadId?: string | null; tab?: GuideTab; replace?: boolean } = {}) {
    if (typeof window === 'undefined') return
    const nextLeadId = next.leadId === undefined ? guideLeadId : next.leadId
    const nextTab = next.tab ?? guideTab
    let href = '/'
    if (nextPage === 'guide') href = buildGuideHref({ enabled: guiaEnabled, leadId: nextLeadId, tab: nextTab })
    else if (nextPage === 'hoje' && cadenciaEnabled) href = buildHojeHref()
    const method = next.replace ? 'replaceState' : 'pushState'
    const current = `${window.location.pathname}${window.location.search}`
    if (current !== href) window.history[method](null, '', href)
  }

  function goTo(nextPage: AppPage, extra: { leadId?: string | null; tab?: GuideTab; replace?: boolean } = {}) {
    setPage(nextPage)
    setSelectedLeadId(null)
    setIsImportingLeads(false)
    setSelectedClientId(null)
    if (extra.tab) setGuideTab(extra.tab)
    if (extra.leadId !== undefined) setGuideLeadId(extra.leadId)
    if (nextPage === 'guide' && !extra.tab && guiaEnabled) setGuideTab('whatsapp')
    syncPath(nextPage, {
      ...extra,
      tab: extra.tab ?? (nextPage === 'guide' && guiaEnabled ? 'whatsapp' : extra.tab),
    })
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const parsed = parseAppLocation(window.location.href, { guiaEnabled, cadenciaEnabled })
    if (parsed.replacePath) {
      window.history.replaceState(null, '', buildGuideHref({ enabled: true, leadId: parsed.leadId, tab: parsed.guideTab }))
    }
    const onPop = () => {
      const next = parseAppLocation(window.location.href, { guiaEnabled, cadenciaEnabled })
      setPage(next.page)
      setGuideTab(next.guideTab)
      setGuideLeadId(next.leadId)
      setSelectedLeadId(null)
      setSelectedClientId(null)
      setIsImportingLeads(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [cadenciaEnabled, guiaEnabled])

  useEffect(() => {
    if (!supabaseClient) {
      setIsLoadingSession(false)
      return
    }

    let active = true
    let receivedEvent = false
    const timer = window.setTimeout(() => {
      if (active) { setSessionError('O acesso demorou mais que o esperado. Verifique a conexão e recarregue.'); setIsLoadingSession(false) }
    }, 25000)
    const rejectAnonymousSession = (nextSession: Session | null) => {
      if (!nextSession?.user.is_anonymous) return false
      setSession(null)
      setSessionError('')
      setIsLoadingSession(false)
      window.setTimeout(() => { void supabaseClient.auth.signOut({ scope: 'local' }) }, 0)
      return true
    }
    void supabaseClient.auth.getSession().then(({ data, error }) => {
      if (!active || receivedEvent) return
      if (error) throw error
      window.clearTimeout(timer)
      if (rejectAnonymousSession(data.session)) return
      setSession(data.session)
      setIsLoadingSession(false)
    }).catch(() => {
      if (!active || receivedEvent) return
      window.clearTimeout(timer)
      setSessionError('Não foi possível verificar o acesso. Verifique a conexão e recarregue.')
      setIsLoadingSession(false)
    })

    const { data: listener } = supabaseClient.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return
        receivedEvent = true
        window.clearTimeout(timer)
        if (rejectAnonymousSession(nextSession)) return
        setSessionError('')
        setSession(nextSession)
        setIsLoadingSession(false)
        if (!nextSession) { setPage('dashboard'); setSelectedLeadId(null); setSelectedClientId(null); setIsImportingLeads(false) }
      },
    )

    return () => { active = false; window.clearTimeout(timer); listener.subscription.unsubscribe() }
  }, [supabaseClient])

  async function signOut() {
    if (!supabaseClient || signingOut) return
    setSigningOut(true)
    try { const { error } = await supabaseClient.auth.signOut(); if (error) throw error }
    catch { setSessionError('Não foi possível sair. Verifique a conexão e tente novamente.') }
    finally { setSigningOut(false) }
  }

  if (!supabaseClient) {
    return (
      <main className="app-shell">
        <section className="welcome-card" aria-labelledby="setup-title">
          <p className="eyebrow">Configuração necessária</p>
          <h1 id="setup-title">Conecte o Supabase</h1>
          <p>A configuração de acesso está ausente ou inválida. Contate o responsável pela aplicação.</p>
        </section>
      </main>
    )
  }

  if (isLoadingSession) {
    return <main className="loading-screen">Carregando acesso…</main>
  }

  if (sessionError && !session) return <main className="app-shell"><section className="welcome-card" role="alert"><h1>Falha ao verificar acesso</h1><p>{sessionError}</p><button onClick={() => window.location.reload()}>Tentar novamente</button></section></main>

  if (!session) {
    return <LoginPage supabase={supabaseClient} />
  }

  return (
    <main className="authenticated-app" key={session.user.id}>
      <header className="app-header"><strong className="brand">Gerenciamento de clientes</strong><nav aria-label="Navegação principal"><button aria-current={page === 'dashboard' ? 'page' : undefined} className={page === 'dashboard' ? 'nav-active' : ''} onClick={() => goTo('dashboard')}><LayoutDashboard size={23} />Dashboard</button>{cadenciaEnabled && <button aria-current={page === 'hoje' ? 'page' : undefined} className={page === 'hoje' ? 'nav-active' : ''} onClick={() => goTo('hoje')}><CalendarClock size={23} />Hoje</button>}<button aria-current={page === 'leads' ? 'page' : undefined} className={page === 'leads' ? 'nav-active' : ''} onClick={() => goTo('leads')}><UserRound size={23} />Leads</button><button aria-current={page === 'clients' ? 'page' : undefined} className={page === 'clients' ? 'nav-active' : ''} onClick={() => goTo('clients')}><UsersRound size={23} />Clientes</button><button aria-current={page === 'guide' ? 'page' : undefined} className={page === 'guide' ? 'nav-active' : ''} onClick={() => goTo('guide', { tab: guiaEnabled ? 'whatsapp' : 'ligacao' })}><GitBranch size={23} />{guideLabel}</button>{kitWhatsappEnabled && <button aria-current={page === 'wa-templates' ? 'page' : undefined} className={page === 'wa-templates' ? 'nav-active' : ''} onClick={() => goTo('wa-templates')}><MessageCircle size={23} />Templates WA</button>}</nav><div className="header-tools"><button className="icon-button" aria-label="Sair" disabled={signingOut} onClick={() => void signOut()}><UserCircle size={27} /></button></div></header>
      {sessionError && <p className="form-error" role="alert">{sessionError}</p>}
      {page === 'hoje' && cadenciaEnabled && (selectedLeadId ? <LeadDetailsPage supabase={supabaseClient} leadId={selectedLeadId} onBack={() => setSelectedLeadId(null)} /> : <HojePage supabase={supabaseClient} onOpenLead={setSelectedLeadId} />)}
      {page === 'leads' && (selectedLeadId ? <LeadDetailsPage supabase={supabaseClient} leadId={selectedLeadId} onBack={() => setSelectedLeadId(null)} /> : isImportingLeads ? <CsvImportPage supabase={supabaseClient} onBack={() => setIsImportingLeads(false)} onFinished={() => setIsImportingLeads(false)} /> : <LeadsPage supabase={supabaseClient} onOpenLead={setSelectedLeadId} onImport={() => setIsImportingLeads(true)} />)}
      {page === 'clients' && (selectedClientId ? <ClientDetailsPage supabase={supabaseClient} clientId={selectedClientId} onBack={() => setSelectedClientId(null)} /> : <ClientsPage supabase={supabaseClient} onOpenClient={setSelectedClientId} />)}
      {page === 'dashboard' && <DashboardPage supabase={supabaseClient} onNavigate={(nextPage) => goTo(nextPage)} />}
      {page === 'guide' && (
        <GuidePage
          supabase={supabaseClient}
          leadId={guideLeadId}
          tab={guideTab}
          onLeadIdChange={(id) => {
            setGuideLeadId(id)
            syncPath('guide', { leadId: id, replace: true })
          }}
          onTabChange={(nextTab) => {
            setGuideTab(nextTab)
            syncPath('guide', { tab: nextTab, replace: true })
          }}
          onOpenHoje={cadenciaEnabled ? () => goTo('hoje') : undefined}
        />
      )}
      {page === 'wa-templates' && kitWhatsappEnabled && <WaTemplatesPage supabase={supabaseClient} />}
    </main>
  )
}

export default App
