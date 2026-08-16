import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

type LoginPageProps = {
  supabase: SupabaseClient
}

export function LoginPage({ supabase }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setIsSubmitting(false)

    if (error) {
      setErrorMessage('Não foi possível entrar. Confira o e-mail e a senha.')
    }
  }

  return (
    <main className="app-shell">
      <section className="welcome-card login-card" aria-labelledby="login-title">
        <p className="eyebrow">Acesso da equipe</p>
        <h1 id="login-title">Gerenciamento de clientes</h1>
        <p>Entre com seu e-mail e senha para acessar os dados da equipe.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            E-mail
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Senha
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}
