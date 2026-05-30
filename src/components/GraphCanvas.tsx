import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Focus, Pause, Play, RotateCcw, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import type { SavedFact } from '../lib/facts'
import { evaluateConditionDetailed, normalizeOperator } from '../lib/simulator/helpers'
import { simulateFact } from '../lib/simulator/runtime'
import { useSimulatorStore } from '../lib/store'
import type {
  CompiledNetwork,
  CompiledNode,
  Fact,
  SimulationInput,
  SimulationRun,
  TimelineEvent,
} from '../lib/simulator/types'
import { cn } from '../lib/utils'
import { AuthoredRuleView } from './AuthoredRuleView'
import { TimelinePanel } from './TimelinePanel'
import { TreeGraph } from './tree-graph/TreeGraph'
import type { GraphEdge, GraphEdgeState, GraphNode, GraphNodeState, GraphVisibilityState } from './tree-graph/treeGraphTypes'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'

type VisibleNodeType = 'alpha' | 'beta' | 'production'
type GraphView = 'compiled' | 'authored' | 'compare' | 'fact-compare'
type TreeScene = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  nodeStateById: Record<string, GraphNodeState>
  edgeStateById: Record<string, GraphEdgeState>
  nodeVisibilityById: Record<string, GraphVisibilityState>
  edgeVisibilityById: Record<string, GraphVisibilityState>
}
type CompareRunSummary = {
  failedAlphaLabels: string[]
  successfulBetaLabels: string[]
  triggeredRuleNames: string[]
  reasons: string[]
}

const FACT_NODE_ID = 'fact'

function safeParseJson<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T
  } catch {
    return fallback
  }
}

function compactFieldName(field: string): string {
  return field.replace(/^(transaction|customer|user)\./, '').replace(/_/g, ' ')
}

function compactValue(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 14 ? `${text.slice(0, 11)}...` : text
}

function getFactDescription(
  network: CompiledNetwork,
  selectedFact: SavedFact | null,
  runEvents: TimelineEvent[] | null,
): string {
  const factEvent = runEvents?.find((event) => event.type === 'fact-created')
  const factSnapshot = factEvent?.snapshot.workingMemory[0]
  const transaction = factSnapshot?.transaction
  const fallbackRule = network.canonicalRuleSet.rules[0]

  if (!transaction) {
    if (selectedFact) {
      return `Fact ${selectedFact.request.transaction.transaction_reference} for ${selectedFact.request.transaction.customer_reference_id} enters org ${selectedFact.organizationId} and fans into matching alpha branches from root.`
    }
    return fallbackRule
      ? `Input fact enters root, then fans into org ${fallbackRule.organizationId} rule branches.`
      : 'Input fact entering the rules engine network.'
  }

  const factReference = selectedFact?.request.transaction.transaction_reference ?? transaction.externalId ?? transaction.reference ?? transaction.id
  const factCustomer = selectedFact?.request.transaction.customer_reference_id ?? transaction.customerReferenceId ?? transaction.userId
  const parts = [
    `Transaction ${factReference}`,
    factCustomer ? `for ${factCustomer}` : null,
    transaction.amount !== undefined ? `amount ${transaction.amount}` : null,
    transaction.currency ? transaction.currency : null,
    `in org ${transaction.organizationId}`,
  ].filter(Boolean)

  return `${parts.join(' ')} enters the rules engine as the input fact before root dispatches it into matching alpha branches.`
}

function compactNodeRef(nodeId: string): string {
  if (nodeId.startsWith('alpha-')) return `A${nodeId.replace('alpha-', '')}`
  if (nodeId.startsWith('beta-')) return `B${nodeId.replace('beta-', '')}`
  if (nodeId.startsWith('production-')) return `P${nodeId.replace('production-', '').slice(0, 4)}`
  if (nodeId === 'root') return 'Root'
  if (nodeId === FACT_NODE_ID) return 'Fact'
  return nodeId
}

function getBetaSourceAlphaIds(nodeId: string, network: CompiledNetwork, seen = new Set<string>()): string[] {
  if (seen.has(nodeId)) return []
  seen.add(nodeId)

  const node = network.nodes[nodeId]
  if (!node) return []
  if (node.type === 'alpha') return [node.id]
  if (node.type !== 'beta') return []

  return [...getBetaSourceAlphaIds(node.leftAlphaId, network, seen), ...getBetaSourceAlphaIds(node.rightAlphaId, network, seen)]
}

function getNodeLabel(node: CompiledNode, network: CompiledNetwork): string {
  if (node.type === 'root') return 'Root'
  if (node.type === 'alpha') {
    return `${compactFieldName(node.condition.field)} ${normalizeOperator(node.condition.operator)} ${compactValue(node.condition.value)}`
  }
  if (node.type === 'beta') {
    const alphaIds = [...new Set(getBetaSourceAlphaIds(node.id, network))]
    const compactRefs = alphaIds.map(compactNodeRef)
    if (compactRefs.length === 0) return compactNodeRef(node.id)
    if (compactRefs.length <= 3) return compactRefs.join(' × ')
    return `${compactRefs.slice(0, 3).join(' × ')}+`
  }
  return node.rule.name
}

function getNodeDescription(node: CompiledNode, network: CompiledNetwork): string {
  if (node.type === 'root') return 'Dispatches incoming facts into matching alpha branches.'
  if (node.type === 'alpha') {
    return `${node.condition.field} ${normalizeOperator(node.condition.operator)} ${String(node.condition.value)}`
  }
  if (node.type === 'beta') {
    const alphaIds = [...new Set(getBetaSourceAlphaIds(node.id, network))]
    const sourceText = alphaIds.map(compactNodeRef).join(' × ')
    const leftText = compactNodeRef(node.leftAlphaId)
    const rightText = compactNodeRef(node.rightAlphaId)
    return `${sourceText || compactNodeRef(node.id)} feeds this beta join. It combines ${leftText} and ${rightText} with a same-transaction user_id equality check before passing forward.`
  }
  return `${node.rule.primaryOperator} rule terminal for ${node.rule.name}.`
}

function formatAnnotationValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === undefined) return 'missing'
  return JSON.stringify(value)
}

function getFailedComparisonLabel(actualValue: unknown, operator: string, expectedValue: unknown): string {
  const normalized = normalizeOperator(operator)
  switch (normalized) {
    case '>':
      return `${formatAnnotationValue(actualValue)} <= ${formatAnnotationValue(expectedValue)}`
    case '>=':
      return `${formatAnnotationValue(actualValue)} < ${formatAnnotationValue(expectedValue)}`
    case '<':
      return `${formatAnnotationValue(actualValue)} >= ${formatAnnotationValue(expectedValue)}`
    case '<=':
      return `${formatAnnotationValue(actualValue)} > ${formatAnnotationValue(expectedValue)}`
    case '==':
    case '=':
      return `${formatAnnotationValue(actualValue)} ≠ ${formatAnnotationValue(expectedValue)}`
    case '!=':
      return `${formatAnnotationValue(actualValue)} = ${formatAnnotationValue(expectedValue)}`
    case 'in':
      return `${formatAnnotationValue(actualValue)} not in set`
    default:
      return `${formatAnnotationValue(actualValue)} vs ${normalized} ${formatAnnotationValue(expectedValue)}`
  }
}

