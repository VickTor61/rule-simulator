import type { Edge, Node } from '@xyflow/react'

export type RuleSource = 'rayyan' | 'rules-engine'
export type NodeType = 'root' | 'alpha' | 'beta' | 'production'
export type TimelinePhase = 'build' | 'execute'
export type NodeDiffState = 'unchanged' | 'added' | 'removed' | 'changed'
export type TimelineEventType =
  | 'network-alpha-linked'
  | 'network-beta-linked'
  | 'network-production-linked'
  | 'fact-created'
  | 'working-memory-added'
  | 'root-dispatch'
  | 'root-skipped'
  | 'alpha-evaluated'
  | 'alpha-memory-added'
  | 'beta-activated'
  | 'beta-join-success'
  | 'beta-join-rejected'
  | 'production-activated'
  | 'simulation-complete'

export interface RuleAction {
  type: string
  priority?: string
  decision: string
  url?: string
}

export interface RuleCondition {
  reference?: number
  id?: string
  field: string
  operator: string
  value: unknown
  valueType?: string
  type?: string
  position?: number
  velocity?: boolean
  timeWindow?: string
  evaluationType?: 'match' | 'compare' | string
}

export interface RuleConditionGroup {
  id?: string
  operator: 'AND' | 'OR'
  position: number
  conditions: RuleCondition[]
}

export interface Rule {
  id: string
  name: string
  reference?: number
  organizationId: number
  description?: string
  category?: string
  primaryOperator: 'AND' | 'OR'
  status?: string
  version?: number
  conditions: RuleCondition[]
  conditionGroups?: RuleConditionGroup[]
  actions: RuleAction[]
  metadata?: Record<string, unknown>
}

export interface TransactionFact {
  id: string
  organizationId: number
  userId: string
  amount?: number
  count?: number
  amountSum?: number
  precision?: number
  currency?: string
  country?: string
  transactionType?: string
  channel?: string
  accountId?: string
  customerReferenceId?: string
  externalId?: string
  reference?: string
  description?: string
  ipAddress?: string
  deviceId?: string
  transactionAuthenticated?: boolean
  deviceRiskScore?: number
  trustedDevice?: boolean
  counterpartyName?: string
  counterpartyAccountNumber?: string
  counterpartyCountry?: string
  metadata?: Record<string, unknown>
  createdAt?: string
  transactionDate?: string
  status?: string
}

export interface UserProfileFact {
  transactionCount?: number
  overallRiskScore?: number
  avgTransactionAmount?: number
  maxTransactionAmount?: number
  velocityScore?: number
  geographicScore?: number
  behavioralScore?: number
  riskLevel?: string
  kycStatus?: string
  isVerified?: boolean
}

export interface Fact {
  id: string
  transaction: TransactionFact | null
  userProfile: UserProfileFact | null
  analysis: Record<string, unknown>
  timestamp: number
  source: string
  sentBy?: string
}

export interface ActivationFact extends Fact {
  source: 'activation'
}

export interface SimulationInput {
  ruleSource: RuleSource
  rules: unknown
  transaction: TransactionFact
  userProfile?: UserProfileFact | null
  analysisSeed?: Record<string, unknown>
}

export interface CanonicalRuleSet {
  source: RuleSource
  rules: Rule[]
}

export interface JoinCondition {
  leftField: string
  rightField: string
  operator: string
}

export interface MemorySnapshot {
  workingMemory: Fact[]
  alphaMemory: Record<string, Fact[]>
  betaMemory: Record<string, { left: Fact[]; right: Fact[] }>
  activations: ActivationFact[]
}

export interface TimelineEvent {
  index: number
  type: TimelineEventType
  phase: TimelinePhase
  nodeId?: string
  edgeId?: string
  ruleId?: string
  label: string
  detail: string
  factId?: string
  relatedFactIds?: string[]
  snapshot: MemorySnapshot
}

export interface ConditionEvaluation {
  condition: RuleCondition
  actualValue: unknown
  matched: boolean
  availability: 'available' | 'unavailable'
  unavailableReason?: string
}

