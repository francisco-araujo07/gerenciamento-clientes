import {
  cadenciaCanalLabels,
  cadenciaResultadoLabels,
  cadenciaTipoLabels,
  type CadenciaCanal,
  type LeadAtividade,
} from '../../types/cadencia'
import { dateTimeLabel } from '../../utils/dates'

function canalLabel(value: CadenciaCanal | null) {
  return value ? cadenciaCanalLabels[value] : null
}

export function LeadActivityTimeline({ entries }: { entries: LeadAtividade[] }) {
  return (
    <article className="detail-wide">
      <h2>Timeline de atividades</h2>
      {entries.length === 0 ? <p>Nenhuma atividade de cadência registrada.</p> : (
        <ol className="status-history">
          {entries.map((entry) => (
            <li key={entry.id}>
              <strong>{cadenciaTipoLabels[entry.tipo]} · {cadenciaResultadoLabels[entry.resultado]}</strong>
              <span>{dateTimeLabel(entry.created_at)}{canalLabel(entry.canal) ? ` · ${canalLabel(entry.canal)}` : ''}</span>
              {entry.nota && <span className="table-note">{entry.nota}</span>}
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}
