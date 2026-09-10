import { useEffect, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { GitBranch, LayoutDashboard, UserCircle, UserRound, UsersRound } from 'lucide-react'
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

function App({ client = supabase }: { client?: SupabaseClient | null }) {
  const supabaseClient = client
  const [session, setSession] = useState<Session | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [page, setPage] = useState<'dashboard' | 'leads' | 'clients' | 'guide'>('dashboard')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [isImportingLeads, setIsImportingLeads] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

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
    void supabaseClient.auth.getSession().then(({ data, error }) => {
      if (!active || receivedEvent) return
      if (error) throw error
      window.clearTimeout(timer)
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
      <header className="app-header"><strong className="brand">Gerenciamento de clientes</strong><nav aria-label="Navegação principal"><button aria-current={page === 'dashboard' ? 'page' : undefined} className={page === 'dashboard' ? 'nav-active' : ''} onClick={() => { setPage('dashboard'); setSelectedLeadId(null); setIsImportingLeads(false); setSelectedClientId(null) }}><LayoutDashboard size={23} />Dashboard</button><button aria-current={page === 'leads' ? 'page' : undefined} className={page === 'leads' ? 'nav-active' : ''} onClick={() => { setPage('leads'); setSelectedLeadId(null); setIsImportingLeads(false); setSelectedClientId(null) }}><UserRound size={23} />Leads</button><button aria-current={page === 'clients' ? 'page' : undefined} className={page === 'clients' ? 'nav-active' : ''} onClick={() => { setPage('clients'); setSelectedLeadId(null); setIsImportingLeads(false); setSelectedClientId(null) }}><UsersRound size={23} />Clientes</button><button aria-current={page === 'guide' ? 'page' : undefined} className={page === 'guide' ? 'nav-active' : ''} onClick={() => { setPage('guide'); setSelectedLeadId(null); setIsImportingLeads(false); setSelectedClientId(null) }}><GitBranch size={23} />Guia de ligação</button></nav><div className="header-tools"><button className="icon-button" aria-label="Sair" disabled={signingOut} onClick={() => void signOut()}><UserCircle size={27} /></button></div></header>
      {sessionError && <p className="form-error" role="alert">{sessionError}</p>}
      {page === 'leads' && (selectedLeadId ? <LeadDetailsPage supabase={supabaseClient} leadId={selectedLeadId} onBack={() => setSelectedLeadId(null)} /> : isImportingLeads ? <CsvImportPage supabase={supabaseClient} onBack={() => setIsImportingLeads(false)} onFinished={() => setIsImportingLeads(false)} /> : <LeadsPage supabase={supabaseClient} onOpenLead={setSelectedLeadId} onImport={() => setIsImportingLeads(true)} />)}
      {page === 'clients' && (selectedClientId ? <ClientDetailsPage supabase={supabaseClient} clientId={selectedClientId} onBack={() => setSelectedClientId(null)} /> : <ClientsPage supabase={supabaseClient} onOpenClient={setSelectedClientId} />)}
      {page === 'dashboard' && <DashboardPage supabase={supabaseClient} onNavigate={(nextPage) => setPage(nextPage)} />}
      {page === 'guide' && <GuidePage />}
    </main>
  )
}

export default App
