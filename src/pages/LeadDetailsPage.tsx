import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LeadForm } from '../features/leads/LeadForm'
import { convertLeadToClient, getLead, updateLead } from '../features/leads/lead-service'
import { leadStatusLabels, type Lead, type LeadFormValues } from '../types/lead'

type LeadDetailsPageProps = { supabase: SupabaseClient; leadId: string; onBack: () => void }

import { dateLabel } from '../utils/dates'
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
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [conversionMessage, setConversionMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const mapUrl = safeMapUrl(lead?.google_maps_url ?? null)

  const load = useCallback(async () => {
    setIsLoading(true); setErrorMessage('')
    try { setLead(await getLead(supabase, leadId)) } catch { setErrorMessage('Não foi possível carregar este lead.') }
    setIsLoading(false)
  }, [leadId, supabase])

  useEffect(() => { void load() }, [load])

  async function save(values: LeadFormValues) {
    setIsSaving(true); setErrorMessage('')
    try { setLead(await updateLead(supabase, leadId, values, lead!.updated_at)); setIsEditing(false) }
    catch { setErrorMessage('Não foi possível salvar. Confira os campos; o registro pode ter sido alterado por outra pessoa. Preserve seu texto e atualize antes de repetir.') }
    setIsSaving(false)
  }

  async function convert() {
    if (!window.confirm(`Converter ${lead?.company_name} em cliente? Os dados e anotações serão preservados.`)) return
    setIsConverting(true); setErrorMessage(''); setConversionMessage('')
    try {
      await convertLeadToClient(supabase, leadId)
      setLead((current) => current ? { ...current, status: 'convertido' } : current)
      setConversionMessage('Lead convertido em cliente com sucesso.')
    } catch { setErrorMessage('Não foi possível converter o lead. Confira se a migração de conversão foi aplicada no Supabase.') }
    setIsConverting(false)
  }

  if (isLoading) return <section className="page-content">Carregando lead…</section>
  if (!lead) return <section className="page-content"><p className="form-error">{errorMessage || 'Lead não encontrado.'}</p><button onClick={onBack}>Voltar para leads</button></section>
  if (isEditing) return <section className="page-content"><div className="detail-header"><div><button className="button-link back-button" onClick={() => setIsEditing(false)}>← Voltar aos detalhes</button><p className="eyebrow">Editar lead</p><h1>{lead.company_name}</h1></div></div>{errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}<LeadForm lead={lead} isSaving={isSaving} onCancel={() => setIsEditing(false)} onSave={save} /></section>

  return <section className="page-content">
    <div className="detail-header"><div><button className="button-link back-button" onClick={onBack}>← Voltar para leads</button><p className="eyebrow">Detalhes do lead</p><h1>{lead.company_name}</h1><p>{lead.responsible_name || 'Sem responsável informado'}</p></div><div className="page-actions">{(lead.status === 'novo' || lead.status === 'negociacao') && <button onClick={() => void convert()} disabled={isConverting}>{isConverting ? 'Convertendo…' : 'Converter em cliente'}</button>}<button className="button-secondary" onClick={() => setIsEditing(true)}>Editar lead</button></div></div>
    {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
    {conversionMessage && <p className="validation-ok" role="status">{conversionMessage}</p>}
    <div className="detail-grid">
      <article><h2>Contato</h2><dl><div><dt>WhatsApp</dt><dd>{lead.whatsapp || '—'}</dd></div><div><dt>E-mail</dt><dd>{lead.email || '—'}</dd></div><div><dt>Instagram</dt><dd>{lead.instagram || '—'}</dd></div></dl></article>
      <article><h2>Qualificação</h2><dl><div><dt>Status</dt><dd><span className={`status status-${lead.status}`}>{leadStatusLabels[lead.status]}</span></dd></div><div><dt>Segmento</dt><dd>{lead.segment || '—'}</dd></div><div><dt>Origem</dt><dd>{lead.source || '—'}</dd></div></dl></article>
      <article><h2>Próxima ação</h2><dl><div><dt>Data prevista</dt><dd>{dateLabel(lead.next_action_due_date)}</dd></div><div><dt>Ação</dt><dd>{lead.next_action || '—'}</dd></div></dl></article>
      <article><h2>Localização</h2><dl><div><dt>Endereço</dt><dd>{lead.address || '—'}</dd></div><div><dt>Google Maps</dt><dd>{mapUrl ? <a href={mapUrl} target="_blank" rel="noreferrer">Abrir mapa</a> : lead.google_maps_url ? 'Link inválido' : '—'}</dd></div></dl></article>
      <article className="detail-wide"><h2>Resumo e anotações</h2><p>{lead.notes || 'Nenhuma anotação registrada.'}</p></article>
    </div>
  </section>
}
