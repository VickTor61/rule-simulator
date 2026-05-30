import { Handle, Position } from '@xyflow/react'
import type { FlowNodeData } from '../lib/simulator/types'
import { cn } from '../lib/utils'

const typeLabels: Record<FlowNodeData['type'], string> = {
  root: 'ROOT',
  alpha: 'ALPHA',
  beta: 'BETA',
  production: 'PRODUCTION',
}

export function GraphNodeCard({ data }: { data: FlowNodeData }): JSX.Element {
  return (
    <div
      className={cn(
        'graph-node-card relative min-w-[176px] rounded-lg border border-border bg-white px-3 py-2 shadow-sm',
        data.type === 'root' && 'border-l-4 border-l-zinc-500',
        data.type === 'alpha' && 'border-l-4 border-l-emerald-500 bg-emerald-50/40',
        data.type === 'beta' && 'border-l-4 border-l-sky-500 bg-sky-50/40',
        data.type === 'production' && 'border-l-4 border-l-violet-500 bg-violet-50/40',
      )}
    >
      <Handle className="workflow-handle !left-[-6px]" type="target" position={Position.Left} />
      <div
        className={cn(
          'text-xs font-medium uppercase tracking-[0.08em]',
          data.type === 'root' && 'text-zinc-500',
          data.type === 'alpha' && 'text-emerald-700',
          data.type === 'beta' && 'text-sky-700',
          data.type === 'production' && 'text-violet-700',
        )}
      >
        {typeLabels[data.type]}
      </div>
      <div className="text-sm font-medium leading-5 text-zinc-950">{data.label}</div>
      <div className="text-xs leading-5 text-zinc-500">{data.subtitle}</div>
      {data.comparisonLabel ? (
        <div className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">{data.comparisonLabel}</div>
      ) : null}
      <Handle className="workflow-handle !right-[-6px]" type="source" position={Position.Right} />
    </div>
  )
}
