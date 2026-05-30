import type { GraphEdge, GraphNode, TreeGraphLayoutResult } from './treeGraphTypes'

type LayoutOptions = {
  rootId?: string
  nodeRadius?: number
  levelGap?: number
  siblingGap?: number
}

const DEFAULT_NODE_RADIUS = 40
const DEFAULT_LEVEL_GAP = 120
const DEFAULT_SIBLING_GAP = 132
const VIEWBOX_PADDING = 48

function warn(message: string): void {
  const meta = import.meta as ImportMeta & { env?: { DEV?: boolean } }
  if (meta.env?.DEV) {
    console.warn(`[TreeGraph] ${message}`)
  }
}

function createParentMap(nodeIds: string[]): Record<string, string | null> {
  return Object.fromEntries(nodeIds.map((id) => [id, null]))
}

function getUniqueChildren(children: string[]): string[] {
  return [...new Set(children)]
}

function getUniqueParents(nodeId: string, edges: GraphEdge[]): string[] {
  return [...new Set(edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source))]
}

function getValidEdges(nodes: GraphNode[], edges: GraphEdge[]): GraphEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.id))
  return edges.filter((edge) => {
    const valid = nodeIds.has(edge.source) && nodeIds.has(edge.target)
    if (!valid) warn(`Ignoring edge ${edge.source} -> ${edge.target} because one or both nodes are missing.`)
    return valid
  })
}

function inferRootId(nodes: GraphNode[], edges: GraphEdge[], explicitRootId?: string): string | null {
  if (explicitRootId && nodes.some((node) => node.id === explicitRootId)) return explicitRootId
  if (explicitRootId) warn(`Explicit rootId "${explicitRootId}" was not found. Falling back to inference.`)

  const incoming = new Set(edges.map((edge) => edge.target))
  const rootCandidates = nodes.filter((node) => !incoming.has(node.id))
  if (rootCandidates.length > 0) return rootCandidates[0].id
  return nodes[0]?.id ?? null
}

