import { useState } from 'react'
import { TreeGraph } from '../components/tree-graph/TreeGraph'
import type { GraphNode } from '../components/tree-graph/treeGraphTypes'
import { basicTreeEdges, basicTreeNodes, rulesTreeEdges, rulesTreeNodes, rulesTreeStates } from '../data/treeGraphDemoData'

export function TreeGraphDemo(): JSX.Element {
  const [selectedNodeLabel, setSelectedNodeLabel] = useState<string | null>(null)

  const handleNodeClick = (node: GraphNode): void => {
    setSelectedNodeLabel(node.label)
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-8 lg:px-8">
        <header className="rounded-2xl border border-zinc-200 bg-white px-6 py-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Tree Graph Demo</p>
          <h1 className="mt-1 max-w-4xl text-balance">Mermaid-style schematic tree graph for facts, roots, alpha, beta, and production nodes.</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            This reusable SVG component is built for Vite + TypeScript. It renders circular nodes, top-down branches,
            clear edge connections, and simple highlighting states without the overhead of a workflow canvas.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="rounded-full border border-zinc-300 px-3 py-1">Circular nodes</span>
            <span className="rounded-full border border-zinc-300 px-3 py-1">Top-down layout</span>
            <span className="rounded-full border border-zinc-300 px-3 py-1">Custom SVG renderer</span>
            <span className="rounded-full border border-zinc-300 px-3 py-1">Rules-engine ready</span>
          </div>
        </header>

        <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Example 1</p>
            <h2>Fact to root to ten alpha gates</h2>
            <p className="text-sm leading-6 text-zinc-600">
              This mirrors the Mermaid flow from your prompt: one fact node, one root node, and ten evenly spaced child branches.
            </p>
          </div>
          <TreeGraph
            nodes={basicTreeNodes}
            edges={basicTreeEdges}
            rootId="fact"
            height={620}
            siblingGap={140}
            className="bg-white"
            onNodeClick={handleNodeClick}
          />
        </section>

        <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Example 2</p>
            <h2>Rules-engine schematic with node states</h2>
            <p className="text-sm leading-6 text-zinc-600">
              This shows how the same component can later represent fact, root, alpha, beta, and production nodes with active, passed, failed, and selected states.
            </p>
          </div>
          <TreeGraph
            nodes={rulesTreeNodes}
            edges={rulesTreeEdges}
            rootId="fact"
            height={520}
            nodeStateById={rulesTreeStates}
            className="bg-white"
            onNodeClick={handleNodeClick}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">How To Extend</p>
            <div className="mt-2 space-y-3 text-sm leading-6 text-zinc-600">
              <p>Map your rules-engine compiler output into `GraphNode[]` and `GraphEdge[]`, then pass that directly into `TreeGraph`.</p>
              <p>Use node `type` values like `alpha`, `beta`, and `production` to preserve semantic meaning without changing the rendering API.</p>
              <p>Later, drive `nodeStateById` from your simulator state so the current node is `active`, matched nodes are `passed`, failed alpha checks are `failed`, and the inspector target is `selected`.</p>
            </div>
          </div>

          <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Selected Node</p>
            <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-700">
              {selectedNodeLabel ?? 'Click any node in the examples to inspect the click handler output.'}
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}
