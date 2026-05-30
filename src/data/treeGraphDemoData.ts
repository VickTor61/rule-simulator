import type { GraphEdge, GraphNode, GraphNodeState } from '../components/tree-graph/treeGraphTypes'

export const basicTreeNodes: GraphNode[] = [
  { id: 'fact', label: 'Fact', type: 'fact' },
  { id: 'root', label: 'Root', type: 'root' },
  { id: 'gate-1', label: 'Gate 1', type: 'alpha' },
  { id: 'gate-2', label: 'Gate 2', type: 'alpha' },
  { id: 'gate-3', label: 'Gate 3', type: 'alpha' },
  { id: 'gate-4', label: 'Gate 4', type: 'alpha' },
  { id: 'gate-5', label: 'Gate 5', type: 'alpha' },
  { id: 'gate-6', label: 'Gate 6', type: 'alpha' },
  { id: 'gate-7', label: 'Gate 7', type: 'alpha' },
  { id: 'gate-8', label: 'Gate 8', type: 'alpha' },
  { id: 'gate-9', label: 'Gate 9', type: 'alpha' },
  { id: 'gate-10', label: 'Gate 10', type: 'alpha' },
]

export const basicTreeEdges: GraphEdge[] = [
  { source: 'fact', target: 'root' },
  { source: 'root', target: 'gate-1' },
  { source: 'root', target: 'gate-2' },
  { source: 'root', target: 'gate-3' },
  { source: 'root', target: 'gate-4' },
  { source: 'root', target: 'gate-5' },
  { source: 'root', target: 'gate-6' },
  { source: 'root', target: 'gate-7' },
  { source: 'root', target: 'gate-8' },
  { source: 'root', target: 'gate-9' },
  { source: 'root', target: 'gate-10' },
]

export const rulesTreeNodes: GraphNode[] = [
  { id: 'fact', label: 'Fact', type: 'fact' },
  { id: 'root', label: 'Root', type: 'root' },
  { id: 'alpha-1', label: 'Alpha 1', type: 'alpha' },
  { id: 'alpha-2', label: 'Alpha 2', type: 'alpha' },
  { id: 'alpha-3', label: 'Alpha 3', type: 'alpha' },
  { id: 'beta-1', label: 'Beta 1', type: 'beta' },
  { id: 'production-1', label: 'Production', type: 'production' },
]

export const rulesTreeEdges: GraphEdge[] = [
  { source: 'fact', target: 'root' },
  { source: 'root', target: 'alpha-1' },
  { source: 'root', target: 'alpha-2' },
  { source: 'root', target: 'alpha-3' },
  { source: 'alpha-1', target: 'beta-1' },
  { source: 'alpha-2', target: 'beta-1' },
  { source: 'beta-1', target: 'production-1' },
]

export const rulesTreeStates: Record<string, GraphNodeState> = {
  root: 'active',
  'alpha-1': 'passed',
  'alpha-3': 'failed',
  'production-1': 'selected',
}
