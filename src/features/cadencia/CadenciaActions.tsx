import { CalendarClock, MessageCircle, PauseCircle, PhoneOff, Reply, Send, XCircle } from 'lucide-react'
import type { Lead } from '../../types/lead'
import { principalWhatsapp } from '../porteiro-decisor/contacts'
import { isGlcPorteiroDecisorEnabled } from '../../utils/feature-flags'
import { whatsappMeUrl } from './whatsapp'

type Props = {
  lead: Lead
  busy: boolean
  onToquei: () => void
  onRespondeu: () => void
  onSemResposta: () => void
  onReagendar: () => void
  onPerdido: () => void
  onPausar: () => void
  onAbrirWhatsApp?: () => void
}

export function CadenciaActions({
  lead,
  busy,
  onToquei,
  onRespondeu,
  onSemResposta,
  onReagendar,
  onPerdido,
  onPausar,
  onAbrirWhatsApp,
}: Props) {
  const whatsappUrl = whatsappMeUrl(isGlcPorteiroDecisorEnabled() ? principalWhatsapp(lead) : lead.whatsapp)
  return (
    <div className="cadencia-actions">
      <button type="button" className="button-secondary cadencia-action" disabled={busy} onClick={onToquei}>
        <Send size={16} /> Toquei
      </button>
      <button type="button" className="button-secondary cadencia-action" disabled={busy} onClick={onRespondeu}>
        <Reply size={16} /> Respondeu
      </button>
      <button type="button" className="button-secondary cadencia-action" disabled={busy} onClick={onSemResposta}>
        <PhoneOff size={16} /> Sem resposta
      </button>
      <button type="button" className="button-secondary cadencia-action" disabled={busy} onClick={onReagendar}>
        <CalendarClock size={16} /> Reagendar
      </button>
      <button type="button" className="button-secondary cadencia-action" disabled={busy} onClick={onPausar}>
        <PauseCircle size={16} /> Pausar
      </button>
      <button type="button" className="button-secondary cadencia-action danger-action" disabled={busy} onClick={onPerdido}>
        <XCircle size={16} /> Perdido
      </button>
      {onAbrirWhatsApp ? (
        <button type="button" className="button-secondary cadencia-action cadencia-whatsapp" disabled={busy} onClick={onAbrirWhatsApp}>
          <MessageCircle size={16} /> Abrir WhatsApp
        </button>
      ) : whatsappUrl ? (
        <a className="button-secondary cadencia-action cadencia-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">
          <MessageCircle size={16} /> Abrir WhatsApp
        </a>
      ) : (
        <span className="cadencia-whatsapp-disabled" title="Informe um WhatsApp válido no cadastro do lead para abrir o wa.me.">
          <button type="button" className="button-secondary cadencia-action" disabled>
            <MessageCircle size={16} /> Abrir WhatsApp
          </button>
        </span>
      )}
    </div>
  )
}
