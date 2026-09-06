export type GuideNodeKind = 'etapa' | 'decisao' | 'acao'

export type GuideNode = {
  id: string
  title: string
  kind: GuideNodeKind
  summary: string
  script?: string
  tips?: string[]
  children?: GuideNode[]
}
