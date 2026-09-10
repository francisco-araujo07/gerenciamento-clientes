import { Modal } from './Modal'

type Props = {
  labelledBy: string
  title: string
  message: string
  confirmLabel: string
  busy?: boolean
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ labelledBy, title, message, confirmLabel, busy = false, danger = false, onCancel, onConfirm }: Props) {
  return <Modal labelledBy={labelledBy} busy={busy} onClose={onCancel}>
    <div className="modal-heading"><h2 id={labelledBy}>{title}</h2><button type="button" className="button-link" disabled={busy} onClick={onCancel}>Fechar</button></div>
    <p className="confirm-message">{message}</p>
    <div className="form-actions"><button type="button" className="button-secondary" disabled={busy} onClick={onCancel}>Cancelar</button><button type="button" className={danger ? 'button-danger' : ''} disabled={busy} onClick={onConfirm}>{busy ? 'Confirmando…' : confirmLabel}</button></div>
  </Modal>
}
