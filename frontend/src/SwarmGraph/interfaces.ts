import { NodeKind, EdgeKind } from '../types'

export interface NodeData {
  id: string
  name?: string
  Name?: string
  kind: NodeKind
  attributes?: {
    status?: string
    image?: string
    [key: string]: any
  }
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

export interface EdgeData {
  id?: string
  src: string
  dst: string
  kind: EdgeKind
  attributes?: {
    ip?: string
    target?: string
    [key: string]: any
  }
  source: NodeData
  target: NodeData
}

export interface GraphData {
  nodes: Record<string, NodeData>
  edges: EdgeData[]
}

export interface SwarmGraphProps {
  data: GraphData
}

export interface GraphDimensions {
  width: number
  height: number
}

export interface VisibilityState {
  visibleNodes: Record<NodeKind, boolean>
  visibleEdges: Record<EdgeKind, boolean>
}

export interface GraphEventHandlers {
  setHoveredNode: (id: string | null) => void
  setSelectedNode: React.Dispatch<React.SetStateAction<string | null>>
  hoveredNode: string | null
  selectedNode: string | null
}

export interface ReactD3GraphProps extends VisibilityState, GraphEventHandlers {
  data: GraphData
  dimensions: GraphDimensions
}
