import { leadStatusLabels, type LeadStatus } from '../../types/lead'
import { isGlcFunilStatusEnabled } from '../../utils/feature-flags'

export function LeadStatusBadge({ status, funilEnabled = isGlcFunilStatusEnabled() }: { status: LeadStatus; funilEnabled?: boolean }) {
  return (
    <span className={`status status-${status}`}>
      {leadStatusLabels[status]}
      {funilEnabled && status === 'negociacao' && <span className="status-review">Revisar</span>}
    </span>
  )
}
