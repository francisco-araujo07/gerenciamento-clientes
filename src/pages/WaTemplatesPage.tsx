import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MessageCircle } from 'lucide-react'
import {
  emptyWaTemplateFormValues,
  waTemplateEtapaLabels,
  waTemplateEtapas,
  waTemplateVariables,
  type WaTemplate,
  type WaTemplateFormValues,
} from '../types/whatsapp'
import {
  createWaTemplate,
  listWaTemplates,
  setWaTemplateAtivo,
  updateWaTemplate,
} from '../features/whatsapp/whatsapp-service'

type Props = { supabase: SupabaseClient }

export function WaTemplatesPage({ supabase }: Props) {
  const [templates, setTemplates] = useState<WaTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [editing, setEditing] = useState<WaTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const [values, setValues] = useState<WaTemplateFormValues>(emptyWaTemplateFormValues)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      setTemplates(await listWaTemplates(supabase))
    } catch {
      setErrorMessage('Não foi possível carregar os templates.')
    }
    setIsLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const ativos = useMemo(() => templates.filter((item) => item.ativo), [templates])
  const inativos = useMemo(() => templates.filter((item) => !item.ativo), [templates])

  function startCreate() {
    setCreating(true)
    setEditing(null)
    setValues(emptyWaTemplateFormValues)
    setSuccessMessage('')
    setErrorMessage('')
  }

  function startEdit(template: WaTemplate) {
    setCreating(false)
    setEditing(template)
    setValues({
      nome: template.nome,
      etapa: template.etapa,
      corpo: template.corpo,
      ativo: template.ativo,
    })
    setSuccessMessage('')
    setErrorMessage('')
  }

  function cancelForm() {
    setCreating(false)
    setEditing(null)
    setValues(emptyWaTemplateFormValues)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      if (editing) {
        const saved = await updateWaTemplate(supabase, editing.id, values, editing.updated_at)
        setTemplates((current) => current.map((item) => item.id === saved.id ? saved : item))
        setSuccessMessage('Template atualizado.')
      } else {
        const created = await createWaTemplate(supabase, values)
        setTemplates((current) => [...current, created])
        setSuccessMessage('Template criado.')
      }
      cancelForm()
    } catch {
      setErrorMessage('Não foi possível salvar o template. Confira nome, etapa e corpo.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleAtivo(template: WaTemplate) {
    if (busy) return
    setBusy(true)
    setErrorMessage('')
    try {
      const saved = await setWaTemplateAtivo(supabase, template, !template.ativo)
      setTemplates((current) => current.map((item) => item.id === saved.id ? saved : item))
      setSuccessMessage(saved.ativo ? 'Template reativado. Ele volta a aparecer no modal.' : 'Template desativado. Ele fica só nesta config.')
    } catch {
      setErrorMessage('Não foi possível alterar o template.')
    } finally {
      setBusy(false)
    }
  }

  const showForm = creating || Boolean(editing)

  return (
    <section className="page-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Kit WhatsApp</p>
          <h1>Templates</h1>
          <p>Textos usados no wa.me. Inativos não aparecem no modal Abrir WhatsApp.</p>
        </div>
        <div className="page-actions">
          <button type="button" onClick={startCreate} disabled={busy || showForm}>Novo template</button>
        </div>
      </div>
      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      {successMessage && <p className="validation-ok" role="status">{successMessage}</p>}
      {showForm && (
        <form className="lead-form kit-wa-form" onSubmit={save}>
          <div className="form-grid">
            <label className="field">Nome *<input value={values.nome} onChange={(event) => setValues((current) => ({ ...current, nome: event.target.value }))} maxLength={120} required /></label>
            <label className="field">Etapa *<select value={values.etapa} onChange={(event) => setValues((current) => ({ ...current, etapa: event.target.value as WaTemplateFormValues['etapa'] }))}>{waTemplateEtapas.map((etapa) => <option key={etapa} value={etapa}>{waTemplateEtapaLabels[etapa]}</option>)}</select></label>
            <label className="field field-wide">
              Corpo *
              <textarea value={values.corpo} onChange={(event) => setValues((current) => ({ ...current, corpo: event.target.value }))} rows={6} maxLength={2000} required aria-describedby="kit-wa-vars" />
              <span id="kit-wa-vars" className="field-counter">
                Variáveis: {waTemplateVariables.map((item) => `{{${item}}}`).join(' ')} · {values.corpo.length}/2000
              </span>
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="button-secondary" disabled={busy} onClick={cancelForm}>Cancelar</button>
            <button type="submit" disabled={busy}>{busy ? 'Salvando…' : editing ? 'Salvar template' : 'Criar template'}</button>
          </div>
        </form>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Etapa</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr className="table-message"><td colSpan={4}>Carregando templates…</td></tr>
            ) : templates.length === 0 ? (
              <tr className="table-message">
                <td colSpan={4}>
                  <div className="empty-state">
                    <MessageCircle size={28} aria-hidden="true" />
                    <strong>Nenhum template cadastrado.</strong>
                    <span>Crie o primeiro texto para o wa.me.</span>
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {ativos.map((template) => (
                  <tr key={template.id}>
                    <td data-label="Nome">{template.nome}</td>
                    <td data-label="Etapa">{waTemplateEtapaLabels[template.etapa]}</td>
                    <td data-label="Status"><span className="status status-project-concluido">Ativo</span></td>
                    <td data-label="Ações" className="row-actions">
                      <button type="button" className="button-link" disabled={busy} onClick={() => startEdit(template)}>Editar</button>
                      <button type="button" className="button-link" disabled={busy} onClick={() => void toggleAtivo(template)}>Desativar</button>
                    </td>
                  </tr>
                ))}
                {inativos.length > 0 && (
                  <tr className="table-message kit-wa-inactive-heading">
                    <td colSpan={4}><strong>Inativos (só nesta config)</strong></td>
                  </tr>
                )}
                {inativos.map((template) => (
                  <tr key={template.id}>
                    <td data-label="Nome">{template.nome}</td>
                    <td data-label="Etapa">{waTemplateEtapaLabels[template.etapa]}</td>
                    <td data-label="Status"><span className="status status-project-pausado">Inativo</span></td>
                    <td data-label="Ações" className="row-actions">
                      <button type="button" className="button-link" disabled={busy} onClick={() => startEdit(template)}>Editar</button>
                      <button type="button" className="button-link" disabled={busy} onClick={() => void toggleAtivo(template)}>Reativar</button>
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
