import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { emptyLeadFormValues, leadStatusLabels, type Lead, type LeadFormValues } from '../../types/lead'
import { isGlcFunilStatusEnabled } from '../../utils/feature-flags'
import { LeadStatusBadge } from './LeadStatusBadge'
import { visibleLeadStatuses } from './lead-status'

type LeadFormProps = { lead?: Lead | null; isSaving: boolean; onCancel: () => void; onSave: (values: LeadFormValues) => Promise<void> }

export function LeadForm({ lead, isSaving, onCancel, onSave }: LeadFormProps) {
  const [values, setValues] = useState<LeadFormValues>(emptyLeadFormValues)
  const funilEnabled = isGlcFunilStatusEnabled()
  useEffect(() => {
    if (!lead) return setValues(emptyLeadFormValues)
    const { id: _id, created_at: _createdAt, updated_at: _updatedAt, touches_sem_resposta: _touches, ...formValues } = lead
    setValues({
      ...formValues,
      motivo_perda: formValues.motivo_perda ?? null,
      motivo_perda_detalhe: formValues.motivo_perda_detalhe ?? '',
      reuniao_em: formValues.reuniao_em ?? '',
      reuniao_link: formValues.reuniao_link ?? '',
    })
  }, [lead])
  function field(name: keyof LeadFormValues, value: string) { setValues((current) => ({ ...current, [name]: value })) }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (isSaving) return; await onSave(values) }
  const statusOptions = visibleLeadStatuses(funilEnabled, lead?.status)
  return <form className="lead-form" onSubmit={submit}>
    <div className="form-grid">
      <label className="field field-wide">Empresa *<input value={values.company_name} onChange={(e) => field('company_name', e.target.value)} maxLength={200} required aria-required="true" /></label>
      <label className="field">Responsável<input value={values.responsible_name ?? ''} onChange={(e) => field('responsible_name', e.target.value)} maxLength={200} /></label>
      <label className="field">WhatsApp<input value={values.whatsapp ?? ''} onChange={(e) => field('whatsapp', e.target.value)} maxLength={50} inputMode="tel" /></label>
      <label className="field">E-mail<input value={values.email ?? ''} onChange={(e) => field('email', e.target.value)} maxLength={254} type="email" /></label>
      <label className="field">Instagram<input value={values.instagram ?? ''} onChange={(e) => field('instagram', e.target.value)} maxLength={200} /></label>
      <label className="field">Segmento<input value={values.segment ?? ''} onChange={(e) => field('segment', e.target.value)} maxLength={200} /></label>
      <label className="field">Origem<input value={values.source ?? ''} onChange={(e) => field('source', e.target.value)} maxLength={200} placeholder="Google, Instagram, indicação..." /></label>
      {lead ? (
        <div className="field">Status<LeadStatusBadge status={values.status} /><span className="field-counter">{funilEnabled ? 'Altere o status na página de detalhes.' : 'O status não é alterado pela edição cadastral.'}</span></div>
      ) : (
        <label className="field">Status<select value={values.status} onChange={(e) => field('status', e.target.value)}>{statusOptions.map((status) => <option key={status} value={status}>{leadStatusLabels[status]}</option>)}</select></label>
      )}
      <label className="field">Data da próxima ação<input value={values.next_action_due_date ?? ''} onChange={(e) => field('next_action_due_date', e.target.value)} type="date" /></label>
      <label className="field field-wide">Endereço<input value={values.address ?? ''} onChange={(e) => field('address', e.target.value)} maxLength={1000} /></label>
      <label className="field field-wide">Link do Google Maps<input value={values.google_maps_url ?? ''} onChange={(e) => field('google_maps_url', e.target.value)} maxLength={2048} type="url" /></label>
      <label className="field field-wide">Próxima ação<textarea value={values.next_action ?? ''} onChange={(e) => field('next_action', e.target.value)} maxLength={2000} rows={2} aria-describedby="next-action-counter" /><span id="next-action-counter" className="field-counter">{(values.next_action ?? '').length}/2000</span></label>
      <label className="field field-wide">Resumo e anotações<textarea value={values.notes ?? ''} onChange={(e) => field('notes', e.target.value)} maxLength={10000} rows={4} aria-describedby="notes-counter" /><span id="notes-counter" className="field-counter">{(values.notes ?? '').length}/10000</span></label>
    </div>
    <div className="form-actions"><button type="button" className="button-secondary" disabled={isSaving} onClick={onCancel}>Cancelar</button><button type="submit" disabled={isSaving}>{isSaving ? 'Salvando…' : 'Salvar lead'}</button></div>
  </form>
}
