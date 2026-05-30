import {
  normalizeActionType,
  normalizeOperator,
  toArray,
} from '../simulator/helpers'
import type {
  CanonicalRuleSet,
  RayyanRuleBundle,
  RayyanRuleConditionInput,
  RayyanRuleGroupInput,
  RayyanRuleInput,
  Rule,
  RuleAction,
  RuleCondition,
  RuleConditionGroup,
  RulesEngineRuleBundle,
  RuleSource,
  SimulationInput,
} from '../simulator/types'

function normalizeCondition(input: RayyanRuleConditionInput | Record<string, unknown>): RuleCondition {
  const raw = input as Record<string, unknown>
  return {
    id: String(raw.id ?? ''),
    reference: typeof raw.reference === 'number' ? raw.reference : undefined,
    field: String(raw.field ?? ''),
    operator: normalizeOperator(String(raw.operator ?? '==')),
    value: raw.value,
    valueType:
      typeof raw.value_type === 'string'
        ? raw.value_type
        : typeof raw.valueType === 'string'
          ? String(raw.valueType)
          : undefined,
    position:
      typeof raw.position === 'number'
        ? raw.position
        : typeof raw.position === 'string'
          ? Number(raw.position)
          : undefined,
    velocity:
      typeof raw.velocity === 'boolean'
        ? raw.velocity
        : Boolean(raw.time_window ?? raw.timeWindow),
    timeWindow:
      typeof raw.time_window === 'string'
        ? raw.time_window
        : typeof raw.timeWindow === 'string'
          ? String(raw.timeWindow)
          : undefined,
    evaluationType:
      typeof raw.evaluation_type === 'string'
        ? raw.evaluation_type
        : typeof raw.evaluationType === 'string'
          ? String(raw.evaluationType)
          : 'match',
  }
}

function normalizeAction(input: Record<string, unknown>): RuleAction {
  return {
    type: normalizeActionType(String(input.type ?? input.action ?? 'review')),
    decision: String(input.decision ?? 'allow').toLowerCase(),
    priority: typeof input.priority === 'string' ? input.priority : undefined,
    url: typeof input.url === 'string' ? input.url : undefined,
  }
}

function normalizeGroup(group: RayyanRuleGroupInput, fallbackConditions: RuleCondition[]): RuleConditionGroup {
  const conditions = toArray(group.conditions ?? group.rule_conditions).map(normalizeCondition)
  return {
    id: group.id,
    operator: group.operator ?? 'AND',
    position: group.position ?? 1,
    conditions: conditions.length > 0 ? conditions : fallbackConditions,
  }
}

function normalizeRayyanRule(rule: RayyanRuleInput, index: number): Rule {
  const flatConditions = toArray(rule.conditions).map(normalizeCondition)
  const groups = toArray(rule.condition_groups).map((group) =>
    normalizeGroup(group, flatConditions.length > 0 ? flatConditions : []),
  )

  const resolvedConditions =
    flatConditions.length > 0
      ? flatConditions
      : groups.flatMap((group) => group.conditions)

  return {
    id: String(rule.id ?? `rayyan-rule-${index + 1}`),
    name: rule.name,
    reference: rule.reference,
    organizationId: rule.organization_id ?? 1,
    description: rule.description,
    category: rule.rule_category,
    primaryOperator: rule.primary_operator ?? 'AND',
    status: rule.status ?? 'active',
    conditions: resolvedConditions,
    conditionGroups: groups.length > 0 ? groups : undefined,
    actions: toArray(rule.actions).map((action) =>
      normalizeAction(action as unknown as Record<string, unknown>),
    ),
    metadata: {
      authoredShape: groups.length > 0 ? 'grouped' : 'flat',
    },
  }
}

function normalizeRulesEngineRule(rule: Record<string, unknown>, index: number): Rule {
  return {
    id: String(rule.id ?? `rules-engine-rule-${index + 1}`),
    name: String(rule.name ?? `Rule ${index + 1}`),
    reference: typeof rule.reference === 'number' ? rule.reference : undefined,
    organizationId:
      typeof rule.organization_id === 'number'
        ? rule.organization_id
        : typeof rule.organizationId === 'number'
          ? rule.organizationId
          : 1,
    description: typeof rule.description === 'string' ? rule.description : undefined,
    category:
      typeof rule.category === 'string'
        ? rule.category
        : typeof rule.rule_category === 'string'
          ? rule.rule_category
          : undefined,
    primaryOperator:
      rule.primary_operator === 'OR' || rule.primaryOperator === 'OR' ? 'OR' : 'AND',
    status: typeof rule.status === 'string' ? rule.status : 'active',
    version: typeof rule.version === 'number' ? rule.version : undefined,
    conditions: toArray(rule.conditions as RuleCondition[]).map((condition) =>
      normalizeCondition(condition as unknown as Record<string, unknown>),
    ),
    actions: toArray(rule.actions as RuleAction[]).map((action) =>
      normalizeAction(action as unknown as Record<string, unknown>),
    ),
    metadata:
      typeof rule.metadata === 'object' && rule.metadata !== null
        ? (rule.metadata as Record<string, unknown>)
        : undefined,
  }
}

export function normalizeRuleInput(input: SimulationInput): CanonicalRuleSet {
  const source: RuleSource = input.ruleSource
  if (source === 'rayyan') {
    const bundle = input.rules as RayyanRuleBundle
    return {
      source,
      rules: bundle.rules.map(normalizeRayyanRule),
    }
  }

  const bundle = input.rules as RulesEngineRuleBundle
  return {
    source,
    rules: bundle.rules.map(normalizeRulesEngineRule),
  }
}

export function parseJson<T>(value: string): T {
  return JSON.parse(value) as T
}
