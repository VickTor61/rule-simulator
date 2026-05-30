import { Database, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useSimulatorStore } from '../lib/store'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

export function FactsWorkspace(): JSX.Element {
  const {
    savedFacts,
    selectedFactId,
    isEngineEnabled,
    selectFact,
    deleteFact,
    openFactModal,
    runSelectedFact,
  } = useSimulatorStore()

  const selectedFact = selectedFactId
    ? savedFacts.find((fact) => fact.id === selectedFactId) ?? null
    : null

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-0 bg-transparent shadow-none">
      <CardHeader className="gap-4 border-b border-zinc-200/80 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Facts</p>
            <CardTitle className="mt-1 text-lg font-semibold tracking-[-0.02em] text-zinc-950">Transaction fact library</CardTitle>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Save API-shaped transaction requests, edit them, and run the selected fact against the current network.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-9 rounded-full px-4" onClick={() => openFactModal()}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add fact
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-full border-zinc-200 px-4"
              onClick={runSelectedFact}
              disabled={!isEngineEnabled || !selectedFact}
            >
              <Play className="mr-1.5 h-4 w-4" />
              Run selected fact
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Saved facts</p>
            <p className="mt-1 text-sm font-medium text-zinc-950">{savedFacts.length} available</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Selected</p>
            <p className="mt-1 truncate text-sm font-medium text-zinc-950">
              {selectedFact?.request.transaction.transaction_reference ?? 'No fact selected'}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Engine</p>
            <p className="mt-1 text-sm font-medium text-zinc-950">{isEngineEnabled ? 'Ready to run' : 'Engine off'}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto p-4">
        {savedFacts.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/70 px-6 text-center text-sm leading-6 text-zinc-500">
            No saved facts yet. Add a fact to store a transaction request that can be replayed through the current network.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {savedFacts.map((fact) => {
              const selected = fact.id === selectedFactId
              return (
                <div
                  key={fact.id}
                  className={cn(
                    'flex flex-col gap-3 rounded-[24px] border px-4 py-4 transition-colors',
                    selected ? 'border-zinc-950 bg-zinc-950 text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                  )}
                >
                  <button type="button" onClick={() => selectFact(fact.id)} className="text-left">
                    <div className="flex items-center gap-2">
                      <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-xl', selected ? 'bg-white/12 text-white' : 'bg-zinc-100 text-zinc-600')}>
                        <Database className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium leading-6">{fact.request.transaction.transaction_reference}</p>
                        <p className={cn('truncate text-xs leading-5', selected ? 'text-white/70' : 'text-zinc-500')}>
                          {fact.request.transaction.customer_reference_id}
                        </p>
                      </div>
                    </div>
                  </button>

                  <div className={cn('rounded-2xl border px-3 py-2', selected ? 'border-white/12 bg-white/6' : 'border-zinc-200 bg-zinc-50/70')}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className={selected ? 'text-white/70' : 'text-zinc-500'}>Amount</span>
                      <span className="font-medium">
                        {fact.request.transaction.amount} {fact.request.transaction.currency}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                      <span className={selected ? 'text-white/70' : 'text-zinc-500'}>Channel</span>
                      <span className="font-medium">{fact.request.transaction.channel}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                      <span className={selected ? 'text-white/70' : 'text-zinc-500'}>Type</span>
                      <span className="font-medium">{fact.request.transaction.transaction_type}</span>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={selected ? 'secondary' : 'outline'}
                      className={cn('h-9 rounded-full px-4', !selected && 'border-zinc-200')}
                      onClick={() => selectFact(fact.id)}
                    >
                      Select
                    </Button>
                    <Button
                      size="icon"
                      variant={selected ? 'secondary' : 'ghost'}
                      className="h-9 w-9 rounded-full"
                      onClick={() => openFactModal(fact.id)}
                      aria-label={`Edit ${fact.request.transaction.transaction_reference}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant={selected ? 'secondary' : 'ghost'}
                      className="h-9 w-9 rounded-full"
                      onClick={() => deleteFact(fact.id)}
                      aria-label={`Delete ${fact.request.transaction.transaction_reference}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
