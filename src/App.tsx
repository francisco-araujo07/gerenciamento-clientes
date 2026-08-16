import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'

function App() {
  const supabaseClient = supabase
  const [session, setSession] = useState<Session | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)

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
    <main className="app-shell">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <p className="eyebrow">Base do MVP</p>
        <h1 id="welcome-title">Gerenciamento de clientes</h1>
        <p>
          Você está conectado. O painel de leads e clientes será construído nas
          próximas etapas.
        </p>
        <button type="button" onClick={() => void supabaseClient.auth.signOut()}>
          Sair
        </button>
      </section>
    </main>
  )
}

export default App
