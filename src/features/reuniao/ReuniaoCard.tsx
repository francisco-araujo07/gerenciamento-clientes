import { CalendarClock } from 'lucide-react'
import type { Lead } from '../../types/lead'
import { dateTimeLabel } from '../../utils/dates'
import {
  isReuniaoPendente,
  reuniaoCountdown,
  reuniaoHojeCtas,
  reuniaoJaPassou,
  reuniaoResultadoLabels,
  reuniaoResultadoOf,
  safeReuniaoHref,
} from './reuniao'

type Props = {
  lead: Lead
  now?: Date
  busy?: boolean
  onConfirmar?: () => void
  onRegistrar?: () => void
}

export function ReuniaoCard({ lead, now = new Date(), busy = false, onConfirmar, onRegistrar }: Props) {
  if (!lead.reuniao_em) return null
  const resultado = reuniaoResultadoOf(lead)
  const countdown = reuniaoCountdown(lead.reuniao_em, now)
  const ctas = reuniaoHojeCtas(lead, now)
  const pendente = isReuniaoPendente(lead)
  const passou = reuniaoJaPassou(lead.reuniao_em, now)
  const reuniaoHref = safeReuniaoHref(lead.reuniao_link)

  return (
    <article className="reuniao-card">
      <h2>Próxima reunião</h2>
      <div className="reuniao-card-heading">
        <CalendarClock size={22} aria-hidden="true" />
        <p className={passou ? 'reuniao-countdown reuniao-countdown-past' : 'reuniao-countdown'} role="status">
          {pendente ? countdown.label : reuniaoResultadoLabels[resultado]}
        </p>
      </div>
      <dl>
        <div>
          <dt>Quando</dt>
          <dd>{dateTimeLabel(lead.reuniao_em)}</dd>
        </div>
        <div>
          <dt>Link</dt>
          <dd>
            {reuniaoHref
              ? <a href={reuniaoHref} target="_blank" rel="noreferrer">Abrir link</a>
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Local</dt>
          <dd>{lead.reuniao_local || '—'}</dd>
        </div>
        <div>
          <dt>Resultado</dt>
          <dd>{reuniaoResultadoLabels[resultado]}</dd>
        </div>
        {lead.reuniao_notas && (
          <div className="field-wide">
            <dt>Notas</dt>
            <dd>{lead.reuniao_notas}</dd>
          </div>
        )}
      </dl>
      {(ctas.confirmar || ctas.registrar) && (
        <div className="form-actions reuniao-card-actions">
          {ctas.confirmar && onConfirmar && (
            <button type="button" className="button-secondary" disabled={busy} onClick={onConfirmar}>
              Confirmar reunião
            </button>
          )}
          {ctas.registrar && onRegistrar && (
            <button type="button" disabled={busy} onClick={onRegistrar}>
              Registrar resultado
            </button>
          )}
        </div>
      )}
    </article>
  )
}
