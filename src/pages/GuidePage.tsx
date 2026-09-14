import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ChevronRight, GitBranch, MessageCircleQuestion, Search } from 'lucide-react'
import { guideTree } from '../features/guide/guide-data'
import { displayGuideNodeTitle, guidePageTitle, guideDocumentTitle, APP_DOCUMENT_TITLE, type GuideTab } from '../features/guide/guide-chrome'
import { GuideWhatsAppPanel } from '../features/guide/GuideWhatsAppPanel'
import { buildGuiaConversaVars } from '../features/guide/guia-conversa-interpolate'
import { displayNameFromUser } from '../features/whatsapp/templates'
import { currentWhatsappUserName } from '../features/whatsapp/whatsapp-service'
import { OpenWhatsAppDialog } from '../features/whatsapp/OpenWhatsAppDialog'
import { getLead, listLeadsPage } from '../features/leads/lead-service'
import type { GuideNode } from '../types/guide'
import type { Lead } from '../types/lead'
import {
  isGlcFilaCadenciaEnabled,
  isGlcGuiaConversaEnabled,
  isGlcKitWhatsappEnabled,
} from '../utils/feature-flags'

type TreeNodeProps = { node: GuideNode; selectedId: string; depth: number; onSelect: (id: string) => void; enabled: boolean }

function findNode(node: GuideNode, id: string): GuideNode | null {
  if (node.id === id) return node
  for (const child of node.children ?? []) {
    const match = findNode(child, id)
    if (match) return match
  }
  return null
}

function findPath(node: GuideNode, id: string, path: GuideNode[] = []): GuideNode[] | null {
  const nextPath = [...path, node]
  if (node.id === id) return nextPath
  for (const child of node.children ?? []) {
    const match = findPath(child, id, nextPath)
    if (match) return match
  }
  return null
}

