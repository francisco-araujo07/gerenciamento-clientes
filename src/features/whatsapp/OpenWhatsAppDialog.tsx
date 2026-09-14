import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CadenciaTouchLimitError } from '../cadencia/cadencia'
import { registrarCadencia } from '../cadencia/cadencia-service'
import { Modal } from '../../components/Modal'
import type { Lead } from '../../types/lead'
import { waTemplateEtapaLabels, type WaTemplate } from '../../types/whatsapp'
import { toE164Br } from '../cadencia/whatsapp'
import {
  defaultWaDestinatario,
  validWaDestinatarios,
  waDestinatarioLabels,
  whatsappForDestinatario,
  type WaDestinatario,
} from '../porteiro-decisor/contacts'
import { isGlcPorteiroDecisorEnabled } from '../../utils/feature-flags'
import {
  buildWaTemplateContext,
  buildWhatsappMeUrl,
  displayNameFromUser,
  interpolateWaTemplate,
  suggestWaTemplate,
} from './templates'
import { currentWhatsappUserName, listWaTemplates, updateLeadLastWaTemplate } from './whatsapp-service'

type Props = {
  supabase: SupabaseClient
  lead: Lead
  busy?: boolean
  initialPreview?: string
  preferredTemplateName?: string
  onClose: () => void
  onLeadUpdated: (lead: Lead) => void
  onTouchLimit?: (lead: Lead) => void
}

