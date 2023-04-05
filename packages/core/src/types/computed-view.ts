import type { Opaque } from './opaque'
import type { ElementShape, Fqn, ThemeColor } from './element'
import type { RelationID } from './relation'
import type { ElementView, ViewID } from './view'

export type NodeId = Fqn

export type EdgeId = Opaque<string, 'EdgeId'>

export interface ComputedNode {
  id: NodeId
  parent: NodeId | null
  title: string
  description?: string
  technology?: string
  children: NodeId[]
  shape: ElementShape
  color: ThemeColor
  navigateTo?: ViewID
}


export interface ComputedEdge {
  id: EdgeId
  source: NodeId
  target: NodeId
  label: string | null
  relations: RelationID[]
}

export interface ComputedView<Node extends ComputedNode = ComputedNode, Edge extends ComputedEdge = ComputedEdge> extends ElementView {
  nodes: Node[]
  edges: Edge[]
}