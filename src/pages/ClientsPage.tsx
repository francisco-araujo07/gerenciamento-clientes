import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Pagination, PAGE_SIZE } from '../components/Pagination'
import { listClients } from '../features/clients/client-service'
import { projectStatusLabels, projectStatuses, type Client, type ProjectStatus } from '../types/client'

type ClientsPageProps = { supabase: SupabaseClient; onOpenClient: (id: string) => void }
const summary = (client: Client) => client.projects.length ? client.projects.map((project) => `${project.name} (${projectStatusLabels[project.status]})`).join(', ') : 'Sem projetos cadastrados'

export function ClientsPage({ supabase, onOpenClient }: ClientsPageProps) {
  const [page, setPage] = useState(0)
  const [clients, setClients] = useState<Client[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [search, setSearch] = useState(''); const [status, setStatus] = useState<'todos' | ProjectStatus>('todos')
  const load = useCallback(async () => { setLoading(true); try { setClients(await listClients(supabase)); setError('') } catch { setError('Não foi possível carregar os clientes.') } setLoading(false) }, [supabase])
  useEffect(() => { void load() }, [load])
  const visible = useMemo(() => clients.filter((client) => { const term = search.trim().toLocaleLowerCase('pt-BR'); return (!term || client.company_name.toLocaleLowerCase('pt-BR').includes(term) || client.responsible_name?.toLocaleLowerCase('pt-BR').includes(term)) && (status === 'todos' || client.projects.some((project) => project.status === status)) }), [clients, search, status])
  useEffect(() => { setPage(0) }, [search, status])
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visible.length / PAGE_SIZE) - 1))
  return <section className="page-content"><div className="page-heading"><div><p className="eyebrow">Relacionamento</p><h1>Clientes</h1><p>Clientes convertidos e os projetos contratados.</p></div></div><div className="filters"><label className="search-field"><Search size={20} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por empresa ou responsável" aria-label="Buscar clientes" /></label><label className="select-field"><SlidersHorizontal size={18} /><select value={status} onChange={(e) => setStatus(e.target.value as 'todos' | ProjectStatus)} aria-label="Filtrar situação"><option value="todos">Todas as situações</option>{projectStatuses.map((item) => <option key={item} value={item}>{projectStatusLabels[item]}</option>)}</select></label></div>{error && <p className="form-error">{error}</p>}<div className="table-wrap"><table><thead><tr><th>Empresa</th><th>Responsável</th><th>Resumo dos projetos</th><th>Ações</th></tr></thead><tbody>{loading ? <tr><td colSpan={4}>Carregando clientes…</td></tr> : visible.length ? visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((client) => <tr key={client.id}><td><button className="company-link" onClick={() => onOpenClient(client.id)}>{client.company_name}</button></td><td>{client.responsible_name || '—'}</td><td>{summary(client)}</td><td><button className="button-link" onClick={() => onOpenClient(client.id)}>Ver detalhes</button></td></tr>) : <tr><td colSpan={4}>Nenhum cliente encontrado.</td></tr>}</tbody></table></div>{!loading && <Pagination page={currentPage} total={visible.length} onChange={setPage} />}</section>
}
