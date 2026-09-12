import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Download, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { mapCsvLeadRows, type CsvImportRow } from '../features/leads/csv-import'
import { createLeads, listLeads } from '../features/leads/lead-service'
import { MAX_CSV_BYTES } from '../utils/csv'

type CsvImportPageProps = { supabase: SupabaseClient; onBack: () => void; onFinished: () => void }

export function CsvImportPage({ supabase, onBack, onFinished }: CsvImportPageProps) {
  const reading = useRef(0)
  const [isReading, setIsReading] = useState(false)
  const [rows, setRows] = useState<CsvImportRow[]>([])
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
      const next = mapCsvLeadRows(await file.text(), await listLeads(supabase))
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
    <p className="upload-help"><FileSpreadsheet aria-hidden="true" size={18} /> A importação será revisada antes de qualquer dado entrar no banco. Colunas porteiro_* e decisor_* são opcionais.</p>
    {isReading && <p role="status">Lendo e validando arquivo…</p>}
    {message && <p className="form-error" role="alert">{message}</p>}
    {rows.length > 0 && <><p className="import-summary">{rows.length} linha(s) encontradas · {selectedCount} pronta(s) para importar · {errorCount} com erro. Linhas com possível duplicidade ficam desmarcadas até sua revisão.</p><div className="table-wrap"><table><thead><tr><th>Importar</th><th>Linha</th><th>Empresa</th><th>Contato</th><th>Validação</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.rowNumber}><td data-label="Importar"><input type="checkbox" checked={row.selected} disabled={isImporting || row.errors.length > 0} onChange={(e) => toggle(index, e.target.checked)} aria-label={`Importar linha ${row.rowNumber}`} /></td><td data-label="Linha">{row.rowNumber}</td><td data-label="Empresa"><strong>{row.values.company_name || '—'}</strong></td><td data-label="Contato">{row.values.whatsapp || row.values.porteiro_whatsapp || row.values.decisor_whatsapp || row.values.email || '—'}</td><td data-label="Validação">{row.errors.length ? <span className="validation-error">{row.errors.join('; ')}</span> : row.duplicates.length ? <span className="validation-warning">Possível duplicidade: {row.duplicates.join(', ')}</span> : <span className="validation-ok">Pronta para importar</span>}</td></tr>)}</tbody></table></div><div className="form-actions"><button className="button-secondary" onClick={onBack}>Cancelar</button><button onClick={() => setShowImportConfirmation(true)} disabled={isImporting || isReading || selectedCount === 0}>{isImporting ? 'Importando…' : `Confirmar importação (${selectedCount})`}</button></div></>}
    {showImportConfirmation && <ConfirmDialog labelledBy="confirm-import-title" title="Confirmar importação?" message={`${selectedCount} lead(s) válido(s) serão adicionados. Revise a seleção antes de confirmar para evitar duplicidades.`} confirmLabel="Importar leads" busy={isImporting} onCancel={() => setShowImportConfirmation(false)} onConfirm={() => void confirmImport()} />}
  </section>
}
