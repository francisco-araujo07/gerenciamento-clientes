import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { dateLabel } from '../utils/dates'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ClientEditor } from '../features/clients/ClientEditor'
import { createProject, deleteClient, deleteProject, getClient, updateClient, updateProject, type ClientValues } from '../features/clients/client-service'
import { emptyProjectValues, projectStatusLabels, projectStatuses, type Client, type ProjectValues } from '../types/client'

type Props = { supabase: SupabaseClient; clientId: string; onBack: () => void }
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export function ClientDetailsPage({ supabase, clientId, onBack }: Props) {
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [editingClient, setEditingClient] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [values, setValues] = useState<ProjectValues>(emptyProjectValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [pendingProjectDeletion, setPendingProjectDeletion] = useState<string | null>(null)
  const [showClientDeletion, setShowClientDeletion] = useState(false)
  const load = useCallback(async () => { setLoading(true); try { setClient(await getClient(supabase, clientId)); setError('') } catch { setError('Não foi possível carregar o cliente.') } setLoading(false) }, [clientId, supabase])
  useEffect(() => { void load() }, [load])
  async function saveClient(values: ClientValues) { if (saving) return; setSaving(true); setError(''); setSuccessMessage(''); try { await updateClient(supabase, clientId, values, client!.updated_at); setEditingClient(false); await load(); setSuccessMessage('Cliente salvo com sucesso.') } catch { setError('Não foi possível salvar o cliente. Confira os campos ou uma alteração concorrente; preserve seu texto antes de atualizar.') } setSaving(false) }
  async function saveProject(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!client || saving) return; const wasEditing = Boolean(editingProjectId); setSaving(true); setError(''); setSuccessMessage(''); try { if (editingProjectId) await updateProject(supabase, editingProjectId, values, client.projects.find((project) => project.id === editingProjectId)!.updated_at); else await createProject(supabase, client.id, values); setValues(emptyProjectValues); setEditingProjectId(null); setShowProjectForm(false); await load(); setSuccessMessage(wasEditing ? 'Projeto atualizado com sucesso.' : 'Projeto salvo com sucesso.') } catch { setError('Não foi possível salvar o projeto. Confira os campos ou uma alteração concorrente; preserve seu texto antes de atualizar.') } setSaving(false) }
  async function removeProject() {
    if (!pendingProjectDeletion || saving) return
    setSaving(true); setError('')
    try { await deleteProject(supabase, pendingProjectDeletion); setPendingProjectDeletion(null); await load() }
    catch { setError('Não foi possível excluir o projeto. Atualize antes de tentar novamente.') }
    finally { setSaving(false) }
  }
  async function removeClient() {
    if (saving) return
    setSaving(true); setError('')
    try { await deleteClient(supabase, clientId); onBack() }
    catch { setError('Não foi possível excluir o cliente. Atualize antes de tentar novamente.') }
    finally { setSaving(false); setShowClientDeletion(false) }
  }
  if (loading) return <section className="page-content">Carregando cliente…</section>
  if (!client) return <section className="page-content"><p className="form-error">{error || 'Cliente não encontrado.'}</p></section>
  if (editingClient) return <section className="page-content"><button className="button-link back-button" onClick={() => setEditingClient(false)}>← Voltar aos detalhes</button><p className="eyebrow">Editar cliente</p><h1>{client.company_name}</h1>{error && <p role="alert" className="form-error">{error}</p>}<ClientEditor client={client} saving={saving} onCancel={() => setEditingClient(false)} onSave={saveClient} /></section>
  return <section className="page-content"><div className="detail-header"><div><button className="button-link back-button" onClick={onBack}>← Voltar para clientes</button><p className="eyebrow">Detalhes do cliente</p><h1>{client.company_name}</h1><p>{client.responsible_name || 'Sem responsável informado'}</p></div><div className="page-actions"><button className="button-secondary" onClick={() => setEditingClient(true)}>Editar cliente</button><button onClick={() => { setValues(emptyProjectValues); setEditingProjectId(null); setShowProjectForm(!showProjectForm) }}>{showProjectForm ? 'Cancelar projeto' : 'Novo projeto'}</button><button className="button-secondary danger-link" disabled={saving} onClick={() => setShowClientDeletion(true)}>Excluir cliente</button></div></div>{error && <p className="form-error" role="alert">{error}</p>}{successMessage && <p className="validation-ok" role="status">{successMessage}</p>}{showProjectForm && <form className="lead-form project-form" onSubmit={saveProject}><div className="form-grid"><label className="field field-wide">Nome do projeto *<input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} required /></label><label className="field">Preço *<input value={values.price} onChange={(e) => setValues({ ...values, price: e.target.value })} type="number" min="0" step="0.01" max="9999999999.99" required /></label><label className="field">Situação<select value={values.status} onChange={(e) => setValues({ ...values, status: e.target.value as ProjectValues['status'] })}>{projectStatuses.map((status) => <option key={status} value={status}>{projectStatusLabels[status]}</option>)}</select></label><label className="field">Prazo<input type="date" value={values.deadline} onChange={(e) => setValues({ ...values, deadline: e.target.value })} /></label>{values.status === 'concluido' && <label className="field">Data de conclusão<input type="date" value={values.completed_at} onChange={(e) => setValues({ ...values, completed_at: e.target.value })} /></label>}</div><div className="form-actions"><button disabled={saving}>{saving ? 'Salvando…' : 'Salvar projeto'}</button></div></form>}<div className="detail-grid"><article><h2>Contato</h2><dl><div><dt>WhatsApp</dt><dd>{client.whatsapp || '—'}</dd></div><div><dt>E-mail</dt><dd>{client.email || '—'}</dd></div></dl></article><article><h2>Projetos</h2>{client.projects.length === 0 && <p>Nenhum projeto cadastrado.</p>}{client.projects.map((project) => <div className="project-row" key={project.id}><div><strong>{project.name}</strong><span className="table-note">Prazo: {dateLabel(project.deadline)}</span>{project.completed_at && <span className="table-note">Concluído: {dateLabel(project.completed_at)}</span>}</div><span>{money(project.price)}</span><span className={`status status-${project.status}`}>{projectStatusLabels[project.status]}</span><button className="button-link" onClick={() => { setValues({ name: project.name, price: String(project.price), deadline: project.deadline || '', status: project.status, completed_at: project.completed_at || '' }); setEditingProjectId(project.id); setShowProjectForm(true) }}>Editar</button><button className="button-link danger-link" disabled={saving} onClick={() => setPendingProjectDeletion(project.id)}>Excluir</button></div>)}</article><article className="detail-wide"><h2>Resumo e anotações</h2><p>{client.notes || 'Nenhuma anotação registrada.'}</p></article></div>{pendingProjectDeletion && <ConfirmDialog labelledBy="delete-project-title" title="Excluir projeto?" message="Use a exclusão somente para projetos criados por engano. Esta ação não pode ser desfeita." confirmLabel="Excluir projeto" danger busy={saving} onCancel={() => setPendingProjectDeletion(null)} onConfirm={() => void removeProject()} />}{showClientDeletion && <ConfirmDialog labelledBy="delete-client-title" title="Excluir este cliente?" message="Todos os projetos deste cliente também serão excluídos. Use a exclusão somente para registros criados por engano." confirmLabel="Excluir cliente" danger busy={saving} onCancel={() => setShowClientDeletion(false)} onConfirm={() => void removeClient()} />}</section>
}