function buildSimulationInputForFact(
  fact: SavedFact,
  source: SimulationInput['ruleSource'],
  rulesText: string,
  userProfileText: string,
  analysisText: string,
): SimulationInput {
  return {
    ruleSource: source,
    rules: safeParseJson(rulesText, { rules: [] } as unknown),
    transaction: fact.transaction,
    userProfile: fact.userProfile ?? safeParseJson(userProfileText, null),
    analysisSeed: safeParseJson(analysisText, {}),
  }
}

function summarizeCompareRun(network: CompiledNetwork, run: SimulationRun): CompareRunSummary {
  const failedAlphaLabels = Array.from(new Set(
    run.timeline
      .filter((event) => event.type === 'alpha-evaluated' && (event.detail.includes('failed') || event.detail.includes('could not run')))
      .map((event) => event.nodeId)
      .filter((nodeId): nodeId is string => Boolean(nodeId))
      .map((nodeId) => {
        const node = network.nodes[nodeId]
        return node ? getNodeLabel(node, network) : nodeId
      }),
  ))

  const successfulBetaLabels = Array.from(new Set(
    run.timeline
      .filter((event) => event.type === 'beta-join-success')
      .map((event) => event.nodeId)
      .filter((nodeId): nodeId is string => Boolean(nodeId))
      .map((nodeId) => {
        const node = network.nodes[nodeId]
        return node ? getNodeLabel(node, network) : nodeId
      }),
  ))

  return {
    failedAlphaLabels,
    successfulBetaLabels,
    triggeredRuleNames: run.result.triggeredRules.map((evaluation) => evaluation.rule.name),
    reasons: run.result.reasons,
  }
}

function isVisibleNode(node: CompiledNode, activeRuleId: string | null, visibleNodeTypes: Record<VisibleNodeType, boolean>): boolean {
  if (node.type === 'root') return true
  if (node.type === 'alpha' && !visibleNodeTypes.alpha) return false
  if (node.type === 'beta' && !visibleNodeTypes.beta) return false
  if (node.type === 'production' && !visibleNodeTypes.production) return false
  if (!activeRuleId) return true
  return 'relatedRuleIds' in node ? node.relatedRuleIds.includes(activeRuleId) : false
}

function buildBaseGraph(
  network: CompiledNetwork,
  activeRuleId: string | null,
  visibleNodeTypes: Record<VisibleNodeType, boolean>,
  selectedFact: SavedFact | null,
  runEvents: TimelineEvent[] | null,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const visibleCompiledNodes = Object.values(network.nodes).filter((node) => isVisibleNode(node, activeRuleId, visibleNodeTypes))
  const visibleNodeIds = new Set(visibleCompiledNodes.map((node) => node.id))

  const graphNodes: GraphNode[] = [
    {
      id: FACT_NODE_ID,
      label: selectedFact?.request.transaction.transaction_reference ?? 'Fact',
      type: 'fact',
      description: getFactDescription(network, selectedFact, runEvents),
    },
    ...visibleCompiledNodes.map((node) => ({
      id: node.id,
      label: getNodeLabel(node, network),
      type: node.type,
      description: getNodeDescription(node, network),
    })),
  ]

  const edgeMap = new Map<string, GraphEdge>()
  edgeMap.set(`${FACT_NODE_ID}->${network.rootId}`, { source: FACT_NODE_ID, target: network.rootId })

  visibleCompiledNodes.forEach((node) => {
    node.children.forEach((childId) => {
      if (!visibleNodeIds.has(childId)) return
      const edgeId = `${node.id}->${childId}`
      if (!edgeMap.has(edgeId)) {
        edgeMap.set(edgeId, { source: node.id, target: childId })
      }
    })
  })

  return {
    nodes: graphNodes,
    edges: [...edgeMap.values()],
  }
}

function parseEdgeId(edgeId: string | undefined): string | null {
  return edgeId ?? null
}

function getEventNodeState(event: TimelineEvent): GraphNodeState {
  if (event.type === 'root-skipped') return 'failed'
  if (event.type === 'beta-join-rejected') return 'failed'
  if (event.type === 'alpha-evaluated' && event.detail.toLowerCase().includes('failed')) return 'failed'
  if (event.type === 'production-activated' || event.type === 'beta-join-success') return 'passed'
  return 'active'
}

function buildNodeStatesForExecution(
  nodes: GraphNode[],
  events: TimelineEvent[],
  currentEvent: TimelineEvent | null,
  selectedNodeId: string | null,
): Record<string, GraphNodeState> {
  const nodeStateById = Object.fromEntries(
    nodes.map((node) => [node.id, events.length > 0 ? 'unreached' : 'default']),
  ) as Record<string, GraphNodeState>

  events.forEach((event) => {
    if (event.type === 'fact-created' || event.type === 'working-memory-added') {
      nodeStateById[FACT_NODE_ID] = 'passed'
      return
    }
    if (!event.nodeId) return
    if (event.type === 'production-activated') {
      nodeStateById[event.nodeId] = 'triggered'
      return
    }
    if (event.type === 'root-skipped' || event.type === 'beta-join-rejected') {
      nodeStateById[event.nodeId] = 'failed'
      return
    }
    if (event.type === 'alpha-evaluated') {
      nodeStateById[event.nodeId] = event.detail.toLowerCase().includes('failed') ? 'failed' : 'passed'
      return
    }
    nodeStateById[event.nodeId] = 'passed'
  })

  if (currentEvent) {
    if (currentEvent.type === 'fact-created' || currentEvent.type === 'working-memory-added') {
      nodeStateById[FACT_NODE_ID] = 'active'
    }
    if (currentEvent.nodeId) {
      nodeStateById[currentEvent.nodeId] = currentEvent.type === 'production-activated' ? 'triggered' : getEventNodeState(currentEvent)
    }
  }

  if (selectedNodeId) nodeStateById[selectedNodeId] = 'selected'

  return nodeStateById
}

function buildEdgeStatesForExecution(
  edges: GraphEdge[],
  events: TimelineEvent[],
  currentEvent: TimelineEvent | null,
  isEngineEnabled: boolean,
): Record<string, GraphEdgeState> {
  const edgeStateById = Object.fromEntries(
    edges.map((edge) => [
      `${edge.source}->${edge.target}`,
      !isEngineEnabled ? 'muted' : events.length > 0 ? 'unreached' : 'default',
    ]),
  ) as Record<string, GraphEdgeState>

  if (events.length > 0) {
    edgeStateById[`${FACT_NODE_ID}->root`] = 'passed'
  }

  events.forEach((event) => {
    const edgeId = parseEdgeId(event.edgeId)
    if (!edgeId || !edgeStateById[edgeId]) return
    edgeStateById[edgeId] = event.type === 'production-activated' ? 'triggered' : 'passed'
  })

  const currentEdgeId = parseEdgeId(currentEvent?.edgeId)
  if (currentEdgeId && edgeStateById[currentEdgeId]) {
    edgeStateById[currentEdgeId] = currentEvent?.type === 'production-activated' ? 'triggered' : 'active'
  }

  return edgeStateById
}

