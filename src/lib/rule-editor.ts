import { isRuleLiveInNetwork, normalizeRuleStatus } from './rule-status'
import { getConditionKey, normalizeOperator } from './simulator/helpers'
import type { Rule } from './simulator/types'
import type { RuleSource } from './simulator/types'

export type EditableCondition = {
  field: string
  operator: string
  value: string
  originalValue: unknown
}

export type RuleDraft = {
  id: string
  organizationId: number
  name: string
  description: string
  status: string
  primaryOperator: 'AND' | 'OR'
  actionType: string
  actionDecision: string
  conditions: EditableCondition[]
}

export type RuleImpactPreview = {
  compileState: 'live' | 'draft-only' | 'disabled'
  alphaNodeCount: number
  createdAlphaCount: number
  reusedAlphaCount: number
  betaJoinCount: number
  productionNodeCount: number
  reusedAlphaLabels: string[]
  createdAlphaLabels: string[]
  betaJoinLabels: string[]
  affectedRuleNames: string[]
}

function formatConditionLabel(condition: Pick<EditableCondition, 'field' | 'operator' | 'value'>): string {
  return `${condition.field} ${normalizeOperator(condition.operator)} ${String(condition.value)}`
}

function buildDefaultCondition(source: RuleSource): EditableCondition {
  return {
    field: source === 'rayyan' ? 'transaction.amount' : 'amount',
    operator: source === 'rayyan' ? 'gt' : '>',
    value: '1000',
    originalValue: 1000,
  }
}

export function buildRuleDraft(rule: Rule | null): RuleDraft | null {
  if (!rule) return null
  return {
    id: rule.id,
    organizationId: rule.organizationId,
    name: rule.name,
    description: rule.description ?? '',
    status: rule.status ?? 'active',
    primaryOperator: rule.primaryOperator,
    actionType: rule.actions[0]?.type ?? 'review',
    actionDecision: rule.actions[0]?.decision ?? 'review',
    conditions: rule.conditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: String(condition.value ?? ''),
      originalValue: condition.value,
    })),
  }
}

export function buildNewRuleDraft(source: RuleSource, ruleCount: number, organizationId = 1): RuleDraft {
  const nextIndex = ruleCount + 1
  return {
    id: source === 'rayyan' ? `rayyan-draft-${nextIndex}` : `rules-engine-draft-${nextIndex}`,
    organizationId,
    name: `Draft Rule ${nextIndex}`,
    description: '',
    status: 'draft',
    primaryOperator: 'AND',
    actionType: 'review',
    actionDecision: 'review',
    conditions: [buildDefaultCondition(source)],
  }
}

export function validateRuleDraft(draft: RuleDraft | null): string | null {
  if (!draft) return 'Select a rule to edit.'
  if (!Number.isFinite(draft.organizationId) || draft.organizationId <= 0) return 'Organization ID must be greater than 0.'
  if (!draft.name.trim()) return 'Rule name is required.'
  if (draft.conditions.length === 0) return 'At least one condition is required.'
  for (const condition of draft.conditions) {
    if (!condition.field.trim()) return 'Each condition needs a field.'
    if (!condition.operator.trim()) return 'Each condition needs an operator.'
    if (!condition.value.trim()) return 'Each condition needs a value.'
  }
  return null
}

export function createBlankEditableCondition(source: RuleSource): EditableCondition {
  return buildDefaultCondition(source)
}

export function buildRuleImpactPreview(
  draft: RuleDraft | null,
  rules: Rule[],
  editingRuleId: string | null,
): RuleImpactPreview | null {
  if (!draft) return null

  const uniqueDraftConditionKeys = Array.from(
    new Set(
      draft.conditions.map((condition) =>
        getConditionKey({
          field: condition.field,
          operator: condition.operator,
          value: condition.value,
        }),
      ),
    ),
  )
  const uniqueDraftConditions = draft.conditions.filter((condition, index, collection) => {
    const conditionKey = getConditionKey({
      field: condition.field,
      operator: condition.operator,
      value: condition.value,
    })
    return index === collection.findIndex((candidate) => getConditionKey({
      field: candidate.field,
      operator: candidate.operator,
      value: candidate.value,
    }) === conditionKey)
  })

  const reusableRules = rules
      .filter(
        (rule) =>
          rule.id !== editingRuleId
          && rule.organizationId === draft.organizationId
          && isRuleLiveInNetwork(rule.status),
      )
  const reusableConditionKeys = new Set(
    reusableRules.flatMap((rule) => rule.conditions.map((condition) => getConditionKey(condition))),
  )

  const reusedAlphaCount = uniqueDraftConditionKeys.filter((key) => reusableConditionKeys.has(key)).length
  const alphaNodeCount = uniqueDraftConditionKeys.length
  const createdAlphaCount = Math.max(0, alphaNodeCount - reusedAlphaCount)
  const betaJoinCount = draft.primaryOperator === 'AND' ? Math.max(0, draft.conditions.length - 1) : 0
  const normalizedStatus = normalizeRuleStatus(draft.status)
  const compileState = normalizedStatus === 'active'
    ? 'live'
    : normalizedStatus === 'draft'
      ? 'draft-only'
      : 'disabled'
  const reusedAlphaLabels = uniqueDraftConditions
    .filter((condition) => reusableConditionKeys.has(getConditionKey({
      field: condition.field,
      operator: condition.operator,
      value: condition.value,
    })))
    .map(formatConditionLabel)
  const createdAlphaLabels = uniqueDraftConditions
    .filter((condition) => !reusableConditionKeys.has(getConditionKey({
      field: condition.field,
      operator: condition.operator,
      value: condition.value,
    })))
    .map(formatConditionLabel)
  const betaJoinLabels = draft.primaryOperator === 'AND'
    ? draft.conditions.slice(1).map((condition, index) => {
        const left = index === 0
          ? formatConditionLabel(draft.conditions[0] ?? condition)
          : `join ${index}`
        return `${left} × ${formatConditionLabel(condition)}`
      })
    : []
  const affectedRuleNames = Array.from(new Set(reusableRules
    .filter((rule) => rule.conditions.some((condition) => uniqueDraftConditionKeys.includes(getConditionKey(condition))))
    .map((rule) => rule.name)))

  return {
    compileState,
    alphaNodeCount,
    createdAlphaCount,
    reusedAlphaCount,
    betaJoinCount,
    productionNodeCount: 1,
    reusedAlphaLabels,
    createdAlphaLabels,
    betaJoinLabels,
    affectedRuleNames,
  }
}

