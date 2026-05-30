import { useMemo, type ReactNode } from 'react'
import { evaluateConditionDetailed, normalizeOperator } from '../lib/simulator/helpers'
import type {
  CompiledNode,
  Fact,
  ProductionCompiledNode,
  TimelineEvent,
} from '../lib/simulator/types'
import { useSimulatorStore } from '../lib/store'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { ScrollArea } from './ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

const quirks = [
  'This is a rete-like DAG, not a full generalized RETE implementation.',
  'Beta joins only succeed when both facts belong to the same transaction and organization.',
  'Alpha nodes are shared by org and condition signature, but beta nodes remain rule-specific.',
  'Detailed explanations are produced after activation by re-evaluating conditions against the original fact.',
  'Velocity behavior differs between production and backtest in the Go engine; this simulator documents that difference rather than hiding it.',
  'The engine uses transaction CreatedAt for hour and weekend analysis, which can differ from TransactionDate flows.',
]

function summarizeNode(node: CompiledNode): string {
  if (node.type === 'root') return 'Root node'
  if (node.type === 'alpha') return 'Alpha filter'
  if (node.type === 'beta') return 'Beta join'
  return 'Production terminal'
}

function getSourceNodeLabel(nodeId: string): string {
  if (nodeId === 'root') return 'root'
  if (nodeId.startsWith('alpha-')) return nodeId.replace('alpha-', 'alpha ')
  if (nodeId.startsWith('beta-')) return nodeId.replace('beta-', 'beta ')
  return nodeId
}

function getWhyThisExists(node: CompiledNode): string {
  if (node.type === 'root') {
    return 'The root exists once per network. It accepts each input fact, then dispatches that fact into the alpha branches that belong to matching organizations.'
  }
  if (node.type === 'alpha') {
    return `This alpha exists because at least one rule needs ${node.condition.field} ${normalizeOperator(node.condition.operator)} ${String(node.condition.value)}. The engine shares alpha nodes across rules when org and condition signature match.`
  }
  if (node.type === 'beta') {
    return `This beta exists because an AND rule needs to join ${getSourceNodeLabel(node.leftAlphaId)} with ${getSourceNodeLabel(node.rightAlphaId)}. Beta nodes are rule-specific and join on same-transaction user_id equality.`
  }
  return `This production node exists as the terminal for ${node.rule.name}. If the upstream path succeeds, the engine emits an activation fact here.`
}

function getNodeEvent(events: TimelineEvent[], nodeId: string | null): TimelineEvent | null {
  if (!nodeId) return null
  return [...events].reverse().find((event) => event.nodeId === nodeId) ?? null
}

function formatFactSummary(
  fact: Fact | null | undefined,
  selectedFact: ReturnType<typeof useSimulatorStore.getState>['savedFacts'][number] | null,
): string[] {
  const request = selectedFact?.request
  const transaction = fact?.transaction

  if (!transaction && !request) return ['No fact is active at this step.']

  if (request) {
    return [
      `transaction_reference: ${request.transaction.transaction_reference}`,
      `customer_reference_id: ${request.transaction.customer_reference_id}`,
      `organization_id: ${selectedFact?.organizationId}`,
      `amount: ${request.transaction.amount}`,
      request.transaction.count !== undefined ? `count: ${request.transaction.count}` : null,
      request.transaction.amount_sum !== undefined ? `amount_sum: ${request.transaction.amount_sum}` : null,
      `currency: ${request.transaction.currency}`,
      `transaction_type: ${request.transaction.transaction_type}`,
      `channel: ${request.transaction.channel}`,
      request.transaction.country ? `country: ${request.transaction.country}` : null,
      selectedFact?.userProfile?.maxTransactionAmount !== undefined
        ? `max_transaction_amount: ${selectedFact.userProfile.maxTransactionAmount}`
        : null,
    ].filter(Boolean) as string[]
  }

  if (!transaction) return ['No fact is active at this step.']

  return [
    `Transaction ${transaction.id}`,
    `Organization ${transaction.organizationId}`,
    `User ${transaction.userId}`,
    transaction.amount !== undefined ? `Amount ${transaction.amount}` : null,
    transaction.count !== undefined ? `Count ${transaction.count}` : null,
    transaction.amountSum !== undefined ? `Amount sum ${transaction.amountSum}` : null,
    fact?.userProfile?.maxTransactionAmount !== undefined
      ? `Max transaction amount ${fact.userProfile.maxTransactionAmount}`
      : null,
    transaction.currency ? `Currency ${transaction.currency}` : null,
    transaction.country ? `Country ${transaction.country}` : null,
  ].filter(Boolean) as string[]
}

