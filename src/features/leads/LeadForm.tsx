import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  contatoPrincipalLabels,
  emptyLeadFormValues,
  leadStatusLabels,
  type ContatoPrincipal,
  type Lead,
  type LeadFormValues,
} from '../../types/lead'
import { contactSpotlight } from '../porteiro-decisor/contacts'
import { isGlcFunilStatusEnabled, isGlcKitWhatsappEnabled, isGlcPorteiroDecisorEnabled } from '../../utils/feature-flags'
import { LeadStatusBadge } from './LeadStatusBadge'
import { visibleLeadStatuses } from './lead-status'

type LeadFormProps = { lead?: Lead | null; isSaving: boolean; onCancel: () => void; onSave: (values: LeadFormValues) => Promise<void> }

function formValuesFromLead(lead: Lead): LeadFormValues {
  const {
    id: _id,
    created_at: _createdAt,
    updated_at: _updatedAt,
    touches_sem_resposta: _touches,
    wa_ultimo_template_id: _lastTemplate,
    deleted_at: _deletedAt,
    ...formValues
  } = lead
  return {
    ...formValues,
    motivo_perda: formValues.motivo_perda ?? null,
    motivo_perda_detalhe: formValues.motivo_perda_detalhe ?? '',
    reuniao_em: formValues.reuniao_em ?? '',
    reuniao_link: formValues.reuniao_link ?? '',
    gatilho: formValues.gatilho ?? '',
    prototipo_url: formValues.prototipo_url ?? '',
    prototipo_notas: formValues.prototipo_notas ?? '',
    porteiro_nome: formValues.porteiro_nome ?? '',
    porteiro_whatsapp: formValues.porteiro_whatsapp ?? '',
    decisor_nome: formValues.decisor_nome ?? '',
    decisor_whatsapp: formValues.decisor_whatsapp ?? '',
    decisor_cargo: formValues.decisor_cargo ?? '',
    contato_principal: formValues.contato_principal ?? 'geral',
    ultimo_combinado_com_porteiro: formValues.ultimo_combinado_com_porteiro ?? '',
  }
}