function buildExecutionAnnotations(
  network: CompiledNetwork,
  nodes: GraphNode[],
  executeEvents: TimelineEvent[],
  runFact: Fact | null,
): Record<string, NonNullable<GraphNode['annotation']>> {
  if (executeEvents.length === 0) return {}

  const latestEventByNodeId = new Map<string, TimelineEvent>()
  executeEvents.forEach((event) => {
    if (event.nodeId) latestEventByNodeId.set(event.nodeId, event)
  })

  return nodes.reduce<Record<string, NonNullable<GraphNode['annotation']>>>((annotations, node) => {
    if (node.id === FACT_NODE_ID) return annotations
    const compiledNode = network.nodes[node.id]
    const latestEvent = latestEventByNodeId.get(node.id)
    if (!compiledNode || !latestEvent) return annotations

    if (compiledNode.type === 'alpha' && runFact && latestEvent.type === 'alpha-evaluated') {
      const evaluation = evaluateConditionDetailed(compiledNode.condition, runFact)
      if (evaluation.availability === 'unavailable') {
        annotations[node.id] = {
          label: `Missing ${compactFieldName(compiledNode.condition.field)}`,
          detail: evaluation.unavailableReason,
          tone: 'info',
        }
        return annotations
      }
      if (!evaluation.matched) {
        annotations[node.id] = {
          label: getFailedComparisonLabel(evaluation.actualValue, compiledNode.condition.operator, compiledNode.condition.value),
          detail: `${compiledNode.condition.field} expected ${normalizeOperator(compiledNode.condition.operator)} ${String(compiledNode.condition.value)}`,
          tone: 'failed',
        }
      }
      return annotations
    }

    if (compiledNode.type === 'beta' && latestEvent.type === 'beta-join-rejected') {
      annotations[node.id] = {
        label: 'Join blocked',
        detail: latestEvent.detail,
        tone: 'failed',
      }
      return annotations
    }

    if (compiledNode.type === 'production' && latestEvent.type === 'production-activated') {
      annotations[node.id] = {
        label: 'Triggered',
        detail: compiledNode.rule.name,
        tone: 'triggered',
      }
    }

    return annotations
  }, {})
}

function buildCompiledScene(
  network: CompiledNetwork,
  activeRuleId: string | null,
  visibleNodeTypes: Record<VisibleNodeType, boolean>,
  selectedNodeId: string | null,
  isEngineEnabled: boolean,
  selectedFact: SavedFact | null,
  runEvents: TimelineEvent[] | null = null,
): TreeScene {
  const base = buildBaseGraph(network, activeRuleId, visibleNodeTypes, selectedFact, runEvents)
  const nodeStateById: Record<string, GraphNodeState> = {}
  if (selectedNodeId) nodeStateById[selectedNodeId] = 'selected'

  const edgeStateById = Object.fromEntries(
    base.edges.map((edge) => [`${edge.source}->${edge.target}`, isEngineEnabled ? 'default' : 'muted']),
  ) as Record<string, GraphEdgeState>
  const nodeVisibilityById = Object.fromEntries(base.nodes.map((node) => [node.id, 'visible'])) as Record<string, GraphVisibilityState>
  const edgeVisibilityById = Object.fromEntries(base.edges.map((edge) => [`${edge.source}->${edge.target}`, 'visible'])) as Record<string, GraphVisibilityState>

  return { ...base, nodeStateById, edgeStateById, nodeVisibilityById, edgeVisibilityById }
}

function buildBuildScene(
  network: CompiledNetwork,
  activeRuleId: string | null,
  visibleNodeTypes: Record<VisibleNodeType, boolean>,
  selectedFact: SavedFact | null,
  runEvents: TimelineEvent[],
  stepIndex: number,
  selectedNodeId: string | null,
): TreeScene {
  const base = buildBaseGraph(network, activeRuleId, visibleNodeTypes, selectedFact, runEvents)
  const buildEvents = runEvents.filter((event) => event.phase === 'build' && event.index <= stepIndex)
  const currentBuildEvent = runEvents[stepIndex]?.phase === 'build' ? runEvents[stepIndex] : null
  const nodeStateById: Record<string, GraphNodeState> = {}
  const nodeVisibilityById = Object.fromEntries(base.nodes.map((node) => [
    node.id,
    node.id === network.rootId ? 'visible' : node.id === FACT_NODE_ID ? 'ghosted' : 'ghosted',
  ])) as Record<string, GraphVisibilityState>
  const edgeVisibilityById = Object.fromEntries(base.edges.map((edge) => [
    `${edge.source}->${edge.target}`,
    edge.source === FACT_NODE_ID && edge.target === network.rootId ? 'ghosted' : 'ghosted',
  ])) as Record<string, GraphVisibilityState>

  buildEvents.forEach((event) => {
    if (event.nodeId) {
      nodeStateById[event.nodeId] = 'passed'
      nodeVisibilityById[event.nodeId] = 'visible'
    }
    const edgeId = parseEdgeId(event.edgeId)
    if (edgeId && edgeVisibilityById[edgeId]) edgeVisibilityById[edgeId] = 'visible'
  })

  if (currentBuildEvent?.nodeId) nodeStateById[currentBuildEvent.nodeId] = 'active'
  if (currentBuildEvent?.nodeId) nodeVisibilityById[currentBuildEvent.nodeId] = 'visible'
  if (selectedNodeId) nodeStateById[selectedNodeId] = 'selected'
  if (selectedNodeId) nodeVisibilityById[selectedNodeId] = 'visible'

  const edgeStateById = Object.fromEntries(
    base.edges.map((edge) => [`${edge.source}->${edge.target}`, 'muted']),
  ) as Record<string, GraphEdgeState>

  edgeStateById[`${FACT_NODE_ID}->${network.rootId}`] = 'muted'
  buildEvents.forEach((event) => {
    const edgeId = parseEdgeId(event.edgeId)
    if (edgeId && edgeStateById[edgeId]) edgeStateById[edgeId] = 'passed'
  })
  const currentEdgeId = parseEdgeId(currentBuildEvent?.edgeId)
  if (currentEdgeId && edgeStateById[currentEdgeId]) edgeStateById[currentEdgeId] = 'active'
  if (currentEdgeId && edgeVisibilityById[currentEdgeId]) edgeVisibilityById[currentEdgeId] = 'visible'

  return {
    nodes: base.nodes,
    edges: base.edges,
    nodeStateById,
    edgeStateById,
    nodeVisibilityById,
    edgeVisibilityById,
  }
}

