import type { KeyboardEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'
import { getEdgeStyle, getNodeStyle, getVisibilityStyle, TREE_GRAPH_COLORS } from './treeGraphStyles'
import { layoutTreeGraph } from './treeGraphLayout'
import type {
  GraphEdgeState,
  GraphNode,
  GraphNodeState,
  TreeGraphProps,
  TreeGraphPosition,
} from './treeGraphTypes'

type HoveredNode = {
  node: GraphNode
  x: number
  y: number
}

const MIN_SCALE = 0.65
const MAX_SCALE = 1.85
const SCALE_STEP = 0.12
const PAN_MARGIN = 48
const WHEEL_PAN_DAMPING = 0.88
const DRAG_THRESHOLD = 6

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

function clampPanValue(value: number, maxAbs: number): number {
  return Math.min(maxAbs, Math.max(-maxAbs, value))
}

function truncateLabel(label: string): string {
  return label.length > 14 ? `${label.slice(0, 12)}...` : label
}

function splitLabel(label: string): string[] {
  const compact = truncateLabel(label)
  if (compact.length <= 10) return [compact]
  const words = compact.split(' ')
  if (words.length === 1) return [compact]

  const midpoint = Math.ceil(words.length / 2)
  const firstLine = words.slice(0, midpoint).join(' ')
  const secondLine = words.slice(midpoint).join(' ')
  return [firstLine, secondLine]
}

function renderEdgePath(
  source: TreeGraphPosition,
  target: TreeGraphPosition,
  nodeRadius: number,
  _curvedEdges: boolean,
): string {
  const startX = source.x
  const startY = source.y + nodeRadius
  const endX = target.x
  const endY = target.y - nodeRadius

  if (Math.abs(endX - startX) < 4 || Math.abs(endY - startY) < 4) {
    return `M ${startX} ${startY} L ${endX} ${endY}`
  }

  const verticalLead = Math.max(28, Math.min(54, (endY - startY) * 0.32))
  const splitY = Math.min(startY + verticalLead, endY - 18)

  return [
    `M ${startX} ${startY}`,
    `L ${startX} ${splitY}`,
    `L ${endX} ${splitY}`,
    `L ${endX} ${endY}`,
  ].join(' ')
}

function getPathId(source: string, target: string): string {
  return `tree-path-${source}-${target}`.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function getFlowOverlay(state: GraphEdgeState, pathId: string, stroke: string): JSX.Element | null {
  if (state === 'muted' || state === 'failed') return null

  const isActive = state === 'active'
  const isPassed = state === 'passed'
  const radius = isActive ? 4.5 : isPassed ? 3.6 : 3
  const opacity = isActive ? 0.95 : isPassed ? 0.82 : 0.68
  const duration = isActive ? '1.1s' : isPassed ? '1.35s' : '1.65s'

  return (
    <circle r={radius} fill={stroke} opacity={opacity}>
      <animateMotion dur={duration} repeatCount="indefinite" rotate="auto">
        <mpath href={`#${pathId}`} />
      </animateMotion>
    </circle>
  )
}

function getAnnotationStyle(tone: NonNullable<GraphNode['annotation']>['tone']): {
  fill: string
  stroke: string
  text: string
} {
  switch (tone) {
    case 'failed':
      return { fill: '#fef2f2', stroke: '#fca5a5', text: '#991b1b' }
    case 'triggered':
      return { fill: '#f5f3ff', stroke: '#c4b5fd', text: '#5b21b6' }
    case 'info':
      return { fill: '#ecfeff', stroke: '#67e8f9', text: '#155e75' }
    default:
      return { fill: '#f4f4f5', stroke: '#d4d4d8', text: '#3f3f46' }
  }
}

function NodeCircle({
  node,
  x,
  y,
  radius,
  state,
  onClick,
  onHover,
  onLeave,
  canActivate,
}: {
  node: GraphNode
  x: number
  y: number
  radius: number
  state: GraphNodeState
  onClick?: (node: GraphNode) => void
  onHover: (node: GraphNode, event: ReactPointerEvent<SVGGElement>) => void
  onLeave: () => void
  canActivate: boolean
}): JSX.Element {
  const lines = splitLabel(node.label)
  const { fill, stroke, strokeWidth, ringStroke, ringStrokeWidth, ringOpacity } = getNodeStyle(node.type, state)
  const isInteractive = Boolean(onClick)
  const annotationStyle = node.annotation ? getAnnotationStyle(node.annotation.tone) : null
  const annotationWidth = node.annotation ? Math.max(64, node.annotation.label.length * 6.6 + 18) : 0

  const activateNode = (): void => {
    if (!canActivate) return
    onClick?.(node)
  }

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>): void => {
    if (!isInteractive) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    activateNode()
  }

  return (
    <g
      data-testid={`tree-node-${node.id}`}
      data-node-id={node.id}
      data-node-type={node.type ?? 'generic'}
      data-node-state={state}
      aria-label={isInteractive ? `Select ${node.label} node` : undefined}
      className={cn(isInteractive && 'cursor-pointer')}
      onClick={isInteractive ? activateNode : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      onPointerEnter={(event) => onHover(node, event)}
      onPointerMove={(event) => onHover(node, event)}
      onPointerLeave={onLeave}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      focusable={isInteractive ? 'true' : undefined}
      style={{ outline: 'none' }}
    >
      {ringStroke ? (
        <>
          <circle
            cx={x}
            cy={y}
            r={radius + 9}
            fill="none"
            stroke={ringStroke}
            strokeWidth={ringStrokeWidth ?? 2}
            opacity={ringOpacity ?? 0.65}
            className="transition-all duration-200 ease-out"
          />
          <circle
            cx={x}
            cy={y}
            r={radius + 14}
            fill="none"
            stroke={ringStroke}
            strokeWidth={1.5}
            opacity={state === 'selected' ? 0.22 : 0}
            className="transition-all duration-200 ease-out"
          />
        </>
      ) : null}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        className="transition-all duration-200 ease-out"
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={TREE_GRAPH_COLORS.text}
        fontSize={12}
        fontWeight={600}
        className="pointer-events-none select-none"
      >
        {lines.map((line, index) => (
          <tspan
            key={`${node.id}-${line}-${index}`}
            x={x}
            dy={index === 0 ? (lines.length > 1 ? '-0.45em' : '0.1em') : '1.1em'}
          >
            {line}
          </tspan>
        ))}
      </text>
      {node.annotation && annotationStyle ? (
        <g className="pointer-events-none">
          <rect
            x={x - annotationWidth / 2}
            y={y - radius - 28}
            rx={9}
            ry={9}
            width={annotationWidth}
            height={20}
            fill={annotationStyle.fill}
            stroke={annotationStyle.stroke}
            strokeWidth={1.2}
          />
          <text
            x={x}
            y={y - radius - 18}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={annotationStyle.text}
            fontSize={12}
            fontWeight={700}
            className="select-none"
          >
            {node.annotation.label}
          </text>
        </g>
      ) : null}
    </g>
  )
}

export function TreeGraph({
  nodes,
  edges,
  rootId,
  width = '100%',
  height = '100%',
  nodeRadius = 40,
  levelGap = 120,
  siblingGap = 132,
  curvedEdges = true,
  nodeStateById = {},
  edgeStateById = {},
  nodeVisibilityById = {},
  edgeVisibilityById = {},
  className,
  onNodeClick,
  renderMode = 'default',
  topLeftOverlay,
  topRightControls,
  bottomRightControls,
}: TreeGraphProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragState, setDragState] = useState<{ pointerId: number; startX: number; startY: number; panX: number; panY: number } | null>(
    null,
  )
  const [hoveredNode, setHoveredNode] = useState<HoveredNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const wheelDeltaRef = useRef({ x: 0, y: 0 })
  const graphIdentityRef = useRef<string | null>(null)
  const suppressClickRef = useRef(false)

  const layout = useMemo(
    () => layoutTreeGraph(nodes, edges, { rootId, nodeRadius, levelGap, siblingGap }),
    [edges, levelGap, nodeRadius, nodes, rootId, siblingGap],
  )

  const graphIdentity = useMemo(() => {
    const nodeKey = [...nodes.map((node) => node.id)].sort().join('|')
    const edgeKey = [...edges.map((edge) => `${edge.source}->${edge.target}`)].sort().join('|')
    return `${nodeKey}::${edgeKey}`
  }, [edges, nodes])

  const clampPan = (nextPan: { x: number; y: number }, nextScale: number): { x: number; y: number } => {
    const maxX = Math.max(PAN_MARGIN, ((layout.viewBox.width * nextScale) - layout.viewBox.width) / 2 + PAN_MARGIN)
    const maxY = Math.max(PAN_MARGIN, ((layout.viewBox.height * nextScale) - layout.viewBox.height) / 2 + PAN_MARGIN)
    return {
      x: clampPanValue(nextPan.x, maxX),
      y: clampPanValue(nextPan.y, maxY),
    }
  }

  useEffect(() => {
    if (graphIdentityRef.current === graphIdentity) return
    graphIdentityRef.current = graphIdentity
    setScale(1)
    setPan({ x: 0, y: 0 })
  }, [graphIdentity])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const updateHover = (node: GraphNode, event: ReactPointerEvent<SVGGElement>): void => {
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return
    setHoveredNode({
      node,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>): void => {
    event.preventDefault()
    suppressClickRef.current = false
    setDragState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    })
    if ('setPointerCapture' in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!dragState || dragState.pointerId !== event.pointerId) return
    const deltaX = event.clientX - dragState.startX
    const deltaY = event.clientY - dragState.startY
    if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) {
      suppressClickRef.current = true
    }
    setPan(clampPan({
      x: dragState.panX + deltaX,
      y: dragState.panY + deltaY,
    }, scale))
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!dragState || dragState.pointerId !== event.pointerId) return
    setDragState(null)
    if ('releasePointerCapture' in event.currentTarget) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  const queueWheelPan = (): void => {
    if (rafRef.current !== null) return

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      setPan((current) => {
        const next = clampPan(
          {
            x: current.x - wheelDeltaRef.current.x,
            y: current.y - wheelDeltaRef.current.y,
          },
          scale,
        )
        wheelDeltaRef.current = { x: 0, y: 0 }
        return next
      })
    })
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()

      const nextScale = clampScale(scale + (event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP))
      const svgX = layout.viewBox.minX + ((event.clientX - bounds.left) / bounds.width) * layout.viewBox.width
      const svgY = layout.viewBox.minY + ((event.clientY - bounds.top) / bounds.height) * layout.viewBox.height
      const worldX = (svgX - pan.x) / scale
      const worldY = (svgY - pan.y) / scale
      const nextPan = clampPan(
        {
          x: svgX - worldX * nextScale,
          y: svgY - worldY * nextScale,
        },
        nextScale,
      )

      setScale(nextScale)
      setPan(nextPan)
      return
    }

    const unitX = layout.viewBox.width / Math.max(bounds.width, 1)
    const unitY = layout.viewBox.height / Math.max(bounds.height, 1)
    const delta = {
      x: event.deltaX * unitX * WHEEL_PAN_DAMPING,
      y: event.deltaY * unitY * WHEEL_PAN_DAMPING,
    }
    const projected = clampPan(
      {
        x: pan.x - delta.x,
        y: pan.y - delta.y,
      },
      scale,
    )
    const canConsume = Math.abs(projected.x - pan.x) > 0.2 || Math.abs(projected.y - pan.y) > 0.2

    if (!canConsume) return

    event.preventDefault()
    wheelDeltaRef.current = {
      x: wheelDeltaRef.current.x + delta.x,
      y: wheelDeltaRef.current.y + delta.y,
    }
    queueWheelPan()
  }

  const zoomIn = (): void => setScale((current) => clampScale(current + SCALE_STEP))
  const zoomOut = (): void => setScale((current) => clampScale(current - SCALE_STEP))
  const resetView = (): void => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-zinc-200 bg-white',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-start justify-between gap-4">
        <div className="pointer-events-auto">
          {topLeftOverlay ?? (
            <div className="rounded-lg border border-zinc-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Canvas</p>
              <p className="text-xs leading-5 text-zinc-600">Drag to pan. Scroll or use controls to zoom.</p>
            </div>
          )}
        </div>
        {topRightControls ? (
          <div className="pointer-events-auto">
            {topRightControls({ scalePercent: Math.round(scale * 100), zoomIn, zoomOut, resetView })}
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 z-20">
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-zinc-200 bg-white/90 p-1 shadow-sm backdrop-blur">
          {bottomRightControls ? bottomRightControls({ scalePercent: Math.round(scale * 100), zoomIn, zoomOut, resetView }) : (
            <>
              <Button size="sm" variant="outline" className="h-8 px-3" onClick={zoomOut}>
                -
              </Button>
              <div className="min-w-[54px] text-center text-xs font-medium text-zinc-700">{Math.round(scale * 100)}%</div>
              <Button size="sm" variant="outline" className="h-8 px-3" onClick={zoomIn}>
                +
              </Button>
              <Button size="sm" variant="outline" className="h-8 px-3" onClick={resetView}>
                Reset
              </Button>
            </>
          )}
        </div>
      </div>

      {hoveredNode ? (
        <div
          className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full animate-in fade-in-0 zoom-in-95"
          style={{ left: hoveredNode.x, top: hoveredNode.y - 14 }}
        >
          <div className="max-w-[280px] rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-lg">
            <div className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
              {hoveredNode.node.type ?? 'node'}
            </div>
            <div className="max-w-[240px] text-sm font-medium leading-5 text-zinc-900">{hoveredNode.node.label}</div>
            {hoveredNode.node.description ? (
              <div className="mt-1 max-w-[260px] text-xs leading-5 text-zinc-600">{hoveredNode.node.description}</div>
            ) : null}
            {hoveredNode.node.annotation?.detail ? (
              <div className="mt-1 max-w-[260px] text-xs leading-5 text-zinc-500">{hoveredNode.node.annotation.detail}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <svg
        role="img"
        aria-label="Rules engine graph"
        width={width}
        height={height}
        viewBox={`${layout.viewBox.minX} ${layout.viewBox.minY} ${layout.viewBox.width} ${layout.viewBox.height}`}
        className={cn(
          'block min-h-[580px] w-full',
          renderMode === 'assembly' ? 'bg-zinc-100' : 'bg-zinc-50',
          dragState ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <pattern id="tree-graph-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#e4e4e7" strokeWidth="1" />
          </pattern>
        </defs>

        <rect
          x={layout.viewBox.minX}
          y={layout.viewBox.minY}
          width={layout.viewBox.width}
          height={layout.viewBox.height}
          fill={renderMode === 'assembly' ? '#f4f4f5' : TREE_GRAPH_COLORS.canvas}
        />
        <rect
          x={layout.viewBox.minX}
          y={layout.viewBox.minY}
          width={layout.viewBox.width}
          height={layout.viewBox.height}
          fill="url(#tree-graph-grid)"
          opacity={0.55}
        />

        <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`} style={{ transformOrigin: 'center' }}>
          <g data-testid="tree-edges">
            {layout.validEdges.map((edge) => {
              const source = layout.positions[edge.source]
              const target = layout.positions[edge.target]
              const sourceNode = nodes.find((node) => node.id === edge.source)
              const edgeState = edgeStateById[`${edge.source}->${edge.target}`] ?? 'default'
              const edgeVisibility = edgeVisibilityById[`${edge.source}->${edge.target}`] ?? 'visible'
              const edgeStyle = getEdgeStyle(sourceNode?.type, edgeState)
              const visibilityStyle = getVisibilityStyle(edgeVisibility)
              if (!source || !target) return null
              if (!visibilityStyle.shouldRender) return null

            return (
              <g key={`${edge.source}-${edge.target}`}>
                <path
                  id={getPathId(edge.source, edge.target)}
                  data-testid={`tree-edge-${edge.source}-${edge.target}`}
                  d={renderEdgePath(source, target, nodeRadius, curvedEdges)}
                  fill="none"
                  stroke={edgeStyle.stroke}
                  strokeWidth={edgeStyle.strokeWidth}
                  strokeDasharray={edgeStyle.strokeDasharray}
                  opacity={(edgeStyle.opacity ?? 1) * visibilityStyle.opacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300 ease-out"
                />
                {visibilityStyle.opacity > 0.4 && renderMode !== 'assembly'
                  ? getFlowOverlay(edgeState, getPathId(edge.source, edge.target), edgeStyle.stroke)
                  : null}
              </g>
            )
          })}
        </g>

          <g data-testid="tree-nodes">
            {nodes.map((node) => {
              const position = layout.positions[node.id]
              const visibility = nodeVisibilityById[node.id] ?? 'visible'
              const visibilityStyle = getVisibilityStyle(visibility)
              if (!position) return null
              if (!visibilityStyle.shouldRender) return null
              return (
                <g key={node.id} opacity={visibilityStyle.opacity} className="transition-opacity duration-300 ease-out">
                  <NodeCircle
                    node={node}
                    x={position.x}
                    y={position.y}
                    radius={nodeRadius}
                    state={nodeStateById[node.id] ?? 'default'}
                    onClick={onNodeClick}
                    onHover={updateHover}
                    onLeave={() => setHoveredNode(null)}
                    canActivate={!suppressClickRef.current}
                  />
                </g>
              )
            })}
          </g>
        </g>
      </svg>
    </div>
  )
}
