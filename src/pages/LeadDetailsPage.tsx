import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MessageCircle } from 'lucide-react'
import { LeadForm } from '../features/leads/LeadForm'
import { LeadStatusBadge } from '../features/leads/LeadStatusBadge'
import { LeadStatusHistory } from '../features/leads/LeadStatusHistory'
import { LeadStatusTransitionDialog } from '../features/leads/LeadStatusTransitionDialog'
import {
  conversionBlockMessage,
  conversionDecision,
  detailStatusOptions,
  evaluateLeadStatusTransition,
  isLeadStatus,
  needsTransitionDialog,
  type LeadStatusTransitionInput,
} from '../features/leads/lead-status'
import { convertLeadToClient, getLead, listLeadStatusHistory, updateLead, updateLeadStatus } from '../features/leads/lead-service'
import { LeadActivityTimeline } from '../features/cadencia/LeadActivityTimeline'
import { listLeadAtividades } from '../features/cadencia/cadencia-service'
import { leadStatusLabels, lossReasonLabels, type Lead, type LeadFormValues, type LeadStatus, type LeadStatusHistoryEntry } from '../types/lead'
import type { LeadAtividade } from '../types/cadencia'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { OpenWhatsAppDialog } from '../features/whatsapp/OpenWhatsAppDialog'
import { isGlcFilaCadenciaEnabled, isGlcFunilStatusEnabled, isGlcKitWhatsappEnabled } from '../utils/feature-flags'

type LeadDetailsPageProps = { supabase: SupabaseClient; leadId: string; onBack: () => void }