function buildExecuteScene(
  network: CompiledNetwork,
  activeRuleId: string | null,
  visibleNodeTypes: Record<VisibleNodeType, boolean>,
  selectedFact: SavedFact | null,
  runEvents: TimelineEvent[],
  stepIndex: number,
  selectedNodeId: string | null,
  isEngineEnabled: boolean,
  runFact: Fact | null = null,
): TreeScene {
  const base = buildBaseGraph(network, activeRuleId, visibleNodeTypes, selectedFact, runEvents)
  const executeEvents = runEvents.filter((event) => event.phase === 'execute' && event.index <= stepIndex)
  const currentEvent = runEvents[stepIndex]?.phase === 'execute' ? runEvents[stepIndex] : null
  const nodeVisibilityById = Object.fromEntries(base.nodes.map((node) => [node.id, 'visible'])) as Record<string, GraphVisibilityState>
  const edgeVisibilityById = Object.fromEntries(base.edges.map((edge) => [`${edge.source}->${edge.target}`, 'visible'])) as Record<string, GraphVisibilityState>
  const nodeStateById = buildNodeStatesForExecution(base.nodes, executeEvents, currentEvent, selectedNodeId)
  const annotationsByNodeId = buildExecutionAnnotations(network, base.nodes, executeEvents, runFact)

  return {
    ...base,
    nodes: base.nodes.map((node) => ({
      ...node,
      annotation: annotationsByNodeId[node.id],
    })),
    nodeStateById,
    edgeStateById: buildEdgeStatesForExecution(base.edges, executeEvents, currentEvent, isEngineEnabled),
    nodeVisibilityById,
    edgeVisibilityById,
  }
}

function buildCombinedScene(
  network: CompiledNetwork,
  activeRuleId: string | null,
  visibleNodeTypes: Record<VisibleNodeType, boolean>,
  selectedFact: SavedFact | null,
  runEvents: TimelineEvent[] | null,
  stepIndex: number,
  selectedNodeId: string | null,
  isEngineEnabled: boolean,
  runFact: Fact | null = null,
): TreeScene {
  if (!runEvents || runEvents.length === 0) {
    return buildCompiledScene(network, activeRuleId, visibleNodeTypes, selectedNodeId, isEngineEnabled, selectedFact)
  }

  const currentEvent = runEvents[stepIndex] ?? null
  if (currentEvent?.phase === 'build') {
    return buildBuildScene(network, activeRuleId, visibleNodeTypes, selectedFact, runEvents, stepIndex, selectedNodeId)
  }

  return buildExecuteScene(network, activeRuleId, visibleNodeTypes, selectedFact, runEvents, stepIndex, selectedNodeId, isEngineEnabled, runFact)
}

