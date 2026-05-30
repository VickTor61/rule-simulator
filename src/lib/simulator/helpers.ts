import type {
  ActivationFact,
  ConditionEvaluation,
  Fact,
  MemorySnapshot,
  Rule,
  RuleAction,
  RuleCondition,
  TimelineEvent,
  TransactionFact,
  UserProfileFact,
} from './types'

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null) return []
  return [value]
}

export function normalizeOperator(operator: string | undefined): string {
  const input = (operator ?? '').trim().toLowerCase()
  const map: Record<string, string> = {
    eq: '==',
    ne: '!=',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    '=': '=',
    '==': '==',
    '!=': '!=',
    '>': '>',
    '>=': '>=',
    '<': '<',
    '<=': '<=',
    in: 'in',
  }
  return map[input] ?? operator ?? '=='
}

export function normalizeDecision(decision: string | undefined): string {
  return (decision ?? 'allow').toLowerCase()
}

export function normalizeActionType(type: string | undefined): string {
  return (type ?? 'review').toLowerCase()
}

export function coerceNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function compareValues(left: unknown, right: unknown, operator: string): boolean {
  switch (normalizeOperator(operator)) {
    case '=':
    case '==':
      return left === right
    case '!=':
      return left !== right
    case '>':
      return coerceNumber(left) > coerceNumber(right)
    case '>=':
      return coerceNumber(left) >= coerceNumber(right)
    case '<':
      return coerceNumber(left) < coerceNumber(right)
    case '<=':
      return coerceNumber(left) <= coerceNumber(right)
    case 'in':
      return Array.isArray(right) && right.includes(left)
    default:
      return false
  }
}

function createUnavailableEvaluation(
  condition: RuleCondition,
  actualValue: unknown,
  unavailableReason: string,
): ConditionEvaluation {
  return {
    condition,
    actualValue,
    matched: false,
    availability: 'unavailable',
    unavailableReason,
  }
}

function parseDateValue(value: string | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function buildAnalysis(
  transaction: TransactionFact,
  profile: UserProfileFact | null | undefined,
  analysisSeed: Record<string, unknown> = {},
): Record<string, unknown> {
  const createdAt = parseDateValue(transaction.createdAt)
  const hour = createdAt?.getUTCHours() ?? 0
  const weekday = createdAt?.getUTCDay() ?? 0
  const base: Record<string, unknown> = {
    is_round_amount: ((transaction.amount ?? 0) as number) % 1000 === 0,
    is_weekend: weekday === 0 || weekday === 6,
    hour,
    ...analysisSeed,
  }

  if (profile?.avgTransactionAmount && transaction.amount !== undefined) {
    const deviation = transaction.amount / profile.avgTransactionAmount
    base.amount_deviation = deviation
    base.is_unusual_amount = deviation > 3 || deviation < 0.1
  }

  if (transaction.count !== undefined) {
    base.velocity_count_1_hour = transaction.count
  }

  if (transaction.amountSum !== undefined) {
    base.velocity_total_amount_1_hour = transaction.amountSum
  }

  return base
}

export function createFact(
  transaction: TransactionFact,
  userProfile: UserProfileFact | null | undefined,
  analysisSeed: Record<string, unknown> = {},
): Fact {
  return {
    id: `${transaction.id}_${Date.now()}`,
    transaction,
    userProfile: userProfile ?? null,
    analysis: buildAnalysis(transaction, userProfile, analysisSeed),
    timestamp: Date.now(),
    source: 'transaction',
  }
}

function normalizeFieldPath(field: string): string {
  return field.replace(/^(transaction|customer|user)\./, '')
}

function getDateParts(transaction: TransactionFact | null): { hour: number; weekday: number; isWeekend: boolean } {
  const date = parseDateValue(transaction?.createdAt)
  const hour = date?.getUTCHours() ?? 0
  const weekday = date?.getUTCDay() ?? 0
  return { hour, weekday, isWeekend: weekday === 0 || weekday === 6 }
}

export function extractValue(fact: Fact, field: string): unknown {
  const normalized = normalizeFieldPath(field)
  const transaction = fact.transaction
  const profile = fact.userProfile
  const { hour, weekday, isWeekend } = getDateParts(transaction)

  const txMap: Record<string, unknown> = {
    amount: transaction?.amount,
    count: transaction?.count,
    amount_sum: transaction?.amountSum,
    precision: transaction?.precision,
    currency: transaction?.currency,
    country: transaction?.country,
    transaction_type: transaction?.transactionType,
    channel: transaction?.channel,
    account_id: transaction?.accountId,
    description: transaction?.description,
    ip_address: transaction?.ipAddress,
    device_id: transaction?.deviceId,
    transaction_authenticated: transaction?.transactionAuthenticated,
    device_risk_score: transaction?.deviceRiskScore,
    trusted_device: transaction?.trustedDevice,
    counterparty_name: transaction?.counterpartyName,
    counterparty_account_number: transaction?.counterpartyAccountNumber,
    counterparty_country: transaction?.counterpartyCountry,
    metadata: transaction?.metadata,
    customer_reference_id: transaction?.customerReferenceId,
    user_id: transaction?.userId,
    transaction_reference: transaction?.reference,
    external_id: transaction?.externalId,
    reference: transaction?.reference,
    hour,
    weekday,
    is_weekend: isWeekend,
  }

  if (normalized in txMap) return txMap[normalized]

  const profileMap: Record<string, unknown> = {
    transaction_count: profile?.transactionCount,
    overall_risk_score: profile?.overallRiskScore,
    avg_transaction_amount: profile?.avgTransactionAmount,
    max_transaction_amount: profile?.maxTransactionAmount,
    velocity_score: profile?.velocityScore,
    geographic_score: profile?.geographicScore,
    behavioral_score: profile?.behavioralScore,
    risk_level: profile?.riskLevel,
    kyc_status: profile?.kycStatus,
    is_verified: profile?.isVerified,
  }

  if (normalized in profileMap) return profileMap[normalized]

  if (normalized === 'transaction.amount_sum') {
    return fact.analysis[`velocity_total_amount_${inferTimeWindow(field)}`]
  }

  if (normalized === 'transaction.count') {
    return fact.analysis[`velocity_count_${inferTimeWindow(field)}`]
  }

  if (normalized in fact.analysis) return fact.analysis[normalized]

  return fact.analysis[field]
}

function inferTimeWindow(field: string): string {
  const match = field.match(/\(([^)]+)\)$/)
  return match?.[1] ?? ''
}

