import type { Lead, LeadFormValues } from '../../types/lead.ts'
import { emptyLeadFormValues } from '../../types/lead.ts'
import { isContatoPrincipal } from '../porteiro-decisor/contacts.ts'
import { leadPayload } from '../../utils/validation.ts'
import { parseCsv } from '../../utils/csv.ts'

export const requiredCsvHeaders = [
  'company_name',
  'responsible_name',
  'whatsapp',
  'email',
  'instagram',
  'address',
  'google_maps_url',
  'segment',
  'source',
  'notes',
  'next_action',
  'next_action_due_date',
] as const

export const optionalCsvHeaders = [
  'porteiro_nome',
  'porteiro_whatsapp',
  'decisor_nome',
  'decisor_whatsapp',
  'decisor_cargo',
  'contato_principal',
  'ultimo_combinado_com_porteiro',
] as const

export type CsvImportRow = {
  rowNumber: number
  values: LeadFormValues
  errors: string[]
  duplicates: string[]
  selected: boolean
}

const normalize = (value: string | null) => value?.trim().toLocaleLowerCase('pt-BR') ?? ''
const phone = (value: string | null) => value?.replace(/\D/g, '') ?? ''

function cell(headers: string[], cells: string[], header: string) {
  const index = headers.indexOf(header)
  return index >= 0 ? cells[index]?.trim() ?? '' : ''
}

export function csvLeadValues(headers: string[], cells: string[]): LeadFormValues {
  const contatoRaw = cell(headers, cells, 'contato_principal').toLocaleLowerCase('pt-BR')
  return {
    ...emptyLeadFormValues,
    company_name: cell(headers, cells, 'company_name'),
    responsible_name: cell(headers, cells, 'responsible_name'),
    whatsapp: cell(headers, cells, 'whatsapp'),
    email: cell(headers, cells, 'email'),
    instagram: cell(headers, cells, 'instagram'),
    address: cell(headers, cells, 'address'),
    google_maps_url: cell(headers, cells, 'google_maps_url'),
    segment: cell(headers, cells, 'segment'),
    source: cell(headers, cells, 'source'),
    notes: cell(headers, cells, 'notes'),
    next_action: cell(headers, cells, 'next_action'),
    next_action_due_date: cell(headers, cells, 'next_action_due_date'),
    status: 'novo',
    porteiro_nome: cell(headers, cells, 'porteiro_nome'),
    porteiro_whatsapp: cell(headers, cells, 'porteiro_whatsapp'),
    decisor_nome: cell(headers, cells, 'decisor_nome'),
    decisor_whatsapp: cell(headers, cells, 'decisor_whatsapp'),
    decisor_cargo: cell(headers, cells, 'decisor_cargo'),
    contato_principal: isContatoPrincipal(contatoRaw) ? contatoRaw : 'geral',
    ultimo_combinado_com_porteiro: cell(headers, cells, 'ultimo_combinado_com_porteiro'),
  }
}

export function mapCsvLeadRows(text: string, existing: Lead[]): CsvImportRow[] {
  const parsed = parseCsv(text)
  const headers = parsed[0]?.map((header) => header.trim().toLocaleLowerCase('pt-BR')) ?? []
  if (new Set(headers).size !== headers.length) throw new Error('Colunas repetidas no CSV.')
  const absent = requiredCsvHeaders.filter((header) => !headers.includes(header))
  if (absent.length) throw new Error(`Faltam colunas no arquivo: ${absent.join(', ')}.`)
  const existingCompany = new Set(existing.map((lead) => normalize(lead.company_name)))
  const existingEmail = new Set(existing.map((lead) => normalize(lead.email)))
  const existingPhone = new Set(existing.flatMap((lead) => [
    phone(lead.whatsapp),
    phone(lead.porteiro_whatsapp),
    phone(lead.decisor_whatsapp),
  ].filter(Boolean)))
  const fileCompany = new Set<string>()
  const fileEmail = new Set<string>()
  const filePhone = new Set<string>()
  return parsed.slice(1).map((cells, index) => {
    const values = csvLeadValues(headers, cells)
    const errors: string[] = []
    const duplicates: string[] = []
    if (cells.length !== headers.length) errors.push('Quantidade de colunas diferente do cabeçalho')
    try { leadPayload(values) } catch { errors.push('Campos inválidos: confira datas, URL HTTPS e limites de texto') }
    if (!values.company_name) errors.push('Empresa é obrigatória')
    if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) errors.push('E-mail inválido')
    if (values.next_action_due_date && !/^\d{4}-\d{2}-\d{2}$/.test(values.next_action_due_date)) errors.push('Data deve usar AAAA-MM-DD')
    if (values.google_maps_url) try { new URL(values.google_maps_url) } catch { errors.push('Link do Google Maps inválido') }
    const company = normalize(values.company_name)
    const email = normalize(values.email)
    const phones = [phone(values.whatsapp), phone(values.porteiro_whatsapp), phone(values.decisor_whatsapp)].filter(Boolean)
    if (company && (existingCompany.has(company) || fileCompany.has(company))) duplicates.push('empresa')
    if (email && (existingEmail.has(email) || fileEmail.has(email))) duplicates.push('e-mail')
    if (phones.some((item) => existingPhone.has(item) || filePhone.has(item))) duplicates.push('WhatsApp')
    if (company) fileCompany.add(company)
    if (email) fileEmail.add(email)
    for (const item of phones) filePhone.add(item)
    return { rowNumber: index + 2, values, errors, duplicates, selected: errors.length === 0 && duplicates.length === 0 }
  })
}
