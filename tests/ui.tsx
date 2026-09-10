// Fixture de desenvolvimento: não faz parte do build e não consulta o Supabase.
import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import App from '../src/App'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import '../src/index.css'

const fail = new URLSearchParams(location.search).get('fail')
const base = { responsible_name: 'Pessoa de teste', whatsapp: '', email: '', instagram: '', address: '', google_maps_url: '', segment: 'Teste', notes: 'Somente dados fictícios.', created_at: '', updated_at: '' }
const records: Record<string, Record<string, unknown>[]> = {
  leads: [{ ...base, id: 'lead-test', company_name: 'Empresa fictícia para validação da interface', status: 'novo', source: '', next_action: 'Retorno de teste', next_action_due_date: '2026-09-01' }],
  clients: [{ ...base, id: 'client-test', company_name: 'Cliente fictício', lead_id: null }],
  projects: [{ id: 'project-test', client_id: 'client-test', name: 'Projeto demonstrativo', price: 1234.56, status: 'concluido', completed_at: '2026-09-01', deadline: '2026-09-01' }],
}
function query(table: string) {
  let data = [...(records[table] ?? [])]
  let single = false
  let mutation = false
  let from = 0; let to = Infinity
  const builder = {
    select() { return builder }, order() { return builder },
    eq(key: string, value: unknown) { data = data.filter((row) => row[key] === value); return builder },
    range(a: number, b: number) { from = a; to = b; return builder },
    single() { single = true; return builder },
    update() { mutation = true; return builder }, delete() { mutation = true; return builder }, insert() { mutation = true; return builder },
    then(resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) {
      return Promise.resolve({ data: single ? data[0] : data.slice(from, to + 1), count: data.length, error: (fail === 'data' || (fail === 'write' && mutation)) ? new Error('Falha simulada') : null }).then(resolve, reject)
    },
  }
  return builder
}
const fixture = {
  auth: {
    getSession: async () => { if (fail === 'session') throw new Error('Falha simulada'); return { data: { session: fail === 'login' ? null : { user: { id: 'test-user' } } }, error: null } },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => { throw new Error('Login de teste indisponível') },
    signOut: async () => ({ error: new Error('Falha simulada') }),
  },
  from: query,
} as unknown as SupabaseClient
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App client={fixture} /></ErrorBoundary></StrictMode>)
