import { useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Plus, Upload } from 'lucide-react'
import { Modal } from '../../components/Modal'
import { dateLabel } from '../../utils/dates'
import { type Lead, type LeadStatus } from '../../types/lead'
import { LeadStatusTransitionDialog } from './LeadStatusTransitionDialog'
import { updateLeadStatus } from './lead-service'
import type { LeadStatusTransitionInput } from './lead-status'
import {
  KANBAN_COLUMN_PAGE_SIZE,
  decideKanbanDrop,
  groupKanbanLeads,
  isKanbanColumnStatus,
  isKanbanOverdue,
  kanbanColumns,
  kanbanContactName,
  kanbanInitials,
  leadsWithPendingMove,
  nextKanbanColumnLimit,
  truncateNextAction,
  visibleKanbanCards,
  type KanbanColumnStatus,
  type KanbanPendingMove,
} from './kanban'

type LeadsKanbanProps = {
  supabase: SupabaseClient
  leads: Lead[]
  isLoading: boolean
  hasFilters: boolean
  porteiroEnabled: boolean
  onOpenLead: (leadId: string) => void
  onLeadSaved: (lead: Lead) => void
  onError: (message: string) => void
  onClearFilters: () => void
  onCreate: () => void
  onImport: () => void
}

export function LeadsKanban({
  supabase,
  leads,
  isLoading,
  hasFilters,
  porteiroEnabled,
  onOpenLead,
  onLeadSaved,
  onError,
  onClearFilters,
  onCreate,
  onImport,
}: LeadsKanbanProps) {
  const [pending, setPending] = useState<KanbanPendingMove | null>(null)
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null)
  const [overColumn, setOverColumn] = useState<KanbanColumnStatus | null>(null)
  const [limits, setLimits] = useState<Partial<Record<KanbanColumnStatus, number>>>({})
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const draggingIdRef = useRef<string | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => { setLimits({}) }, [leads])

  const columns = useMemo(() => kanbanColumns(leadsWithPendingMove(leads, pending)), [leads, pending])
  const grouped = useMemo(() => groupKanbanLeads(leads, pending), [leads, pending])
  const pendingLead = pending ? leads.find((lead) => lead.id === pending.leadId) ?? null : null
  const pendingDecision = pendingLead && pending ? decideKanbanDrop(pendingLead.status, pending.toStatus) : null
  const pendingDialog = pendingDecision?.kind === 'dialog' ? pendingDecision : null

  async function applyStatus(lead: Lead, toStatus: LeadStatus, input: LeadStatusTransitionInput = {}) {
    setBusyLeadId(lead.id)
    onError('')
    try {
      const saved = await updateLeadStatus(supabase, lead, toStatus, input)
      onLeadSaved(saved)
      setPending(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível atualizar o status.'
      onError(message)
      throw error
    } finally {
      setBusyLeadId(null)
    }
  }

  async function dropOnColumn(toStatus: KanbanColumnStatus, leadId: string) {
    if (pending || busyLeadId) return
    const lead = leads.find((item) => item.id === leadId)
    if (!lead || !isKanbanColumnStatus(toStatus)) return
    const decision = decideKanbanDrop(lead.status, toStatus)
    if (decision.kind === 'noop') return
    if (decision.kind === 'reject') {
      onError(decision.error)
      return
    }
    if (decision.kind === 'apply') {
      setPending({ leadId: lead.id, toStatus: decision.toStatus })
      try { await applyStatus(lead, decision.toStatus) } catch { setPending(null) }
      return
    }
    setPending({ leadId: lead.id, toStatus: decision.toStatus })
  }

  function columnAtPoint(clientX: number, clientY: number) {
    const el = document.elementFromPoint(clientX, clientY)
    const status = el?.closest<HTMLElement>('[data-kanban-column]')?.dataset.status
    return status && isKanbanColumnStatus(status) ? status : null
  }

  function finishDrag(event: { clientX: number; clientY: number }) {
    const leadId = draggingIdRef.current
    draggingIdRef.current = null
    setDraggingId(null)
    setOverColumn(null)
    if (!leadId) return
    const status = columnAtPoint(event.clientX, event.clientY)
    if (!status) return
    suppressClick.current = true
    void dropOnColumn(status, leadId)
    window.setTimeout(() => { suppressClick.current = false }, 0)
  }

  function cancelPending() {
    setPending(null)
    onError('')
  }

  if (isLoading) {
    return <p className="kanban-loading" role="status">Carregando leads…</p>
  }

  if (leads.length === 0) {
    return (
      <div className="empty-state kanban-empty">
        <strong>{hasFilters ? 'Nenhum resultado para os filtros atuais.' : 'Nenhum lead encontrado.'}</strong>
        <span>{hasFilters ? 'Ajuste a busca ou limpe os filtros para ver outros leads.' : 'Cadastre um lead ou importe uma lista aprovada para começar.'}</span>
        <div className="empty-actions">
          {hasFilters && <button type="button" className="button-secondary" onClick={onClearFilters}>Limpar filtros</button>}
          {!hasFilters && (
            <>
              <button type="button" onClick={onCreate}><Plus size={18} /> Novo lead</button>
              <button type="button" className="button-secondary" onClick={onImport}><Upload size={18} /> Importar CSV</button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="kanban-board" role="region" aria-label="Kanban do funil">
      {columns.map((column) => {
        const limit = limits[column.status] ?? KANBAN_COLUMN_PAGE_SIZE
        const { items, remaining } = visibleKanbanCards(grouped[column.status] ?? [], limit)
        const isOver = overColumn === column.status
        return (
          <section
            key={column.status}
            className={isOver ? 'kanban-column kanban-column-over' : 'kanban-column'}
            role="list"
            aria-label={`${column.label}, ${column.count} ${column.count === 1 ? 'lead' : 'leads'}`}
            data-status={column.status}
            data-kanban-column={column.status}
          >
            <header className="kanban-column-header">
              <h2>{column.label}</h2>
              <span>{column.count}</span>
            </header>
            <div className="kanban-column-cards">
              {items.map((lead) => {
                const contact = kanbanContactName(lead, porteiroEnabled)
                const nextAction = truncateNextAction(lead.next_action)
                const overdue = isKanbanOverdue(lead)
                const isDragging = draggingId === lead.id
                return (
                  <article
                    key={lead.id}
                    className={isDragging || pending?.leadId === lead.id ? 'kanban-card kanban-card-active' : 'kanban-card'}
                    aria-grabbed={isDragging}
                    onPointerDown={(event) => {
                      if (event.button !== 0 || busyLeadId === lead.id || pending) return
                      if ((event.target as HTMLElement).closest('button')) return
                      event.currentTarget.setPointerCapture(event.pointerId)
                      draggingIdRef.current = lead.id
                      setDraggingId(lead.id)
                    }}
                    onPointerMove={(event) => {
                      if (draggingIdRef.current !== lead.id) return
                      setOverColumn(columnAtPoint(event.clientX, event.clientY))
                    }}
                    onPointerUp={(event) => {
                      if (draggingIdRef.current !== lead.id) return
                      finishDrag(event)
                    }}
                    onPointerCancel={() => {
                      if (draggingIdRef.current !== lead.id) return
                      draggingIdRef.current = null
                      setDraggingId(null)
                      setOverColumn(null)
                    }}
                  >
                    <div className="kanban-card-top">
                      <span className="kanban-initials" title={contact ?? 'Sem responsável'} aria-hidden="true">
                        {kanbanInitials(contact)}
                      </span>
                      <div className="kanban-card-identity">
                        <button
                          type="button"
                          className="company-link"
                          onClick={() => { if (!suppressClick.current) onOpenLead(lead.id) }}
                        >
                          {lead.company_name}
                        </button>
                        {lead.segment && <span className="table-note">{lead.segment}</span>}
                      </div>
                    </div>
                    {nextAction
                      ? <p className="kanban-next-action" title={lead.next_action ?? undefined}>{nextAction}</p>
                      : <p className="kanban-next-action kanban-next-action-empty">Sem próxima ação</p>}
                    <div className="kanban-card-meta">
                      {lead.next_action_due_date
                        ? (
                          <strong className={overdue ? 'overdue' : ''}>
                            {dateLabel(lead.next_action_due_date)}
                            {overdue && <span className="status status-perdido">Atrasada</span>}
                          </strong>
                        )
                        : <span>Sem data</span>}
                      <span>{lead.touches_sem_resposta === 1 ? '1 toque' : `${lead.touches_sem_resposta} toques`}</span>
                    </div>
                  </article>
                )
              })}
            </div>
            {remaining > 0 && (
              <button
                type="button"
                className="button-secondary kanban-load-more"
                onClick={() => setLimits((current) => ({
                  ...current,
                  [column.status]: nextKanbanColumnLimit(limit),
                }))}
              >
                Carregar mais ({remaining})
              </button>
            )}
          </section>
        )
      })}
      {pendingLead && pendingDialog && (
        <LeadStatusTransitionDialog
          lead={pendingLead}
          toStatus={pendingDialog.toStatus}
          evaluation={pendingDialog.evaluation}
          busy={busyLeadId === pendingLead.id}
          onCancel={cancelPending}
          onConfirm={(input) => applyStatus(pendingLead, pendingDialog.toStatus, input)}
        />
      )}
      {pending && !pendingLead && (
        <Modal labelledBy="kanban-missing-title" busy={false} onClose={cancelPending}>
          <div className="modal-heading">
            <h2 id="kanban-missing-title">Lead indisponível</h2>
            <button type="button" className="button-link" onClick={cancelPending}>Fechar</button>
          </div>
          <p className="confirm-message">O card voltou para a coluna original.</p>
        </Modal>
      )}
    </div>
  )
}
