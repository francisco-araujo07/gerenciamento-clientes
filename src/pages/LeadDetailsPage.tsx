import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LeadForm } from '../features/leads/LeadForm'
import { getLead, updateLead } from '../features/leads/lead-service'
import { leadStatusLabels, type Lead, type LeadFormValues } from '../types/lead'

type LeadDetailsPageProps = { supabase: SupabaseClient; leadId: string; onBack: () => void }

const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00`)) : 'Não definida'

export function LeadDetailsPage({ supabase, leadId, onBack }: LeadDetailsPageProps) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true); setErrorMessage('')
    try { setLead(await getLead(supabase, leadId)) } catch { setErrorMessage('Não foi possível carregar este lead.') }
    setIsLoading(false)
  }, [leadId, supabase])

  useEffect(() => { void load() }, [load])

  async function save(values: LeadFormValues) {
    setIsSaving(true); setErrorMessage('')
    try { setLead(await updateLead(supabase, leadId, values)); setIsEditing(false) }
    catch { setErrorMessage('Não foi possível salvar as alterações.') }
    setIsSaving(false)
  }

  if (isLoading) return <section className="page-content">Carregando lead…</section>
  if (!lead) return <section className="page-content"><p className="form-error">{errorMessage || 'Lead não encontrado.'}</p><button onClick={onBack}>Voltar para leads</button></section>
  if (isEditing) return <section className="page-content"><div className="detail-header"><div><button className="button-link back-button" onClick={() => setIsEditing(false)}>← Voltar aos detalhes</button><p className="eyebrow">Editar lead</p><h1>{lead.company_name}</h1></div></div>{errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}<LeadForm lead={lead} isSaving={isSaving} onCancel={() => setIsEditing(false)} onSave={save} /></section>

  return <section className="page-content">
    <div className="detail-header"><div><button className="button-link back-button" onClick={onBack}>← Voltar para leads</button><p className="eyebrow">Detalhes do lead</p><h1>{lead.company_name}</h1><p>{lead.responsible_name || 'Sem responsável informado'}</p></div><button onClick={() => setIsEditing(true)}>Editar lead</button></div>
    {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
    <div className="detail-grid">
      <article><h2>Contato</h2><dl><div><dt>WhatsApp</dt><dd>{lead.whatsapp || '—'}</dd></div><div><dt>E-mail</dt><dd>{lead.email || '—'}</dd></div><div><dt>Instagram</dt><dd>{lead.instagram || '—'}</dd></div></dl></article>
      <article><h2>Qualificação</h2><dl><div><dt>Status</dt><dd><span className={`status status-${lead.status}`}>{leadStatusLabels[lead.status]}</span></dd></div><div><dt>Segmento</dt><dd>{lead.segment || '—'}</dd></div><div><dt>Origem</dt><dd>{lead.source || '—'}</dd></div></dl></article>
      <article><h2>Próxima ação</h2><dl><div><dt>Data prevista</dt><dd>{dateLabel(lead.next_action_due_date)}</dd></div><div><dt>Ação</dt><dd>{lead.next_action || '—'}</dd></div></dl></article>
      <article><h2>Localização</h2><dl><div><dt>Endereço</dt><dd>{lead.address || '—'}</dd></div><div><dt>Google Maps</dt><dd>{lead.google_maps_url ? <a href={lead.google_maps_url} target="_blank" rel="noreferrer">Abrir mapa</a> : '—'}</dd></div></dl></article>
      <article className="detail-wide"><h2>Resumo e anotações</h2><p>{lead.notes || 'Nenhuma anotação registrada.'}</p></article>
    </div>
  </section>
}
