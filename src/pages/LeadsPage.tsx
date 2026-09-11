import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Clock3, Pencil, Plus, Search, SlidersHorizontal, Trash2, Upload } from 'lucide-react'
import { Pagination, PAGE_SIZE } from '../components/Pagination'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LeadForm } from '../features/leads/LeadForm'
import { createLead, deleteLead, listLeads, updateLead } from '../features/leads/lead-service'
import { leadStatusLabels, leadStatuses, type Lead, type LeadFormValues, type LeadStatus } from '../types/lead'

type LeadsPageProps = { supabase: SupabaseClient; onOpenLead: (leadId: string) => void; onImport: () => void }
type StatusFilter = 'ativos' | 'todos' | LeadStatus

import { localDate as today, dateLabel } from '../utils/dates'
import { Modal } from '../components/Modal'

export function LeadsPage({ supabase, onOpenLead, onImport }: LeadsPageProps) {
  const [page, setPage] = useState(0)
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ativos')
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null | undefined>(undefined)
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  useEffect(() => { setPage(0) }, [search, statusFilter, onlyOverdue])
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visibleLeads.length / PAGE_SIZE) - 1))

  async function save(values: LeadFormValues) {
    setIsSaving(true); setErrorMessage(''); setSuccessMessage('')
    try {
      const saved = editingLead ? await updateLead(supabase, editingLead.id, values, editingLead.updated_at) : await createLead(supabase, values)
      setLeads((current) => editingLead ? current.map((lead) => lead.id === saved.id ? saved : lead) : [...current, saved].sort((a, b) => (a.next_action_due_date ?? '9999').localeCompare(b.next_action_due_date ?? '9999')))
      setEditingLead(undefined)
      setSuccessMessage(editingLead ? 'Lead atualizado com sucesso.' : 'Lead criado com sucesso.')
    } catch { setErrorMessage('Não foi possível salvar. Confira os campos; o registro pode ter sido alterado por outra pessoa. Preserve seu texto e atualize antes de repetir.') }
    setIsSaving(false)
  }

  async function remove() {
    if (!deletingLead || isDeleting) return
    setIsDeleting(true); setErrorMessage('')
    try { await deleteLead(supabase, deletingLead.id); setLeads((current) => current.filter((item) => item.id !== deletingLead.id)); setDeletingLead(null) }
    catch { setErrorMessage('Não foi possível excluir o lead.') }
    finally { setIsDeleting(false) }
  }

  const hasFilters = search.trim() !== '' || statusFilter !== 'ativos' || onlyOverdue
  return <section className="page-content">
    <div className="page-heading"><div><p className="eyebrow">Prospecção</p><h1>Leads</h1><p>Acompanhe os contatos e priorize a próxima ação.</p></div><div className="page-actions"><button className="button-secondary" onClick={onImport}><Upload size={18} /> Importar CSV</button><button onClick={() => setEditingLead(null)}><Plus size={18} /> Novo lead</button></div></div>
    <div className="filters" aria-label="Filtros de leads">
      <label className="search-field"><Search size={20} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por empresa ou responsável" aria-label="Buscar empresa ou responsável" /></label>
      <label className="select-field"><SlidersHorizontal aria-hidden="true" size={18} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} aria-label="Filtrar por status"><option value="ativos">Ativos (Novo e Negociação)</option><option value="todos">Todos os status</option>{leadStatuses.map((status) => <option key={status} value={status}>{leadStatusLabels[status]}</option>)}</select></label>
      <label className="check-filter"><Clock3 aria-hidden="true" size={18} /><input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} /> Apenas atrasadas</label>
    </div>
    {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
    {successMessage && <p className="validation-ok" role="status">{successMessage}</p>}
    <p className="lead-count" role="status" aria-live="polite">{visibleLeads.length} {visibleLeads.length === 1 ? 'registro encontrado' : 'registros encontrados'}</p>
    <div className="table-wrap"><table><thead><tr><th>Empresa</th><th>Responsável</th><th>WhatsApp</th><th>Status</th><th>Próxima ação</th><th>Ações</th></tr></thead><tbody>
      {isLoading ? <tr className="table-message"><td colSpan={6}>Carregando leads…</td></tr> : visibleLeads.length === 0 ? <tr className="table-message"><td colSpan={6}><div className="empty-state"><strong>{hasFilters ? 'Nenhum resultado para os filtros atuais.' : 'Nenhum lead encontrado.'}</strong><span>{hasFilters ? 'Ajuste a busca ou limpe os filtros para ver outros leads.' : 'Cadastre um lead ou importe uma lista aprovada para começar.'}</span><div className="empty-actions">{hasFilters && <button type="button" className="button-secondary" onClick={() => { setSearch(''); setStatusFilter('ativos'); setOnlyOverdue(false) }}>Limpar filtros</button>}{!hasFilters && <><button type="button" onClick={() => setEditingLead(null)}><Plus size={18} /> Novo lead</button><button type="button" className="button-secondary" onClick={onImport}><Upload size={18} /> Importar CSV</button></>}</div></div></td></tr> : visibleLeads.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((lead) => {
        const overdue = Boolean(lead.next_action_due_date && lead.next_action_due_date < today() && (lead.status === 'novo' || lead.status === 'negociacao'))
        return <tr key={lead.id}><td data-label="Empresa"><button className="company-link" onClick={() => onOpenLead(lead.id)}>{lead.company_name}</button>{lead.segment && <span className="table-note">{lead.segment}</span>}</td><td data-label="Responsável">{lead.responsible_name || '—'}</td><td data-label="WhatsApp">{lead.whatsapp || '—'}</td><td data-label="Status"><span className={`status status-${lead.status}`}>{leadStatusLabels[lead.status]}</span></td><td data-label="Próxima ação">{lead.next_action ? <><strong className={overdue ? 'overdue' : ''}>{dateLabel(lead.next_action_due_date)} {overdue && <span className="status status-perdido">Atrasada</span>}</strong><span className="table-note" title={lead.next_action}>{lead.next_action}</span></> : '—'}</td><td data-label="Ações" className="row-actions"><button type="button" className="icon-button" aria-label={`Editar ${lead.company_name}`} title="Editar" onClick={() => setEditingLead(lead)}><Pencil size={18} /></button><button type="button" className="icon-button danger-action" aria-label={`Excluir ${lead.company_name}`} title="Excluir" onClick={() => setDeletingLead(lead)}><Trash2 size={18} /></button></td></tr>
      })}</tbody></table></div>
    {!isLoading && <Pagination page={currentPage} total={visibleLeads.length} onChange={setPage} />}
    {editingLead !== undefined && <Modal labelledBy="lead-form-title" busy={isSaving} onClose={() => setEditingLead(undefined)}><div className="modal-heading"><h2 id="lead-form-title">{editingLead ? 'Editar lead' : 'Novo lead'}</h2><button className="button-link" disabled={isSaving} onClick={() => setEditingLead(undefined)}>Fechar</button></div>{errorMessage && <p role="alert" className="form-error">{errorMessage}</p>}<LeadForm lead={editingLead} isSaving={isSaving} onCancel={() => setEditingLead(undefined)} onSave={save} /></Modal>}
    {deletingLead && <ConfirmDialog labelledBy="delete-lead-title" title={`Excluir ${deletingLead.company_name}?`} message="Use a exclusão somente para registros criados por engano. Esta ação não pode ser desfeita." confirmLabel="Excluir lead" danger busy={isDeleting} onCancel={() => setDeletingLead(null)} onConfirm={() => void remove()} />}
  </section>
}