export function layoutTreeGraph(nodes: GraphNode[], edges: GraphEdge[], options: LayoutOptions = {}): TreeGraphLayoutResult {
  const nodeRadius = options.nodeRadius ?? DEFAULT_NODE_RADIUS
  const levelGap = Math.max(options.levelGap ?? DEFAULT_LEVEL_GAP, nodeRadius * 3.15)
  const siblingGap = Math.max(options.siblingGap ?? DEFAULT_SIBLING_GAP, nodeRadius * 3.4)
  const validEdges = getValidEdges(nodes, edges)
  const nodeIds = nodes.map((node) => node.id)
  const childrenByNodeId = Object.fromEntries(nodeIds.map((id) => [id, [] as string[]]))
  const parentByNodeId = createParentMap(nodeIds)

  validEdges.forEach((edge) => {
    childrenByNodeId[edge.source]?.push(edge.target)
    if (parentByNodeId[edge.target] === null) {
      parentByNodeId[edge.target] = edge.source
    }
  })

  const rootId = inferRootId(nodes, validEdges, options.rootId)
  const inferredRootIds = nodes
    .map((node) => node.id)
    .filter((id) => parentByNodeId[id] === null)

  if (!options.rootId && inferredRootIds.length > 1) {
    warn(`Multiple root candidates found (${inferredRootIds.join(', ')}). Rendering additional roots beneath the primary root.`)
  }

  const orderedRoots = rootId
    ? [rootId, ...nodes.map((node) => node.id).filter((id) => id !== rootId && parentByNodeId[id] === null)]
    : []

  const depthByNodeId: Record<string, number> = {}
  orderedRoots.forEach((id, index) => {
    depthByNodeId[id] = index
  })

  const pending = [...orderedRoots]
  const seen = new Set<string>()

  while (pending.length > 0) {
    const currentId = pending.shift()
    if (!currentId) continue

    if (seen.has(currentId)) {
      warn(`Detected a cycle involving node "${currentId}". Rendering best-effort layout.`)
      continue
    }

    seen.add(currentId)
    const currentDepth = depthByNodeId[currentId] ?? 0

    for (const childId of getUniqueChildren(childrenByNodeId[currentId] ?? [])) {
      const parentIds = getUniqueParents(childId, validEdges)
      const deepestParent = parentIds.reduce((maxDepth, parentId) => Math.max(maxDepth, depthByNodeId[parentId] ?? 0), currentDepth)
      const nextDepth = deepestParent + 1

      if (depthByNodeId[childId] === undefined || nextDepth > depthByNodeId[childId]) {
        depthByNodeId[childId] = nextDepth
      }

      pending.push(childId)
    }

    seen.delete(currentId)
  }

  nodes.forEach((node, index) => {
    if (depthByNodeId[node.id] === undefined) {
      depthByNodeId[node.id] = orderedRoots.length + index
      if (!orderedRoots.includes(node.id)) orderedRoots.push(node.id)
      warn(`Node "${node.id}" is disconnected from the inferred root. Rendering it as a fallback root.`)
    }
  })

  const xByNodeId: Record<string, number> = {}
  let cursorX = VIEWBOX_PADDING + nodeRadius

  const placeNode = (nodeId: string, path = new Set<string>()): number => {
    if (xByNodeId[nodeId] !== undefined) return xByNodeId[nodeId]
    if (path.has(nodeId)) {
      warn(`Detected recursion while placing node "${nodeId}".`)
      xByNodeId[nodeId] = cursorX
      cursorX += siblingGap
      return xByNodeId[nodeId]
    }

    const nextPath = new Set(path)
    nextPath.add(nodeId)
    const children = getUniqueChildren(childrenByNodeId[nodeId] ?? [])

    if (children.length === 0) {
      xByNodeId[nodeId] = cursorX
      cursorX += siblingGap
      return xByNodeId[nodeId]
    }

    const childXs = children.map((childId) => placeNode(childId, nextPath))
    xByNodeId[nodeId] = (Math.min(...childXs) + Math.max(...childXs)) / 2
    return xByNodeId[nodeId]
  }

  orderedRoots.forEach((currentRootId) => {
    placeNode(currentRootId)
    cursorX += siblingGap * 0.3
  })

  const depthLevels = new Map<number, string[]>()
  Object.entries(depthByNodeId).forEach(([nodeId, depth]) => {
    const level = depthLevels.get(depth) ?? []
    level.push(nodeId)
    depthLevels.set(depth, level)
  })

  depthLevels.forEach((levelNodeIds) => {
    if (levelNodeIds.length <= 1) return

    const sorted = [...levelNodeIds].sort((left, right) => (xByNodeId[left] ?? 0) - (xByNodeId[right] ?? 0))
    const center = sorted.reduce((sum, nodeId) => sum + (xByNodeId[nodeId] ?? 0), 0) / sorted.length
    const startX = center - ((sorted.length - 1) * siblingGap) / 2

    sorted.forEach((nodeId, index) => {
      xByNodeId[nodeId] = startX + index * siblingGap
    })
  })

  const depthValues = [...new Set(Object.values(depthByNodeId))].sort((left, right) => right - left)
  depthValues.forEach((depth) => {
    const levelNodeIds = (depthLevels.get(depth) ?? []).sort((left, right) => (xByNodeId[left] ?? 0) - (xByNodeId[right] ?? 0))

    levelNodeIds.forEach((nodeId, index) => {
      const uniqueChildren = getUniqueChildren(childrenByNodeId[nodeId] ?? [])
      if (uniqueChildren.length > 0) {
        const childXs = uniqueChildren.map((childId) => xByNodeId[childId]).filter((value): value is number => value !== undefined)
        if (childXs.length > 0) {
          xByNodeId[nodeId] = (Math.min(...childXs) + Math.max(...childXs)) / 2
        }
      }

      if (index === 0) return
      const previousId = levelNodeIds[index - 1]
      const minimumX = (xByNodeId[previousId] ?? 0) + siblingGap
      if ((xByNodeId[nodeId] ?? 0) < minimumX) {
        xByNodeId[nodeId] = minimumX
      }
    })
  })

  const positions = Object.fromEntries(
    nodes.map((node) => [
      node.id,
      {
        x: xByNodeId[node.id] ?? VIEWBOX_PADDING + nodeRadius,
        y: VIEWBOX_PADDING + nodeRadius + depthByNodeId[node.id] * levelGap,
      },
    ]),
  )

  const xs = Object.values(positions).map((position) => position.x)
  const ys = Object.values(positions).map((position) => position.y)
  const minX = Math.min(...xs, VIEWBOX_PADDING) - nodeRadius - VIEWBOX_PADDING
  const minY = Math.min(...ys, VIEWBOX_PADDING) - nodeRadius - VIEWBOX_PADDING
  const maxX = Math.max(...xs, VIEWBOX_PADDING) + nodeRadius + VIEWBOX_PADDING
  const maxY = Math.max(...ys, VIEWBOX_PADDING) + nodeRadius + VIEWBOX_PADDING

  return {
    rootId,
    positions,
    depthByNodeId,
    childrenByNodeId,
    parentByNodeId,
    validEdges,
    viewBox: {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
    },
  }
}
