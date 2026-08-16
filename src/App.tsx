import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Bell, CircleHelp, LayoutDashboard, UserCircle, UserRound, UsersRound } from 'lucide-react'
import './App.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { LeadsPage } from './pages/LeadsPage'
import { LeadDetailsPage } from './pages/LeadDetailsPage'
import { CsvImportPage } from './pages/CsvImportPage'
import { ClientsPage } from './pages/ClientsPage'
import { ClientDetailsPage } from './pages/ClientDetailsPage'

function App() {
  const supabaseClient = supabase
  const [session, setSession] = useState<Session | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [page, setPage] = useState<'dashboard' | 'leads' | 'clients'>('leads')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [isImportingLeads, setIsImportingLeads] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  useEffect(() => {
    if (!supabaseClient) {
      setIsLoadingSession(false)
      return
    }

    void supabaseClient.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoadingSession(false)
    })

    const { data: listener } = supabaseClient.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
        setIsLoadingSession(false)
      },
    )

    return () => listener.subscription.unsubscribe()
  }, [supabaseClient])

  if (!isSupabaseConfigured || !supabaseClient) {
    return (
      <main className="app-shell">
        <section className="welcome-card" aria-labelledby="setup-title">
          <p className="eyebrow">Configuração necessária</p>
          <h1 id="setup-title">Conecte o Supabase</h1>
          <p>Preencha as variáveis locais para habilitar o acesso ao sistema.</p>
        </section>
      </main>
    )
  }

  if (isLoadingSession) {
    return <main className="loading-screen">Carregando acesso…</main>
  }

  if (!session) {
    return <LoginPage supabase={supabaseClient} />
  }

  return (
    <main className="authenticated-app">
      <header className="app-header"><strong className="brand">Gerenciamento de clientes</strong><nav aria-label="Navegação principal"><button className={page === 'dashboard' ? 'nav-active' : ''} onClick={() => { setPage('dashboard'); setSelectedLeadId(null); setIsImportingLeads(false); setSelectedClientId(null) }}><LayoutDashboard size={23} />Dashboard</button><button className={page === 'leads' ? 'nav-active' : ''} onClick={() => { setPage('leads'); setSelectedLeadId(null); setIsImportingLeads(false); setSelectedClientId(null) }}><UserRound size={23} />Leads</button><button className={page === 'clients' ? 'nav-active' : ''} onClick={() => { setPage('clients'); setSelectedLeadId(null); setIsImportingLeads(false); setSelectedClientId(null) }}><UsersRound size={23} />Clientes</button></nav><div className="header-tools"><button className="icon-button" aria-label="Notificações"><Bell size={23} /></button><button className="icon-button" aria-label="Ajuda"><CircleHelp size={23} /></button><button className="icon-button" aria-label="Sair" onClick={() => void supabaseClient.auth.signOut()}><UserCircle size={27} /></button></div></header>
      {page === 'leads' && (selectedLeadId ? <LeadDetailsPage supabase={supabaseClient} leadId={selectedLeadId} onBack={() => setSelectedLeadId(null)} /> : isImportingLeads ? <CsvImportPage supabase={supabaseClient} onBack={() => setIsImportingLeads(false)} onFinished={() => setIsImportingLeads(false)} /> : <LeadsPage supabase={supabaseClient} onOpenLead={setSelectedLeadId} onImport={() => setIsImportingLeads(true)} />)}
      {page === 'clients' && (selectedClientId ? <ClientDetailsPage supabase={supabaseClient} clientId={selectedClientId} onBack={() => setSelectedClientId(null)} /> : <ClientsPage supabase={supabaseClient} onOpenClient={setSelectedClientId} />)}
      {page === 'dashboard' && <section className="page-content placeholder-page"><p className="eyebrow">Em construção</p><h1>Dashboard</h1><p>Esta área será construída nas próximas etapas do MVP.</p></section>}
    </main>
  )
}

export default App