function TreeNode({ node, selectedId, depth, onSelect, enabled }: TreeNodeProps) {
  const isSelected = node.id === selectedId
  const hasChildren = Boolean(node.children?.length)
  return (
    <div className="guide-tree-node">
      <button className={`guide-tree-button ${isSelected ? 'guide-tree-selected' : ''}`} style={{ paddingLeft: `${8 + depth * 8}px` }} onClick={() => onSelect(node.id)} aria-current={isSelected ? 'step' : undefined}>
        <span className="guide-tree-icon">{hasChildren ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
        <span>
          <strong>{displayGuideNodeTitle(node.title, enabled)}</strong>
          <small>{node.kind}</small>
        </span>
      </button>
      {hasChildren && <div className="guide-tree-children">{node.children?.map((child) => <TreeNode key={child.id} node={child} selectedId={selectedId} depth={depth + 1} onSelect={onSelect} enabled={enabled} />)}</div>}
    </div>
  )
}

const kindLabel: Record<GuideNode['kind'], string> = { etapa: 'Etapa', decisao: 'Caminho', acao: 'Ação' }

type GuidePageProps = {
  supabase: SupabaseClient
  leadId?: string | null
  tab?: GuideTab
  onLeadIdChange?: (id: string | null) => void
  onTabChange?: (tab: GuideTab) => void
  onOpenHoje?: () => void
}

function GuideLigacaoPanel({ enabled }: { enabled: boolean }) {
  const [selectedId, setSelectedId] = useState('root')
  const selected = useMemo(() => findNode(guideTree, selectedId) ?? guideTree, [selectedId])
  const path = useMemo(() => findPath(guideTree, selected.id) ?? [guideTree], [selected.id])
  const children = selected.children ?? []
  const previous = path.length > 1 ? path[path.length - 2] : null

  return (
    <div className="guide-layout">
      <aside className="guide-tree-panel" aria-label="Mapa do guia de ligação">
        <div className="guide-panel-heading">
          <div>
            <strong>Mapa da conversa</strong>
            <small>Clique em qualquer etapa ou caminho</small>
          </div>
          <MessageCircleQuestion size={21} />
        </div>
        <div className="guide-tree">
          <TreeNode node={guideTree} selectedId={selected.id} depth={0} onSelect={setSelectedId} enabled={enabled} />
        </div>
      </aside>
      <div className="guide-content">
        <nav className="guide-breadcrumb" aria-label="Caminho atual">
          {path.map((item, index) => (
            <span key={item.id}>
              {index > 0 && <ChevronRight size={15} />}
              {displayGuideNodeTitle(item.title, enabled)}
            </span>
          ))}
        </nav>
        <article className="guide-card guide-card-main">
          <div className="guide-card-topline">
            <span className={`guide-kind guide-kind-${selected.kind}`}>{kindLabel[selected.kind]}</span>
            <span className="guide-step-count">{path.length === 1 ? 'Início' : `Passo ${path.length - 1}`}</span>
          </div>
          <h2>{displayGuideNodeTitle(selected.title, enabled)}</h2>
          <p className="guide-summary">{selected.summary}</p>
          {selected.script && (
            <div className="guide-script">
              <strong>Fala sugerida</strong>
              <p>{selected.script}</p>
            </div>
          )}
          {selected.tips && selected.tips.length > 0 && (
            <div className="guide-tips">
              <strong>Cuidados</strong>
              <ul>
                {selected.tips.map((tip) => (
                  <li key={tip}>
                    <CheckCircle2 size={16} />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
        {children.length > 0 && (
          <section className="guide-next">
            <div className="guide-next-heading">
              <div>
                <p className="eyebrow">Escolha o próximo caminho</p>
                <h2>O que aconteceu?</h2>
              </div>
              <span>{children.length} opção(ões)</span>
            </div>
            <div className="guide-choice-grid">
              {children.map((child) => (
                <button key={child.id} className="guide-choice" onClick={() => setSelectedId(child.id)}>
                  <span className={`guide-choice-icon guide-kind-${child.kind}`}>{child.kind === 'decisao' ? <MessageCircleQuestion size={20} /> : <ArrowRight size={20} />}</span>
                  <span>
                    <strong>{displayGuideNodeTitle(child.title, enabled)}</strong>
                    <small>{child.summary}</small>
                  </span>
                  <ChevronRight size={20} />
                </button>
              ))}
            </div>
          </section>
        )}
        <div className="guide-navigation">
          {previous && (
            <button className="button-secondary" onClick={() => setSelectedId(previous.id)}>
              <ArrowLeft size={17} /> Voltar
            </button>
          )}
          {selected.id !== 'root' && (
            <button className="button-link" onClick={() => setSelectedId('root')}>
              Voltar ao início
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function GuidePage({
  supabase,
  leadId = null,
  tab,
  onLeadIdChange,
  onTabChange,
  onOpenHoje,
}: GuidePageProps) {
  const guiaEnabled = isGlcGuiaConversaEnabled()
  const kitEnabled = isGlcKitWhatsappEnabled()
  const cadenciaEnabled = isGlcFilaCadenciaEnabled()
  const title = guidePageTitle(guiaEnabled)
  const activeTab: GuideTab = guiaEnabled ? (tab ?? 'whatsapp') : 'ligacao'
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Lead[]>([])
  const [lead, setLead] = useState<Lead | null>(null)
  const [leadError, setLeadError] = useState('')
  const [seuNome, setSeuNome] = useState('')
  const [kitSpeech, setKitSpeech] = useState<{ text: string; chip?: string } | null>(null)

  useEffect(() => {
    const previous = document.title
    document.title = guideDocumentTitle(guiaEnabled)
    return () => { document.title = APP_DOCUMENT_TITLE || previous }
  }, [guiaEnabled])

  useEffect(() => {
    if (!guiaEnabled) return
    let active = true
    void currentWhatsappUserName(supabase).then((user) => {
      if (active) setSeuNome(displayNameFromUser(user))
    })
    return () => { active = false }
  }, [guiaEnabled, supabase])

  useEffect(() => {
    if (!leadId) {
      setLead(null)
      setLeadError('')
      return
    }
    let active = true
    setLeadError('')
    void getLead(supabase, leadId).then((row) => {
      if (!active) return
      setLead(row)
    }).catch(() => {
      if (!active) return
      setLead(null)
      setLeadError('Não foi possível abrir este lead. Confira o seletor ou o parâmetro ?leadId=.')
    })
    return () => { active = false }
  }, [leadId, supabase])

  const vars = useMemo(() => buildGuiaConversaVars(lead, seuNome), [lead, seuNome])

  async function searchLeads() {
    const term = search.trim()
    if (!term) {
      setResults([])
      return
    }
    try {
      const page = await listLeadsPage(supabase, { search: term, status: 'todos', pageSize: 8 })
      setResults(page.data)
      if (page.data.length === 0) setLeadError('Nenhum lead encontrado para essa busca.')
      else setLeadError('')
    } catch {
      setLeadError('Não foi possível buscar leads.')
    }
  }

  function selectLead(id: string) {
    onLeadIdChange?.(id)
    setResults([])
    setSearch('')
  }

  return (
    <section className="page-content guide-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Playbook comercial</p>
          <h1>{title}</h1>
          <p>
            {guiaEnabled
              ? 'Siga a conversa no WhatsApp (padrão) ou o roteiro legado de ligação. Sem preço de pacote no chat.'
              : 'Siga a conversa por caminhos interativos até a reunião, apresentação e negociação.'}
          </p>
        </div>
        <div className="guide-heading-badge">
          <GitBranch size={20} /> {guiaEnabled ? 'Ligação + WhatsApp' : 'Estrutura em árvore'}
        </div>
      </div>
      {guiaEnabled && (
        <>
          <nav className="guide-breadcrumb" aria-label="Navegação do guia">
            <span>{title}</span>
            <ChevronRight size={15} />
            <span>{activeTab === 'whatsapp' ? 'WhatsApp' : 'Ligação'}</span>
            {lead && (
              <>
                <ChevronRight size={15} />
                <span>{lead.company_name}</span>
              </>
            )}
          </nav>
          <div className="cadencia-tabs" role="tablist" aria-label="Canal do guia">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ligacao'}
              className={activeTab === 'ligacao' ? 'cadencia-tab cadencia-tab-active' : 'cadencia-tab'}
              onClick={() => onTabChange?.('ligacao')}
            >
              Ligação
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'whatsapp'}
              className={activeTab === 'whatsapp' ? 'cadencia-tab cadencia-tab-active' : 'cadencia-tab'}
              onClick={() => onTabChange?.('whatsapp')}
            >
              WhatsApp
            </button>
          </div>
          <div className="guide-lead-picker">
            <label className="search-field">
              <Search size={20} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchLeads() } }}
                placeholder="Buscar lead por empresa ou responsável"
                aria-label="Buscar lead para interpolar o guia"
              />
            </label>
            <button type="button" className="button-secondary" onClick={() => void searchLeads()}>Buscar</button>
            {lead && (
              <button type="button" className="button-link" onClick={() => onLeadIdChange?.(null)}>
                Limpar lead
              </button>
            )}
          </div>
          {lead && (
            <p className="validation-ok" role="status">
              Lead aberto: {lead.company_name}. Variáveis F3 e horários de amanhã 10h/16h entram nas falas.
            </p>
          )}
          {leadError && <p className="form-error" role="alert">{leadError}</p>}
          {results.length > 0 && (
            <ul className="guide-lead-results">
              {results.map((item) => (
                <li key={item.id}>
                  <button type="button" className="company-link" onClick={() => selectLead(item.id)}>
                    {item.company_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {activeTab === 'whatsapp' && guiaEnabled ? (
        <GuideWhatsAppPanel
          vars={vars}
          lead={lead}
          kitEnabled={kitEnabled}
          cadenciaEnabled={cadenciaEnabled}
          onUseText={(text, chip) => setKitSpeech({ text, chip })}
          onOpenHoje={onOpenHoje}
        />
      ) : (
        <GuideLigacaoPanel enabled={guiaEnabled} />
      )}
      {kitEnabled && lead && kitSpeech && (
        <OpenWhatsAppDialog
          supabase={supabase}
          lead={lead}
          initialPreview={kitSpeech.text}
          preferredTemplateName={kitSpeech.chip}
          onClose={() => setKitSpeech(null)}
          onLeadUpdated={(saved) => setLead(saved)}
        />
      )}
    </section>
  )
}
