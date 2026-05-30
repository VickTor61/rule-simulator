import type { GraphEdgeState, GraphNodeState, GraphNodeType, GraphVisibilityState } from './treeGraphTypes'

export const TREE_GRAPH_COLORS = {
  background: '#ffffff',
  canvas: '#fafafa',
  edge: '#4b5563',
  text: '#111827',
  mutedText: '#6b7280',
  outline: '#1f2937',
  outlineSoft: '#374151',
  active: '#1f2937',
  passed: '#3F6E4E',
  passedFill: '#EDF5EE',
  failed: '#8A4B4B',
  failedFill: '#FAF1F1',
  triggered: '#6E59A5',
  triggeredFill: '#F3F0FA',
} as const

const typePaletteMap: Record<
  GraphNodeType,
  {
    stroke: string
    fill: string
    activeFill: string
    failedFill: string
    failedStroke: string
    selectedStroke: string
  }
> = {
  fact: {
    stroke: '#111827',
    fill: '#f5f5f5',
    activeFill: '#e5e7eb',
    failedFill: TREE_GRAPH_COLORS.failedFill,
    failedStroke: TREE_GRAPH_COLORS.failed,
    selectedStroke: '#1f2937',
  },
  root: {
    stroke: '#1f2937',
    fill: '#f4f4f5',
    activeFill: '#e4e4e7',
    failedFill: TREE_GRAPH_COLORS.failedFill,
    failedStroke: TREE_GRAPH_COLORS.failed,
    selectedStroke: '#3f3f46',
  },
  alpha: {
    stroke: '#2F6B66',
    fill: '#EDF6F4',
    activeFill: '#DBEDEA',
    failedFill: TREE_GRAPH_COLORS.failedFill,
    failedStroke: TREE_GRAPH_COLORS.failed,
    selectedStroke: '#2F6B66',
  },
  beta: {
    stroke: '#4A5A78',
    fill: '#F1F4F8',
    activeFill: '#E2E8F0',
    failedFill: TREE_GRAPH_COLORS.failedFill,
    failedStroke: TREE_GRAPH_COLORS.failed,
    selectedStroke: '#4A5A78',
  },
  production: {
    stroke: '#6E59A5',
    fill: '#F6F3FC',
    activeFill: '#ECE7F8',
    failedFill: TREE_GRAPH_COLORS.failedFill,
    failedStroke: TREE_GRAPH_COLORS.failed,
    selectedStroke: '#6E59A5',
  },
  generic: {
    stroke: '#374151',
    fill: '#f9fafb',
    activeFill: '#f3f4f6',
    failedFill: TREE_GRAPH_COLORS.failedFill,
    failedStroke: TREE_GRAPH_COLORS.failed,
    selectedStroke: '#4b5563',
  },
}

export function getNodeStyle(type: GraphNodeType = 'generic', state: GraphNodeState = 'default'): {
  fill: string
  stroke: string
  strokeWidth: number
  ringStroke?: string
  ringStrokeWidth?: number
  ringOpacity?: number
} {
  const palette = typePaletteMap[type]

  if (state === 'unreached') {
    return { fill: palette.fill, stroke: palette.stroke, strokeWidth: 1.6 }
  }

  if (state === 'active') {
    return { fill: palette.activeFill, stroke: palette.stroke, strokeWidth: 3 }
  }

  if (state === 'triggered') {
    return {
      fill: TREE_GRAPH_COLORS.triggeredFill,
      stroke: TREE_GRAPH_COLORS.triggered,
      strokeWidth: 3.2,
      ringStroke: TREE_GRAPH_COLORS.triggered,
      ringStrokeWidth: 3,
      ringOpacity: 0.32,
    }
  }

  if (state === 'passed') {
    return {
      fill: TREE_GRAPH_COLORS.passedFill,
      stroke: TREE_GRAPH_COLORS.passed,
      strokeWidth: 2.8,
      ringStroke: TREE_GRAPH_COLORS.passed,
      ringStrokeWidth: 2,
      ringOpacity: 0.14,
    }
  }

  if (state === 'failed') {
    return { fill: palette.failedFill, stroke: palette.failedStroke, strokeWidth: 2.6 }
  }

  if (state === 'selected') {
    return {
      fill: palette.fill,
      stroke: palette.stroke,
      strokeWidth: 3,
      ringStroke: palette.selectedStroke,
      ringStrokeWidth: 4,
      ringOpacity: 0.9,
    }
  }

  return { fill: palette.fill, stroke: palette.stroke, strokeWidth: 2 }
}

export function getEdgeStyle(type: GraphNodeType = 'generic', state: GraphEdgeState = 'default'): {
  stroke: string
  strokeWidth: number
  strokeDasharray?: string
  opacity?: number
  shouldAnimate?: boolean
} {
  const baseStroke = typePaletteMap[type].stroke

  if (state === 'unreached') {
    return {
      stroke: '#d4d4d8',
      strokeWidth: 1.4,
      opacity: 0.48,
      strokeDasharray: '2 10',
    }
  }

  if (state === 'active') {
    return {
      stroke: baseStroke,
      strokeWidth: 3.2,
      opacity: 1,
    }
  }

  if (state === 'passed') {
    return {
      stroke: TREE_GRAPH_COLORS.passed,
      strokeWidth: 2.6,
      opacity: 0.96,
    }
  }

  if (state === 'triggered') {
    return {
      stroke: TREE_GRAPH_COLORS.triggered,
      strokeWidth: 3,
      opacity: 1,
    }
  }

  if (state === 'failed') {
    return {
      stroke: TREE_GRAPH_COLORS.failed,
      strokeWidth: 2.2,
      opacity: 0.9,
    }
  }

  if (state === 'muted') {
    return {
      stroke: '#d4d4d8',
      strokeWidth: 1.5,
      strokeDasharray: '2 10',
      opacity: 0.7,
    }
  }

  return {
    stroke: baseStroke,
    strokeWidth: 1.6,
    strokeDasharray: '2 10',
    opacity: 0.75,
    shouldAnimate: true,
  }
}

export function getVisibilityStyle(visibility: GraphVisibilityState = 'visible'): {
  opacity: number
  shouldRender: boolean
} {
  if (visibility === 'hidden') {
    return {
      opacity: 0,
      shouldRender: false,
    }
  }

  if (visibility === 'ghosted') {
    return {
      opacity: 0.2,
      shouldRender: true,
    }
  }

  return {
    opacity: 1,
    shouldRender: true,
  }
}
