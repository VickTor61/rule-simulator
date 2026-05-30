import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { TreeGraph } from '../components/tree-graph/TreeGraph'
import { basicTreeEdges, basicTreeNodes, rulesTreeEdges, rulesTreeNodes, rulesTreeStates } from '../data/treeGraphDemoData'

describe('TreeGraph', () => {
  test('renders circular nodes and all expected edges', () => {
    render(<TreeGraph nodes={basicTreeNodes} edges={basicTreeEdges} rootId="fact" height={620} />)

    expect(screen.getByTestId('tree-node-fact')).toBeInTheDocument()
    expect(screen.getByTestId('tree-node-gate-10')).toBeInTheDocument()
    expect(screen.getByTestId('tree-edge-fact-root')).toBeInTheDocument()
    expect(screen.getByTestId('tree-edge-root-gate-10')).toBeInTheDocument()
  })

  test('supports highlighting states and click handling', async () => {
    const user = userEvent.setup()
    const onNodeClick = vi.fn()

    render(
      <TreeGraph
        nodes={rulesTreeNodes}
        edges={rulesTreeEdges}
        rootId="fact"
        nodeStateById={rulesTreeStates}
        onNodeClick={onNodeClick}
      />,
    )

    await user.click(screen.getByTestId('tree-node-production-1'))
    expect(onNodeClick).toHaveBeenCalled()
    expect(screen.getAllByText(/Production/i).length).toBeGreaterThan(0)
    expect(screen.getByTestId('tree-node-root')).toHaveAttribute('data-node-state', 'active')
    expect(screen.getByTestId('tree-node-alpha-1')).toHaveAttribute('data-node-state', 'passed')
    expect(screen.getByTestId('tree-node-alpha-3')).toHaveAttribute('data-node-state', 'failed')
    expect(screen.getByTestId('tree-node-production-1')).toHaveAttribute('data-node-state', 'selected')
  })

  test('exposes button semantics and keyboard activation only for clickable nodes', async () => {
    const user = userEvent.setup()
    const onNodeClick = vi.fn()

    const { rerender } = render(
      <TreeGraph nodes={basicTreeNodes} edges={basicTreeEdges} rootId="fact" height={620} onNodeClick={onNodeClick} />,
    )

    const factNode = screen.getByRole('button', { name: /select fact node/i })
    expect(factNode).toHaveAttribute('tabindex', '0')

    factNode.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onNodeClick).toHaveBeenCalledTimes(2)

    rerender(<TreeGraph nodes={basicTreeNodes} edges={basicTreeEdges} rootId="fact" height={620} />)
    expect(screen.queryByRole('button', { name: /select fact node/i })).not.toBeInTheDocument()
  })

  test('shows ten gate children in the prompt example dataset', () => {
    render(<TreeGraph nodes={basicTreeNodes} edges={basicTreeEdges} rootId="fact" height={620} />)

    for (let index = 1; index <= 10; index += 1) {
      expect(screen.getByTestId(`tree-node-gate-${index}`)).toBeInTheDocument()
    }
  })

  test('keeps zoom level when replay state changes on the same graph', async () => {
    const user = userEvent.setup()

    const { rerender } = render(
      <TreeGraph nodes={basicTreeNodes} edges={basicTreeEdges} rootId="fact" height={620} />,
    )

    await user.click(screen.getByRole('button', { name: '+' }))
    expect(screen.getByText('112%')).toBeInTheDocument()

    rerender(
      <TreeGraph
        nodes={basicTreeNodes}
        edges={basicTreeEdges}
        rootId="fact"
        height={620}
        nodeStateById={{ root: 'active', 'gate-1': 'passed' }}
      />,
    )
    expect(screen.getByText('112%')).toBeInTheDocument()
  })

  test('uses plain wheel for pan and ctrl-wheel for zoom', () => {
    const { container } = render(<TreeGraph nodes={basicTreeNodes} edges={basicTreeEdges} rootId="fact" height={620} />)
    const canvas = screen.getByLabelText(/Rules engine graph/i)

    Object.defineProperty(container.firstChild, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    })

    fireEvent.wheel(canvas.parentElement as Element, { deltaX: 0, deltaY: 120 })
    expect(screen.getByText('100%')).toBeInTheDocument()

    fireEvent.wheel(canvas.parentElement as Element, { deltaY: -120, ctrlKey: true, clientX: 400, clientY: 240 })
    expect(screen.getByText('112%')).toBeInTheDocument()
  })

  test('supports hidden and ghosted visibility states', () => {
    render(
      <TreeGraph
        nodes={rulesTreeNodes}
        edges={rulesTreeEdges}
        rootId="fact"
        nodeVisibilityById={{
          fact: 'visible',
          root: 'visible',
          'alpha-1': 'ghosted',
          'alpha-2': 'hidden',
        }}
        edgeVisibilityById={{
          'fact->root': 'visible',
          'root->alpha-1': 'ghosted',
          'root->alpha-2': 'hidden',
        }}
      />,
    )

    expect(screen.getByTestId('tree-node-alpha-1').parentElement).toHaveAttribute('opacity', '0.2')
    expect(screen.queryByTestId('tree-node-alpha-2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tree-edge-root-alpha-2')).not.toBeInTheDocument()
  })

  test('renders node annotations for failure overlays', () => {
    render(
      <TreeGraph
        nodes={[
          ...rulesTreeNodes.map((node) => (
            node.id === 'alpha-3'
              ? { ...node, annotation: { label: '500 <= 5000', tone: 'failed' as const, detail: 'amount expected > 5000' } }
              : node
          )),
        ]}
        edges={rulesTreeEdges}
        rootId="fact"
      />,
    )

    expect(screen.getByText('500 <= 5000')).toBeInTheDocument()
  })
})