export interface RuleEvaluationResult {
  rule: Rule
  matchedAt: string
  conditions: ConditionEvaluation[]
  actions: RuleAction[]
}

export interface SimulationResult {
  decision: string
  triggeredRules: RuleEvaluationResult[]
  reasons: string[]
  riskScore: number
  factId: string
}

export interface SimulationRun {
  input: SimulationInput
  fact: Fact
  timeline: TimelineEvent[]
  result: SimulationResult
  finalSnapshot: MemorySnapshot
}

export interface FlowNodeData {
  [key: string]: unknown
  label: string
  subtitle: string
  type: NodeType
  description: string
  ruleId?: string
  relatedRuleIds?: string[]
  signature?: string
  diffState?: NodeDiffState
  comparisonLabel?: string
  condition?: RuleCondition
  joinConditions?: JoinCondition[]
}

export interface CompiledNodeBase {
  id: string
  type: NodeType
  children: string[]
}

export interface RootCompiledNode extends CompiledNodeBase {
  type: 'root'
}

export interface AlphaCompiledNode extends CompiledNodeBase {
  type: 'alpha'
  condition: RuleCondition
  organizationId: number
  memoryKey: string
  relatedRuleIds: string[]
  signature: string
}

export interface BetaCompiledNode extends CompiledNodeBase {
  type: 'beta'
  leftAlphaId: string
  rightAlphaId: string
  joinConditions: JoinCondition[]
  memoryKey: string
  relatedRuleIds: string[]
  signature: string
}

export interface ProductionCompiledNode extends CompiledNodeBase {
  type: 'production'
  rule: Rule
  relatedRuleIds: string[]
  signature: string
}

export type CompiledNode =
  | RootCompiledNode
  | AlphaCompiledNode
  | BetaCompiledNode
  | ProductionCompiledNode

export interface CompiledNetwork {
  nodes: Record<string, CompiledNode>
  rootId: string
  alphaIndex: Record<string, string>
  betaIndex: Record<string, string>
  productionIndex: Record<string, string>
  flowNodes: Node<FlowNodeData>[]
  flowEdges: Edge[]
  canonicalRuleSet: CanonicalRuleSet
}

export interface SimulationSnapshot {
  event: TimelineEvent | null
  selectedNode: CompiledNode | null
  memory: MemorySnapshot
  result: SimulationResult
}

export interface RuleDiffSummary {
  addedRuleIds: string[]
  removedRuleIds: string[]
  modifiedRuleIds: string[]
  summaryLines: string[]
}

export interface CompiledNetworkDiff {
  baseline: CompiledNetwork
  candidate: CompiledNetwork
  diffStateByNodeId: Record<string, NodeDiffState>
  diffStateByEdgeId: Record<string, NodeDiffState>
  summary: RuleDiffSummary
}

export interface RayyanRuleConditionInput {
  id?: string
  position?: number
  field: string
  evaluation_type?: string
  operator: string
  value_type?: string
  value: unknown
  velocity?: boolean
  time_window?: string
}

export interface RayyanRuleGroupInput {
  id?: string
  operator?: 'AND' | 'OR'
  position?: number
  conditions?: RayyanRuleConditionInput[]
  rule_conditions?: RayyanRuleConditionInput[]
}

export interface RayyanRuleActionInput {
  type?: string
  action?: string
  decision: string
  priority?: string
  url?: string
}

export interface RayyanRuleInput {
  id?: string | number
  name: string
  description?: string
  status?: string
  primary_operator?: 'AND' | 'OR'
  rule_category?: string
  organization_id?: number
  reference?: number
  condition_groups?: RayyanRuleGroupInput[]
  conditions?: RayyanRuleConditionInput[]
  actions?: RayyanRuleActionInput[]
}

export interface RayyanRuleBundle {
  rules: RayyanRuleInput[]
}

export interface RulesEngineRuleBundle {
  rules: Array<Record<string, unknown>>
}
