import { useState } from 'react'
import { leadStatusLabels, lossReasonLabels, lossReasons, type Lead, type LeadStatus } from '../../types/lead'
import { recifeDateTimeToIso, suggestedPauseAction, toDateTimeLocal } from '../../utils/dates'
import { Modal } from '../../components/Modal'
import type { LeadStatusTransitionEvaluation, LeadStatusTransitionInput } from './lead-status'

type Props = {
  lead: Lead
  toStatus: LeadStatus
  evaluation: LeadStatusTransitionEvaluation
  busy: boolean
  onCancel: () => void
  onConfirm: (input: LeadStatusTransitionInput) => Promise<void>
}

export function LeadStatusTransitionDialog({ lead, toStatus, evaluation, busy, onCancel, onConfirm }: Props) {
  const pause = suggestedPauseAction()
  const [motivoPerda, setMotivoPerda] = useState(lead.motivo_perda ?? '')
  const [motivoPerdaDetalhe, setMotivoPerdaDetalhe] = useState(lead.motivo_perda_detalhe ?? '')
  const [reuniaoEm, setReuniaoEm] = useState(toDateTimeLocal(lead.reuniao_em) || '')
  const [reuniaoLink, setReuniaoLink] = useState(lead.reuniao_link ?? '')
  const [note, setNote] = useState('')
  const [nextAction, setNextAction] = useState(pause.next_action)
  const [nextActionDueDate, setNextActionDueDate] = useState(pause.next_action_due_date)
  const [confirmAtypical, setConfirmAtypical] = useState(evaluation.typical)
  const [errorMessage, setErrorMessage] = useState('')

  async function submit() {
    if (busy) return
    setErrorMessage('')
    try {
      await onConfirm({
        confirmAtypical,
        note,
        motivoPerda: motivoPerda || null,
        motivoPerdaDetalhe,
        reuniaoEm: evaluation.requiresReuniao && reuniaoEm ? recifeDateTimeToIso(reuniaoEm) : null,
        reuniaoLink,
        nextAction: evaluation.suggestsPause ? nextAction : null,
        nextActionDueDate: evaluation.suggestsPause ? nextActionDueDate : null,
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o status.')
    }
  }

  return (
    <Modal labelledBy="lead-status-title" busy={busy} onClose={onCancel}>
      <div className="modal-heading">
        <h2 id="lead-status-title">Alterar para {leadStatusLabels[toStatus]}</h2>
        <button type="button" className="button-link" disabled={busy} onClick={onCancel}>Fechar</button>
      </div>
      {!evaluation.typical && (
        <p className="validation-warning" role="status">
          Esta mudança é atípica no funil. Confirme explicitamente se deseja continuar.
        </p>
      )}
      {evaluation.requiresMotivo && (
        <div className="form-grid">
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
        </div>
      )}
      {evaluation.requiresReuniao && (
        <div className="form-grid">
          <label className="field">Data e hora da reunião *
            <input type="datetime-local" value={reuniaoEm} onChange={(event) => setReuniaoEm(event.target.value)} required />
          </label>
          <label className="field">Link da reunião
            <input type="url" value={reuniaoLink} onChange={(event) => setReuniaoLink(event.target.value)} maxLength={2048} placeholder="https://" />
          </label>
        </div>
      )}
      {evaluation.requiresEncaminhadoNote && (
        <label className="field field-wide">Encaminhou o quê? *
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} required placeholder="Ex.: encaminhou para o sócio responsável pela decisão" />
        </label>
      )}
      {evaluation.suggestsPause && (
        <div className="form-grid">
          <label className="field">Retomar em
            <input type="date" value={nextActionDueDate} onChange={(event) => setNextActionDueDate(event.target.value)} />
          </label>
          <label className="field field-wide">Próxima ação
            <textarea value={nextAction} onChange={(event) => setNextAction(event.target.value)} maxLength={2000} rows={2} />
          </label>
        </div>
      )}
      {!evaluation.typical && (
        <label className="check-filter status-confirm">
          <input type="checkbox" checked={confirmAtypical} onChange={(event) => setConfirmAtypical(event.target.checked)} />
          Confirmo esta transição atípica
        </label>
      )}
      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      <div className="form-actions">
        <button type="button" className="button-secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="button" disabled={busy || (!evaluation.typical && !confirmAtypical)} onClick={() => void submit()}>
          {busy ? 'Salvando…' : 'Confirmar status'}
        </button>
      </div>
    </Modal>
  )
}
