import { useState } from 'react'
import type { Lead } from '../../types/lead'
import { recifeDate } from '../../utils/dates'
import { Modal } from '../../components/Modal'

type Props = {
  lead: Lead
  busy: boolean
  onCancel: () => void
  onConfirm: (input: { nextAction: string; nextActionDueDate: string }) => Promise<void>
}

export function RescheduleDialog({ lead, busy, onCancel, onConfirm }: Props) {
  const [nextAction, setNextAction] = useState(lead.next_action ?? '')
  const [nextActionDueDate, setNextActionDueDate] = useState(lead.next_action_due_date || recifeDate())
  const [errorMessage, setErrorMessage] = useState('')

  async function submit() {
    if (busy) return
    setErrorMessage('')
    if (!nextActionDueDate) {
      setErrorMessage('Informe a nova data da próxima ação.')
      return
    }
    try {
      await onConfirm({ nextAction, nextActionDueDate })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível reagendar.')
    }
  }

  return (
    <Modal labelledBy="cadencia-reagendar-title" busy={busy} onClose={onCancel}>
      <div className="modal-heading">
        <h2 id="cadencia-reagendar-title">Reagendar {lead.company_name}</h2>
        <button type="button" className="button-link" disabled={busy} onClick={onCancel}>Fechar</button>
      </div>
      <div className="form-grid">
        <label className="field">Nova data *
          <input type="date" value={nextActionDueDate} onChange={(event) => setNextActionDueDate(event.target.value)} required />
        </label>
        <label className="field field-wide">Próxima ação
          <textarea value={nextAction} onChange={(event) => setNextAction(event.target.value)} maxLength={2000} rows={2} />
        </label>
      </div>
      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      <div className="form-actions">
        <button type="button" className="button-secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="button" disabled={busy} onClick={() => void submit()}>{busy ? 'Salvando…' : 'Reagendar'}</button>
      </div>
    </Modal>
  )
}