function coerceDraftValue(value: string, originalValue: unknown): unknown {
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

function normalizeOperatorForSource(operator: string, source: RuleSource): string {
  if (source !== 'rayyan') return operator
  switch (operator) {
    case '>=':
      return 'gte'
    case '<=':
      return 'lte'
    case '==':
      return 'eq'
    case '!=':
      return 'ne'
    case '>':
      return 'gt'
    case '<':
      return 'lt'
    default:
      return operator
  }
}

export function upsertRuleInBundle(
  rulesText: string,
  source: RuleSource,
  draft: RuleDraft,
): string {
  const parsed = JSON.parse(rulesText) as { rules?: Array<Record<string, unknown>> }
  const rules = Array.isArray(parsed.rules) ? [...parsed.rules] : []
  const ruleIndex = rules.findIndex((rule) => String(rule.id ?? '') === draft.id)

  const nextConditions = draft.conditions.map((condition, index) => {
    const baseRule = ruleIndex >= 0 ? rules[ruleIndex] : undefined
    const current = baseRule && Array.isArray(baseRule.conditions)
      ? (baseRule.conditions[index] as Record<string, unknown> | undefined)
      : undefined
    const coercedValue = coerceDraftValue(condition.value, condition.originalValue)

    return {
      ...(current ?? {}),
      field: condition.field,
      operator: normalizeOperatorForSource(condition.operator, source),
      value: coercedValue,
      position: index + 1,
      ...(source === 'rayyan'
        ? { value_type: typeof coercedValue === 'number' ? 'number' : 'string' }
        : {}),
    }
  })

  const existingRule = ruleIndex >= 0 ? rules[ruleIndex] : undefined
  const nextRule: Record<string, unknown> = {
    ...(existingRule ?? {}),
    id: draft.id,
    organization_id: draft.organizationId,
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    status: draft.status,
  }

  if (source === 'rayyan') {
    nextRule.primary_operator = draft.primaryOperator
    nextRule.rule_category = existingRule?.rule_category ?? 'transaction'
    nextRule.conditions = nextConditions
    nextRule.condition_groups = [
      {
        id:
          Array.isArray(existingRule?.condition_groups)
          && existingRule?.condition_groups[0]
          && typeof existingRule.condition_groups[0] === 'object'
            ? (existingRule.condition_groups[0] as Record<string, unknown>).id
            : undefined,
        position: 1,
        operator: draft.primaryOperator,
        conditions: nextConditions,
      },
    ]
    nextRule.actions = [
      {
        ...(Array.isArray(existingRule?.actions) && existingRule?.actions[0] && typeof existingRule.actions[0] === 'object'
          ? (existingRule.actions[0] as Record<string, unknown>)
          : {}),
        type: draft.actionType,
        decision: draft.actionDecision,
      },
    ]
  } else {
    nextRule.primary_operator = draft.primaryOperator
    nextRule.conditions = nextConditions
    nextRule.actions = [
      {
        ...(Array.isArray(existingRule?.actions) && existingRule?.actions[0] && typeof existingRule.actions[0] === 'object'
          ? (existingRule.actions[0] as Record<string, unknown>)
          : {}),
        type: draft.actionType,
        decision: draft.actionDecision,
      },
    ]
  }

  if (ruleIndex >= 0) {
    rules[ruleIndex] = nextRule
  } else {
    rules.push(nextRule)
  }

  return JSON.stringify({ ...parsed, rules }, null, 2)
}

export function appendRuleObjectToBundle(
  rulesText: string,
  source: RuleSource,
  inputRule: Record<string, unknown>,
): { rulesText: string; ruleId: string } {
  const parsed = JSON.parse(rulesText) as { rules?: Array<Record<string, unknown>> }
  const rules = Array.isArray(parsed.rules) ? [...parsed.rules] : []
  const nextId = String(
    inputRule.id
      ?? (source === 'rayyan' ? `rayyan-json-${rules.length + 1}` : `rules-engine-json-${rules.length + 1}`),
  )
  const nextRule = {
    ...inputRule,
    id: nextId,
  }

  return {
    rulesText: JSON.stringify({ ...parsed, rules: [...rules, nextRule] }, null, 2),
    ruleId: nextId,
  }
}

export function removeRuleFromBundle(
  rulesText: string,
  ruleId: string,
): { rulesText: string; removed: boolean } {
  const parsed = JSON.parse(rulesText) as { rules?: Array<Record<string, unknown>> }
  const rules = Array.isArray(parsed.rules) ? [...parsed.rules] : []
  const nextRules = rules.filter((rule) => String(rule.id ?? '') !== ruleId)

  return {
    rulesText: JSON.stringify({ ...parsed, rules: nextRules }, null, 2),
    removed: nextRules.length !== rules.length,
  }
}