function findFocusedNode(network: ReturnType<typeof useSimulatorStore.getState>['network'], selectedNodeId: string | null, currentEvent: TimelineEvent | null): CompiledNode | null {
  if (!network) return null
  if (selectedNodeId && network.nodes[selectedNodeId]) return network.nodes[selectedNodeId]
  if (currentEvent?.nodeId && network.nodes[currentEvent.nodeId]) return network.nodes[currentEvent.nodeId]
  return network.nodes[network.rootId] ?? null
}

function ExplanationSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}): JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
      <div className="mt-2 grid gap-2">{children}</div>
    </section>
  )
}

function DetailList({ items }: { items: string[] }): JSX.Element {
  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li key={item} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-700">
          {item}
        </li>
      ))}
    </ul>
  )
}

function formatMemoryFact(fact: Fact): string {
  const reference = fact.transaction?.externalId ?? fact.transaction?.reference ?? fact.transaction?.id ?? fact.id
  const amount = fact.transaction?.amount
  const currency = fact.transaction?.currency ?? ''
  return amount !== undefined ? `${reference} · ${amount} ${currency}`.trim() : reference
}

export function ExplanationPanel(): JSX.Element {
  const {
    network,
    run,
    stepIndex,
    selectedNodeId,
    savedFacts,
    selectedFactId,
    selectedMemoryTab,
    setSelectedMemoryTab,
    getSnapshot,
  } = useSimulatorStore()
  const snapshot = getSnapshot()
  const currentEvent = run?.timeline[stepIndex] ?? null
  const focusedNode = findFocusedNode(network, selectedNodeId, currentEvent)
  const selectedFact = selectedFactId ? savedFacts.find((fact) => fact.id === selectedFactId) ?? null : null

  const focusedEvent = useMemo(() => {
    if (!run?.timeline || !focusedNode) return null
    return getNodeEvent(run.timeline.slice(0, stepIndex + 1), focusedNode.id)
  }, [focusedNode, run?.timeline, stepIndex])

  const evaluation = useMemo(() => {
    if (!focusedNode || focusedNode.type !== 'alpha' || !run?.fact) return null
    return evaluateConditionDetailed(focusedNode.condition, run.fact)
  }, [focusedNode, run?.fact])

  const explanationItems = useMemo(() => {
    if (!focusedNode) return []
    if (focusedNode.type === 'root') {
      return [
        `Root has ${focusedNode.children.length} outgoing branch${focusedNode.children.length === 1 ? '' : 'es'} in the current network.`,
        currentEvent?.type === 'root-dispatch'
          ? 'At this step the root is dispatching the input fact into a matching alpha branch.'
          : 'At runtime the root forwards the input fact into each eligible alpha branch.',
      ]
    }
    if (focusedNode.type === 'alpha') {
      const memoryCount = snapshot?.memory.alphaMemory[focusedNode.id]?.length ?? 0
      return [
        `Condition: ${focusedNode.condition.field} ${normalizeOperator(focusedNode.condition.operator)} ${String(focusedNode.condition.value)}.`,
        evaluation
          ? evaluation.availability === 'unavailable'
            ? `This alpha could not run because ${evaluation.unavailableReason}.`
            : `Actual value at this step: ${String(evaluation.actualValue)}. Result: ${evaluation.matched ? 'matched' : 'failed'}.`
          : 'Run a fact to see the exact value that hits this alpha.',
        `Alpha memory currently holds ${memoryCount} fact${memoryCount === 1 ? '' : 's'}.`,
      ]
    }
    if (focusedNode.type === 'beta') {
      const memory = snapshot?.memory.betaMemory[focusedNode.id] ?? { left: [], right: [] }
      return [
        `Join inputs: ${getSourceNodeLabel(focusedNode.leftAlphaId)} × ${getSourceNodeLabel(focusedNode.rightAlphaId)}.`,
        `Join rule: ${focusedNode.joinConditions.map((condition) => `${condition.leftField} ${condition.operator} ${condition.rightField}`).join(', ')}.`,
        `Left memory holds ${memory.left.length} fact${memory.left.length === 1 ? '' : 's'} and right memory holds ${memory.right.length} fact${memory.right.length === 1 ? '' : 's'}.`,
      ]
    }
    const productionNode = focusedNode as ProductionCompiledNode
    const activationCount = snapshot?.memory.activations.filter((activation) => String(activation.analysis.rule_id) === productionNode.rule.id).length ?? 0
    return [
      `Terminal rule: ${productionNode.rule.name}.`,
      `Primary operator: ${productionNode.rule.primaryOperator}.`,
      `Activations emitted so far: ${activationCount}.`,
      `Actions: ${productionNode.rule.actions.map((action) => `${action.type}:${action.decision}`).join(', ')}.`,
    ]
  }, [currentEvent?.type, evaluation, focusedNode, snapshot?.memory.activations, snapshot?.memory.alphaMemory, snapshot?.memory.betaMemory])

  const factItems = useMemo(() => {
    if (snapshot?.memory.workingMemory[0]) return formatFactSummary(snapshot.memory.workingMemory[0], selectedFact)
    return run?.fact ? formatFactSummary(run.fact, selectedFact) : formatFactSummary(null, selectedFact)
  }, [run?.fact, selectedFact, snapshot?.memory.workingMemory])

  const resultItems = useMemo(() => {
    if (!run) return ['Run the selected fact to see the engine decision and triggered rule response.']
    return [
      `recommended_action: ${run.result.decision}`,
      `risk_score: ${run.result.riskScore}`,
      `triggered_rules: ${
        run.result.triggeredRules.length > 0
          ? run.result.triggeredRules.map((result) => result.rule.name).join(', ')
          : 'none'
      }`,
      `reasons: ${run.result.reasons.join(' | ')}`,
    ]
  }, [run])

  const snapshotSummaryItems = useMemo(() => {
    if (!snapshot) return ['Run a fact to capture the alpha, beta, and production memory at each step.']

    const alphaEntries = Object.entries(snapshot.memory.alphaMemory)
    const betaEntries = Object.entries(snapshot.memory.betaMemory)
    return [
      `Working memory facts: ${snapshot.memory.workingMemory.length}`,
      `Alpha memories populated: ${alphaEntries.filter(([, facts]) => facts.length > 0).length}`,
      `Beta memories populated: ${betaEntries.filter(([, memory]) => memory.left.length > 0 || memory.right.length > 0).length}`,
      `Activation facts emitted: ${snapshot.memory.activations.length}`,
      focusedNode ? `Focused node: ${summarizeNode(focusedNode)} ${focusedNode.id}` : 'Focused node: none',
    ]
  }, [focusedNode, snapshot])

  const snapshotFactItems = useMemo(() => {
    if (!snapshot) return ['No replay snapshot is available yet.']
    if (!focusedNode || focusedNode.type === 'root') {
      return snapshot.memory.workingMemory.length > 0
        ? snapshot.memory.workingMemory.map(formatMemoryFact)
        : ['Working memory is empty at this step.']
    }
    if (focusedNode.type === 'alpha') {
      const facts = snapshot.memory.alphaMemory[focusedNode.id] ?? []
      return facts.length > 0
        ? facts.map(formatMemoryFact)
        : ['This alpha memory is empty at the current replay step.']
    }
    if (focusedNode.type === 'beta') {
      const memory = snapshot.memory.betaMemory[focusedNode.id] ?? { left: [], right: [] }
      const leftItems = memory.left.map((fact) => `Left · ${formatMemoryFact(fact)}`)
      const rightItems = memory.right.map((fact) => `Right · ${formatMemoryFact(fact)}`)
      return leftItems.length + rightItems.length > 0
        ? [...leftItems, ...rightItems]
        : ['This beta join has no left or right memory yet.']
    }
    const matchingActivations = snapshot.memory.activations.filter(
      (activation) => String(activation.analysis.rule_id ?? '') === focusedNode.rule.id,
    )
    return matchingActivations.length > 0
      ? matchingActivations.map((activation) => `Activation · ${activation.id}`)
      : ['This production terminal has not emitted an activation yet.']
  }, [focusedNode, snapshot])

  const activationItems = useMemo(() => {
    if (!snapshot) return ['No activations yet.']
    return snapshot.memory.activations.length > 0
      ? snapshot.memory.activations.map((activation) => {
          const reasons = Array.isArray(activation.analysis.reasons) ? activation.analysis.reasons.join(', ') : 'No reasons captured'
          return `${String(activation.analysis.rule_name ?? activation.analysis.rule_id ?? activation.id)} · ${reasons}`
        })
      : ['No activation facts have been emitted at this step.']
  }, [snapshot])

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="space-y-2">
        <div className="space-y-1">
          <p className="eyebrow">Explanation</p>
          <CardTitle>Step and node explanation</CardTitle>
        </div>
        <Tabs defaultValue="explanation">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="explanation" className="flex-1">Explanation</TabsTrigger>
            <TabsTrigger value="snapshot" className="flex-1">Execution snapshot</TabsTrigger>
            <TabsTrigger value="fidelity" className="flex-1">Fidelity notes</TabsTrigger>
          </TabsList>

          <TabsContent value="explanation" className="min-h-0">
            <CardContent className="min-h-0 px-4 pb-4 pt-0">
              <ScrollArea className="h-[calc(100vh-15rem)] pr-3 xl:h-[calc(100vh-12rem)]">
                <div className="grid gap-3">
                  <ExplanationSection title="Current step">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{currentEvent?.phase ?? 'ready'}</Badge>
                      <Badge variant="outline">{currentEvent?.type ?? 'idle'}</Badge>
                      {focusedNode ? <Badge variant="secondary">{summarizeNode(focusedNode)}</Badge> : null}
                    </div>
                    <div className="text-sm leading-6 text-zinc-900">{currentEvent?.label ?? 'Compile the network and run a fact to inspect a live step.'}</div>
                    <div className="text-sm leading-6 text-muted-foreground">{currentEvent?.detail ?? 'The explanation panel will track the active replay step and the focused node.'}</div>
                  </ExplanationSection>

                  <ExplanationSection title="Focused node">
                    <div className="text-sm font-medium leading-6 text-zinc-900">
                      {focusedNode ? `${summarizeNode(focusedNode)}: ${focusedNode.id}` : 'No node selected'}
                    </div>
                    <div className="text-sm leading-6 text-muted-foreground">
                      {focusedNode ? getWhyThisExists(focusedNode) : 'Select a node or advance the replay to inspect why the engine created it.'}
                    </div>
                    {focusedEvent ? (
                      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-700">
                        Latest node event: {focusedEvent.label}. {focusedEvent.detail}
                      </div>
                    ) : null}
                  </ExplanationSection>

                  <ExplanationSection title="Logic at this step">
                    <DetailList items={explanationItems.length > 0 ? explanationItems : ['No node logic is available yet.']} />
                  </ExplanationSection>

                  <ExplanationSection title="Input fact">
                    <DetailList items={factItems} />
                  </ExplanationSection>

                  <ExplanationSection title="API result">
                    <DetailList items={resultItems} />
                  </ExplanationSection>
                </div>
              </ScrollArea>
            </CardContent>
          </TabsContent>

          <TabsContent value="snapshot" className="min-h-0">
            <CardContent className="min-h-0 px-4 pb-4 pt-0">
              <ScrollArea className="h-[calc(100vh-15rem)] pr-3 xl:h-[calc(100vh-12rem)]">
                <div className="grid gap-3">
                  <ExplanationSection title="Snapshot focus">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant={selectedMemoryTab === 'summary' ? 'secondary' : 'outline'} className="h-8" onClick={() => setSelectedMemoryTab('summary')}>
                        Summary
                      </Button>
                      <Button size="sm" variant={selectedMemoryTab === 'facts' ? 'secondary' : 'outline'} className="h-8" onClick={() => setSelectedMemoryTab('facts')}>
                        Facts
                      </Button>
                      <Button size="sm" variant={selectedMemoryTab === 'activations' ? 'secondary' : 'outline'} className="h-8" onClick={() => setSelectedMemoryTab('activations')}>
                        Activations
                      </Button>
                    </div>
                    <div className="text-sm leading-6 text-muted-foreground">
                      Inspect the rete-like memory snapshot captured at the current replay step.
                    </div>
                  </ExplanationSection>

                  {selectedMemoryTab === 'summary' ? (
                    <ExplanationSection title="Memory summary">
                      <DetailList items={snapshotSummaryItems} />
                    </ExplanationSection>
                  ) : null}

                  {selectedMemoryTab === 'facts' ? (
                    <ExplanationSection title="Stored facts">
                      <DetailList items={snapshotFactItems} />
                    </ExplanationSection>
                  ) : null}

                  {selectedMemoryTab === 'activations' ? (
                    <ExplanationSection title="Activation facts">
                      <DetailList items={activationItems} />
                    </ExplanationSection>
                  ) : null}
                </div>
              </ScrollArea>
            </CardContent>
          </TabsContent>

          <TabsContent value="fidelity" className="min-h-0">
            <CardContent className="min-h-0 px-4 pb-4 pt-0">
              <ScrollArea className="h-[calc(100vh-15rem)] pr-3 xl:h-[calc(100vh-12rem)]">
                <ul className="space-y-2">
                  {quirks.map((quirk, index) => (
                    <li key={quirk} className="flex items-start gap-3 rounded-md border border-border bg-white p-3">
                      <Badge variant="secondary">{index + 1}</Badge>
                      <span className="text-sm leading-6 text-muted-foreground">{quirk}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </TabsContent>
        </Tabs>
      </CardHeader>
    </Card>
  )
}
