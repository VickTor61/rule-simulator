import { BaseEdge, getSmoothStepPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

type WorkflowEdgeState = 'ambient' | 'visited' | 'active' | 'static'

interface WorkflowEdgeData {
  color?: string
  motionState?: WorkflowEdgeState
}

export function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps): JSX.Element {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  })

  const edgeData = (data ?? {}) as WorkflowEdgeData
  const color = edgeData.color ?? '#a1a1aa'
  const motionState = edgeData.motionState ?? 'ambient'

  const strokeStyles =
    motionState === 'active'
      ? {
          stroke: color,
          strokeWidth: 2.75,
          strokeDasharray: 'none',
          opacity: 1,
        }
      : motionState === 'visited'
        ? {
            stroke: color,
            strokeWidth: 2,
            strokeDasharray: 'none',
            opacity: 0.72,
          }
        : motionState === 'static'
          ? {
              stroke: color,
              strokeWidth: 1.3,
              strokeDasharray: '4 8',
              opacity: 0.34,
            }
        : {
            stroke: color,
            strokeWidth: 1.4,
            strokeDasharray: '1 12',
            strokeLinecap: 'round' as const,
            opacity: 0.44,
          }

  const indicatorRadius = motionState === 'active' ? 4 : 2.4
  const indicatorOpacity = motionState === 'active' ? 1 : 0.5
  const indicatorDuration = motionState === 'active' ? '1.05s' : '2.8s'
  const indicatorColor = color

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ ...style, ...strokeStyles }} />
      {motionState !== 'visited' && motionState !== 'static' ? (
        <circle r={indicatorRadius} fill={indicatorColor} opacity={indicatorOpacity}>
          <animateMotion dur={indicatorDuration} repeatCount="indefinite" path={edgePath} />
        </circle>
      ) : null}
    </>
  )
}
