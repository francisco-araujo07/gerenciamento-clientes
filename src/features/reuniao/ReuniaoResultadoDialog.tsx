import { useState } from 'react'
import { leadStatusLabels, lossReasonLabels, lossReasons, type Lead } from '../../types/lead'
import { recifeDateTimeToIso, toDateTimeLocal } from '../../utils/dates'
import { Modal } from '../../components/Modal'
import { validateHttpsLink } from '../leads/lead-status'
import {
  reuniaoResultadoAcoes,
  reuniaoResultadoLabels,
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
  const [resultado, setResultado] = useState<ReuniaoResultadoAcao | ''>('')
  const [notas, setNotas] = useState(lead.reuniao_notas ?? '')
  const [reuniaoEm, setReuniaoEm] = useState(toDateTimeLocal(lead.reuniao_em) || '')
  const [reuniaoLink, setReuniaoLink] = useState(lead.reuniao_link ?? '')
  const [reuniaoLocal, setReuniaoLocal] = useState(lead.reuniao_local ?? '')
  const [motivoPerda, setMotivoPerda] = useState(lead.motivo_perda ?? '')
  const [motivoPerdaDetalhe, setMotivoPerdaDetalhe] = useState(lead.motivo_perda_detalhe ?? '')
  const [errorMessage, setErrorMessage] = useState('')

  async function submit() {
    if (busy || !resultado) return
    setErrorMessage('')
    try {
      if (reuniaoLink.trim()) validateHttpsLink(reuniaoLink.trim(), 'O link da reunião')
      await onConfirm({
        resultado,
        notas,
        reuniaoEm: resultado === 'reagendou' && reuniaoEm ? recifeDateTimeToIso(reuniaoEm) : null,
        reuniaoLink,
        reuniaoLocal,
        motivoPerda: motivoPerda || null,
        motivoPerdaDetalhe,
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível registrar o resultado.')
    }
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
        {resultado === 'reagendou' && (
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
        <label className="field field-wide">Notas
          <textarea value={notas} onChange={(event) => setNotas(event.target.value)} maxLength={2000} rows={3} />
        </label>
      </div>
      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      <div className="form-actions">
        <button type="button" className="button-secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="button" disabled={busy || !resultado} onClick={() => void submit()}>
          {busy ? 'Salvando…' : resultado === 'fechou' ? 'Registrar e converter' : 'Registrar resultado'}
        </button>
      </div>
    </Modal>
  )
}
