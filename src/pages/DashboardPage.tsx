import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BarChart3, ChevronRight, DollarSign, UserRound, UsersRound } from 'lucide-react'

type Period = 'semana' | 'mes' | 'total'
type Project = { price: number; completed_at: string | null }
type Props = { supabase: SupabaseClient; onNavigate: (page: 'leads' | 'clients') => void }
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export function DashboardPage({ supabase, onNavigate }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [period, setPeriod] = useState<Period>('total')
  const [error, setError] = useState('')
  const load = useCallback(async () => { const { data, error } = await supabase.from('projects').select('price, completed_at').eq('status', 'concluido'); if (error) setError('Não foi possível carregar o faturamento.'); else setProjects((data ?? []) as Project[]) }, [supabase])
  useEffect(() => { void load() }, [load])
  const total = useMemo(() => { const now = new Date(); const start = new Date(now); if (period === 'semana') start.setDate(now.getDate() - now.getDay()); if (period === 'mes') start.setDate(1); return projects.filter((project) => period === 'total' || (project.completed_at && new Date(`${project.completed_at}T00:00:00`) >= start)).reduce((sum, project) => sum + Number(project.price), 0) }, [period, projects])
  return <section className="page-content dashboard"><h1>Dashboard</h1><div className="period-buttons">{(['semana', 'mes', 'total'] as Period[]).map((item) => <button key={item} className={period === item ? 'period-active' : 'button-secondary'} onClick={() => setPeriod(item)}>{item === 'semana' ? 'Semanal' : item === 'mes' ? 'Mensal' : 'Total'}</button>)}</div>{error && <p className="form-error">{error}</p>}<article className="revenue-card"><div><h2>Faturamento concluído</h2><strong>{money(total)}</strong><p>Valor total de faturamento concluído</p></div><div className="revenue-icon"><DollarSign size={46} /><BarChart3 size={104} /></div></article><div className="dashboard-links"><button onClick={() => onNavigate('leads')}><span><UserRound size={40} /></span><div><strong>Leads</strong><small>Visualize e gerencie seus leads</small></div><ChevronRight /></button><button onClick={() => onNavigate('clients')}><span><UsersRound size={40} /></span><div><strong>Clientes</strong><small>Visualize e gerencie seus clientes</small></div><ChevronRight /></button></div></section>
}