function GraphStage({
  title,
  description,
  scene,
  onNodeClick,
  fillHeight = true,
  renderMode = 'default',
  stageBadge,
  topLeftOverlay,
  topRightControls,
  bottomRightControls,
}: {
  title: string
  description: string
  scene: TreeScene
  onNodeClick: (node: GraphNode) => void
  fillHeight?: boolean
  renderMode?: 'default' | 'assembly' | 'execution'
  stageBadge?: JSX.Element
  topLeftOverlay?: JSX.Element
  topRightControls?: (controls: { scalePercent: number; zoomIn: () => void; zoomOut: () => void; resetView: () => void }) => JSX.Element
  bottomRightControls?: (controls: { scalePercent: number; zoomIn: () => void; zoomOut: () => void; resetView: () => void }) => JSX.Element
}): JSX.Element {
  const hasHeader = Boolean(stageBadge || title || description)

  return (
    <section className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[20px] bg-zinc-50/40', fillHeight ? 'flex-1' : 'flex-none')}>
      {hasHeader ? (
        <div className="mb-3 space-y-1 px-3 pt-3">
          {stageBadge}
          {title ? <p className="eyebrow">{title}</p> : null}
          {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      <div className={cn('min-w-0 bg-white', fillHeight ? 'min-h-[420px] flex-1' : 'h-[480px] md:h-[520px]')}>
        <TreeGraph
          nodes={scene.nodes}
          edges={scene.edges}
          rootId={FACT_NODE_ID}
          nodeStateById={scene.nodeStateById}
          edgeStateById={scene.edgeStateById}
          nodeVisibilityById={scene.nodeVisibilityById}
          edgeVisibilityById={scene.edgeVisibilityById}
          className="h-full"
          onNodeClick={onNodeClick}
          renderMode={renderMode}
          topLeftOverlay={topLeftOverlay}
          topRightControls={topRightControls}
          bottomRightControls={bottomRightControls}
        />
      </div>
    </section>
  )
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}): JSX.Element {
  return (
    <Button size="sm" variant={active ? 'default' : 'outline'} className="h-8" onClick={onClick}>
      {label}
    </Button>
  )
}

function MissionPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'active' | 'off'
}): JSX.Element {
  const toneClasses = tone === 'active'
    ? 'border-[#2F6B66]/25 bg-[#2F6B66]/10 text-[#2F6B66]'
    : tone === 'off'
      ? 'border-zinc-300 bg-zinc-100 text-zinc-600'
      : 'border-zinc-200 bg-white text-zinc-700'

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', toneClasses)}>
      <span className="font-medium uppercase tracking-[0.08em] opacity-70">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function MissionOverlay({
  engineEnabled,
  phaseLabel,
  stepLabel,
  currentLabel,
  currentDetail,
  selectedNodeLabel,
  isolatedRuleName,
  onHide,
}: {
  engineEnabled: boolean
  phaseLabel: string
  stepLabel: string
  currentLabel: string
  currentDetail: string
  selectedNodeLabel: string
  isolatedRuleName?: string | null
  onHide?: () => void
}): JSX.Element {
  return (
    <div className="max-w-[340px] rounded-2xl border border-zinc-200 bg-white/92 p-2 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <MissionPill label="Engine" value={engineEnabled ? 'Running' : 'Off'} tone={engineEnabled ? 'active' : 'off'} />
          <MissionPill label="Phase" value={phaseLabel} />
          <MissionPill label="Step" value={stepLabel} />
        </div>
        {onHide ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 rounded-md text-zinc-500 hover:text-zinc-900"
            onClick={onHide}
            aria-label="Hide mission overlay"
            title="Hide mission overlay"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="mt-2.5 grid gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Current event</p>
          <p className="text-xs font-medium leading-4 text-zinc-950">{currentLabel}</p>
          <p className="min-h-[18px] text-xs leading-4 text-zinc-600">{currentDetail}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs leading-4 text-zinc-600">
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
            Selected {selectedNodeLabel}
          </span>
          {isolatedRuleName ? (
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
              Isolated {isolatedRuleName}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function MissionOverlayToggle({
  onShow,
}: {
  onShow: () => void
}): JSX.Element {
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 rounded-md border-zinc-200 bg-white/92 px-2.5 shadow-sm backdrop-blur"
      onClick={onShow}
      aria-label="Show mission overlay"
      title="Show mission overlay"
    >
      <Eye className="mr-1.5 h-3.5 w-3.5" />
      Status
    </Button>
  )
}

function CanvasControlButton({
  icon,
  label,
  active = false,
  onClick,
  disabled,
  ariaLabel,
}: {
  icon: JSX.Element
  label: string
  active?: boolean
  onClick: () => void
  disabled?: boolean
  ariaLabel: string
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={label}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-zinc-950 bg-zinc-950 text-white shadow-[0_1px_2px_rgba(15,23,42,0.12)]'
          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function StageModeBadge({
  mode,
}: {
  mode: 'assembly' | 'execution'
}): JSX.Element {
  const copy = mode === 'assembly'
    ? {
        label: 'Construction mode',
        detail: 'Future nodes stay ghosted while the network is being created.',
        classes: 'border-zinc-300 bg-zinc-100 text-zinc-700',
      }
    : {
        label: 'Runtime mode',
        detail: 'The full network stays visible while the fact traverses matching edges.',
        classes: 'border-[#4A5A78]/20 bg-[#4A5A78]/10 text-[#4A5A78]',
      }

  return (
    <div className={cn('mb-2 inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium', copy.classes)}>
      {copy.label}
      <span className="ml-2 hidden font-normal opacity-75 xl:inline">{copy.detail}</span>
    </div>
  )
}

function CompareSummaryGroup({
  title,
  tone,
  emptyLabel,
  items,
}: {
  title: string
  tone: 'failed' | 'beta' | 'triggered' | 'neutral'
  emptyLabel: string
  items: string[]
}): JSX.Element {
  const toneClasses = tone === 'failed'
    ? 'border-[#8A4B4B]/20 bg-[#8A4B4B]/10 text-[#8A4B4B]'
    : tone === 'beta'
      ? 'border-[#4A5A78]/20 bg-[#4A5A78]/10 text-[#4A5A78]'
      : tone === 'triggered'
        ? 'border-[#6E59A5]/20 bg-[#6E59A5]/10 text-[#6E59A5]'
        : 'border-zinc-200 bg-zinc-50 text-zinc-700'

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">{title}</div>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-600">
          {items.length}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length > 0 ? items.map((label) => (
          <div
            key={`${title}-${label}`}
            className={cn('max-w-full truncate rounded-full border px-2.5 py-1 text-xs font-medium leading-5', toneClasses)}
            title={label}
          >
            {label}
          </div>
        )) : (
          <div className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs leading-5 text-zinc-500">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  )
}

export function GraphCanvas(): JSX.Element {
  const {
    workspaceMode,
    source,
    rulesText,
    userProfileText,
    analysisText,
    network,
    diff,
    run,
    stepIndex,
    isPlaying,
    isEngineEnabled,
    activeRuleId,
    savedFacts,
    selectedFactId,
    selectedNodeId,
    playbackSpeed,
    isLooping,
    selectNode,
    setActiveRuleId,
    runSelectedFact,
    playTraversal,
    pauseTraversal,
    advanceTraversal,
    resetTraversal,
  } = useSimulatorStore()

  const [view, setView] = useState<GraphView>('compiled')
  const [visibleNodeTypes, setVisibleNodeTypes] = useState<Record<VisibleNodeType, boolean>>({
    alpha: true,
    beta: true,
    production: true,
  })
  const [compareBuildStepIndex, setCompareBuildStepIndex] = useState(0)
  const [compareExecuteStepIndex, setCompareExecuteStepIndex] = useState(0)
  const [isCompareBuildPlaying, setIsCompareBuildPlaying] = useState(false)
  const [isCompareExecutePlaying, setIsCompareExecutePlaying] = useState(false)
  const [showMissionOverlay, setShowMissionOverlay] = useState(false)
  const [factCompareIds, setFactCompareIds] = useState<string[]>([])

  useEffect(() => {
    if (workspaceMode === 'diff') setView('compiled')
  }, [workspaceMode])

  useEffect(() => {
    if (!isEngineEnabled || !isPlaying || workspaceMode === 'diff') return
    const timer = window.setTimeout(() => advanceTraversal(), Math.max(220, 700 / playbackSpeed))
    return () => window.clearTimeout(timer)
  }, [advanceTraversal, isEngineEnabled, isPlaying, playbackSpeed, workspaceMode, stepIndex])

  const buildTimeline = useMemo(
    () => (run?.timeline ?? []).filter((event) => event.phase === 'build'),
    [run?.timeline],
  )
  const executeTimeline = useMemo(
    () => (run?.timeline ?? []).filter((event) => event.phase === 'execute'),
    [run?.timeline],
  )

  useEffect(() => {
    setCompareBuildStepIndex(0)
    setCompareExecuteStepIndex(0)
    setIsCompareBuildPlaying(false)
    setIsCompareExecutePlaying(false)
  }, [run?.timeline, view, workspaceMode])

  const isAnyReplayPlaying = isPlaying || isCompareBuildPlaying || isCompareExecutePlaying

  useEffect(() => {
    if (isAnyReplayPlaying) {
      setShowMissionOverlay(true)
      return
    }
    setShowMissionOverlay(false)
  }, [isAnyReplayPlaying])

  useEffect(() => {
    setFactCompareIds((current) => {
      const validCurrent = current.filter((factId) => savedFacts.some((fact) => fact.id === factId))
      if (validCurrent.length > 0) return validCurrent.slice(0, 3)

      const fallback = Array.from(new Set([
        selectedFactId,
        ...savedFacts.map((fact) => fact.id),
      ].filter((value): value is string => Boolean(value))))

      return fallback.slice(0, 3)
    })
  }, [savedFacts, selectedFactId])

  useEffect(() => {
    if (workspaceMode !== 'simulator' || view !== 'compare' || !isEngineEnabled || !isCompareBuildPlaying || buildTimeline.length === 0) return
    const timer = window.setTimeout(() => {
      setCompareBuildStepIndex((current) => {
        if (current >= buildTimeline.length - 1) {
          if (isLooping) return 0
          setIsCompareBuildPlaying(false)
          return current
        }
        return current + 1
      })
    }, Math.max(220, 700 / playbackSpeed))
    return () => window.clearTimeout(timer)
  }, [buildTimeline.length, isCompareBuildPlaying, isEngineEnabled, isLooping, playbackSpeed, view, workspaceMode])

  useEffect(() => {
    if (workspaceMode !== 'simulator' || view !== 'compare' || !isEngineEnabled || !isCompareExecutePlaying || executeTimeline.length === 0) return
    const timer = window.setTimeout(() => {
      setCompareExecuteStepIndex((current) => {
        if (current >= executeTimeline.length - 1) {
          if (isLooping) return 0
          setIsCompareExecutePlaying(false)
          return current
        }
        return current + 1
      })
    }, Math.max(220, 700 / playbackSpeed))
    return () => window.clearTimeout(timer)
  }, [executeTimeline.length, isCompareExecutePlaying, isEngineEnabled, isLooping, playbackSpeed, view, workspaceMode])

  const currentEvent = run?.timeline[stepIndex] ?? null
  const currentRuleName = activeRuleId ? network?.canonicalRuleSet.rules.find((rule) => rule.id === activeRuleId)?.name : null
  const selectedFact = selectedFactId ? savedFacts.find((fact) => fact.id === selectedFactId) ?? null : null
  const selectedNodeLabel = useMemo(() => {
    if (!network || !selectedNodeId) return 'node'
    if (selectedNodeId === FACT_NODE_ID) return 'Fact'
    const node = network.nodes[selectedNodeId]
    if (!node) return selectedNodeId
    if (node.type === 'production') return node.rule.name
    return getNodeLabel(node, network)
  }, [network, selectedNodeId])
  const toggleNodeType = (type: VisibleNodeType): void => {
    setVisibleNodeTypes((current) => ({ ...current, [type]: !current[type] }))
  }

  const handlePrimaryPlay = (): void => {
    if (!isEngineEnabled || !network) return
    if (!run || run.timeline.length === 0) {
      runSelectedFact()
      playTraversal()
      return
    }
    if (isPlaying) {
      pauseTraversal()
      return
    }
    playTraversal()
  }

  const toggleFactCompare = (factId: string): void => {
    setFactCompareIds((current) => {
      if (current.includes(factId)) return current.filter((candidate) => candidate !== factId)
      return [...current, factId].slice(-3)
    })
  }

  const compiledScene = useMemo(() => {
    if (!network) return null
    return buildCombinedScene(
      network,
      activeRuleId,
      visibleNodeTypes,
      selectedFact,
      run?.timeline ?? null,
      stepIndex,
      selectedNodeId,
      isEngineEnabled,
      run?.fact ?? null,
    )
  }, [activeRuleId, isEngineEnabled, network, run?.fact, run?.timeline, selectedFact, selectedNodeId, stepIndex, visibleNodeTypes])

  const buildScene = useMemo(() => {
    if (!network) return null
    const buildStep = buildTimeline[compareBuildStepIndex]?.index ?? 0
    return buildBuildScene(
      network,
      activeRuleId,
      visibleNodeTypes,
      selectedFact,
      run?.timeline ?? [],
      view === 'compare' ? buildStep : stepIndex,
      selectedNodeId,
    )
  }, [activeRuleId, buildTimeline, compareBuildStepIndex, network, run?.timeline, selectedFact, selectedNodeId, stepIndex, view, visibleNodeTypes])

  const executeScene = useMemo(() => {
    if (!network) return null
    const executeStep = executeTimeline[compareExecuteStepIndex]?.index ?? 0
    return buildExecuteScene(
      network,
      activeRuleId,
      visibleNodeTypes,
      selectedFact,
      run?.timeline ?? [],
      view === 'compare' ? executeStep : stepIndex,
      selectedNodeId,
      isEngineEnabled,
      run?.fact ?? null,
    )
  }, [activeRuleId, compareExecuteStepIndex, executeTimeline, isEngineEnabled, network, run?.fact, run?.timeline, selectedFact, selectedNodeId, stepIndex, view, visibleNodeTypes])

  const factComparisonRuns = useMemo(() => {
    if (!network || workspaceMode !== 'simulator') return []

    return factCompareIds
      .map((factId) => savedFacts.find((fact) => fact.id === factId) ?? null)
      .filter((fact): fact is SavedFact => Boolean(fact))
      .map((fact) => {
        const compareRun = simulateFact(
          network,
          buildSimulationInputForFact(fact, source, rulesText, userProfileText, analysisText),
        )
        return {
          fact,
          run: compareRun,
          scene: buildExecuteScene(
            network,
            activeRuleId,
            visibleNodeTypes,
            fact,
            compareRun.timeline,
            Math.max(compareRun.timeline.length - 1, 0),
            selectedNodeId,
            isEngineEnabled,
            compareRun.fact,
          ),
          summary: summarizeCompareRun(network, compareRun),
        }
      })
  }, [activeRuleId, analysisText, factCompareIds, isEngineEnabled, network, rulesText, savedFacts, selectedNodeId, source, userProfileText, visibleNodeTypes, workspaceMode])

  const diffSummary = diff?.summary.summaryLines ?? []
  const buildCurrentEvent = buildTimeline[Math.min(compareBuildStepIndex, Math.max(buildTimeline.length - 1, 0))] ?? null
  const executeCurrentEvent = executeTimeline[Math.min(compareExecuteStepIndex, Math.max(executeTimeline.length - 1, 0))] ?? null

  const compiledMissionOverlay = workspaceMode === 'simulator' && isPlaying
    ? showMissionOverlay
      ? (
          <MissionOverlay
            engineEnabled={isEngineEnabled}
            phaseLabel={currentEvent?.phase === 'build' ? 'Network build' : currentEvent?.phase === 'execute' ? 'Fact execution' : 'Ready'}
            stepLabel={run ? `${stepIndex + 1}/${run.timeline.length}` : '0/0'}
            currentLabel={currentEvent?.label ?? 'Awaiting replay'}
            currentDetail={currentEvent?.detail ?? 'Compile the network, then run a fact to watch the engine build alpha, beta, and production nodes.'}
            selectedNodeLabel={selectedNodeLabel}
            isolatedRuleName={currentRuleName}
            onHide={() => setShowMissionOverlay(false)}
          />
        )
      : <MissionOverlayToggle onShow={() => setShowMissionOverlay(true)} />
    : undefined

  const buildMissionOverlay = isCompareBuildPlaying
    ? showMissionOverlay
    ? (
        <MissionOverlay
          engineEnabled={isEngineEnabled}
          phaseLabel="Network build"
          stepLabel={buildTimeline.length > 0 ? `${Math.min(compareBuildStepIndex + 1, buildTimeline.length)}/${buildTimeline.length}` : '0/0'}
          currentLabel={buildCurrentEvent?.label ?? 'Awaiting network build replay'}
          currentDetail={buildCurrentEvent?.detail ?? 'This pane shows how the engine creates and links alpha, beta, and production nodes from the rule set.'}
          selectedNodeLabel={selectedNodeLabel}
          isolatedRuleName={currentRuleName}
          onHide={() => setShowMissionOverlay(false)}
        />
      )
    : <MissionOverlayToggle onShow={() => setShowMissionOverlay(true)} />
    : undefined

  const executeMissionOverlay = isCompareExecutePlaying
    ? showMissionOverlay
    ? (
        <MissionOverlay
          engineEnabled={isEngineEnabled}
          phaseLabel="Fact execution"
          stepLabel={executeTimeline.length > 0 ? `${Math.min(compareExecuteStepIndex + 1, executeTimeline.length)}/${executeTimeline.length}` : '0/0'}
          currentLabel={executeCurrentEvent?.label ?? 'Awaiting fact execution replay'}
          currentDetail={executeCurrentEvent?.detail ?? 'This pane shows how the input fact flows through the built network and activates matching paths.'}
          selectedNodeLabel={selectedNodeLabel}
          isolatedRuleName={currentRuleName}
          onHide={() => setShowMissionOverlay(false)}
        />
      )
    : <MissionOverlayToggle onShow={() => setShowMissionOverlay(true)} />
    : undefined
  const replayControls = workspaceMode === 'simulator'
    ? ({ }: { scalePercent: number; zoomIn: () => void; zoomOut: () => void; resetView: () => void }) => (
        <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/92 p-1.5 shadow-sm backdrop-blur">
          <CanvasControlButton
            active={isPlaying}
            onClick={handlePrimaryPlay}
            disabled={!network || !isEngineEnabled}
            ariaLabel={isPlaying ? 'Pause' : 'Play'}
            label={isPlaying ? 'Pause' : 'Play'}
            icon={isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          />
          <CanvasControlButton
            onClick={runSelectedFact}
            disabled={!network || !isEngineEnabled}
            ariaLabel="Run selected fact"
            label="Run fact"
            icon={<RotateCcw className="h-4 w-4" />}
          />
          <CanvasControlButton
            onClick={resetTraversal}
            disabled={!run}
            ariaLabel="Reset run"
            label="Reset"
            icon={<Undo2 className="h-4 w-4" />}
          />
        </div>
      )
    : undefined

  const compareBuildControls = workspaceMode === 'simulator'
    ? ({ }: { scalePercent: number; zoomIn: () => void; zoomOut: () => void; resetView: () => void }) => (
        <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/92 p-1.5 shadow-sm backdrop-blur">
          <CanvasControlButton
            active={isCompareBuildPlaying}
            onClick={() => setIsCompareBuildPlaying((current) => !current)}
            disabled={!buildTimeline.length || !isEngineEnabled}
            ariaLabel={isCompareBuildPlaying ? 'Pause assembly' : 'Play assembly'}
            label={isCompareBuildPlaying ? 'Pause build' : 'Play build'}
            icon={isCompareBuildPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          />
          <CanvasControlButton
            onClick={() => {
              setCompareBuildStepIndex(0)
              setIsCompareBuildPlaying(false)
            }}
            disabled={!buildTimeline.length}
            ariaLabel="Reset assembly"
            label="Reset"
            icon={<Undo2 className="h-4 w-4" />}
          />
        </div>
      )
    : undefined

  const compareExecuteControls = workspaceMode === 'simulator'
    ? ({ }: { scalePercent: number; zoomIn: () => void; zoomOut: () => void; resetView: () => void }) => (
        <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/92 p-1.5 shadow-sm backdrop-blur">
          <CanvasControlButton
            active={isCompareExecutePlaying}
            onClick={() => setIsCompareExecutePlaying((current) => !current)}
            disabled={!executeTimeline.length || !isEngineEnabled}
            ariaLabel={isCompareExecutePlaying ? 'Pause propagation' : 'Play propagation'}
            label={isCompareExecutePlaying ? 'Pause run' : 'Play run'}
            icon={isCompareExecutePlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          />
          <CanvasControlButton
            onClick={() => {
              setCompareExecuteStepIndex(0)
              setIsCompareExecutePlaying(false)
            }}
            disabled={!executeTimeline.length}
            ariaLabel="Reset propagation"
            label="Reset"
            icon={<Undo2 className="h-4 w-4" />}
          />
        </div>
      )
    : undefined

  const zoomControls = ({ scalePercent, zoomIn, zoomOut, resetView }: { scalePercent: number; zoomIn: () => void; zoomOut: () => void; resetView: () => void }) => (
    <>
      <Button size="icon" variant="outline" className="h-8 w-8 rounded-md" onClick={zoomOut} aria-label="Zoom out" title="Zoom out">
        <ZoomOut className="h-4 w-4" />
      </Button>
      <div className="min-w-[54px] px-1 text-center text-xs font-medium text-zinc-700">{scalePercent}%</div>
      <Button size="icon" variant="outline" className="h-8 w-8 rounded-md" onClick={zoomIn} aria-label="Zoom in" title="Zoom in">
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="outline" className="h-8 w-8 rounded-md" onClick={resetView} aria-label="Reset zoom" title="Reset zoom">
        <Focus className="h-4 w-4" />
      </Button>
    </>
  )

  return (
    <Card className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden border-0 bg-transparent shadow-none">
      <CardHeader className="gap-3 border-b border-zinc-200/80 px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">
              <span>Workspace</span>
              <span>/</span>
              <span>Simulator</span>
            </div>
            <CardTitle className="mt-1 truncate text-base font-semibold tracking-[-0.02em] text-zinc-950">
              {workspaceMode === 'diff'
                ? 'Rules engine graph diff'
                : view === 'authored'
                  ? 'Authored rules'
                  : view === 'fact-compare'
                    ? 'Multi-fact comparison'
                  : view === 'compare'
                    ? 'Network build and fact execution'
                    : 'Rules engine simulator'}
            </CardTitle>
          </div>

          <div className="flex flex-col gap-2 xl:min-w-[460px] xl:items-end">
            <div className="flex flex-wrap items-center gap-2">
              {workspaceMode !== 'diff' ? (
                <Tabs value={view} onValueChange={(value) => setView(value as GraphView)}>
                  <TabsList className="h-10 rounded-full border border-zinc-200 bg-zinc-50 p-1">
                    <TabsTrigger value="compiled">Simulator</TabsTrigger>
                    <TabsTrigger value="compare">Split view</TabsTrigger>
                    <TabsTrigger value="fact-compare">Fact compare</TabsTrigger>
                    <TabsTrigger value="authored">Rules</TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={visibleNodeTypes.alpha} label="Alpha" onClick={() => toggleNodeType('alpha')} />
            <FilterChip active={visibleNodeTypes.beta} label="Beta" onClick={() => toggleNodeType('beta')} />
            <FilterChip active={visibleNodeTypes.production} label="Production" onClick={() => toggleNodeType('production')} />
          </div>

          {network ? (
            <select
              aria-label="Rule isolation"
              className="h-10 min-w-[220px] rounded-[20px] border border-zinc-200 bg-white px-4 text-sm text-foreground"
              value={activeRuleId ?? '__all__'}
              onChange={(event) => setActiveRuleId(event.target.value === '__all__' ? null : event.target.value)}
            >
              <option value="__all__">All rules</option>
              {network.canonicalRuleSet.rules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        {currentRuleName ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">Isolated: {currentRuleName}</Badge>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col p-0">
        {!network ? (
          <div className="flex min-h-[420px] flex-1 items-center justify-center px-6 text-sm text-muted-foreground">
            Compile a rule bundle to render the rules engine network.
          </div>
        ) : view === 'authored' && workspaceMode !== 'diff' ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <AuthoredRuleView ruleSet={network.canonicalRuleSet} />
          </div>
        ) : (
          <>
            <div className={cn('min-h-0 min-w-0 overflow-y-auto p-4', view === 'compare' || workspaceMode === 'diff' ? 'flex-1' : 'flex-none')}>
              {workspaceMode === 'diff' ? (
                <div className="grid min-h-full gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <GraphStage
                    title="Candidate network"
                    description="This is the candidate ruleset rendered as the compiled rules-engine network."
                    scene={compiledScene ?? buildCompiledScene(network, activeRuleId, visibleNodeTypes, selectedNodeId, isEngineEnabled, selectedFact, run?.timeline ?? null)}
                    onNodeClick={(node) => selectNode(node.id === FACT_NODE_ID ? null : node.id)}
                    bottomRightControls={zoomControls}
                  />
                  <section className="rounded-xl border border-border bg-zinc-50/60 p-4">
                    <p className="eyebrow">Diff summary</p>
                    <h3 className="mt-1">What changed</h3>
                    <div className="mt-3 space-y-2">
                      {diffSummary.length > 0 ? (
                        diffSummary.map((line) => (
                          <div key={line} className="rounded-md border border-border bg-white px-3 py-2 text-sm leading-6 text-muted-foreground">
                            {line}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-md border border-border bg-white px-3 py-2 text-sm leading-6 text-muted-foreground">
                          No structural graph changes detected between the two rule bundles.
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              ) : view === 'compare' ? (
                <div className="grid min-h-full gap-4 xl:grid-cols-2">
                  <GraphStage
                    title="Network build"
                    description="The engine builds the rete network from rules. Alpha, beta, and production nodes appear as the network is created."
                    scene={buildScene ?? buildCompiledScene(network, activeRuleId, visibleNodeTypes, selectedNodeId, isEngineEnabled, selectedFact, run?.timeline ?? null)}
                    onNodeClick={(node) => selectNode(node.id === FACT_NODE_ID ? null : node.id)}
                    renderMode="assembly"
                    stageBadge={<StageModeBadge mode="assembly" />}
                    topLeftOverlay={buildMissionOverlay}
                    topRightControls={compareBuildControls}
                    bottomRightControls={zoomControls}
                  />
                  <GraphStage
                    title="Fact execution"
                    description="The engine runs the input fact through the built network. The full network stays visible while execution advances."
                    scene={executeScene ?? buildCompiledScene(network, activeRuleId, visibleNodeTypes, selectedNodeId, isEngineEnabled, selectedFact, run?.timeline ?? null)}
                    onNodeClick={(node) => selectNode(node.id === FACT_NODE_ID ? null : node.id)}
                    renderMode="execution"
                    stageBadge={<StageModeBadge mode="execution" />}
                    topLeftOverlay={executeMissionOverlay}
                    topRightControls={compareExecuteControls}
                    bottomRightControls={zoomControls}
                  />
                </div>
              ) : view === 'fact-compare' ? (
                <div className="grid min-h-full gap-4">
                  <section className="rounded-xl border border-border bg-zinc-50/60 p-3">
                    <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="eyebrow">Compare facts</p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          Select up to three saved facts to compare dead ends, successful joins, and triggered rules on the same network.
                        </p>
                      </div>
                      <Badge variant="outline">{factComparisonRuns.length} selected</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {savedFacts.map((fact) => {
                        const selected = factCompareIds.includes(fact.id)
                        return (
                          <button
                            key={`compare-${fact.id}`}
                            type="button"
                            onClick={() => toggleFactCompare(fact.id)}
                            className={cn(
                              'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                              selected ? 'border-zinc-900 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                            )}
                          >
                            <div className="font-medium leading-6">{fact.request.transaction.transaction_reference}</div>
                            <div className={cn('text-xs leading-5', selected ? 'text-white/70' : 'text-zinc-500')}>
                              {fact.request.transaction.amount} {fact.request.transaction.currency} · {fact.request.transaction.customer_reference_id}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </section>

                  {factComparisonRuns.length > 0 ? (
                    <div className={cn('grid gap-4', factComparisonRuns.length === 1 ? 'grid-cols-1' : factComparisonRuns.length === 2 ? 'xl:grid-cols-2' : 'xl:grid-cols-3')}>
                      {factComparisonRuns.map(({ fact, run: compareRun, scene, summary }) => (
                        <div key={`fact-compare-stage-${fact.id}`} className="grid gap-3">
                          <GraphStage
                            title={fact.request.transaction.transaction_reference}
                            description={`${fact.request.transaction.amount} ${fact.request.transaction.currency} · ${fact.request.transaction.transaction_type}`}
                            scene={scene}
                            onNodeClick={(node) => selectNode(node.id === FACT_NODE_ID ? null : node.id)}
                            fillHeight={false}
                            renderMode="execution"
                            stageBadge={<StageModeBadge mode="execution" />}
                            topLeftOverlay={(
                              <div className="max-w-[320px] rounded-2xl border border-zinc-200 bg-white/92 p-2.5 shadow-sm backdrop-blur">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <MissionPill label="Decision" value={compareRun.result.decision} tone={compareRun.result.triggeredRules.length > 0 ? 'active' : 'neutral'} />
                                  <MissionPill label="Triggered" value={String(compareRun.result.triggeredRules.length)} />
                                </div>
                                <p className="mt-2 text-sm leading-5 text-zinc-600">
                                  {compareRun.result.reasons[0] ?? 'No rule fired for this fact.'}
                                </p>
                              </div>
                            )}
                            bottomRightControls={zoomControls}
                          />

                          <section className="grid gap-3 rounded-xl border border-border bg-zinc-50/60 p-3">
                            <div className="grid gap-2 md:grid-cols-3">
                              <CompareSummaryGroup
                                title="Failed alpha"
                                tone="failed"
                                emptyLabel="No alpha dead ends"
                                items={summary.failedAlphaLabels}
                              />
                              <CompareSummaryGroup
                                title="Successful beta"
                                tone="beta"
                                emptyLabel="No beta joins"
                                items={summary.successfulBetaLabels}
                              />
                              <CompareSummaryGroup
                                title="Triggered rules"
                                tone="triggered"
                                emptyLabel="No productions fired"
                                items={summary.triggeredRuleNames}
                              />
                            </div>
                            <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Engine reasons</div>
                                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-600">
                                  {summary.reasons.length}
                                </span>
                              </div>
                              <div className="mt-2 grid gap-1.5">
                                {summary.reasons.length > 0 ? summary.reasons.map((reason) => (
                                  <div key={`${fact.id}-reason-${reason}`} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-5 text-zinc-700">
                                    {reason}
                                  </div>
                                )) : (
                                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-5 text-zinc-700">
                                    No engine reason was emitted for this fact.
                                  </div>
                                )}
                              </div>
                            </div>
                          </section>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-zinc-50 px-4 py-6 text-sm leading-6 text-muted-foreground">
                      Select saved facts above to compare how they behave against the current live network.
                    </div>
                  )}
                </div>
              ) : (
                <GraphStage
                  title=""
                  description=""
                  scene={compiledScene ?? buildCompiledScene(network, activeRuleId, visibleNodeTypes, selectedNodeId, isEngineEnabled, selectedFact, run?.timeline ?? null)}
                  onNodeClick={(node) => selectNode(node.id === FACT_NODE_ID ? null : node.id)}
                  fillHeight={false}
                  renderMode="execution"
                  topLeftOverlay={compiledMissionOverlay}
                  topRightControls={replayControls}
                  bottomRightControls={zoomControls}
                />
              )}
            </div>

            {workspaceMode === 'simulator' && view !== 'fact-compare' ? (
              <div
                className={cn(
                  'border-t border-border bg-white',
                  view === 'compare'
                    ? 'min-h-[280px] max-h-[360px] flex-1'
                    : 'h-[480px] md:h-[520px] flex-none',
                )}
              >
                <TimelinePanel embedded />
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export { getNodeDescription }