import { dateLabel, dateTimeLabel } from '../utils/dates'
const safeMapUrl = (value: string | null) => {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function LeadDetailsPage({ supabase, leadId, onBack }: LeadDetailsPageProps) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [history, setHistory] = useState<LeadStatusHistoryEntry[]>([])
  const [atividades, setAtividades] = useState<LeadAtividade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [showConversionConfirmation, setShowConversionConfirmation] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null)
  const [conversionMessage, setConversionMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null)
  const funilEnabled = isGlcFunilStatusEnabled()
  const cadenciaEnabled = isGlcFilaCadenciaEnabled()
  const kitWhatsappEnabled = isGlcKitWhatsappEnabled()
  const mapUrl = safeMapUrl(lead?.google_maps_url ?? null)
  const convertDecision = lead ? conversionDecision(lead.status, funilEnabled) : 'block'

  const load = useCallback(async () => {
    setIsLoading(true); setErrorMessage('')
    try {
      const nextLead = await getLead(supabase, leadId)
      setLead(nextLead)
      if (funilEnabled) {
        try { setHistory(await listLeadStatusHistory(supabase, leadId)) }
        catch { setHistory([]) }
      }
      if (cadenciaEnabled) {
        try { setAtividades(await listLeadAtividades(supabase, leadId)) }
        catch { setAtividades([]) }
      }
    } catch { setErrorMessage('Não foi possível carregar este lead.') }
    setIsLoading(false)
  }, [cadenciaEnabled, funilEnabled, leadId, supabase])

  useEffect(() => { void load() }, [load])

  async function save(values: LeadFormValues) {
    setIsSaving(true); setErrorMessage('')
    try { setLead(await updateLead(supabase, leadId, values, lead!.updated_at)); setIsEditing(false) }
    catch { setErrorMessage('Não foi possível salvar. Confira os campos; o registro pode ter sido alterado por outra pessoa. Preserve seu texto e atualize antes de repetir.') }
    setIsSaving(false)
  }

  async function applyStatus(toStatus: LeadStatus, input: LeadStatusTransitionInput = {}) {
    if (!lead) return
    setIsSavingStatus(true); setErrorMessage('')
    try {
      const saved = await updateLeadStatus(supabase, lead, toStatus, input)
      setLead(saved)
      setPendingStatus(null)
      if (funilEnabled) setHistory(await listLeadStatusHistory(supabase, leadId))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível atualizar o status.'
      setErrorMessage(message)
      throw error
    } finally {
      setIsSavingStatus(false)
    }
  }

  async function requestStatusChange(next: string) {
    if (!lead || !isLeadStatus(next) || next === lead.status) return
    const evaluation = evaluateLeadStatusTransition(lead.status, next)
    if (!evaluation.allowed) {
      setErrorMessage(evaluation.error ?? 'Transição de status inválida.')
      return
    }
    if (needsTransitionDialog(evaluation)) {
      setErrorMessage('')
      setPendingStatus(next)
      return
    }
    try { await applyStatus(next) } catch { /* mensagem já definida */ }
  }

  async function convert() {
    if (!lead || isConverting || convertDecision === 'block') return
    setIsConverting(true); setErrorMessage(''); setConversionMessage('')
    try {
      await convertLeadToClient(supabase, leadId)
      setLead((current) => current ? { ...current, status: 'convertido' } : current)
      setConversionMessage('Lead convertido em cliente com sucesso.')
      if (funilEnabled) setHistory(await listLeadStatusHistory(supabase, leadId))
    } catch { setErrorMessage('Não foi possível converter o lead agora. Tente novamente em alguns instantes ou contate o responsável pelo sistema.') }
    finally { setIsConverting(false); setShowConversionConfirmation(false) }
  }

  if (isLoading) return <section className="page-content">Carregando lead…</section>
  if (!lead) return <section className="page-content"><p className="form-error">{errorMessage || 'Lead não encontrado.'}</p><button onClick={onBack}>Voltar para leads</button></section>
  if (isEditing) return <section className="page-content"><div className="detail-header"><div><button className="button-link back-button" onClick={() => setIsEditing(false)}>← Voltar aos detalhes</button><p className="eyebrow">Editar lead</p><h1>{lead.company_name}</h1></div></div>{errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}<LeadForm lead={lead} isSaving={isSaving} onCancel={() => setIsEditing(false)} onSave={save} /></section>

  const pendingEvaluation = pendingStatus ? evaluateLeadStatusTransition(lead.status, pendingStatus) : null
  const conversionMessageText = convertDecision === 'confirm'
    ? 'Este lead ainda está em um estágio inicial do funil. Converter agora cria o cliente e tira o registro da visão de ativos.'
    : 'Os dados e as anotações serão preservados. O lead deixará de aparecer na visão padrão de leads.'

  return <section className="page-content">
    <div className="detail-header"><div><button className="button-link back-button" onClick={onBack}>← Voltar para leads</button><p className="eyebrow">Detalhes do lead</p><h1>{lead.company_name}</h1><p>{lead.responsible_name || 'Sem responsável informado'}</p></div><div className="page-actions">{kitWhatsappEnabled && <button className="button-secondary" onClick={() => setWhatsappLead(lead)}><MessageCircle size={16} /> Abrir WhatsApp</button>}{convertDecision !== 'block' && <button onClick={() => setShowConversionConfirmation(true)} disabled={isConverting}>{isConverting ? 'Convertendo…' : 'Converter em cliente'}</button>}<button className="button-secondary" onClick={() => setIsEditing(true)}>Editar lead</button></div></div>
    {convertDecision === 'block' && lead.status !== 'convertido' && <p className="validation-warning" role="status">{conversionBlockMessage(lead.status)}</p>}
    {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
    {conversionMessage && <p className="validation-ok" role="status">{conversionMessage} Para abrir o cliente, acesse a área Clientes e busque por esta empresa.</p>}
    <div className="detail-grid">
      <article><h2>Contato</h2><dl><div><dt>WhatsApp</dt><dd>{lead.whatsapp || '—'}</dd></div><div><dt>E-mail</dt><dd>{lead.email || '—'}</dd></div><div><dt>Instagram</dt><dd>{lead.instagram || '—'}</dd></div></dl></article>
      <article><h2>Qualificação</h2><dl><div><dt>Status</dt><dd><div className="status-detail"><LeadStatusBadge status={lead.status} funilEnabled={funilEnabled} />{funilEnabled && lead.status !== 'convertido' && <label className="field status-select-field">Alterar status<select aria-label="Alterar status do lead" value={lead.status} disabled={isSavingStatus} onChange={(event) => void requestStatusChange(event.target.value)}>{detailStatusOptions(lead.status, true).map((status) => <option key={status} value={status}>{leadStatusLabels[status]}</option>)}</select></label>}</div></dd></div><div><dt>Segmento</dt><dd>{lead.segment || '—'}</dd></div><div><dt>Origem</dt><dd>{lead.source || '—'}</dd></div>{kitWhatsappEnabled && <div><dt>Gatilho</dt><dd>{lead.gatilho || '—'}</dd></div>}{lead.motivo_perda && <div><dt>Motivo da perda</dt><dd>{lossReasonLabels[lead.motivo_perda]}{lead.motivo_perda_detalhe ? ` — ${lead.motivo_perda_detalhe}` : ''}</dd></div>}{lead.reuniao_em && <div><dt>Reunião</dt><dd>{dateTimeLabel(lead.reuniao_em)}{lead.reuniao_link ? <> · <a href={lead.reuniao_link} target="_blank" rel="noreferrer">Abrir link</a></> : ''}</dd></div>}</dl></article>
      <article><h2>Próxima ação</h2><dl><div><dt>Data prevista</dt><dd>{dateLabel(lead.next_action_due_date)}</dd></div><div><dt>Ação</dt><dd>{lead.next_action || '—'}</dd></div>{cadenciaEnabled && <div><dt>Toques sem resposta</dt><dd>{lead.touches_sem_resposta ?? 0}</dd></div>}</dl></article>
      <article><h2>Localização</h2><dl><div><dt>Endereço</dt><dd>{lead.address || '—'}</dd></div><div><dt>Google Maps</dt><dd>{mapUrl ? <a href={mapUrl} target="_blank" rel="noreferrer">Abrir mapa</a> : lead.google_maps_url ? 'Link inválido' : '—'}</dd></div></dl></article>
      {kitWhatsappEnabled && <article className="detail-wide"><h2>Protótipo</h2><dl><div><dt>URL</dt><dd>{safeMapUrl(lead.prototipo_url) ? <a href={safeMapUrl(lead.prototipo_url)!} target="_blank" rel="noreferrer">{lead.prototipo_url}</a> : lead.prototipo_url ? 'Link inválido' : '—'}</dd></div><div><dt>Notas</dt><dd>{lead.prototipo_notas || '—'}</dd></div></dl></article>}
      <article className="detail-wide"><h2>Resumo e anotações</h2><p>{lead.notes || 'Nenhuma anotação registrada.'}</p></article>
      {funilEnabled && <LeadStatusHistory entries={history} />}
      {cadenciaEnabled && <LeadActivityTimeline entries={atividades} />}
    </div>
    {pendingStatus && pendingEvaluation && <LeadStatusTransitionDialog lead={lead} toStatus={pendingStatus} evaluation={pendingEvaluation} busy={isSavingStatus} onCancel={() => setPendingStatus(null)} onConfirm={(input) => applyStatus(pendingStatus, input)} />}
    {showConversionConfirmation && <ConfirmDialog labelledBy="convert-lead-title" title={`Converter ${lead.company_name} em cliente?`} message={conversionMessageText} confirmLabel="Converter lead" busy={isConverting} onCancel={() => setShowConversionConfirmation(false)} onConfirm={() => void convert()} />}
    {kitWhatsappEnabled && whatsappLead && (
      <OpenWhatsAppDialog
        supabase={supabase}
        lead={whatsappLead}
        onClose={() => setWhatsappLead(null)}
        onLeadUpdated={(saved) => {
          setLead(saved)
          setWhatsappLead(saved)
          if (cadenciaEnabled) void listLeadAtividades(supabase, leadId).then(setAtividades).catch(() => undefined)
        }}
      />
    )}
  </section>
}
