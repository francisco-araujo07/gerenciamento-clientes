import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { console.error('Falha de renderização da aplicação.') }
  render() {
    if (this.state.failed) return <main className="app-shell"><section className="welcome-card" role="alert"><h1>Não foi possível abrir esta tela</h1><p>Recarregue para tentar novamente. Alterações não salvas podem ser perdidas.</p><button onClick={() => window.location.reload()}>Recarregar aplicação</button></section></main>
    return this.props.children
  }
}