export function evaluateConditionDetailed(condition: RuleCondition, fact: Fact): ConditionEvaluation {
  const actualValue = extractValue(fact, condition.field)
  const evaluationType = condition.evaluationType ?? 'match'

  let expectedValue = condition.value

  if (condition.velocity && condition.timeWindow) {
    if (actualValue === undefined) {
      return createUnavailableEvaluation(
        condition,
        actualValue,
        `the input fact does not define ${condition.field}`,
      )
    }

    const velocityField =
      condition.field === 'transaction.amount_sum'
        ? `velocity_total_amount_${condition.timeWindow}`
        : `velocity_count_${condition.timeWindow}`
    const velocityActualValue = fact.analysis[velocityField]
    if (velocityActualValue === undefined) {
      return createUnavailableEvaluation(
        condition,
        velocityActualValue,
        `the analysis bundle does not define ${velocityField}`,
      )
    }

    expectedValue = condition.value
    return {
      condition,
      actualValue: velocityActualValue,
      matched: compareValues(velocityActualValue, expectedValue, condition.operator),
      availability: 'available',
    }
  }

  if (actualValue === undefined) {
    return createUnavailableEvaluation(
      condition,
      actualValue,
      `the input fact does not define ${condition.field}`,
    )
  }

  if (evaluationType === 'compare' && typeof condition.value === 'string') {
    expectedValue = extractValue(fact, condition.value)
    if (expectedValue === undefined) {
      return createUnavailableEvaluation(
        condition,
        actualValue,
        `the input fact does not define ${condition.value}`,
      )
    }
  }

  return {
    condition,
    actualValue,
    matched: compareValues(actualValue, expectedValue, condition.operator),
    availability: 'available',
  }
}

export function getConditionKey(condition: RuleCondition): string {
  return [
    condition.field,
    normalizeOperator(condition.operator),
    JSON.stringify(condition.value),
    condition.velocity ? 'vel:1' : 'vel:0',
    condition.timeWindow ?? '',
  ].join('|')
}

export function getJoinKey(): string {
  return 'user_id_= _user_id'.replace(' ', '')
}

export function createEmptySnapshot(): MemorySnapshot {
  return {
    workingMemory: [],
    alphaMemory: {},
    betaMemory: {},
    activations: [],
  }
}

export function cloneSnapshot(snapshot: MemorySnapshot): MemorySnapshot {
  return deepClone(snapshot)
}

export function buildReasons(results: Array<{ rule: Rule; conditions: ConditionEvaluation[] }>): string[] {
  if (results.length === 0) return ['No rules triggered']
  return results.map(({ rule, conditions }) => {
    const matched = conditions
      .filter((condition) => condition.matched)
      .map(
        (condition) =>
          `${condition.condition.field} ${normalizeOperator(condition.condition.operator)} ${String(condition.condition.value)} (actual: ${String(condition.actualValue)})`,
      )
    return matched.length > 0 ? `${rule.name}: ${matched.join(', ')}` : rule.name
  })
}

export function calculateDecision(actions: RuleAction[], transaction: TransactionFact): string {
  const status = (transaction.status ?? '').toLowerCase()
  if (status === 'blocked') return 'block'
  if (status === 'reviewing') return 'review'
  if (status === 'approved') return 'approve'

  const normalized = actions.map((action) => normalizeDecision(action.decision))
  if (normalized.includes('block')) return 'block'
  if (normalized.includes('review')) return 'review'
  return 'allow'
}

export function buildProductionReasons(rule: Rule): string[] {
  return rule.conditions.map(
    (condition) =>
      `${condition.field} ${normalizeOperator(condition.operator)} ${String(condition.value)}`,
  )
}

export function createActivationFact(rule: Rule, fact: Fact): ActivationFact {
  return {
    id: `activation_${rule.id}_${fact.id}`,
    transaction: fact.transaction,
    userProfile: fact.userProfile,
    analysis: {
      rule_activated: true,
      rule_id: rule.id,
      rule_reference: rule.reference,
      rule_name: rule.name,
      rule_org_id: rule.organizationId,
      actions: deepClone(rule.actions),
      reasons: buildProductionReasons(rule),
    },
    timestamp: fact.timestamp,
    source: 'activation',
  }
}

export function pushTimelineEvent(
  timeline: TimelineEvent[],
  event: Omit<TimelineEvent, 'index'>,
): void {
  timeline.push({
    ...event,
    index: timeline.length,
  })
}
