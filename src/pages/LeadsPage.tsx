import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Clock3, Plus, Search, SlidersHorizontal, Upload } from 'lucide-react'
import { LeadForm } from '../features/leads/LeadForm'
import { createLead, deleteLead, listLeads, updateLead } from '../features/leads/lead-service'
import { leadStatusLabels, leadStatuses, type Lead, type LeadFormValues, type LeadStatus } from '../types/lead'

type LeadsPageProps = { supabase: SupabaseClient; onOpenLead: (leadId: string) => void; onImport: () => void }
type StatusFilter = 'ativos' | 'todos' | LeadStatus

const today = () => new Date().toISOString().slice(0, 10)
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00`)) : 'Sem data'

export function LeadsPage({ supabase, onOpenLead, onImport }: LeadsPageProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ativos')
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null | undefined>(undefined)

  const load = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')
    try { setLeads(await listLeads(supabase)) } catch { setErrorMessage('Não foi possível carregar os leads.') }
    setIsLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const visibleLeads = useMemo(() => leads.filter((lead) => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    const found = !term || lead.company_name.toLocaleLowerCase('pt-BR').includes(term) || lead.responsible_name?.toLocaleLowerCase('pt-BR').includes(term)
    const active = lead.status === 'novo' || lead.status === 'negociacao'
    const statusMatches = statusFilter === 'todos' || (statusFilter === 'ativos' ? active : lead.status === statusFilter)
    const overdue = Boolean(lead.next_action_due_date && lead.next_action_due_date < today() && active)
    return found && statusMatches && (!onlyOverdue || overdue)
  }), [leads, onlyOverdue, search, statusFilter])

  async function save(values: LeadFormValues) {
    setIsSaving(true); setErrorMessage('')
    try {
      const saved = editingLead ? await updateLead(supabase, editingLead.id, values) : await createLead(supabase, values)
      setLeads((current) => editingLead ? current.map((lead) => lead.id === saved.id ? saved : lead) : [...current, saved].sort((a, b) => (a.next_action_due_date ?? '9999').localeCompare(b.next_action_due_date ?? '9999')))
      setEditingLead(undefined)
    } catch { setErrorMessage('Não foi possível salvar o lead. Tente novamente.') }
    setIsSaving(false)
  }

  async function remove(lead: Lead) {
    if (!window.confirm(`Excluir ${lead.company_name}? Use a exclusão somente para registros criados por engano.`)) return
    try { await deleteLead(supabase, lead.id); setLeads((current) => current.filter((item) => item.id !== lead.id)) }
    catch { setErrorMessage('Não foi possível excluir o lead.') }
  }

  return <section className="page-content">
    <div className="page-heading"><div><p className="eyebrow">Prospecção</p><h1>Leads</h1><p>Acompanhe os contatos e priorize a próxima ação.</p></div><div className="page-actions"><button className="button-secondary" onClick={onImport}><Upload size={18} /> Importar CSV</button><button onClick={() => setEditingLead(null)}><Plus size={18} /> Novo lead</button></div></div>
    <div className="filters" aria-label="Filtros de leads">
      <label className="search-field"><Search size={20} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por empresa ou responsável" aria-label="Buscar empresa ou responsável" /></label>
      <label className="select-field"><SlidersHorizontal size={18} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} aria-label="Filtrar por status"><option value="ativos">Ativos (Novo e Negociação)</option><option value="todos">Todos os status</option>{leadStatuses.map((status) => <option key={status} value={status}>{leadStatusLabels[status]}</option>)}</select></label>
      <label className="check-filter"><Clock3 size={18} /><input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} /> Apenas atrasadas</label>
    </div>
    {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
    <div className="table-wrap"><table><thead><tr><th>Empresa</th><th>Responsável</th><th>WhatsApp</th><th>Status</th><th>Próxima ação</th><th>Ações</th></tr></thead><tbody>
      {isLoading ? <tr><td colSpan={6}>Carregando leads…</td></tr> : visibleLeads.length === 0 ? <tr><td colSpan={6}>Nenhum lead encontrado.</td></tr> : visibleLeads.map((lead) => {
        const overdue = Boolean(lead.next_action_due_date && lead.next_action_due_date < today() && (lead.status === 'novo' || lead.status === 'negociacao'))
        return <tr key={lead.id}><td><button className="company-link" onClick={() => onOpenLead(lead.id)}>{lead.company_name}</button>{lead.segment && <span className="table-note">{lead.segment}</span>}</td><td>{lead.responsible_name || '—'}</td><td>{lead.whatsapp || '—'}</td><td><span className={`status status-${lead.status}`}>{leadStatusLabels[lead.status]}</span></td><td>{lead.next_action ? <><strong className={overdue ? 'overdue' : ''}>{dateLabel(lead.next_action_due_date)}</strong><span className="table-note">{lead.next_action}</span></> : '—'}</td><td className="row-actions"><button className="button-link" onClick={() => setEditingLead(lead)}>Editar</button><button className="button-link danger-link" onClick={() => void remove(lead)}>Excluir</button></td></tr>
      })}</tbody></table></div>
    {editingLead !== undefined && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="lead-form-title"><div className="modal-heading"><h2 id="lead-form-title">{editingLead ? 'Editar lead' : 'Novo lead'}</h2><button className="button-link" onClick={() => setEditingLead(undefined)}>Fechar</button></div><LeadForm lead={editingLead} isSaving={isSaving} onCancel={() => setEditingLead(undefined)} onSave={save} /></section></div>}
  </section>
}
