import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, Braces, Plus, Trash2, X } from 'lucide-react'
import { useSimulatorStore } from '../lib/store'
import {
  appendRuleObjectToBundle,
  buildNewRuleDraft,
  buildRuleDraft,
  buildRuleImpactPreview,
  createBlankEditableCondition,
  type RuleDraft,
  upsertRuleInBundle,
  validateRuleDraft,
} from '../lib/rule-editor'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

export type RuleEditorMode = 'edit' | 'new' | 'json'
type ConditionEditorMode = 'form' | 'json'

function coerceConditionValue(value: string, originalValue: unknown): unknown {
  if (typeof originalValue === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }
  if (typeof originalValue === 'boolean') {
    return value === 'true'
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }
  if (value === 'true') return true
  if (value === 'false') return false
  return value
}

function buildConditionsJsonText(draft: RuleDraft): string {
  return JSON.stringify(
    draft.conditions.map((condition, index) => ({
      field: condition.field,
      operator: condition.operator,
      value: coerceConditionValue(condition.value, condition.originalValue),
      position: index + 1,
    })),
    null,
    2,
  )
}

function parseConditionsJsonText(input: string): RuleDraft['conditions'] {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid conditions JSON')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Conditions JSON must be an array of condition objects.')
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Condition ${index + 1} must be an object.`)
    }

    const candidate = item as Record<string, unknown>
    if (typeof candidate.field !== 'string' || candidate.field.trim().length === 0) {
      throw new Error(`Condition ${index + 1} must include a field.`)
    }
    if (typeof candidate.operator !== 'string' || candidate.operator.trim().length === 0) {
      throw new Error(`Condition ${index + 1} must include an operator.`)
    }
    if (!Object.prototype.hasOwnProperty.call(candidate, 'value')) {
      throw new Error(`Condition ${index + 1} must include a value.`)
    }

    const rawValue = candidate.value
    return {
      field: candidate.field.trim(),
      operator: candidate.operator.trim(),
      value: typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue),
      originalValue: rawValue,
    }
  })
}

export function RuleEditorModal({
  open,
  mode,
  editingRuleId,
  onOpenChange,
}: {
  open: boolean
  mode: RuleEditorMode
  editingRuleId: string | null
  onOpenChange: (open: boolean) => void
}): JSX.Element | null {
  const {
    network,
    source,
    rulesText,
    setRulesText,
    compileFromEditor,
    setActiveRuleId,
  } = useSimulatorStore()

  const rules = network?.canonicalRuleSet.rules ?? []
  const editingRule = useMemo(
    () => rules.find((rule) => rule.id === editingRuleId) ?? null,
    [editingRuleId, rules],
  )
  const defaultOrganizationId = rules[0]?.organizationId ?? 1
  const initialNewDraft = useMemo(
    () => buildNewRuleDraft(source, rules.length, defaultOrganizationId),
    [defaultOrganizationId, rules.length, source],
  )

  const [draft, setDraft] = useState<RuleDraft | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [jsonRuleText, setJsonRuleText] = useState('')
  const [jsonRuleError, setJsonRuleError] = useState<string | null>(null)
  const [conditionEditorMode, setConditionEditorMode] = useState<ConditionEditorMode>('form')
  const [conditionsJsonText, setConditionsJsonText] = useState('')
  const [conditionsJsonError, setConditionsJsonError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    if (mode === 'edit') {
      setDraft(buildRuleDraft(editingRule))
    } else if (mode === 'new') {
      setDraft(initialNewDraft)
    } else {
      setDraft(null)
    }

    setDraftError(null)
    setJsonRuleError(null)
    setConditionEditorMode('form')
    setConditionsJsonError(null)

    if (mode !== 'json') {
      setJsonRuleText('')
    }
  }, [editingRule, initialNewDraft, mode, open])

  useEffect(() => {
    if (!draft) {
      setConditionsJsonText('')
      return
    }
    if (conditionEditorMode === 'json') return
    setConditionsJsonText(buildConditionsJsonText(draft))
  }, [conditionEditorMode, draft])

  const isDirty = mode === 'json'
    ? jsonRuleText.trim().length > 0
    : JSON.stringify(draft) !== JSON.stringify(mode === 'edit' ? buildRuleDraft(editingRule) : draft ? initialNewDraft : null)

  const close = (): void => onOpenChange(false)

  const updateDraft = (updater: (current: RuleDraft) => RuleDraft): void => {
    setDraft((current) => (current ? updater(current) : current))
  }

  const syncConditionsFromJson = (nextText: string): void => {
    setConditionsJsonText(nextText)
    setDraftError(null)

    try {
      const nextConditions = parseConditionsJsonText(nextText)
      updateDraft((current) => ({ ...current, conditions: nextConditions }))
      setConditionsJsonError(null)
    } catch (error) {
      setConditionsJsonError(error instanceof Error ? error.message : 'Invalid conditions JSON')
    }
  }

  const moveCondition = (index: number, direction: -1 | 1): void => {
    updateDraft((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.conditions.length) return current
      const conditions = [...current.conditions]
      const [target] = conditions.splice(index, 1)
      conditions.splice(nextIndex, 0, target)
      return { ...current, conditions }
    })
  }

  const handleSave = (): void => {
    if (mode === 'json') {
      try {
        const parsedRule = JSON.parse(jsonRuleText) as Record<string, unknown>
        if (Array.isArray(parsedRule) || parsedRule === null) {
          setJsonRuleError('Paste a single rule object, not an array.')
          return
        }
        const result = appendRuleObjectToBundle(rulesText, source, parsedRule)
        setRulesText(result.rulesText)
        compileFromEditor()
        setActiveRuleId(result.ruleId)
        close()
      } catch (error) {
        setJsonRuleError(error instanceof Error ? error.message : 'Invalid rule JSON')
      }
      return
    }

    if (conditionEditorMode === 'json' && conditionsJsonError) {
      setDraftError(conditionsJsonError)
      return
    }

    const validationError = validateRuleDraft(draft)
    if (validationError) {
      setDraftError(validationError)
      return
    }
    if (!draft) return

    const nextRulesText = upsertRuleInBundle(rulesText, source, draft)
    setRulesText(nextRulesText)
    compileFromEditor()
    setActiveRuleId(draft.id)
    close()
  }

  const title = mode === 'edit'
    ? `Edit ${editingRule?.name ?? 'rule'}`
    : mode === 'new'
      ? 'Guided rule builder'
      : 'Import rule JSON'

  const subtitle = mode === 'edit'
    ? 'Adjust the live rule definition, reorder its conditions, and recompile the network from the updated rule.'
    : mode === 'new'
      ? 'Create a rule through the guided builder. Draft rules stay outside the live network until you mark them active.'
      : 'Paste one complete rule object and append it directly into the current rules bundle.'

  const impactPreview = useMemo(
    () => buildRuleImpactPreview(draft, rules, editingRuleId),
    [draft, editingRuleId, rules],
  )

  if (!open) return null

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[1px]">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="space-y-1">
            <p className="eyebrow">{mode === 'json' ? 'Rule import' : 'Rule editor'}</p>
            <h2 className="text-xl font-semibold leading-7 text-zinc-950">{title}</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-md" onClick={close} aria-label="Close rule editor">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {mode === 'json' ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-zinc-50/80 p-3">
                <div className="mb-2 flex items-center gap-2 text-zinc-700">
                  <Braces className="h-4 w-4" />
                  <span className="text-sm font-medium leading-6">Single rule JSON import</span>
                </div>
                <p className="mb-3 text-sm leading-6 text-muted-foreground">
                  Use this path when you already have the full rule object and want to append it directly into the current bundle.
                </p>
                <Textarea
                  aria-label="Rule JSON editor"
                  value={jsonRuleText}
                  onChange={(event) => {
                    setJsonRuleText(event.target.value)
                    setJsonRuleError(null)
                  }}
                  placeholder={`{\n  "name": "Large amount review",\n  "organization_id": 42,\n  "primary_operator": "AND"\n}`}
                  className="min-h-[300px] bg-white"
                />
              </div>
              {jsonRuleError ? (
                <div className="rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
                  {jsonRuleError}
                </div>
              ) : null}
            </div>
          ) : draft ? (
            <div className="space-y-4">
              <section className="grid gap-3 rounded-lg border border-border bg-zinc-50/80 p-3">
                <div className="grid gap-1">
                  <label htmlFor="rule-editor-name" className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Rule name</label>
                  <input
                    id="rule-editor-name"
                    value={draft.name}
                    onChange={(event) => updateDraft((current) => ({ ...current, name: event.target.value }))}
                    className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-zinc-400"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="grid gap-1">
                    <label htmlFor="rule-editor-organization-id" className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Organization ID</label>
                    <input
                      id="rule-editor-organization-id"
                      type="number"
                      min={1}
                      value={draft.organizationId}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        organizationId: Math.max(1, Number(event.target.value || 1)),
                      }))}
                      className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-zinc-400"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label htmlFor="rule-editor-status" className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Status</label>
                    <select
                      id="rule-editor-status"
                      value={draft.status}
                      onChange={(event) => updateDraft((current) => ({ ...current, status: event.target.value }))}
                      className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-zinc-400"
                    >
                      <option value="active">active</option>
                      <option value="draft">draft</option>
                      <option value="disabled">disabled</option>
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <label htmlFor="rule-editor-operator" className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Operator</label>
                    <select
                      id="rule-editor-operator"
                      value={draft.primaryOperator}
                      onChange={(event) => updateDraft((current) => ({ ...current, primaryOperator: event.target.value as 'AND' | 'OR' }))}
                      className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-zinc-400"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-600">
                  <span className="font-medium text-zinc-900">Engine note:</span> condition order matters. The engine sorts by
                  position before it creates the beta chain, so moving a condition changes the runtime join order.
                </div>
              </section>

              <section className="grid gap-3 rounded-lg border border-border bg-zinc-50/80 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium leading-6 text-zinc-950">Conditions</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Edit the rule conditions and order them deliberately before compiling the network.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => updateDraft((current) => ({
                      ...current,
                      conditions: [...current.conditions, createBlankEditableCondition(source)],
                    }))}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add condition
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-white p-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={conditionEditorMode === 'form' ? 'secondary' : 'ghost'}
                      className="h-8"
                      onClick={() => {
                        setConditionEditorMode('form')
                        setConditionsJsonError(null)
                      }}
                    >
                      Builder
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={conditionEditorMode === 'json' ? 'secondary' : 'ghost'}
                      className="h-8"
                      onClick={() => {
                        setConditionEditorMode('json')
                        setConditionsJsonText(buildConditionsJsonText(draft))
                        setConditionsJsonError(null)
                      }}
                    >
                      JSON
                    </Button>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {conditionEditorMode === 'form' ? 'Use the builder for structured editing.' : 'Edit the conditions array directly.'}
                  </span>
                </div>

                {conditionEditorMode === 'form' ? (
                  <div className="grid gap-3">
                    {draft.conditions.map((condition, index) => (
                      <div key={`${draft.id}-${index}`} className="rounded-md border border-zinc-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Condition {index + 1}</span>
                            <p className="text-sm leading-6 text-muted-foreground">Position {index + 1} in the engine sort order</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-md"
                              onClick={() => moveCondition(index, -1)}
                              disabled={index === 0}
                              aria-label={`Move condition ${index + 1} up`}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-md"
                              onClick={() => moveCondition(index, 1)}
                              disabled={index === draft.conditions.length - 1}
                              aria-label={`Move condition ${index + 1} down`}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-md"
                              onClick={() => updateDraft((current) => ({
                                ...current,
                                conditions: current.conditions.filter((_, conditionIndex) => conditionIndex !== index),
                              }))}
                              disabled={draft.conditions.length === 1}
                              aria-label={`Remove condition ${index + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <input
                            value={condition.field}
                            onChange={(event) => updateDraft((current) => ({
                              ...current,
                              conditions: current.conditions.map((item, conditionIndex) => (
                                conditionIndex === index ? { ...item, field: event.target.value } : item
                              )),
                            }))}
                            placeholder="Field"
                            className="h-10 rounded-md border border-border bg-zinc-50 px-3 text-sm outline-none focus:border-zinc-400 focus:bg-white"
                          />
                          <div className="grid gap-2 md:grid-cols-[120px_minmax(0,1fr)]">
                            <select
                              value={condition.operator}
                              onChange={(event) => updateDraft((current) => ({
                                ...current,
                                conditions: current.conditions.map((item, conditionIndex) => (
                                  conditionIndex === index ? { ...item, operator: event.target.value } : item
                                )),
                              }))}
                              className="h-10 rounded-md border border-border bg-zinc-50 px-3 text-sm outline-none focus:border-zinc-400 focus:bg-white"
                            >
                              {['==', '!=', '>', '>=', '<', '<=', 'in'].map((operator) => (
                                <option key={operator} value={operator}>{operator}</option>
                              ))}
                            </select>
                            <input
                              value={condition.value}
                              onChange={(event) => updateDraft((current) => ({
                                ...current,
                                conditions: current.conditions.map((item, conditionIndex) => (
                                  conditionIndex === index ? { ...item, value: event.target.value } : item
                                )),
                              }))}
                              placeholder="Value"
                              className="h-10 rounded-md border border-border bg-zinc-50 px-3 text-sm outline-none focus:border-zinc-400 focus:bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <Textarea
                      aria-label="Conditions JSON editor"
                      value={conditionsJsonText}
                      onChange={(event) => syncConditionsFromJson(event.target.value)}
                      className="min-h-[320px] bg-white"
                    />
                    {conditionsJsonError ? (
                      <div className="rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
                        {conditionsJsonError}
                      </div>
                    ) : null}
                  </div>
                )}
              </section>

              {impactPreview ? (
                <section className="grid gap-3 rounded-lg border border-border bg-zinc-50/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium leading-6 text-zinc-950">Network impact preview</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Preview how this rule will compile before you save it.
                      </p>
                    </div>
                    <div
                      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium uppercase tracking-[0.08em] ${
                        impactPreview.compileState === 'live'
                          ? 'border-zinc-900 bg-zinc-950 text-white'
                          : impactPreview.compileState === 'draft-only'
                            ? 'border-zinc-200 bg-white text-zinc-700'
                            : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {impactPreview.compileState === 'live'
                        ? 'Live in network'
                        : impactPreview.compileState === 'draft-only'
                          ? 'Draft only'
                          : 'Disabled'}
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
                      <div className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Alpha nodes</div>
                      <div className="mt-1 text-lg font-semibold leading-6 text-zinc-950">{impactPreview.alphaNodeCount}</div>
                    </div>
                    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
                      <div className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">New alpha</div>
                      <div className="mt-1 text-lg font-semibold leading-6 text-zinc-950">{impactPreview.createdAlphaCount}</div>
                    </div>
                    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
                      <div className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Shared alpha</div>
                      <div className="mt-1 text-lg font-semibold leading-6 text-zinc-950">{impactPreview.reusedAlphaCount}</div>
                    </div>
                    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
                      <div className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
                        {draft.primaryOperator === 'AND' ? 'Beta joins' : 'Production'}
                      </div>
                      <div className="mt-1 text-lg font-semibold leading-6 text-zinc-950">
                        {draft.primaryOperator === 'AND' ? impactPreview.betaJoinCount : impactPreview.productionNodeCount}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {draft.primaryOperator === 'AND'
                      ? `This ${impactPreview.compileState === 'live' ? 'active' : 'non-live'} rule will chain its conditions in order and build ${impactPreview.betaJoinCount} beta join${impactPreview.betaJoinCount === 1 ? '' : 's'}.`
                      : 'This rule fans each alpha branch directly into one production node. OR rules do not create beta joins.'}
                  </p>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <div className="rounded-md border border-zinc-200 bg-white px-3 py-3">
                      <div className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Shared alpha reuse</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {impactPreview.reusedAlphaLabels.length > 0 ? impactPreview.reusedAlphaLabels.map((label) => (
                          <span key={label} className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800">
                            {label}
                          </span>
                        )) : (
                          <span className="text-sm leading-6 text-zinc-500">No alpha branches will be reused from the current live network.</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border border-zinc-200 bg-white px-3 py-3">
                      <div className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">New alpha branches</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {impactPreview.createdAlphaLabels.length > 0 ? impactPreview.createdAlphaLabels.map((label) => (
                          <span key={label} className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">
                            {label}
                          </span>
                        )) : (
                          <span className="text-sm leading-6 text-zinc-500">Every alpha in this draft already exists in the live network.</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border border-zinc-200 bg-white px-3 py-3">
                      <div className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Join path preview</div>
                      <div className="mt-2 grid gap-2">
                        {impactPreview.betaJoinLabels.length > 0 ? impactPreview.betaJoinLabels.map((label, index) => (
                          <div key={`${label}-${index}`} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-700">
                            Step {index + 1}: {label}
                          </div>
                        )) : (
                          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-700">
                            This rule will fan each alpha branch directly into one production node.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border border-zinc-200 bg-white px-3 py-3">
                      <div className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Shared live rules</div>
                      <div className="mt-2 grid gap-2">
                        {impactPreview.affectedRuleNames.length > 0 ? impactPreview.affectedRuleNames.map((name) => (
                          <div key={name} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-700">
                            {name}
                          </div>
                        )) : (
                          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-700">
                            No existing live rule shares alpha conditions with this draft.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {draftError ? (
                <div className="rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
                  {draftError}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-zinc-50 px-3 py-4 text-sm leading-6 text-muted-foreground">
              Select a rule to edit.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <div className="text-sm leading-6 text-muted-foreground">
            {mode === 'json'
              ? 'JSON import appends one rule object directly into the current bundle.'
              : 'Saving updates the bundle, recompiles the network, and keeps this rule selected.'}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8" onClick={close}>
              Cancel
            </Button>
            <Button size="sm" className="h-8" onClick={handleSave} disabled={!isDirty}>
              {mode === 'edit' ? 'Save changes' : mode === 'new' ? 'Create guided rule' : 'Append JSON rule'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return modal
  return createPortal(modal, document.body)
}
