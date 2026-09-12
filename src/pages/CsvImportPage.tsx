import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Download, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { createLeads, listLeads } from '../features/leads/lead-service'
import type { Lead, LeadFormValues } from '../types/lead'
import { leadPayload } from '../utils/validation'
import { MAX_CSV_BYTES, parseCsv } from '../utils/csv'

type ImportRow = { rowNumber: number; values: LeadFormValues; errors: string[]; duplicates: string[]; selected: boolean }
type CsvImportPageProps = { supabase: SupabaseClient; onBack: () => void; onFinished: () => void }
const expectedHeaders = ['company_name', 'responsible_name', 'whatsapp', 'email', 'instagram', 'address', 'google_maps_url', 'segment', 'source', 'notes', 'next_action', 'next_action_due_date'] as const
const normalize = (value: string | null) => value?.trim().toLocaleLowerCase('pt-BR') ?? ''
const phone = (value: string | null) => value?.replace(/\D/g, '') ?? ''

function mapRows(text: string, existing: Lead[]) {
  const parsed = parseCsv(text)
  const headers = parsed[0]?.map((header) => header.trim().toLocaleLowerCase('pt-BR')) ?? []
  if (new Set(headers).size !== headers.length) throw new Error('Colunas repetidas no CSV.')
  const absent = expectedHeaders.filter((header) => !headers.includes(header))
  if (absent.length) throw new Error(`Faltam colunas no arquivo: ${absent.join(', ')}.`)
  const existingCompany = new Set(existing.map((lead) => normalize(lead.company_name)))
  const existingEmail = new Set(existing.map((lead) => normalize(lead.email)))
  const existingPhone = new Set(existing.map((lead) => phone(lead.whatsapp)))
  const fileCompany = new Set<string>(); const fileEmail = new Set<string>(); const filePhone = new Set<string>()
  return parsed.slice(1).map((cells, index) => {
    const get = (header: typeof expectedHeaders[number]) => cells[headers.indexOf(header)]?.trim() ?? ''
    const values: LeadFormValues = { company_name: get('company_name'), responsible_name: get('responsible_name'), whatsapp: get('whatsapp'), email: get('email'), instagram: get('instagram'), address: get('address'), google_maps_url: get('google_maps_url'), segment: get('segment'), source: get('source'), notes: get('notes'), next_action: get('next_action'), next_action_due_date: get('next_action_due_date'), status: 'novo', motivo_perda: null, motivo_perda_detalhe: '', reuniao_em: '', reuniao_link: '' }
    const errors: string[] = []; const duplicates: string[] = []
    if (cells.length !== headers.length) errors.push('Quantidade de colunas diferente do cabeçalho')
    try { leadPayload(values) } catch { errors.push('Campos inválidos: confira datas, URL HTTPS e limites de texto') }
    if (!values.company_name) errors.push('Empresa é obrigatória')
    if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) errors.push('E-mail inválido')
    if (values.next_action_due_date && !/^\d{4}-\d{2}-\d{2}$/.test(values.next_action_due_date)) errors.push('Data deve usar AAAA-MM-DD')
    if (values.google_maps_url) try { new URL(values.google_maps_url) } catch { errors.push('Link do Google Maps inválido') }
    const company = normalize(values.company_name); const email = normalize(values.email); const whatsapp = phone(values.whatsapp)
    if (company && (existingCompany.has(company) || fileCompany.has(company))) duplicates.push('empresa')
    if (email && (existingEmail.has(email) || fileEmail.has(email))) duplicates.push('e-mail')
    if (whatsapp && (existingPhone.has(whatsapp) || filePhone.has(whatsapp))) duplicates.push('WhatsApp')
    if (company) fileCompany.add(company); if (email) fileEmail.add(email); if (whatsapp) filePhone.add(whatsapp)
    return { rowNumber: index + 2, values, errors, duplicates, selected: errors.length === 0 && duplicates.length === 0 }
  })
}

