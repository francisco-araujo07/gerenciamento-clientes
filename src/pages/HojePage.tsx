import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CalendarClock } from 'lucide-react'
import { Pagination, PAGE_SIZE } from '../components/Pagination'
import { LeadStatusBadge } from '../features/leads/LeadStatusBadge'
import { LeadStatusTransitionDialog } from '../features/leads/LeadStatusTransitionDialog'
import { updateLeadStatus } from '../features/leads/lead-service'
import type { LeadStatusTransitionInput } from '../features/leads/lead-status'
import { CadenciaActions } from '../features/cadencia/CadenciaActions'
import { CadenciaTouchLimitError, filterCadenciaQueue } from '../features/cadencia/cadencia'
import { listCadenciaQueue, listNovosSemProximaAcao, registrarCadencia } from '../features/cadencia/cadencia-service'
import { RescheduleDialog } from '../features/cadencia/RescheduleDialog'
import { TouchLimitDialog } from '../features/cadencia/TouchLimitDialog'
import { principalWhatsapp } from '../features/porteiro-decisor/contacts'
import { maskWhatsapp, whatsappMeUrl } from '../features/cadencia/whatsapp'
import { OpenWhatsAppDialog } from '../features/whatsapp/OpenWhatsAppDialog'
import { cadenciaQueueTabs, type CadenciaAcao, type CadenciaQueueTab } from '../types/cadencia'
import { type Lead, type LeadStatus } from '../types/lead'
import { dateLabel, recifeDate } from '../utils/dates'
import { isGlcFunilStatusEnabled, isGlcKitWhatsappEnabled, isGlcPorteiroDecisorEnabled, isGlcReuniaoEnabled } from '../utils/feature-flags'
import { ReuniaoResultadoDialog } from '../features/reuniao/ReuniaoResultadoDialog'
import { registrarResultadoReuniao } from '../features/reuniao/reuniao-service'
import type { ReuniaoResultadoInput } from '../features/reuniao/reuniao'
import { waSpecSeedNames } from '../types/whatsapp'

type HojePageProps = { supabase: SupabaseClient; onOpenLead: (leadId: string) => void }

const tabLabels: Record<CadenciaQueueTab, string> = {
  todos: 'Todos',
  hoje: 'Hoje',
  atrasadas: 'Atrasadas',
}

