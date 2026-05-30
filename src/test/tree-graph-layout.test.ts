import { describe, expect, test } from 'vitest'
import { layoutTreeGraph } from '../components/tree-graph/treeGraphLayout'
import { basicTreeEdges, basicTreeNodes } from '../data/treeGraphDemoData'

describe('layoutTreeGraph', () => {
  test('lays out a single root graph top-to-bottom', () => {
    const layout = layoutTreeGraph(basicTreeNodes, basicTreeEdges, { rootId: 'fact' })
    expect(layout.positions.fact.y).toBeLessThan(layout.positions.root.y)
    expect(layout.positions.root.y).toBeLessThan(layout.positions['gate-1'].y)
  })

  test('centers the parent over its child span', () => {
    const layout = layoutTreeGraph(basicTreeNodes, basicTreeEdges, { rootId: 'fact' })
    const childXs = ['gate-1', 'gate-10'].map((id) => layout.positions[id].x)
    const midpoint = (Math.min(...childXs) + Math.max(...childXs)) / 2
    expect(layout.positions.root.x).toBe(midpoint)
  })

  test('infers the root when rootId is omitted', () => {
    const layout = layoutTreeGraph(basicTreeNodes, basicTreeEdges)
    expect(layout.rootId).toBe('fact')
  })

  test('ignores invalid edges safely', () => {
    const layout = layoutTreeGraph(
      basicTreeNodes,
      [...basicTreeEdges, { source: 'missing', target: 'gate-1' }, { source: 'gate-1', target: 'unknown' }],
      { rootId: 'fact' },
    )
    expect(layout.validEdges).toHaveLength(basicTreeEdges.length)
  })

  test('renders additional roots beneath the primary root when multiple roots exist', () => {
    const layout = layoutTreeGraph(
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      [{ source: 'a', target: 'b' }],
    )

    expect(layout.rootId).toBe('a')
    expect(layout.depthByNodeId.c).toBeGreaterThan(layout.depthByNodeId.a)
  })
})
