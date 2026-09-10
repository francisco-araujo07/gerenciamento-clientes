import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BarChart3, ChevronRight, DollarSign, UserRound, UsersRound } from 'lucide-react'

import { readAll } from '../lib/read-all'
import { revenueTotal, type RevenuePeriod as Period } from '../utils/dates'
type Project = { price: number; completed_at: string | null }
type Props = { supabase: SupabaseClient; onNavigate: (page: 'leads' | 'clients') => void }
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export function DashboardPage({ supabase, onNavigate }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [period, setPeriod] = useState<Period>('total')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const rows = await readAll<Project>((from, to) => supabase.from('projects').select('price, completed_at', { count: 'exact' }).eq('status', 'concluido').order('id').range(from, to))
      revenueTotal(rows, 'total')
      setProjects(rows)
    } catch { setError('Não foi possível carregar o faturamento completo. Tente novamente; se persistir, contate o responsável.') }
    finally { setLoading(false) }
  }, [supabase])
  useEffect(() => { void load() }, [load])
  const total = useMemo(() => revenueTotal(projects, period), [period, projects])
  return <section className="page-content dashboard"><h1>Dashboard</h1><div className="period-buttons" role="radiogroup" aria-label="Período do faturamento">{(['semana', 'mes', 'total'] as Period[]).map((item) => <button key={item} role="radio" aria-checked={period === item} className={period === item ? 'period-active' : 'button-secondary'} onClick={() => setPeriod(item)}>{item === 'semana' ? 'Semanal' : item === 'mes' ? 'Mensal' : 'Total'}</button>)}</div>{error && <div role="alert"><p className="form-error">{error}</p><button onClick={() => void load()}>Tentar novamente</button></div>}<article className="revenue-card"><div><h2>Faturamento concluído</h2><strong aria-live="polite">{loading ? 'Carregando…' : error ? 'Indisponível' : money(total)}</strong><p>{period === 'semana' ? 'Do domingo até hoje' : period === 'mes' ? 'Do primeiro dia do mês até hoje' : 'Todos os projetos concluídos'}</p></div><div className="revenue-icon" aria-hidden="true"><DollarSign size={46} /><BarChart3 size={104} /></div></article><div className="dashboard-links"><button onClick={() => onNavigate('leads')}><span aria-hidden="true"><UserRound size={40} /></span><div><strong>Leads</strong><small>Visualize e gerencie seus leads</small></div><ChevronRight aria-hidden="true" /></button><button onClick={() => onNavigate('clients')}><span aria-hidden="true"><UsersRound size={40} /></span><div><strong>Clientes</strong><small>Visualize e gerencie seus clientes</small></div><ChevronRight aria-hidden="true" /></button></div></section>
}
