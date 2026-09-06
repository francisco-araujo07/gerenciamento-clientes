import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ChevronRight, GitBranch, MessageCircleQuestion } from 'lucide-react'
import { guideTree } from '../features/guide/guide-data'
import type { GuideNode } from '../types/guide'

type TreeNodeProps = { node: GuideNode; selectedId: string; depth: number; onSelect: (id: string) => void }

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

function TreeNode({ node, selectedId, depth, onSelect }: TreeNodeProps) {
  const isSelected = node.id === selectedId
  const hasChildren = Boolean(node.children?.length)
  return <div className="guide-tree-node">
    <button className={`guide-tree-button ${isSelected ? 'guide-tree-selected' : ''}`} style={{ paddingLeft: `${8 + depth * 8}px` }} onClick={() => onSelect(node.id)} aria-current={isSelected ? 'step' : undefined}>
      <span className="guide-tree-icon">{hasChildren ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
      <span><strong>{node.title}</strong><small>{node.kind}</small></span>
    </button>
    {hasChildren && <div className="guide-tree-children">{node.children?.map((child) => <TreeNode key={child.id} node={child} selectedId={selectedId} depth={depth + 1} onSelect={onSelect} />)}</div>}
  </div>
}

const kindLabel: Record<GuideNode['kind'], string> = { etapa: 'Etapa', decisao: 'Caminho', acao: 'Ação' }

export function GuidePage() {
  const [selectedId, setSelectedId] = useState('root')
  const selected = useMemo(() => findNode(guideTree, selectedId) ?? guideTree, [selectedId])
  const path = useMemo(() => findPath(guideTree, selected.id) ?? [guideTree], [selected.id])
  const children = selected.children ?? []
  const previous = path.length > 1 ? path[path.length - 2] : null

  return <section className="page-content guide-page">
    <div className="page-heading"><div><p className="eyebrow">Playbook comercial</p><h1>Guia de ligação</h1><p>Siga a conversa por caminhos interativos até a reunião, apresentação e negociação.</p></div><div className="guide-heading-badge"><GitBranch size={20} /> Estrutura em árvore</div></div>
    <div className="guide-layout">
      <aside className="guide-tree-panel" aria-label="Mapa do guia de ligação">
        <div className="guide-panel-heading"><div><strong>Mapa da conversa</strong><small>Clique em qualquer etapa ou caminho</small></div><MessageCircleQuestion size={21} /></div>
        <div className="guide-tree"><TreeNode node={guideTree} selectedId={selected.id} depth={0} onSelect={setSelectedId} /></div>
      </aside>
      <div className="guide-content">
        <nav className="guide-breadcrumb" aria-label="Caminho atual">{path.map((item, index) => <span key={item.id}>{index > 0 && <ChevronRight size={15} />}{item.title}</span>)}</nav>
        <article className="guide-card guide-card-main">
          <div className="guide-card-topline"><span className={`guide-kind guide-kind-${selected.kind}`}>{kindLabel[selected.kind]}</span><span className="guide-step-count">{path.length === 1 ? 'Início' : `Passo ${path.length - 1}`}</span></div>
          <h2>{selected.title}</h2>
          <p className="guide-summary">{selected.summary}</p>
          {selected.script && <div className="guide-script"><strong>Fala sugerida</strong><p>{selected.script}</p></div>}
          {selected.tips && selected.tips.length > 0 && <div className="guide-tips"><strong>Cuidados</strong><ul>{selected.tips.map((tip) => <li key={tip}><CheckCircle2 size={16} />{tip}</li>)}</ul></div>}
        </article>
        {children.length > 0 && <section className="guide-next"><div className="guide-next-heading"><div><p className="eyebrow">Escolha o próximo caminho</p><h2>O que aconteceu?</h2></div><span>{children.length} opção(ões)</span></div><div className="guide-choice-grid">{children.map((child) => <button key={child.id} className="guide-choice" onClick={() => setSelectedId(child.id)}><span className={`guide-choice-icon guide-kind-${child.kind}`}>{child.kind === 'decisao' ? <MessageCircleQuestion size={20} /> : <ArrowRight size={20} />}</span><span><strong>{child.title}</strong><small>{child.summary}</small></span><ChevronRight size={20} /></button>)}</div></section>}
        <div className="guide-navigation">{previous && <button className="button-secondary" onClick={() => setSelectedId(previous.id)}><ArrowLeft size={17} /> Voltar</button>}{selected.id !== 'root' && <button className="button-link" onClick={() => setSelectedId('root')}>Voltar ao início</button>}</div>
      </div>
    </div>
  </section>
}
