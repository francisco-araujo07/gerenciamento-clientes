import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lead } from '../../types/lead.ts'
import { type WaTemplate, type WaTemplateFormValues } from '../../types/whatsapp.ts'
import { textValue } from '../../utils/validation.ts'
import { isWaTemplateEtapa } from './templates.ts'

export function waTemplatePayload(values: WaTemplateFormValues) {
  const etapa = values.etapa
  if (!isWaTemplateEtapa(etapa)) throw new Error('Etapa do template inválida.')
  return {
    nome: textValue(values.nome, 120, true)!,
    etapa,
    corpo: textValue(values.corpo, 2000, true)!,
    ativo: Boolean(values.ativo),
  }
}

export async function listWaTemplates(client: SupabaseClient, options: { onlyActive?: boolean } = {}) {
  let query = client
    .from('wa_templates')
    .select('id, nome, etapa, corpo, ativo, created_at, updated_at')
    .order('etapa')
    .order('nome')
    .order('id')
  if (options.onlyActive) query = query.eq('ativo', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as WaTemplate[]
}

export async function createWaTemplate(client: SupabaseClient, values: WaTemplateFormValues) {
  const { data, error } = await client.from('wa_templates').insert(waTemplatePayload(values)).select().single()
  if (error) throw error
  return data as WaTemplate
}

export async function updateWaTemplate(client: SupabaseClient, id: string, values: WaTemplateFormValues, expectedUpdatedAt: string) {
  const { data, error } = await client
    .from('wa_templates')
    .update(waTemplatePayload(values))
    .eq('id', id)
    .eq('updated_at', expectedUpdatedAt)
    .select()
    .single()
  if (error) throw error
  return data as WaTemplate
}

export async function setWaTemplateAtivo(
  client: SupabaseClient,
  template: Pick<WaTemplate, 'id' | 'updated_at'>,
  ativo: boolean,
) {
  const { data, error } = await client
    .from('wa_templates')
    .update({ ativo })
    .eq('id', template.id)
    .eq('updated_at', template.updated_at)
    .select()
    .single()
  if (error) throw error
  return data as WaTemplate
}

export async function updateLeadLastWaTemplate(
  client: SupabaseClient,
  lead: Pick<Lead, 'id' | 'updated_at'>,
  templateId: string | null,
) {
  const { data, error } = await client
    .from('leads')
    .update({ wa_ultimo_template_id: templateId })
    .eq('id', lead.id)
    .eq('updated_at', lead.updated_at)
    .select()
    .single()
  if (error) throw error
  return data as Lead
}

export async function currentWhatsappUserName(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser()
  if (error) return null
  return data.user ?? null
}
