import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Copy, MessageCircle, Search } from 'lucide-react'
import { LeadStatusBadge } from '../leads/LeadStatusBadge'
import type { Lead } from '../../types/lead'
import {
  findGuiaConversaNode,
  findGuiaConversaPath,
  formatGuiaConversaStatus,
  guiaConversaEtapas,
  guiaConversaPrinciples,
  guiaConversaTree,
  searchGuiaConversaNodes,
  type GuiaConversaNode,
} from './guia-conversa-data'
import { interpolateGuiaConversa, type GuiaConversaVars } from './guia-conversa-interpolate'
import { copyTextToClipboard } from './copy-text'

const kindLabel: Record<GuiaConversaNode['kind'], string> = { etapa: 'Etapa', decisao: 'Caminho', acao: 'Ação' }

type TreeNodeProps = { node: GuiaConversaNode; selectedId: string; depth: number; onSelect: (id: string) => void }

function TreeNode({ node, selectedId, depth, onSelect }: TreeNodeProps) {
  const isSelected = node.id === selectedId
  const hasChildren = Boolean(node.children?.length)
  return (
    <div className="guide-tree-node">
      <button
        type="button"
        className={`guide-tree-button ${isSelected ? 'guide-tree-selected' : ''}`}
        style={{ paddingLeft: `${8 + depth * 8}px` }}
        onClick={() => onSelect(node.id)}
        aria-current={isSelected ? 'step' : undefined}
      >
        <span className="guide-tree-icon">{hasChildren ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
        <span>
          <strong>{node.title}</strong>
          <small>{node.kind}</small>
        </span>
      </button>
      {hasChildren && (
        <div className="guide-tree-children">
          {node.children?.map((child) => (
            <TreeNode key={child.id} node={child} selectedId={selectedId} depth={depth + 1} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

type Props = {
  vars: GuiaConversaVars
  lead: Lead | null
  kitEnabled: boolean
  cadenciaEnabled: boolean
  onUseText: (text: string, chip?: string) => void
  onOpenHoje?: () => void
}

export function GuideWhatsAppPanel({ vars, lead, kitEnabled, cadenciaEnabled, onUseText, onOpenHoje }: Props) {
  const [selectedId, setSelectedId] = useState('wa-root')
  const [query, setQuery] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const selected = useMemo(() => findGuiaConversaNode(guiaConversaTree, selectedId) ?? guiaConversaTree, [selectedId])
  const path = useMemo(() => findGuiaConversaPath(guiaConversaTree, selected.id) ?? [guiaConversaTree], [selected.id])
  const children = selected.children ?? []
  const previous = path.length > 1 ? path[path.length - 2] : null
  const etapas = guiaConversaEtapas()
  const matches = useMemo(() => searchGuiaConversaNodes(query), [query])
  const interpolatedSay = selected.say ? interpolateGuiaConversa(selected.say, vars) : ''
  const interpolatedDue = selected.glc?.next_action_due_date
    ? interpolateGuiaConversa(selected.glc.next_action_due_date, vars)
    : ''
  const interpolatedAction = selected.glc?.next_action
    ? interpolateGuiaConversa(selected.glc.next_action, vars)
    : ''

  async function copySay() {
    setCopyMessage('')
    try {
      await copyTextToClipboard(interpolatedSay)
      setCopyMessage('Texto copiado.')
    } catch {
      setCopyMessage('Não foi possível copiar. Selecione o texto e copie manualmente.')
    }
  }

  return (
    <div className="guide-layout">
      <aside className="guide-tree-panel" aria-label="Mapa do guia de conversa no WhatsApp">
        <div className="guide-panel-heading">
          <div>
            <strong>Seis etapas</strong>
            <small>WhatsApp · conteúdo estático do brief</small>
          </div>
          <MessageCircle size={21} />
        </div>
        <div className="guide-wa-etapas" role="navigation" aria-label="Etapas do WhatsApp">
          {etapas.map((etapa) => (
            <button
              key={etapa.id}
              type="button"
              className={path.some((item) => item.id === etapa.id) ? 'guide-wa-etapa guide-wa-etapa-active' : 'guide-wa-etapa'}
              onClick={() => setSelectedId(etapa.id)}
            >
              {etapa.title}
            </button>
          ))}
        </div>
        <label className="search-field guide-wa-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar fala ou etapa"
            aria-label="Buscar fala ou etapa do WhatsApp"
          />
        </label>
        {query.trim() && (
          <ul className="guide-wa-search-results">
            {matches.length === 0 && <li>Nenhuma fala encontrada.</li>}
            {matches.slice(0, 12).map((item) => (
              <li key={item.id}>
                <button type="button" className="button-link" onClick={() => { setSelectedId(item.id); setQuery('') }}>
                  {item.title}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="guide-tree">
          <TreeNode node={guiaConversaTree} selectedId={selected.id} depth={0} onSelect={setSelectedId} />
        </div>
      </aside>
      <div className="guide-content">
        <nav className="guide-breadcrumb" aria-label="Caminho atual do guia de conversa">
          {path.map((item, index) => (
            <span key={item.id}>
              {index > 0 && <ChevronRight size={15} />}
              {item.title}
            </span>
          ))}
        </nav>
        <details className="guide-principles">
          <summary>Princípios da conversa</summary>
          <ul>
            {guiaConversaPrinciples.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
        <article className="guide-card guide-card-main">
          <div className="guide-card-topline">
            <span className={`guide-kind guide-kind-${selected.kind}`}>{kindLabel[selected.kind]}</span>
            <span className="guide-step-count">{path.length === 1 ? 'Início' : `Passo ${path.length - 1}`}</span>
          </div>
          <h2>{selected.title}</h2>
          <p className="guide-summary">{selected.summary}</p>
          {selected.f3Chip && (
            <p className="guide-f3-chip" role="status">
              Chip F3: {selected.f3Chip}
            </p>
          )}
          {interpolatedSay && (
            <div className="guide-script">
              <strong>O que dizer</strong>
              <p>{interpolatedSay}</p>
              <div className="guide-speech-actions">
                <button type="button" className="button-secondary" onClick={() => void copySay()}>
                  <Copy size={16} /> Copiar
                </button>
                {kitEnabled && lead && (
                  <button type="button" onClick={() => onUseText(interpolatedSay, selected.f3Chip)}>
                    Usar este texto no lead aberto
                  </button>
                )}
              </div>
              {copyMessage && <p className="validation-ok" role="status">{copyMessage}</p>}
            </div>
          )}
          {selected.printReminder && (
            <p className="validation-warning" role="status">
              Lembrete: anexe o print do protótipo no WhatsApp depois de abrir a conversa. O wa.me só leva o texto.
            </p>
          )}
          {selected.glc && (
            <div className="guide-glc">
              <strong>O que fazer no GLC</strong>
              <dl>
                {selected.glc.status && (
                  <div>
                    <dt>status</dt>
                    <dd>
                      <code>{selected.glc.status}</code>
                      {' — '}
                      {formatGuiaConversaStatus(selected.glc.status).split(' — ')[1]}
                      {' '}
                      <LeadStatusBadge status={selected.glc.status} funilEnabled />
                    </dd>
                  </div>
                )}
                {interpolatedAction && (
                  <div>
                    <dt>next_action</dt>
                    <dd>{interpolatedAction}</dd>
                  </div>
                )}
                {interpolatedDue && (
                  <div>
                    <dt>next_action_due_date</dt>
                    <dd>{interpolatedDue}</dd>
                  </div>
                )}
              </dl>
              {selected.glc.note && <p>{selected.glc.note}</p>}
              <p className="guide-glc-help">O Guia não aplica status nem cadência sozinho. Atualize no card do lead ou na fila Hoje.</p>
              {cadenciaEnabled && selected.id === 'pos-cadencia' && onOpenHoje && (
                <button type="button" className="button-secondary" onClick={onOpenHoje}>
                  Abrir fila Hoje
                </button>
              )}
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
                <button key={child.id} type="button" className="guide-choice" onClick={() => setSelectedId(child.id)}>
                  <span className={`guide-choice-icon guide-kind-${child.kind}`}>
                    {child.kind === 'decisao' ? <MessageCircle size={20} /> : <ArrowRight size={20} />}
                  </span>
                  <span>
                    <strong>{child.title}</strong>
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
            <button type="button" className="button-secondary" onClick={() => setSelectedId(previous.id)}>
              <ArrowLeft size={17} /> Voltar
            </button>
          )}
          {selected.id !== 'wa-root' && (
            <button type="button" className="button-link" onClick={() => setSelectedId('wa-root')}>
              Voltar ao início
            </button>
          )}
          {cadenciaEnabled && onOpenHoje && selected.id !== 'pos-cadencia' && (
            <button type="button" className="button-link" onClick={onOpenHoje}>
              Ver empty/help da fila Hoje
            </button>
          )}
        </div>
        <p className="guide-glc-help">
          Ramos extras (A–F, case/nicho, 4º toque) existem só neste Guia. Os 5 chips F3 não alteram os corpos do Kit.
        </p>
      </div>
    </div>
  )
}
