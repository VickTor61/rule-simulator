import { useMemo, useState } from 'react'
import { BookmarkPlus, Trash2 } from 'lucide-react'
import { ScenarioPackModal } from './ScenarioPackModal'
import { ImportPanel } from './ImportPanel'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { useSimulatorStore } from '../lib/store'

export function CoreFeaturesWorkspace(): JSX.Element {
  const {
    run,
    selectedFactId,
    savedFacts,
    scenarioPacks,
    selectedScenarioPackId,
    saveScenarioPack,
    loadScenarioPack,
    deleteScenarioPack,
  } = useSimulatorStore()
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false)

  const selectedFact = selectedFactId
    ? savedFacts.find((fact) => fact.id === selectedFactId) ?? null
    : null
  const selectedScenarioPack = selectedScenarioPackId
    ? scenarioPacks.find((pack) => pack.id === selectedScenarioPackId) ?? null
    : null

  const defaultScenarioName = useMemo(() => {
    if (!selectedFact) return 'Scenario pack'
    return `${selectedFact.request.transaction.transaction_type || 'transaction'} · ${selectedFact.request.transaction.amount} ${selectedFact.request.transaction.currency}`.trim()
  }, [selectedFact])

  const defaultScenarioDescription = useMemo(() => {
    if (!run) return 'Saved from the current live rule network.'
    return `Expected ${run.result.decision} with ${run.result.triggeredRules.length} triggered rule${run.result.triggeredRules.length === 1 ? '' : 's'}.`
  }, [run])

  return (
    <>
      <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="flex min-h-0 flex-col overflow-hidden border-0 bg-transparent shadow-none">
          <CardHeader className="gap-3 border-b border-zinc-200/80 px-5 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Core features</p>
              <CardTitle className="mt-1 text-lg font-semibold tracking-[-0.02em] text-zinc-950">Reusable engine utilities</CardTitle>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Save scenario packs, reload known business cases, and work with the input/import tools away from the canvas.
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-4">
            <div className="rounded-[20px] border border-zinc-200 bg-zinc-50/70 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Scenario packs</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Save the current rules plus selected fact so you can reload the same engine case later.
              </p>
              <div className="mt-4 grid gap-2">
                <Button className="h-9 justify-start rounded-full px-4" onClick={() => setIsScenarioModalOpen(true)} disabled={!selectedFact}>
                  <BookmarkPlus className="mr-1.5 h-4 w-4" />
                  Save current scenario
                </Button>
                <select
                  aria-label="Scenario pack selector"
                  className="h-10 rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none focus:border-zinc-300"
                  value={selectedScenarioPackId ?? '__none__'}
                  onChange={(event) => {
                    if (event.target.value === '__none__') return
                    loadScenarioPack(event.target.value)
                  }}
                >
                  <option value="__none__">Select a scenario pack</option>
                  {scenarioPacks.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  className="h-9 justify-start rounded-full border-zinc-200 px-4"
                  onClick={() => selectedScenarioPackId && deleteScenarioPack(selectedScenarioPackId)}
                  disabled={!selectedScenarioPackId}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete selected scenario
                </Button>
              </div>
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm leading-6 text-zinc-600">
                {selectedScenarioPack
                  ? `${selectedScenarioPack.name} · expected ${selectedScenarioPack.expectedDecision}`
                  : 'No scenario pack selected.'}
              </div>
            </div>

            <div className="rounded-[20px] border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-3 text-sm leading-6 text-zinc-500">
              The canvas header has been intentionally cleared. Import, preset, diff, and scenario management now live here so the simulator workspace stays focused on the network.
            </div>
          </CardContent>
        </Card>

        <div className="min-h-0">
          <ImportPanel />
        </div>
      </div>

      <ScenarioPackModal
        open={isScenarioModalOpen}
        defaultName={defaultScenarioName}
        defaultDescription={defaultScenarioDescription}
        onOpenChange={setIsScenarioModalOpen}
        onSave={saveScenarioPack}
      />
    </>
  )
}
