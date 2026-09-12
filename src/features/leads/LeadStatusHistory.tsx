import { leadStatusLabels, type LeadStatus, type LeadStatusHistoryEntry } from '../../types/lead'
import { dateTimeLabel } from '../../utils/dates'

function statusLabel(value: string | null) {
  if (!value) return '—'
  return value in leadStatusLabels ? leadStatusLabels[value as LeadStatus] : value
}

export function LeadStatusHistory({ entries }: { entries: LeadStatusHistoryEntry[] }) {
  return (
    <article className="detail-wide">
      <h2>Histórico de status</h2>
      {entries.length === 0 ? <p>Nenhuma mudança de status registrada.</p> : (
        <ol className="status-history">
          {entries.map((entry) => (
            <li key={entry.id}>
              <strong>{statusLabel(entry.from_status)} → {statusLabel(entry.to_status)}</strong>
              <span>{dateTimeLabel(entry.changed_at)}</span>
              {entry.note && <span className="table-note">{entry.note}</span>}
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}