export function CsvImportPage({ supabase, onBack, onFinished }: CsvImportPageProps) {
  const reading = useRef(0)
  const [isReading, setIsReading] = useState(false)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [message, setMessage] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [showImportConfirmation, setShowImportConfirmation] = useState(false)

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const request = ++reading.current
    setMessage(''); setRows([]); setIsReading(true)
    try {
      if (!file.name.toLowerCase().endsWith('.csv') || file.size > MAX_CSV_BYTES) throw new Error('Selecione um CSV de até 2 MB e 500 linhas.')
      const next = mapRows(await file.text(), await listLeads(supabase))
      if (request === reading.current) setRows(next)
    } catch (error) { if (request === reading.current) setMessage(error instanceof Error ? error.message : 'Não foi possível ler o CSV.') }
    finally { if (request === reading.current) setIsReading(false) }
  }

  function toggle(index: number, selected: boolean) { setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, selected } : row)) }

  async function confirmImport() {
    if (isImporting || isReading) return
    const selected = rows.filter((row) => row.selected && row.errors.length === 0)
    if (!selected.length) return setMessage('Selecione ao menos uma linha válida para importar.')
    setIsImporting(true); setMessage('')
    try { await createLeads(supabase, selected.map((row) => row.values)); setShowImportConfirmation(false); onFinished() }
    catch { setMessage('Não foi possível confirmar a importação. Confira os leads e gere uma nova prévia antes de repetir, para evitar duplicidades.') }
    setIsImporting(false)
  }

  const selectedCount = rows.filter((row) => row.selected && row.errors.length === 0).length
  const errorCount = rows.filter((row) => row.errors.length > 0).length
  return <section className="page-content">
    <div className="detail-header"><div><button className="button-link back-button" onClick={onBack}>← Voltar para leads</button><p className="eyebrow">Importação aprovada</p><h1>Importar leads</h1><p>Envie um arquivo CSV com os leads já aprovados pela equipe.</p></div><a className="template-link" href="/modelo-leads.csv" download><Download aria-hidden="true" size={18} /> Baixar modelo CSV</a></div>
    <label className="upload-box"><UploadCloud aria-hidden="true" size={46} /><strong>Selecione o arquivo CSV</strong><span>Use o seletor abaixo para abrir o arquivo</span><small>Formato .csv · até 2 MB · até 500 leads</small><input type="file" accept=".csv,text/csv" disabled={isImporting || isReading} onChange={chooseFile} /></label>
    <p className="upload-help"><FileSpreadsheet aria-hidden="true" size={18} /> A importação será revisada antes de qualquer dado entrar no banco.</p>
    {isReading && <p role="status">Lendo e validando arquivo…</p>}
    {message && <p className="form-error" role="alert">{message}</p>}
    {rows.length > 0 && <><p className="import-summary">{rows.length} linha(s) encontradas · {selectedCount} pronta(s) para importar · {errorCount} com erro. Linhas com possível duplicidade ficam desmarcadas até sua revisão.</p><div className="table-wrap"><table><thead><tr><th>Importar</th><th>Linha</th><th>Empresa</th><th>Contato</th><th>Validação</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.rowNumber}><td data-label="Importar"><input type="checkbox" checked={row.selected} disabled={isImporting || row.errors.length > 0} onChange={(e) => toggle(index, e.target.checked)} aria-label={`Importar linha ${row.rowNumber}`} /></td><td data-label="Linha">{row.rowNumber}</td><td data-label="Empresa"><strong>{row.values.company_name || '—'}</strong></td><td data-label="Contato">{row.values.whatsapp || row.values.email || '—'}</td><td data-label="Validação">{row.errors.length ? <span className="validation-error">{row.errors.join('; ')}</span> : row.duplicates.length ? <span className="validation-warning">Possível duplicidade: {row.duplicates.join(', ')}</span> : <span className="validation-ok">Pronta para importar</span>}</td></tr>)}</tbody></table></div><div className="form-actions"><button className="button-secondary" onClick={onBack}>Cancelar</button><button onClick={() => setShowImportConfirmation(true)} disabled={isImporting || isReading || selectedCount === 0}>{isImporting ? 'Importando…' : `Confirmar importação (${selectedCount})`}</button></div></>}
    {showImportConfirmation && <ConfirmDialog labelledBy="confirm-import-title" title="Confirmar importação?" message={`${selectedCount} lead(s) válido(s) serão adicionados. Revise a seleção antes de confirmar para evitar duplicidades.`} confirmLabel="Importar leads" busy={isImporting} onCancel={() => setShowImportConfirmation(false)} onConfirm={() => void confirmImport()} />}
  </section>
}
