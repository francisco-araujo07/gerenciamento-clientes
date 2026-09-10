import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { emptyLeadFormValues, leadStatusLabels, leadStatuses, type Lead, type LeadFormValues } from '../../types/lead'

type LeadFormProps = { lead?: Lead | null; isSaving: boolean; onCancel: () => void; onSave: (values: LeadFormValues) => Promise<void> }

export function LeadForm({ lead, isSaving, onCancel, onSave }: LeadFormProps) {
  const [values, setValues] = useState<LeadFormValues>(emptyLeadFormValues)
  useEffect(() => {
    if (!lead) return setValues(emptyLeadFormValues)
    const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...formValues } = lead
    setValues(formValues)
  }, [lead])
  function field(name: keyof LeadFormValues, value: string) { setValues((current) => ({ ...current, [name]: value })) }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (isSaving) return; await onSave(values) }
  return <form className="lead-form" onSubmit={submit}>
    <div className="form-grid">
      <label className="field field-wide">Empresa *<input value={values.company_name} onChange={(e) => field('company_name', e.target.value)} required /></label>
      <label className="field">Responsável<input value={values.responsible_name ?? ''} onChange={(e) => field('responsible_name', e.target.value)} /></label>
      <label className="field">WhatsApp<input value={values.whatsapp ?? ''} onChange={(e) => field('whatsapp', e.target.value)} inputMode="tel" /></label>
      <label className="field">E-mail<input value={values.email ?? ''} onChange={(e) => field('email', e.target.value)} type="email" /></label>
      <label className="field">Instagram<input value={values.instagram ?? ''} onChange={(e) => field('instagram', e.target.value)} /></label>
      <label className="field">Segmento<input value={values.segment ?? ''} onChange={(e) => field('segment', e.target.value)} /></label>
      <label className="field">Origem<input value={values.source ?? ''} onChange={(e) => field('source', e.target.value)} placeholder="Google, Instagram, indicação..." /></label>
      <label className="field">Status<select value={values.status} onChange={(e) => field('status', e.target.value)}>{leadStatuses.filter((status) => status !== 'convertido' || lead?.status === 'convertido').map((status) => <option key={status} value={status}>{leadStatusLabels[status]}</option>)}</select></label>
      <label className="field">Data da próxima ação<input value={values.next_action_due_date ?? ''} onChange={(e) => field('next_action_due_date', e.target.value)} type="date" /></label>
      <label className="field field-wide">Endereço<input value={values.address ?? ''} onChange={(e) => field('address', e.target.value)} /></label>
      <label className="field field-wide">Link do Google Maps<input value={values.google_maps_url ?? ''} onChange={(e) => field('google_maps_url', e.target.value)} type="url" /></label>
      <label className="field field-wide">Próxima ação<textarea value={values.next_action ?? ''} onChange={(e) => field('next_action', e.target.value)} rows={2} /></label>
      <label className="field field-wide">Resumo e anotações<textarea value={values.notes ?? ''} onChange={(e) => field('notes', e.target.value)} rows={4} /></label>
    </div>
    <div className="form-actions"><button type="button" className="button-secondary" disabled={isSaving} onClick={onCancel}>Cancelar</button><button type="submit" disabled={isSaving}>{isSaving ? 'Salvando…' : 'Salvar lead'}</button></div>
  </form>
}
