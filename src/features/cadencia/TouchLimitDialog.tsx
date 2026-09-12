import type { Lead } from '../../types/lead'
import { defaultCadenciaConfig } from '../../types/cadencia'
import { Modal } from '../../components/Modal'

type Props = {
  lead: Lead
  busy: boolean
  onCancel: () => void
  onPause: () => void
  onLost: () => void
}

export function TouchLimitDialog({ lead, busy, onCancel, onPause, onLost }: Props) {
  return (
    <Modal labelledBy="cadencia-limit-title" busy={busy} onClose={onCancel}>
      <div className="modal-heading">
        <h2 id="cadencia-limit-title">Limite de toques sem resposta</h2>
        <button type="button" className="button-link" disabled={busy} onClick={onCancel}>Fechar</button>
      </div>
      <p className="confirm-message">
        {lead.company_name} já chegou ao {defaultCadenciaConfig.max_touches_sem_resposta}º toque sem resposta.
        A cadência não avança sozinha. Pause 60 dias, marque como perdido ou cancele.
      </p>
      <div className="form-actions">
        <button type="button" className="button-secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="button" className="button-secondary" disabled={busy} onClick={onPause}>Pausar 60 dias</button>
        <button type="button" className="button-danger" disabled={busy} onClick={onLost}>Marcar perdido</button>
      </div>
    </Modal>
  )
}
