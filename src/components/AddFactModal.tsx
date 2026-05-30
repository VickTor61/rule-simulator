import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Braces, Play, Plus, X } from 'lucide-react'
import { parseFactRequest } from '../lib/facts'
import { useSimulatorStore } from '../lib/store'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

function getDefaultOrganizationId(
  activeRuleId: string | null,
  rulesText: string,
  network: ReturnType<typeof useSimulatorStore.getState>['network'],
): number {
  if (activeRuleId && network) {
    const activeRule = network.canonicalRuleSet.rules.find((rule) => rule.id === activeRuleId)
    if (activeRule) return activeRule.organizationId
  }

  if (network?.canonicalRuleSet.rules[0]) {
    return network.canonicalRuleSet.rules[0].organizationId
  }

  try {
    const parsed = JSON.parse(rulesText) as { rules?: Array<Record<string, unknown>> }
    const firstRule = Array.isArray(parsed.rules) ? parsed.rules[0] : null
    const organizationId = Number(firstRule?.organization_id ?? firstRule?.organizationId ?? 1)
    return Number.isFinite(organizationId) && organizationId > 0 ? organizationId : 1
  } catch {
    return 1
  }
}

export function AddFactModal(): JSX.Element | null {
  const {
    isFactModalOpen,
    editingFactId,
    closeFactModal,
    saveFact,
    savedFacts,
    rulesText,
    network,
    activeRuleId,
  } = useSimulatorStore()
  const editingFact = editingFactId
    ? savedFacts.find((fact) => fact.id === editingFactId) ?? null
    : null

  const defaultOrganizationId = useMemo(
    () => getDefaultOrganizationId(activeRuleId, rulesText, network),
    [activeRuleId, network, rulesText],
  )

  const initialJsonText = useMemo(() => {
    if (editingFact) {
      return JSON.stringify(editingFact.request, null, 2)
    }

    return JSON.stringify(
      {
        transaction: {
          transaction_reference: '',
          customer_reference_id: '',
          amount: 0,
          currency: '',
          transaction_type: '',
          channel: '',
        },
      },
      null,
      2,
    )
  }, [editingFact])

  const [factJson, setFactJson] = useState(initialJsonText)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isFactModalOpen) return
    setFactJson(initialJsonText)
    setError(null)
  }, [initialJsonText, isFactModalOpen])

  if (!isFactModalOpen) return null

  const handleSave = (runAfterSave: boolean): void => {
    try {
      const fact = parseFactRequest(factJson, defaultOrganizationId, editingFact)
      saveFact(fact, { runAfterSave })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Invalid fact JSON')
    }
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[1px]">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="space-y-1">
            <p className="eyebrow">Fact entry</p>
            <h2 className="text-xl font-semibold leading-7 text-zinc-950">{editingFact ? 'Edit fact' : 'Add fact'}</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Paste the same transaction payload the rules engine transactions API accepts. The simulator will resolve the
              organization from the current live rules unless you provide a top-level <code>organization_id</code>.
            </p>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-md" onClick={closeFactModal} aria-label="Close fact modal">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-zinc-50/80 p-3">
              <div className="mb-2 flex items-center gap-2 text-zinc-700">
                <Braces className="h-4 w-4" />
                <span className="text-sm font-medium leading-6">Transaction request JSON</span>
              </div>
              <p className="mb-3 text-sm leading-6 text-muted-foreground">
                Required fields are <code>transaction_reference</code>, <code>customer_reference_id</code>,{' '}
                <code>amount</code>, <code>currency</code>, <code>transaction_type</code>, and <code>channel</code>.
              </p>
              <Textarea
                aria-label="Fact JSON editor"
                value={factJson}
                onChange={(event) => {
                  setFactJson(event.target.value)
                  setError(null)
                }}
                className="min-h-[360px] bg-white"
              />
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-600">
              Default organization for this fact: <span className="font-medium text-zinc-950">{defaultOrganizationId}</span>
            </div>
            {error ? (
              <div className="rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <div className="text-sm leading-6 text-muted-foreground">
            {editingFact
              ? 'Saving updates this fact in the recent-facts library and keeps it selected for the next run.'
              : 'Saving adds the fact to the recent-facts library and selects it for the next run.'}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8" onClick={closeFactModal}>
              Cancel
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => handleSave(false)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {editingFact ? 'Save changes' : 'Save fact'}
            </Button>
            <Button size="sm" className="h-8" onClick={() => handleSave(true)}>
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Save and run
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return modal
  return createPortal(modal, document.body)
}