export function LeadForm({ lead, isSaving, onCancel, onSave }: LeadFormProps) {
  const [values, setValues] = useState<LeadFormValues>(emptyLeadFormValues)
  const funilEnabled = isGlcFunilStatusEnabled()
  const kitWhatsappEnabled = isGlcKitWhatsappEnabled()
  const porteiroEnabled = isGlcPorteiroDecisorEnabled()
  useEffect(() => {
    if (!lead) return setValues(emptyLeadFormValues)
    setValues(formValuesFromLead(lead))
  }, [lead])
  function field(name: keyof LeadFormValues, value: string) { setValues((current) => ({ ...current, [name]: value })) }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (isSaving) return; await onSave(values) }
  const statusOptions = visibleLeadStatuses(funilEnabled, lead?.status)
  const spotlight = porteiroEnabled ? contactSpotlight(values, values.status) : null

  function principalRadio(value: ContatoPrincipal) {
    return (
      <label className="contact-principal-radio">
        <input
          type="radio"
          name="contato_principal"
          value={value}
          checked={values.contato_principal === value}
          onChange={() => field('contato_principal', value)}
        />
        Usar este número no WhatsApp padrão
      </label>
    )
  }

  return <form className="lead-form" onSubmit={submit}>
    <div className="form-grid">
      <label className="field field-wide">Empresa *<input value={values.company_name} onChange={(e) => field('company_name', e.target.value)} maxLength={200} required aria-required="true" /></label>
      {porteiroEnabled ? (
        <>
          {spotlight && <p className="validation-warning field-wide" role="status">{spotlight}</p>}
          <fieldset className="contact-block field-wide">
            <legend>Geral</legend>
            <div className="form-grid">
              <label className="field">Responsável<input value={values.responsible_name ?? ''} onChange={(e) => field('responsible_name', e.target.value)} maxLength={200} /></label>
              <label className="field">WhatsApp<input value={values.whatsapp ?? ''} onChange={(e) => field('whatsapp', e.target.value)} maxLength={50} inputMode="tel" /></label>
            </div>
            {principalRadio('geral')}
          </fieldset>
          <fieldset className="contact-block field-wide">
            <legend>Porteiro</legend>
            <div className="form-grid">
              <label className="field">Nome do porteiro<input value={values.porteiro_nome ?? ''} onChange={(e) => field('porteiro_nome', e.target.value)} maxLength={200} /></label>
              <label className="field">WhatsApp do porteiro<input value={values.porteiro_whatsapp ?? ''} onChange={(e) => field('porteiro_whatsapp', e.target.value)} maxLength={50} inputMode="tel" /></label>
              <label className="field field-wide">Último combinado com o porteiro<textarea value={values.ultimo_combinado_com_porteiro ?? ''} onChange={(e) => field('ultimo_combinado_com_porteiro', e.target.value)} maxLength={2000} rows={2} aria-describedby="ultimo-combinado-counter" /><span id="ultimo-combinado-counter" className="field-counter">{(values.ultimo_combinado_com_porteiro ?? '').length}/2000</span></label>
            </div>
            {principalRadio('porteiro')}
          </fieldset>
          <fieldset className="contact-block field-wide">
            <legend>Decisor</legend>
            <div className="form-grid">
              <label className="field">Nome do decisor<input value={values.decisor_nome ?? ''} onChange={(e) => field('decisor_nome', e.target.value)} maxLength={200} /></label>
              <label className="field">WhatsApp do decisor<input value={values.decisor_whatsapp ?? ''} onChange={(e) => field('decisor_whatsapp', e.target.value)} maxLength={50} inputMode="tel" /></label>
              <label className="field field-wide">Cargo do decisor<input value={values.decisor_cargo ?? ''} onChange={(e) => field('decisor_cargo', e.target.value)} maxLength={200} /></label>
            </div>
            {principalRadio('decisor')}
          </fieldset>
        </>
      ) : (
        <>
          <label className="field">Responsável<input value={values.responsible_name ?? ''} onChange={(e) => field('responsible_name', e.target.value)} maxLength={200} /></label>
          <label className="field">WhatsApp<input value={values.whatsapp ?? ''} onChange={(e) => field('whatsapp', e.target.value)} maxLength={50} inputMode="tel" /></label>
        </>
      )}
      <label className="field">E-mail<input value={values.email ?? ''} onChange={(e) => field('email', e.target.value)} maxLength={254} type="email" /></label>
      <label className="field">Instagram<input value={values.instagram ?? ''} onChange={(e) => field('instagram', e.target.value)} maxLength={200} /></label>
      <label className="field">Segmento<input value={values.segment ?? ''} onChange={(e) => field('segment', e.target.value)} maxLength={200} /></label>
      <label className="field">Origem<input value={values.source ?? ''} onChange={(e) => field('source', e.target.value)} maxLength={200} placeholder="Google, Instagram, indicação..." /></label>
      {lead ? (
        <div className="field field-wide">Status e cadência<LeadStatusBadge status={values.status} /><span className="field-counter">{funilEnabled ? 'Status muda no detalhe. Próxima ação e data mudam pela fila Hoje.' : 'Status, próxima ação e data não são alterados pela edição cadastral.'}</span></div>
      ) : (
        <>
          <label className="field">Status<select value={values.status} onChange={(e) => field('status', e.target.value)}>{statusOptions.map((status) => <option key={status} value={status}>{leadStatusLabels[status]}</option>)}</select></label>
          <label className="field">Data da próxima ação<input value={values.next_action_due_date ?? ''} onChange={(e) => field('next_action_due_date', e.target.value)} type="date" /></label>
        </>
      )}
      <label className="field field-wide">Endereço<input value={values.address ?? ''} onChange={(e) => field('address', e.target.value)} maxLength={1000} /></label>
      <label className="field field-wide">Link do Google Maps<input value={values.google_maps_url ?? ''} onChange={(e) => field('google_maps_url', e.target.value)} maxLength={2048} type="url" /></label>
      {lead ? null : (
        <label className="field field-wide">Próxima ação<textarea value={values.next_action ?? ''} onChange={(e) => field('next_action', e.target.value)} maxLength={2000} rows={2} aria-describedby="next-action-counter" /><span id="next-action-counter" className="field-counter">{(values.next_action ?? '').length}/2000</span></label>
      )}
      {kitWhatsappEnabled && (
        <>
          <label className="field field-wide">Gatilho<textarea value={values.gatilho ?? ''} onChange={(e) => field('gatilho', e.target.value)} maxLength={280} rows={2} aria-describedby="gatilho-counter" /><span id="gatilho-counter" className="field-counter">{(values.gatilho ?? '').length}/280</span></label>
          <label className="field field-wide">URL do protótipo<input value={values.prototipo_url ?? ''} onChange={(e) => field('prototipo_url', e.target.value)} maxLength={2048} type="url" placeholder="https://" /></label>
          <label className="field field-wide">Notas do protótipo<textarea value={values.prototipo_notas ?? ''} onChange={(e) => field('prototipo_notas', e.target.value)} maxLength={2000} rows={2} aria-describedby="prototipo-notas-counter" /><span id="prototipo-notas-counter" className="field-counter">{(values.prototipo_notas ?? '').length}/2000</span></label>
        </>
      )}
      <label className="field field-wide">Resumo e anotações<textarea value={values.notes ?? ''} onChange={(e) => field('notes', e.target.value)} maxLength={10000} rows={4} aria-describedby="notes-counter" /><span id="notes-counter" className="field-counter">{(values.notes ?? '').length}/10000</span></label>
    </div>
    {porteiroEnabled && (
      <p className="field-counter">WhatsApp padrão: {contatoPrincipalLabels[values.contato_principal]}. O bloco Geral mantém responsável e WhatsApp legados.</p>
    )}
    <div className="form-actions"><button type="button" className="button-secondary" disabled={isSaving} onClick={onCancel}>Cancelar</button><button type="submit" disabled={isSaving}>{isSaving ? 'Salvando…' : 'Salvar lead'}</button></div>
  </form>
}