export function HojePage({ supabase, onOpenLead }: HojePageProps) {
  const [page, setPage] = useState(0)
  const [tab, setTab] = useState<CadenciaQueueTab>('todos')
  const [leads, setLeads] = useState<Lead[]>([])
  const [novosSemData, setNovosSemData] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [rescheduling, setRescheduling] = useState<Lead | null>(null)
  const [touchLimitLead, setTouchLimitLead] = useState<Lead | null>(null)
  const [pendingStatus, setPendingStatus] = useState<{ lead: Lead; toStatus: Extract<LeadStatus, 'perdido' | 'pausado_60d'> } | null>(null)
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null)
  const [whatsappPreferred, setWhatsappPreferred] = useState<string | undefined>(undefined)
  const [resultadoLead, setResultadoLead] = useState<Lead | null>(null)
  const funilEnabled = isGlcFunilStatusEnabled()
  const kitWhatsappEnabled = isGlcKitWhatsappEnabled()
  const porteiroEnabled = isGlcPorteiroDecisorEnabled()
  const reuniaoEnabled = isGlcReuniaoEnabled()
  const today = recifeDate()

  const load = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const [queue, novos] = await Promise.all([
        listCadenciaQueue(supabase, today),
        listNovosSemProximaAcao(supabase),
      ])
      setLeads(queue)
      setNovosSemData(novos)
    } catch {
      setErrorMessage('Não foi possível carregar a fila de hoje.')
    }
    setIsLoading(false)
  }, [supabase, today])

  useEffect(() => { void load() }, [load])

  const visibleLeads = useMemo(() => filterCadenciaQueue(leads, tab, today), [leads, tab, today])
  useEffect(() => { setPage(0) }, [tab])
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visibleLeads.length / PAGE_SIZE) - 1))

  function replaceLead(saved: Lead) {
    setLeads((current) => {
      const next = current.map((item) => item.id === saved.id ? saved : item)
      return filterCadenciaQueue(next, 'todos', today)
    })
  }

  async function applyCadencia(lead: Lead, acao: CadenciaAcao, extra?: { nextAction?: string; nextActionDueDate?: string }) {
    setBusyLeadId(lead.id)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const saved = await registrarCadencia(supabase, lead, { acao, ...extra })
      replaceLead(saved)
      if (acao === 'respondeu') {
        setRescheduling(saved)
        setSuccessMessage('Resposta registrada. Agende o próximo contato para o lead voltar à fila.')
      } else {
        setRescheduling(null)
        setSuccessMessage(acao === 'reagendar' ? 'Lead reagendado.' : 'Atividade registrada.')
      }
    } catch (error) {
      if (error instanceof CadenciaTouchLimitError) {
        setTouchLimitLead(lead)
        return
      }
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível registrar a atividade.')
    } finally {
      setBusyLeadId(null)
    }
  }

  function openConfirmarReuniao(lead: Lead) {
    if (kitWhatsappEnabled) {
      setWhatsappPreferred(waSpecSeedNames[4])
      setWhatsappLead(lead)
      return
    }
    const url = whatsappMeUrl(porteiroEnabled ? principalWhatsapp(lead) : lead.whatsapp)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    else setErrorMessage('Informe um WhatsApp válido no cadastro do lead.')
  }

  async function applyResultado(lead: Lead, input: ReuniaoResultadoInput) {
    setBusyLeadId(lead.id)
    setErrorMessage('')
    try {
      const saved = await registrarResultadoReuniao(supabase, lead, input)
      replaceLead(saved)
      setResultadoLead(null)
      setSuccessMessage(
        saved.status === 'convertido'
          ? 'Reunião fechou. Lead convertido em cliente.'
          : saved.status === 'perdido'
            ? 'Reunião recusada. Lead marcado como perdido.'
            : 'Resultado da reunião registrado.',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível registrar o resultado.'
      setErrorMessage(message)
      throw error
    } finally {
      setBusyLeadId(null)
    }
  }

  async function applyStatus(lead: Lead, toStatus: Extract<LeadStatus, 'perdido' | 'pausado_60d'>, input: LeadStatusTransitionInput = {}) {
    setBusyLeadId(lead.id)
    setErrorMessage('')
    try {
      const saved = await updateLeadStatus(supabase, lead, toStatus, input)
      setLeads((current) => current.filter((item) => item.id !== saved.id))
      setPendingStatus(null)
      setTouchLimitLead(null)
      setSuccessMessage(toStatus === 'perdido' ? 'Lead marcado como perdido.' : 'Lead pausado por 60 dias.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível atualizar o status.'
      setErrorMessage(message)
      throw error
    } finally {
      setBusyLeadId(null)
    }
  }

  const hasEmptyQueue = !isLoading && visibleLeads.length === 0

  return (
    <section className="page-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Cadência</p>
          <h1>O que fazer hoje</h1>
          <p>Fila de leads ativos com próxima ação até o fim do dia em Recife.</p>
        </div>
      </div>
      <div className="cadencia-tabs" role="tablist" aria-label="Fila de cadência">
        {cadenciaQueueTabs.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? 'cadencia-tab cadencia-tab-active' : 'cadencia-tab'}
            onClick={() => setTab(item)}
          >
            {tabLabels[item]}
          </button>
        ))}
      </div>
      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      {successMessage && <p className="validation-ok" role="status">{successMessage}</p>}
      <p className="lead-count" role="status" aria-live="polite">
        {visibleLeads.length} {visibleLeads.length === 1 ? 'lead na fila' : 'leads na fila'}
      </p>
      {!isLoading && novosSemData.length > 0 && (
        <div className="cadencia-empty-cta cadencia-novos-cta">
          <p>
            {novosSemData.length === 1
              ? 'Há 1 lead novo sem data de próxima ação.'
              : `Há ${novosSemData.length} leads novos sem data de próxima ação.`}
          </p>
          <ul className="cadencia-empty-list">
            {novosSemData.slice(0, 5).map((lead) => (
              <li key={lead.id}>
                <button type="button" className="company-link" onClick={() => onOpenLead(lead.id)}>
                  {lead.company_name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Status</th>
              <th>WhatsApp</th>
              <th>Próxima ação</th>
              <th>Data</th>
              <th>Toques</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr className="table-message"><td colSpan={7}>Carregando a fila de hoje…</td></tr>
            ) : hasEmptyQueue ? (
              <tr className="table-message">
                <td colSpan={7}>
                  <div className="empty-state" id="hoje-empty-help">
                    <CalendarClock size={28} aria-hidden="true" />
                    <strong>Nada para fazer nesta visão.</strong>
                    <span>
                      {tab === 'atrasadas'
                        ? 'Não há ações atrasadas na cadência.'
                        : tab === 'hoje'
                          ? 'Nenhum lead com ação prevista para hoje.'
                          : 'Nenhum lead ativo com próxima ação até hoje.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : visibleLeads.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((lead) => {
              const overdue = Boolean(lead.next_action_due_date && lead.next_action_due_date < today)
              return (
                <tr key={lead.id}>
                  <td data-label="Empresa">
                    <button className="company-link" onClick={() => onOpenLead(lead.id)}>{lead.company_name}</button>
                    {lead.segment && <span className="table-note">{lead.segment}</span>}
                  </td>
                  <td data-label="Status"><LeadStatusBadge status={lead.status} funilEnabled={funilEnabled} /></td>
                  <td data-label="WhatsApp">{maskWhatsapp(porteiroEnabled ? principalWhatsapp(lead) : lead.whatsapp)}</td>
                  <td data-label="Próxima ação">{lead.next_action || '—'}</td>
                  <td data-label="Data">
                    <strong className={overdue ? 'overdue' : ''}>
                      {dateLabel(lead.next_action_due_date)}
                      {overdue && <span className="status status-perdido">Atrasada</span>}
                    </strong>
                  </td>
                  <td data-label="Toques">{lead.touches_sem_resposta ?? 0}</td>
                  <td data-label="Ações" className="row-actions">
                    <CadenciaActions
                      lead={lead}
                      busy={busyLeadId === lead.id}
                      onToquei={() => void applyCadencia(lead, 'toquei')}
                      onRespondeu={() => void applyCadencia(lead, 'respondeu')}
                      onSemResposta={() => void applyCadencia(lead, 'sem_resposta')}
                      onReagendar={() => setRescheduling(lead)}
                      onPerdido={() => setPendingStatus({ lead, toStatus: 'perdido' })}
                      onPausar={() => setPendingStatus({ lead, toStatus: 'pausado_60d' })}
                      onAbrirWhatsApp={kitWhatsappEnabled ? () => { setWhatsappPreferred(undefined); setWhatsappLead(lead) } : undefined}
                      onConfirmarReuniao={reuniaoEnabled ? () => openConfirmarReuniao(lead) : undefined}
                      onRegistrarResultado={reuniaoEnabled ? () => setResultadoLead(lead) : undefined}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!isLoading && <Pagination page={currentPage} total={visibleLeads.length} onChange={setPage} />}
      {rescheduling && (
        <RescheduleDialog
          lead={rescheduling}
          busy={busyLeadId === rescheduling.id}
          onCancel={() => setRescheduling(null)}
          onConfirm={(input) => applyCadencia(rescheduling, 'reagendar', input)}
        />
      )}
      {touchLimitLead && (
        <TouchLimitDialog
          lead={touchLimitLead}
          busy={busyLeadId === touchLimitLead.id}
          onCancel={() => setTouchLimitLead(null)}
          onPause={() => {
            const lead = touchLimitLead
            setTouchLimitLead(null)
            setPendingStatus({ lead, toStatus: 'pausado_60d' })
          }}
          onLost={() => {
            const lead = touchLimitLead
            setTouchLimitLead(null)
            setPendingStatus({ lead, toStatus: 'perdido' })
          }}
        />
      )}
      {kitWhatsappEnabled && whatsappLead && (
        <OpenWhatsAppDialog
          supabase={supabase}
          lead={whatsappLead}
          busy={busyLeadId === whatsappLead.id}
          preferredTemplateName={whatsappPreferred}
          onClose={() => {
            setWhatsappLead(null)
            setWhatsappPreferred(undefined)
          }}
          onLeadUpdated={(saved) => {
            replaceLead(saved)
            setWhatsappLead(saved)
          }}
          onTouchLimit={(lead) => {
            setWhatsappLead(null)
            setWhatsappPreferred(undefined)
            setTouchLimitLead(lead)
          }}
        />
      )}
      {reuniaoEnabled && resultadoLead && (
        <ReuniaoResultadoDialog
          lead={resultadoLead}
          busy={busyLeadId === resultadoLead.id}
          onCancel={() => setResultadoLead(null)}
          onConfirm={(input) => applyResultado(resultadoLead, input)}
        />
      )}
      {pendingStatus && (
        <LeadStatusTransitionDialog
          lead={pendingStatus.lead}
          toStatus={pendingStatus.toStatus}
          evaluation={{
            allowed: true,
            typical: true,
            requiresMotivo: pendingStatus.toStatus === 'perdido',
            requiresReuniao: false,
            requiresEncaminhadoNote: false,
            suggestsPause: pendingStatus.toStatus === 'pausado_60d',
          }}
          busy={busyLeadId === pendingStatus.lead.id}
          onCancel={() => setPendingStatus(null)}
          onConfirm={(input) => applyStatus(pendingStatus.lead, pendingStatus.toStatus, input)}
        />
      )}
    </section>
  )
}
