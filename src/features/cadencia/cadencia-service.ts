import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lead } from '../../types/lead.ts'
import type { CadenciaAcao, CadenciaCanal, LeadAtividade } from '../../types/cadencia.ts'
import { recifeDate } from '../../utils/dates.ts'
import { readAll } from '../../lib/read-all.ts'
import { CadenciaTouchLimitError, cadenciaQueueStatuses, isCadenciaTouchLimitError } from './cadencia.ts'

export type RegistrarCadenciaInput = {
  acao: CadenciaAcao
  nota?: string | null
  nextAction?: string | null
  nextActionDueDate?: string | null
  canal?: CadenciaCanal
}

export async function listCadenciaQueue(client: SupabaseClient, today = recifeDate()) {
  return readAll<Lead>((from, to) => client
    .from('leads')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .in('status', [...cadenciaQueueStatuses])
    .lte('next_action_due_date', today)
    .order('next_action_due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .range(from, to))
}

export async function listNovosSemProximaAcao(client: SupabaseClient) {
  return readAll<Lead>((from, to) => client
    .from('leads')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .eq('status', 'novo')
    .is('next_action_due_date', null)
    .order('company_name')
    .order('id')
    .range(from, to))
}

export async function listLeadAtividades(client: SupabaseClient, leadId: string) {
  const { data, error } = await client
    .from('lead_atividade')
    .select('id, lead_id, tipo, resultado, canal, nota, created_at, created_by')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return (data ?? []) as LeadAtividade[]
}

export async function registrarCadencia(
  client: SupabaseClient,
  lead: Pick<Lead, 'id' | 'updated_at'>,
  input: RegistrarCadenciaInput,
) {
  const { data, error } = await client.rpc('registrar_cadencia', {
    p_lead_id: lead.id,
    p_expected_updated_at: lead.updated_at,
    p_acao: input.acao,
    p_nota: input.nota?.trim() || null,
    p_next_action: input.nextAction?.trim() || null,
    p_next_action_due_date: input.nextActionDueDate || null,
    p_canal: input.canal ?? 'whatsapp',
  })
  if (error) {
    if (isCadenciaTouchLimitError(error)) throw new CadenciaTouchLimitError()
    throw error
  }
  return data as Lead
}