export function OpenWhatsAppDialog({
  supabase,
  lead,
  busy = false,
  initialPreview,
  preferredTemplateName,
  onClose,
  onLeadUpdated,
  onTouchLimit,
}: Props) {
  const [templates, setTemplates] = useState<WaTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [preview, setPreview] = useState('')
  const [seuNome, setSeuNome] = useState('—')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [askToquei, setAskToquei] = useState(false)
  const [currentLead, setCurrentLead] = useState(lead)
  const porteiroEnabled = isGlcPorteiroDecisorEnabled()
  const destinatarios = useMemo(
    () => (porteiroEnabled ? validWaDestinatarios(currentLead) : []),
    [currentLead, porteiroEnabled],
  )
  const [destinatario, setDestinatario] = useState<WaDestinatario | null>(
    () => (porteiroEnabled ? defaultWaDestinatario(lead) : 'principal'),
  )

  const selected = useMemo(
    () => templates.find((item) => item.id === templateId) ?? null,
    [templateId, templates],
  )
  const chosenWhatsapp = porteiroEnabled
    ? (destinatario ? whatsappForDestinatario(currentLead, destinatario) : null)
    : currentLead.whatsapp
  const e164 = toE164Br(chosenWhatsapp)
  const waUrl = buildWhatsappMeUrl(chosenWhatsapp, preview)

  useEffect(() => {
    let active = true
    setLoading(true)
    setErrorMessage('')
    void Promise.all([listWaTemplates(supabase, { onlyActive: true }), currentWhatsappUserName(supabase)])
      .then(([rows, user]) => {
        if (!active) return
        setTemplates(rows)
        setSeuNome(displayNameFromUser(user))
        const suggested = suggestWaTemplate(rows, lead.status)
        const preferred = preferredTemplateName
          ? rows.find((item) => item.nome === preferredTemplateName)
          : null
        const chosen = preferred ?? suggested
        setTemplateId(chosen?.id ?? '')
        const context = buildWaTemplateContext(lead, displayNameFromUser(user))
        setPreview(initialPreview?.trim() || (chosen ? interpolateWaTemplate(chosen.corpo, context) : ''))
        if (porteiroEnabled) setDestinatario(defaultWaDestinatario(lead))
      })
      .catch(() => {
        if (active) setErrorMessage('Não foi possível carregar os templates de WhatsApp.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [initialPreview, lead, porteiroEnabled, preferredTemplateName, supabase])

  function applyTemplate(nextId: string) {
    setTemplateId(nextId)
    const next = templates.find((item) => item.id === nextId)
    if (!next) return
    setPreview(interpolateWaTemplate(next.corpo, buildWaTemplateContext(currentLead, seuNome)))
  }

  async function persistLastTemplate(target: Lead) {
    if (!selected) return target
    const saved = await updateLeadLastWaTemplate(supabase, target, selected.id)
    setCurrentLead(saved)
    onLeadUpdated(saved)
    return saved
  }

  async function openWhatsapp() {
    if (working || busy) return
    setErrorMessage('')
    if (!waUrl || !e164) {
      setErrorMessage('Informe um WhatsApp válido no cadastro do lead.')
      return
    }
    setWorking(true)
    try {
      window.open(waUrl, '_blank', 'noopener,noreferrer')
      await persistLastTemplate(currentLead)
      setAskToquei(true)
    } catch {
      setErrorMessage('Não foi possível registrar o último template. A conversa pode ter aberto mesmo assim.')
    } finally {
      setWorking(false)
    }
  }

  async function confirmToquei(consider: boolean) {
    if (working || busy) return
    if (!consider) {
      onClose()
      return
    }
    setWorking(true)
    setErrorMessage('')
    try {
      const saved = await registrarCadencia(supabase, currentLead, {
        acao: 'toquei',
        canal: 'whatsapp',
        nota: selected ? `WhatsApp: ${selected.nome}` : 'WhatsApp',
      })
      onLeadUpdated(saved)
      onClose()
    } catch (error) {
      if (error instanceof CadenciaTouchLimitError) {
        onTouchLimit?.(currentLead)
        onClose()
        return
      }
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível registrar o toque.')
    } finally {
      setWorking(false)
    }
  }

  const disabled = busy || working || loading

  return (
    <Modal labelledBy="kit-wa-title" busy={disabled} onClose={onClose}>
      <div className="modal-heading">
        <h2 id="kit-wa-title">Abrir WhatsApp</h2>
        <button type="button" className="button-link" disabled={disabled} onClick={onClose}>Fechar</button>
      </div>
      <p className="confirm-message">
        Mensagem para {currentLead.company_name}.
        {porteiroEnabled
          ? (e164
            ? ` Número de ${destinatario ? waDestinatarioLabels[destinatario] : 'destino'} (${e164}).`
            : ' Nenhum número válido para o destinatário escolhido.')
          : ` O número usado é o WhatsApp principal do lead${e164 ? ` (${e164})` : ''}.`}
      </p>
      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      {loading ? (
        <p>Carregando templates…</p>
      ) : askToquei ? (
        <div className="kit-wa-toquei">
          <p className="confirm-message">A conversa foi aberta em outra aba. Considerar como Toquei?</p>
          <div className="form-actions">
            <button type="button" className="button-secondary" disabled={disabled} onClick={() => void confirmToquei(false)}>Não</button>
            <button type="button" disabled={disabled} onClick={() => void confirmToquei(true)}>
              {working ? 'Registrando…' : 'Sim, registrar toque'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {porteiroEnabled && (
            <fieldset className="kit-wa-destinatario">
              <legend>Para quem?</legend>
              {destinatarios.length === 0 ? (
                <p className="validation-warning" role="status">Nenhum WhatsApp válido (porteiro, decisor ou principal) neste lead.</p>
              ) : destinatarios.map((item) => (
                <label key={item} className="contact-principal-radio">
                  <input
                    type="radio"
                    name="wa_destinatario"
                    value={item}
                    checked={destinatario === item}
                    disabled={disabled}
                    onChange={() => setDestinatario(item)}
                  />
                  {waDestinatarioLabels[item]}
                  {item === defaultWaDestinatario(currentLead) ? ' (padrão)' : ''}
                </label>
              ))}
            </fieldset>
          )}
          <label className="field">
            Template sugerido
            <select
              aria-label="Template de WhatsApp"
              value={templateId}
              disabled={disabled || templates.length === 0}
              onChange={(event) => applyTemplate(event.target.value)}
            >
              {templates.length === 0 && <option value="">Nenhum template ativo</option>}
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome} · {waTemplateEtapaLabels[item.etapa]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Prévia editável
            <textarea
              value={preview}
              onChange={(event) => setPreview(event.target.value)}
              rows={7}
              maxLength={2000}
              disabled={disabled}
              aria-describedby="kit-wa-preview-help"
            />
            <span id="kit-wa-preview-help" className="field-counter">
              Edição só vale para este envio. O template salvo não muda. {preview.length}/2000
            </span>
          </label>
          <p className="validation-warning" role="status">
            Lembrete: anexe o print do protótipo no WhatsApp depois de abrir a conversa. O wa.me só leva o texto.
          </p>
          <div className="form-actions">
            <button type="button" className="button-secondary" disabled={disabled} onClick={onClose}>Cancelar</button>
            <button type="button" disabled={disabled || !waUrl} onClick={() => void openWhatsapp()}>
              {working ? 'Abrindo…' : 'Abrir no WhatsApp'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
