// Fixture de desenvolvimento: não faz parte do build e não consulta o Supabase.
import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import App from '../src/App'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import '../src/index.css'

const fail = new URLSearchParams(location.search).get('fail')
const now = '2026-09-12T12:00:00+00:00'
const base = {
  responsible_name: 'Pessoa de teste',
  whatsapp: '',
  email: '',
  instagram: '',
  address: '',
  google_maps_url: '',
  segment: 'Teste',
  notes: 'Somente dados fictícios.',
  source: '',
  next_action: 'Retorno de teste',
  next_action_due_date: '2026-09-01',
  touches_sem_resposta: 0,
  motivo_perda: null,
  motivo_perda_detalhe: null,
  reuniao_em: null,
  reuniao_link: null,
  reuniao_local: null,
  reuniao_resultado: 'pendente',
  reuniao_notas: null,
  created_at: now,
  updated_at: now,
}
const records: Record<string, Record<string, unknown>[]> = {
  leads: [
    { ...base, id: 'lead-test', company_name: 'Empresa fictícia para validação da interface', status: 'novo', whatsapp: '81988887777' },
    { ...base, id: 'lead-neg', company_name: 'Padaria legado em negociação', status: 'negociacao', next_action: 'Reclassificar funil' },
    { ...base, id: 'lead-prop', company_name: 'Clínica com proposta enviada', status: 'proposta_enviada', next_action: 'Cobrar retorno', next_action_due_date: '2026-09-12' },
    { ...base, id: 'lead-lost', company_name: 'Loja perdida', status: 'perdido', motivo_perda: 'preco', next_action: null, next_action_due_date: null },
    { ...base, id: 'lead-sem-data', company_name: 'Studio novo sem próxima ação', status: 'novo', next_action: null, next_action_due_date: null },
  ],
  clients: [{ ...base, id: 'client-test', company_name: 'Cliente fictício', lead_id: null }],
  projects: [{ id: 'project-test', client_id: 'client-test', name: 'Projeto demonstrativo', price: 1234.56, status: 'concluido', completed_at: '2026-09-01', deadline: '2026-09-01' }],
  lead_status_history: [],
  lead_atividade: [],
}
function query(table: string) {
  let data = [...(records[table] ?? [])]
  let single = false
  let mutation = false
  let from = 0; let to = Infinity
  const builder = {
    select() { return builder }, order() { return builder },
    eq(key: string, value: unknown) { data = data.filter((row) => row[key] === value); return builder },
    in(key: string, values: unknown[]) { data = data.filter((row) => values.includes(row[key])); return builder },
    not() { return builder },
    lt() { return builder },
    lte(key: string, value: unknown) { data = data.filter((row) => String(row[key] ?? '') <= String(value)); return builder },
    is(key: string, value: unknown) { data = data.filter((row) => row[key] == value); return builder },
    or() { return builder },
    range(a: number, b: number) { from = a; to = b; return builder },
    single() { single = true; return builder },
    update(values: Record<string, unknown>) {
      mutation = true
      data = data.map((row) => ({ ...row, ...values, updated_at: now }))
      const stored = records[table]
      if (stored) {
        for (const row of data) {
          const index = stored.findIndex((item) => item.id === row.id)
          if (index >= 0) stored[index] = row
        }
      }
      return builder
    },
    delete() { mutation = true; return builder },
    insert() { mutation = true; return builder },
    then(resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) {
      return Promise.resolve({ data: single ? data[0] : data.slice(from, to + 1), count: data.length, error: (fail === 'data' || (fail === 'write' && mutation)) ? new Error('Falha simulada') : null }).then(resolve, reject)
    },
  }
  return builder
}
function rpc(name: string, args: Record<string, unknown>) {
  if (name === 'update_lead_status') {
    const lead = records.leads.find((row) => row.id === args.p_lead_id)
    if (!lead) return Promise.resolve({ data: null, error: new Error('Lead não encontrado.') })
    const fromStatus = String(lead.status)
    lead.status = args.p_to_status
    lead.updated_at = now
    if (args.p_motivo_perda) lead.motivo_perda = args.p_motivo_perda
    if (args.p_motivo_perda_detalhe) lead.motivo_perda_detalhe = args.p_motivo_perda_detalhe
    if (args.p_reuniao_em) lead.reuniao_em = args.p_reuniao_em
    if (args.p_reuniao_link) lead.reuniao_link = args.p_reuniao_link
    if (args.p_next_action) lead.next_action = args.p_next_action
    if (args.p_next_action_due_date) lead.next_action_due_date = args.p_next_action_due_date
    records.lead_status_history.unshift({
      id: `hist-${records.lead_status_history.length + 1}`,
      lead_id: lead.id,
      from_status: fromStatus,
      to_status: args.p_to_status,
      changed_at: now,
      changed_by: 'test-user',
      note: args.p_note ?? null,
    })
    return Promise.resolve({ data: lead, error: null })
  }
  if (name === 'marcar_reuniao') {
    const lead = records.leads.find((row) => row.id === args.p_lead_id)
    if (!lead) return Promise.resolve({ data: null, error: new Error('Lead não encontrado.') })
    const fromStatus = String(lead.status)
    lead.status = 'reuniao_marcada'
    lead.updated_at = now
    lead.reuniao_em = args.p_reuniao_em
    lead.reuniao_link = args.p_reuniao_link ?? lead.reuniao_link
    lead.reuniao_local = args.p_reuniao_local ?? lead.reuniao_local
    lead.reuniao_notas = args.p_reuniao_notas ?? lead.reuniao_notas
    lead.reuniao_resultado = 'pendente'
    lead.next_action = 'Confirmar reunião no WhatsApp'
    records.lead_status_history.unshift({
      id: `hist-${records.lead_status_history.length + 1}`,
      lead_id: lead.id,
      from_status: fromStatus,
      to_status: 'reuniao_marcada',
      changed_at: now,
      changed_by: 'test-user',
      note: args.p_note ?? null,
    })
    return Promise.resolve({ data: lead, error: null })
  }
  if (name === 'registrar_resultado_reuniao') {
    const lead = records.leads.find((row) => row.id === args.p_lead_id)
    if (!lead) return Promise.resolve({ data: null, error: new Error('Lead não encontrado.') })
    const resultado = String(args.p_resultado)
    lead.updated_at = now
    lead.reuniao_notas = args.p_notas ?? lead.reuniao_notas
    if (resultado === 'reagendou') {
      lead.reuniao_em = args.p_reuniao_em
      lead.reuniao_link = args.p_reuniao_link ?? lead.reuniao_link
      lead.reuniao_local = args.p_reuniao_local ?? lead.reuniao_local
      lead.reuniao_resultado = 'pendente'
      lead.next_action = 'Confirmar reunião no WhatsApp'
    } else if (resultado === 'pediu_proposta') {
      lead.status = 'proposta_enviada'
      lead.reuniao_resultado = 'pediu_proposta'
      lead.next_action = 'Enviar proposta'
    } else if (resultado === 'fechou') {
      lead.status = 'convertido'
      lead.reuniao_resultado = 'fechou'
    } else if (resultado === 'recusou') {
      lead.status = 'perdido'
      lead.reuniao_resultado = 'recusou'
      lead.motivo_perda = args.p_motivo_perda
    } else {
      lead.reuniao_resultado = resultado
    }
    return Promise.resolve({ data: lead, error: null })
  }
  if (name === 'registrar_cadencia') {
    const lead = records.leads.find((row) => row.id === args.p_lead_id)
    if (!lead) return Promise.resolve({ data: null, error: new Error('Lead não encontrado.') })
    const acao = String(args.p_acao)
    const touches = Number(lead.touches_sem_resposta ?? 0)
    if ((acao === 'toquei' || acao === 'sem_resposta') && touches + 1 >= 4) {
      return Promise.resolve({ data: null, error: { message: 'TOUCH_LIMIT', code: 'PT409' } })
    }
    if (acao === 'toquei' || acao === 'sem_resposta') {
      const next = touches + 1
      const offsets = [3, 4, 6]
      lead.touches_sem_resposta = next
      lead.next_action_due_date = `2026-09-${String(12 + offsets[next - 1]).padStart(2, '0')}`
    } else if (acao === 'respondeu') {
      lead.touches_sem_resposta = 0
      lead.next_action_due_date = null
    } else if (acao === 'reagendar') {
      if (args.p_next_action) lead.next_action = args.p_next_action
      if (args.p_next_action_due_date) lead.next_action_due_date = args.p_next_action_due_date
    }
    lead.updated_at = now
    records.lead_atividade.unshift({
      id: `act-${records.lead_atividade.length + 1}`,
      lead_id: lead.id,
      tipo: acao === 'respondeu' ? 'resposta' : acao === 'reagendar' ? 'reagendar' : 'toque',
      resultado: acao === 'sem_resposta' ? 'sem_resposta' : acao === 'respondeu' ? 'respondeu' : acao === 'reagendar' ? 'reagendado' : 'toquei',
      canal: args.p_canal ?? 'whatsapp',
      nota: args.p_nota ?? null,
      created_at: now,
      created_by: 'test-user',
    })
    return Promise.resolve({ data: lead, error: null })
  }
  if (name === 'convert_lead_to_client') {
    const lead = records.leads.find((row) => row.id === args.p_lead_id)
    if (!lead) return Promise.resolve({ data: null, error: new Error('Lead não encontrado.') })
    if (lead.status === 'perdido' || lead.status === 'pausado_60d') {
      return Promise.resolve({ data: null, error: new Error('Leads perdidos ou pausados não podem ser convertidos.') })
    }
    const fromStatus = String(lead.status)
    lead.status = 'convertido'
    records.clients.push({ ...base, id: `client-${String(lead.id)}`, company_name: lead.company_name, lead_id: lead.id })
    records.lead_status_history.unshift({
      id: `hist-${records.lead_status_history.length + 1}`,
      lead_id: lead.id,
      from_status: fromStatus,
      to_status: 'convertido',
      changed_at: now,
      changed_by: 'test-user',
      note: 'Conversão em cliente',
    })
    return Promise.resolve({ data: {}, error: null })
  }
  return Promise.resolve({ data: null, error: null })
}
const fixture = {
  auth: {
    getSession: async () => { if (fail === 'session') throw new Error('Falha simulada'); return { data: { session: fail === 'login' ? null : { user: { id: 'test-user' } } }, error: null } },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => { throw new Error('Login de teste indisponível') },
    signOut: async () => ({ error: new Error('Falha simulada') }),
  },
  from: query,
  rpc,
} as unknown as SupabaseClient
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App client={fixture} /></ErrorBoundary></StrictMode>)
