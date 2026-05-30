export type GraphNodeType =
  | 'fact'
  | 'root'
  | 'alpha'
  | 'beta'
  | 'production'
  | 'generic'

export type GraphNodeState =
  | 'default'
  | 'unreached'
  | 'active'
  | 'passed'
  | 'failed'
  | 'triggered'
  | 'selected'

export type GraphVisibilityState =
  | 'visible'
  | 'ghosted'
  | 'hidden'

export type GraphEdgeState =
  | 'default'
  | 'unreached'
  | 'active'
  | 'passed'
  | 'failed'
  | 'triggered'
  | 'muted'

export type GraphNode = {
  id: string
  label: string
  type?: GraphNodeType
  description?: string
  annotation?: {
    label: string
    detail?: string
    tone: 'neutral' | 'info' | 'failed' | 'triggered'
  }
}

export type GraphEdge = {
  source: string
  target: string
}

export type TreeGraphProps = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  rootId?: string
  width?: number | string
  height?: number | string
  nodeRadius?: number
  levelGap?: number
  siblingGap?: number
  curvedEdges?: boolean
  nodeStateById?: Record<string, GraphNodeState>
  edgeStateById?: Record<string, GraphEdgeState>
  nodeVisibilityById?: Record<string, GraphVisibilityState>
  edgeVisibilityById?: Record<string, GraphVisibilityState>
  className?: string
  onNodeClick?: (node: GraphNode) => void
  renderMode?: 'default' | 'assembly' | 'execution'
  topLeftOverlay?: JSX.Element
  topRightControls?: (controls: { scalePercent: number; zoomIn: () => void; zoomOut: () => void; resetView: () => void }) => JSX.Element
  bottomRightControls?: (controls: { scalePercent: number; zoomIn: () => void; zoomOut: () => void; resetView: () => void }) => JSX.Element
}

export type TreeGraphPosition = {
  x: number
  y: number
}

export type TreeGraphLayoutResult = {
  rootId: string | null
  positions: Record<string, TreeGraphPosition>
  depthByNodeId: Record<string, number>
  childrenByNodeId: Record<string, string[]>
  parentByNodeId: Record<string, string | null>
  validEdges: GraphEdge[]
  viewBox: {
    minX: number
    minY: number
    width: number
    height: number
  }
}
