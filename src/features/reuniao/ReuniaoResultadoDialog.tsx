import { useState } from 'react'
import { leadStatusLabels, lossReasonLabels, lossReasons, type Lead } from '../../types/lead'
import { recifeDate, recifeDateTimeToIso, suggestedPauseAction, toDateTimeLocal } from '../../utils/dates'
import { Modal } from '../../components/Modal'
import { validateHttpsLink } from '../leads/lead-status'
import {
  isReuniaoNoShowSemCaminho,
  reuniaoResultadoAcoes,
  reuniaoResultadoLabels,
  type CompareceuDestino,
  type NoShowDestino,
  type ReuniaoResultadoAcao,
  type ReuniaoResultadoInput,
} from './reuniao'

type Props = {
  lead: Lead
  busy: boolean
  onCancel: () => void
  onConfirm: (input: ReuniaoResultadoInput) => Promise<void>
}

export function ReuniaoResultadoDialog({ lead, busy, onCancel, onConfirm }: Props) {
  const pause = suggestedPauseAction()
  const stuckNoShow = isReuniaoNoShowSemCaminho(lead)
  const [resultado, setResultado] = useState<ReuniaoResultadoAcao | ''>(stuckNoShow ? 'no_show' : '')
  const [notas, setNotas] = useState(lead.reuniao_notas ?? '')
  const [reuniaoEm, setReuniaoEm] = useState(toDateTimeLocal(lead.reuniao_em) || '')
  const [reuniaoLink, setReuniaoLink] = useState(lead.reuniao_link ?? '')
  const [reuniaoLocal, setReuniaoLocal] = useState(lead.reuniao_local ?? '')
  const [motivoPerda, setMotivoPerda] = useState(lead.motivo_perda ?? '')
  const [motivoPerdaDetalhe, setMotivoPerdaDetalhe] = useState(lead.motivo_perda_detalhe ?? '')
  const [compareceuDestino, setCompareceuDestino] = useState<CompareceuDestino | ''>('')
  const [noShowDestino, setNoShowDestino] = useState<NoShowDestino | ''>('')
  const [nextAction, setNextAction] = useState('')
  const [nextActionDueDate, setNextActionDueDate] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const needsRescheduleFields = resultado === 'reagendou' || (resultado === 'no_show' && noShowDestino === 'reagendar')
  const needsPauseFields = resultado === 'no_show' && noShowDestino === 'pausado_60d'
  const needsNextActionFields = resultado === 'compareceu' && compareceuDestino === 'manter'
  const canSubmit = Boolean(
    resultado
    && (resultado !== 'compareceu' || compareceuDestino)
    && (resultado !== 'no_show' || noShowDestino),
  )

  async function submit() {
    if (busy || !canSubmit || !resultado) return
    setErrorMessage('')
    try {
      if (reuniaoLink.trim()) validateHttpsLink(reuniaoLink.trim(), 'O link da reunião')
      await onConfirm({
        resultado,
        notas,
        reuniaoEm: needsRescheduleFields && reuniaoEm ? recifeDateTimeToIso(reuniaoEm) : null,
        reuniaoLink,
        reuniaoLocal,
        motivoPerda: motivoPerda || null,
        motivoPerdaDetalhe,
        compareceuDestino: resultado === 'compareceu' ? compareceuDestino || null : null,
        noShowDestino: resultado === 'no_show' ? noShowDestino || null : null,
        nextAction: needsNextActionFields || needsPauseFields ? nextAction : null,
        nextActionDueDate: needsNextActionFields || needsPauseFields ? nextActionDueDate : null,
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível registrar o resultado.')
    }
  }

  function submitLabel() {
    if (busy) return 'Salvando…'
    if (resultado === 'fechou') return 'Registrar e converter'
    if (resultado === 'compareceu' && compareceuDestino === 'proposta_enviada') return 'Registrar e enviar proposta'
    if (resultado === 'no_show' && noShowDestino === 'pausado_60d') return 'Registrar e pausar'
    if (resultado === 'no_show' && noShowDestino === 'reagendar') return 'Registrar e reagendar'
    return 'Registrar resultado'
  }

  return (
    <Modal labelledBy="reuniao-resultado-title" busy={busy} onClose={onCancel}>
      <div className="modal-heading">
        <h2 id="reuniao-resultado-title">Registrar resultado da reunião</h2>
        <button type="button" className="button-link" disabled={busy} onClick={onCancel}>Fechar</button>
      </div>
      <p className="confirm-message">
        {lead.company_name} · {leadStatusLabels[lead.status]}.
      </p>
      {stuckNoShow && (
        <p className="validation-warning" role="status">
          Esta reunião ficou como não compareceu. Reagende um novo horário ou pause o lead por 60 dias.
        </p>
      )}
      <div className="form-grid">
        <label className="field field-wide">Resultado *
          <select
            aria-label="Resultado da reunião"
            value={resultado}
            onChange={(event) => setResultado(event.target.value as ReuniaoResultadoAcao | '')}
            required
          >
            <option value="">Selecione</option>
            {reuniaoResultadoAcoes.map((item) => (
              <option key={item} value={item}>{reuniaoResultadoLabels[item]}</option>
            ))}
          </select>
        </label>
        {resultado === 'compareceu' && (
          <fieldset className="field field-wide">
            <legend>Próximo passo *</legend>
            <label className="check-filter">
              <input
                type="radio"
                name="compareceu-destino"
                value="proposta_enviada"
                checked={compareceuDestino === 'proposta_enviada'}
                onChange={() => setCompareceuDestino('proposta_enviada')}
              />
              Ir para {leadStatusLabels.proposta_enviada}
            </label>
            <label className="check-filter">
              <input
                type="radio"
                name="compareceu-destino"
                value="manter"
                checked={compareceuDestino === 'manter'}
                onChange={() => {
                  setCompareceuDestino('manter')
                  setNextAction('')
                  setNextActionDueDate(recifeDate())
                }}
              />
              Permanecer em reunião marcada e definir a próxima ação
            </label>
          </fieldset>
        )}
        {needsNextActionFields && (
          <>
            <label className="field field-wide">Próxima ação *
              <textarea
                value={nextAction}
                onChange={(event) => setNextAction(event.target.value)}
                maxLength={2000}
                rows={2}
                required
              />
            </label>
            <label className="field">Data da próxima ação
              <input type="date" value={nextActionDueDate} onChange={(event) => setNextActionDueDate(event.target.value)} />
            </label>
          </>
        )}
        {resultado === 'no_show' && (
          <fieldset className="field field-wide">
            <legend>Caminho após o no-show *</legend>
            <label className="check-filter">
              <input
                type="radio"
                name="no-show-destino"
                value="reagendar"
                checked={noShowDestino === 'reagendar'}
                onChange={() => setNoShowDestino('reagendar')}
              />
              Reagendar reunião
            </label>
            <label className="check-filter">
              <input
                type="radio"
                name="no-show-destino"
                value="pausado_60d"
                checked={noShowDestino === 'pausado_60d'}
                onChange={() => {
                  setNoShowDestino('pausado_60d')
                  setNextAction(pause.next_action)
                  setNextActionDueDate(pause.next_action_due_date)
                }}
              />
              Pausar 60 dias
            </label>
          </fieldset>
        )}
        {needsRescheduleFields && (
          <>
            <label className="field">Nova data e hora *
              <input type="datetime-local" value={reuniaoEm} onChange={(event) => setReuniaoEm(event.target.value)} required />
            </label>
            <label className="field">Link da reunião
              <input type="url" value={reuniaoLink} onChange={(event) => setReuniaoLink(event.target.value)} maxLength={2048} placeholder="https://" />
            </label>
            <label className="field field-wide">Local
              <input value={reuniaoLocal} onChange={(event) => setReuniaoLocal(event.target.value)} maxLength={500} />
            </label>
          </>
        )}
        {needsPauseFields && (
          <>
            <label className="field">Retomar em
              <input type="date" value={nextActionDueDate} onChange={(event) => setNextActionDueDate(event.target.value)} />
            </label>
            <label className="field field-wide">Próxima ação
              <textarea value={nextAction} onChange={(event) => setNextAction(event.target.value)} maxLength={2000} rows={2} />
            </label>
          </>
        )}
        {resultado === 'recusou' && (
          <>
            <label className="field field-wide">Motivo da perda *
              <select value={motivoPerda} onChange={(event) => setMotivoPerda(event.target.value)} required>
                <option value="">Selecione</option>
                {lossReasons.map((reason) => <option key={reason} value={reason}>{lossReasonLabels[reason]}</option>)}
              </select>
            </label>
            {motivoPerda === 'outro' && (
              <label className="field field-wide">Detalhe do motivo *
                <textarea value={motivoPerdaDetalhe} onChange={(event) => setMotivoPerdaDetalhe(event.target.value)} maxLength={2000} rows={3} required />
              </label>
            )}
          </>
        )}
        {resultado === 'fechou' && (
          <p className="validation-warning" role="status">
            Fechou converte o lead em cliente e preserva os dados. Esta ação não registra preço de projeto.
          </p>
        )}
        {resultado === 'pediu_proposta' && (
          <p className="confirm-message" role="status">
            O status passa para {leadStatusLabels.proposta_enviada} e a próxima ação vira “Enviar proposta”.
          </p>
        )}
        {resultado === 'compareceu' && compareceuDestino === 'proposta_enviada' && (
          <p className="confirm-message" role="status">
            Compareceu e o status passa para {leadStatusLabels.proposta_enviada}.
          </p>
        )}
        <label className="field field-wide">Notas
          <textarea value={notas} onChange={(event) => setNotas(event.target.value)} maxLength={2000} rows={3} />
        </label>
      </div>
      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      <div className="form-actions">
        <button type="button" className="button-secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="button" disabled={busy || !canSubmit} onClick={() => void submit()}>
          {submitLabel()}
        </button>
      </div>
    </Modal>
  )
}
