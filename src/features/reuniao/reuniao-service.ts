import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lead } from '../../types/lead.ts'
import { isGlcReuniaoEnabled } from '../../utils/feature-flags.ts'
import { lossReasons } from '../../types/lead.ts'
import { validateLeadStatusTransition, type LeadStatusTransitionInput } from '../leads/lead-status.ts'
import { validateReuniaoResultado, type ReuniaoResultadoInput } from './reuniao.ts'

export async function marcarReuniao(
  client: SupabaseClient,
  lead: Pick<Lead, 'id' | 'status' | 'updated_at'>,
  input: LeadStatusTransitionInput = {},
) {
  validateLeadStatusTransition(lead.status, 'reuniao_marcada', input)
  if (!input.reuniaoEm?.trim()) throw new Error('Informe data e hora da reunião.')
  const { data, error } = await client.rpc('marcar_reuniao', {
    p_lead_id: lead.id,
    p_expected_updated_at: lead.updated_at,
    p_reuniao_em: input.reuniaoEm,
    p_reuniao_link: input.reuniaoLink?.trim() || null,
    p_reuniao_local: input.reuniaoLocal?.trim() || null,
    p_reuniao_notas: input.reuniaoNotas?.trim() || null,
    p_confirm_atypical: Boolean(input.confirmAtypical),
    p_note: input.note?.trim() || null,
  })
  if (error) throw error
  return data as Lead
}

export async function registrarResultadoReuniao(
  client: SupabaseClient,
  lead: Pick<Lead, 'id' | 'updated_at'>,
  input: ReuniaoResultadoInput,
) {
  validateReuniaoResultado(input, lossReasons)
  const { data, error } = await client.rpc('registrar_resultado_reuniao', {
    p_lead_id: lead.id,
    p_expected_updated_at: lead.updated_at,
    p_resultado: input.resultado,
    p_notas: input.notas?.trim() || null,
    p_reuniao_em: input.reuniaoEm || null,
    p_reuniao_link: input.reuniaoLink?.trim() || null,
    p_reuniao_local: input.reuniaoLocal?.trim() || null,
    p_motivo_perda: input.motivoPerda || null,
    p_motivo_perda_detalhe: input.motivoPerdaDetalhe?.trim() || null,
  })
  if (error) throw error
  return data as Lead
}

export function shouldMarcarReuniao(toStatus: Lead['status'], reuniaoEnabled = isGlcReuniaoEnabled()) {
  return reuniaoEnabled && toStatus === 'reuniao_marcada'
}
