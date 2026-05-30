import { useMemo } from 'react'
import { useSimulatorStore } from '../lib/store'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Separator } from './ui/separator'

export function InspectorPanel(): JSX.Element {
  const {
    network,
    run,
    stepIndex,
    activeRuleId,
    selectedNodeId,
    setActiveRuleId,
    setStepIndex,
    getSnapshot,
    isMemoryOpen,
    setMemoryOpen,
    selectedMemoryTab,
    setSelectedMemoryTab,
  } = useSimulatorStore()
  const snapshot = getSnapshot()

  const canStep = run && run.timeline.length > 0
  const maxStep = run ? run.timeline.length - 1 : 0
  const selectedNode = selectedNodeId && network ? network.nodes[selectedNodeId] ?? null : null
  const selectedRule = activeRuleId ? network?.canonicalRuleSet.rules.find((rule) => rule.id === activeRuleId) : null

  const memoryItems = useMemo(() => {
    if (!selectedNode || !snapshot) return []
    if (selectedNode.type === 'alpha') return snapshot.memory.alphaMemory[selectedNode.id] ?? []
    if (selectedNode.type === 'production') return snapshot.memory.activations.filter((activation) => activation.analysis.rule_id === selectedNode.rule.id)
    if (selectedNode.type === 'beta') {
      const bucket = snapshot.memory.betaMemory[selectedNode.id]
      return bucket ? [...bucket.left, ...bucket.right] : []
    }
    return []
  }, [selectedNode, snapshot])

  return (
    <>
      <Card className="flex h-full min-h-0 flex-col overflow-hidden">
        <CardHeader className="space-y-2">
          <div className="space-y-1">
            <p className="eyebrow">Inspector</p>
            <CardTitle>Node and replay details</CardTitle>
          </div>

          {network ? (
            <select
              aria-label="Inspector rule isolation"
              className="h-8 rounded-md border border-border bg-white px-2 text-xs text-foreground"
              value={activeRuleId ?? '__all__'}
              onChange={(event) => setActiveRuleId(event.target.value === '__all__' ? null : event.target.value)}
            >
              <option value="__all__">All rules</option>
              {network.canonicalRuleSet.rules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.name}
                </option>
              ))}
            </select>
          ) : null}

          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span>
              Step {canStep ? stepIndex + 1 : 0}/{canStep ? maxStep + 1 : 0}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={!canStep || stepIndex === 0} onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}>
                Prev
              </Button>
              <Button size="sm" variant="outline" disabled={!canStep || stepIndex === maxStep} onClick={() => setStepIndex(Math.min(maxStep, stepIndex + 1))}>
                Next
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-0">
          <Section title="Current event">
            {snapshot?.event ? (
              <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3">
                <div className="text-sm font-medium leading-6 text-foreground">{snapshot.event.label}</div>
                <p className="text-sm leading-6 text-muted-foreground">{snapshot.event.detail}</p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">Run the simulator to inspect timeline events.</p>
            )}
          </Section>

          <Separator />

          <Section title="Selected node">
            {selectedNode ? (
              <div className="space-y-2 rounded-md border border-border bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{selectedNode.type}</Badge>
                  <Badge variant="outline">{selectedNode.id}</Badge>
                  {'relatedRuleIds' in selectedNode && selectedNode.relatedRuleIds.length > 1 ? (
                    <Badge variant="outline">Shared by {selectedNode.relatedRuleIds.length} rules</Badge>
                  ) : null}
                </div>
                {'children' in selectedNode ? (
                  <p className="text-sm leading-6 text-muted-foreground">Outgoing edges: {selectedNode.children.length}</p>
                ) : null}
                {'condition' in selectedNode ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    <code>{selectedNode.condition.field}</code> {selectedNode.condition.operator} <code>{String(selectedNode.condition.value)}</code>
                  </p>
                ) : null}
                {'joinConditions' in selectedNode ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Join on <code>{selectedNode.joinConditions[0]?.leftField}</code> = <code>{selectedNode.joinConditions[0]?.rightField}</code>
                  </p>
                ) : null}
                {'rule' in selectedNode ? <p className="text-sm leading-6 text-muted-foreground">{selectedNode.rule.name}</p> : null}
                {selectedRule && 'relatedRuleIds' in selectedNode ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {(selectedNode.relatedRuleIds ?? []).includes(selectedRule.id)
                      ? `Used by isolated rule ${selectedRule.name}${selectedNode.relatedRuleIds.length > 1 ? ` and shared with ${selectedNode.relatedRuleIds.length - 1} other rule(s).` : '.'}`
                      : 'Not used by the isolated rule.'}
                  </p>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => setMemoryOpen(true)}>
                  Inspect memory
                </Button>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">Select a node in the graph to inspect it.</p>
            )}
          </Section>

          <Separator />

          <Section title="Traversal snapshot">
            {snapshot ? (
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <SnapshotStat label="Working memory" value={snapshot.memory.workingMemory.length} />
                <SnapshotStat label="Alpha memories" value={Object.keys(snapshot.memory.alphaMemory).length} />
                <SnapshotStat label="Beta memories" value={Object.keys(snapshot.memory.betaMemory).length} />
                <SnapshotStat label="Activations" value={snapshot.memory.activations.length} />
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">No traversal snapshot yet.</p>
            )}
          </Section>

          <Separator />

          <Section title="Compiled rule outcome">
            {snapshot ? (
              <div className="space-y-2 rounded-md border border-border bg-white p-3">
                <div className="flex items-center gap-2">
                  <Badge>{snapshot.result.decision}</Badge>
                  <Badge variant="outline">{snapshot.result.triggeredRules.length} rule(s)</Badge>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">Risk score: {snapshot.result.riskScore}</p>
                <ul className="list-disc space-y-1 pl-4 text-sm leading-6 text-muted-foreground">
                  {snapshot.result.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">Simulation results appear here after a run.</p>
            )}
          </Section>
        </CardContent>
      </Card>

      {isMemoryOpen && selectedNode && snapshot ? (
        <div className="fixed inset-y-6 right-6 z-50 hidden w-[420px] xl:block">
          <Card className="flex h-full flex-col overflow-hidden shadow-2xl">
            <CardHeader className="space-y-2 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="eyebrow">Memory</p>
                  <CardTitle>{selectedNode.id}</CardTitle>
                </div>
                <Button size="sm" variant="outline" onClick={() => setMemoryOpen(false)}>
                  Close
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['summary', 'facts', 'activations'] as const).map((tab) => (
                  <Button key={tab} size="sm" variant={selectedMemoryTab === tab ? 'default' : 'outline'} onClick={() => setSelectedMemoryTab(tab)}>
                    {tab}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto pt-4">
              {selectedMemoryTab === 'summary' ? (
                <div className="space-y-3">
                  <MemorySummaryRow label="Node type" value={selectedNode.type} />
                  <MemorySummaryRow label="Stored items" value={String(memoryItems.length)} />
                  {selectedNode.type === 'beta' ? (
                    <>
                      <MemorySummaryRow label="Left memory" value={String(snapshot.memory.betaMemory[selectedNode.id]?.left.length ?? 0)} />
                      <MemorySummaryRow label="Right memory" value={String(snapshot.memory.betaMemory[selectedNode.id]?.right.length ?? 0)} />
                    </>
                  ) : null}
                </div>
              ) : selectedMemoryTab === 'facts' ? (
                <div className="space-y-3">
                  {memoryItems.length > 0 ? memoryItems.map((fact) => (
                    <pre key={fact.id} className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-5 text-foreground">
                      {JSON.stringify(fact, null, 2)}
                    </pre>
                  )) : <p className="text-sm leading-6 text-muted-foreground">No facts stored for this node at the current step.</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  {'rule' in selectedNode ? (
                    <>
                      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
                        Actions: {selectedNode.rule.actions.map((action) => action.decision).join(', ')}
                      </div>
                      {snapshot.memory.activations.filter((activation) => activation.analysis.rule_id === selectedNode.rule.id).map((activation) => (
                        <pre key={activation.id} className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-5 text-foreground">
                          {JSON.stringify(activation, null, 2)}
                        </pre>
                      ))}
                    </>
                  ) : (
                    <p className="text-sm leading-6 text-muted-foreground">Activations are only emitted by production nodes.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  )
}

function Section({ title, children }: { title: string; children: JSX.Element | JSX.Element[] | string }): JSX.Element {
  return (
    <section className="space-y-2">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function SnapshotStat({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <div className="eyebrow">{label}</div>
      <div className="text-sm font-medium leading-6 text-foreground">{value}</div>
    </div>
  )
}

function MemorySummaryRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="eyebrow">{label}</div>
      <div className="text-sm font-medium leading-6 text-foreground">{value}</div>
    </div>
  )
}
