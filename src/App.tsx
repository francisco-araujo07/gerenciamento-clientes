import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { LeadsPage } from './pages/LeadsPage'
import { LeadDetailsPage } from './pages/LeadDetailsPage'

function App() {
  const supabaseClient = supabase
  const [session, setSession] = useState<Session | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [page, setPage] = useState<'dashboard' | 'leads' | 'clients'>('leads')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)

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
      <header className="app-header"><strong>Gerenciamento de clientes</strong><nav aria-label="Navegação principal"><button className={page === 'dashboard' ? 'nav-active' : ''} onClick={() => { setPage('dashboard'); setSelectedLeadId(null) }}>Dashboard</button><button className={page === 'leads' ? 'nav-active' : ''} onClick={() => { setPage('leads'); setSelectedLeadId(null) }}>Leads</button><button className={page === 'clients' ? 'nav-active' : ''} onClick={() => { setPage('clients'); setSelectedLeadId(null) }}>Clientes</button></nav><button className="button-link" onClick={() => void supabaseClient.auth.signOut()}>Sair</button></header>
      {page === 'leads' && (selectedLeadId ? <LeadDetailsPage supabase={supabaseClient} leadId={selectedLeadId} onBack={() => setSelectedLeadId(null)} /> : <LeadsPage supabase={supabaseClient} onOpenLead={setSelectedLeadId} />)}
      {page !== 'leads' && <section className="page-content placeholder-page"><p className="eyebrow">Em construção</p><h1>{page === 'dashboard' ? 'Dashboard' : 'Clientes'}</h1><p>Esta área será construída nas próximas etapas do MVP.</p></section>}
    </main>
  )
}

export default App
