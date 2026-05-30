import { isRuleLiveInNetwork } from '../rule-status'
import {
  calculateDecision,
  cloneSnapshot,
  createActivationFact,
  createEmptySnapshot,
  createFact,
  deepClone,
  evaluateConditionDetailed,
  extractValue,
  pushTimelineEvent,
  buildReasons,
  normalizeOperator,
  getConditionKey,
} from './helpers'
import type {
  ActivationFact,
  AlphaCompiledNode,
  BetaCompiledNode,
  CompiledNetwork,
  CompiledNode,
  Fact,
  MemorySnapshot,
  ProductionCompiledNode,
  Rule,
  RuleEvaluationResult,
  SimulationInput,
  SimulationRun,
  SimulationSnapshot,
} from './types'

function getAlphaKey(rule: Rule, condition: Rule['conditions'][number]): string {
  return `org_${rule.organizationId}_${getConditionKey(condition)}`
}

function getBetaKey(rule: Rule, position: number, joinConditions: BetaCompiledNode['joinConditions']): string {
  return `org_${rule.organizationId}_rule_${rule.id}_pos_${position}_${joinConditions
    .map((condition) => `${condition.leftField}_${condition.operator}_${condition.rightField}`)
    .join('_')}`
}

function ensureAlphaBucket(snapshot: MemorySnapshot, node: AlphaCompiledNode): Fact[] {
  snapshot.alphaMemory[node.id] ??= []
  return snapshot.alphaMemory[node.id]
}

function ensureBetaBucket(snapshot: MemorySnapshot, node: BetaCompiledNode): { left: Fact[]; right: Fact[] } {
  snapshot.betaMemory[node.id] ??= { left: [], right: [] }
  return snapshot.betaMemory[node.id]
}

function evaluateJoin(node: BetaCompiledNode, left: Fact, right: Fact): boolean {
  if (left.transaction?.organizationId !== right.transaction?.organizationId) return false
  if (left.transaction?.id !== right.transaction?.id) return false
  return node.joinConditions.every((condition) => {
    const leftValue = extractValue(left, condition.leftField)
    const rightValue = extractValue(right, condition.rightField)
    return normalizeOperator(condition.operator) === '=' ? leftValue === rightValue : false
  })
}

function createJoinedFact(left: Fact, right: Fact): Fact {
  return {
    id: `${left.id}_${right.id}`,
    transaction: left.transaction,
    userProfile: left.userProfile,
    analysis: {
      ...deepClone(left.analysis),
      ...deepClone(right.analysis),
    },
    timestamp: left.timestamp,
    source: 'joined',
  }
}

function buildEvaluationResults(fact: Fact, rules: Rule[]): RuleEvaluationResult[] {
  return rules.map((rule) => {
    const conditions = rule.conditions.map((condition) => evaluateConditionDetailed(condition, fact))
    return {
      rule,
      matchedAt: new Date().toISOString(),
      conditions,
      actions: deepClone(rule.actions),
    }
  })
}

function buildSimulationResult(
  fact: Fact,
  triggeredRules: Rule[],
  evaluations: RuleEvaluationResult[],
): SimulationRun['result'] {
  const actions = triggeredRules.flatMap((rule) => rule.actions)
  return {
    decision: calculateDecision(actions, fact.transaction!),
    triggeredRules: evaluations,
    reasons: buildReasons(evaluations.map((evaluation) => ({ rule: evaluation.rule, conditions: evaluation.conditions }))),
    riskScore: fact.userProfile?.overallRiskScore ?? 0,
    factId: fact.id,
  }
}

function pushCompilationReplay(
  network: CompiledNetwork,
  timeline: SimulationRun['timeline'],
  snapshot: MemorySnapshot,
): void {
  const joinConditions: BetaCompiledNode['joinConditions'] = [{ leftField: 'user_id', rightField: 'user_id', operator: '=' }]
  const seenAlphaNodes = new Set<string>()

  for (const rule of network.canonicalRuleSet.rules.filter((candidate) => isRuleLiveInNetwork(candidate.status))) {
    const productionNodeId = network.productionIndex[rule.id]
    const sortedConditions = [...rule.conditions].sort(
      (left, right) => (left.position ?? 0) - (right.position ?? 0),
    )

    const alphaNodeIds = sortedConditions.map((condition) => {
      const alphaKey = getAlphaKey(rule, condition)
      return network.alphaIndex[alphaKey]
    })

    alphaNodeIds.forEach((alphaNodeId, index) => {
      const alphaNode = network.nodes[alphaNodeId] as AlphaCompiledNode | undefined
      const condition = sortedConditions[index]
      if (!alphaNode || !condition) return

      pushTimelineEvent(timeline, {
        type: 'network-alpha-linked',
        phase: 'build',
        nodeId: alphaNode.id,
        edgeId: `root->${alphaNode.id}`,
        ruleId: rule.id,
        label: `Alpha node ${alphaNode.id} positioned`,
        detail: seenAlphaNodes.has(alphaNode.id)
          ? `${rule.name} reuses ${alphaNode.id} for ${condition.field} ${normalizeOperator(condition.operator)} ${String(condition.value)}, showing how matching conditions share alpha filters.`
          : `${rule.name} maps ${condition.field} ${normalizeOperator(condition.operator)} ${String(condition.value)} into ${alphaNode.id}, creating the alpha filter branch under root for org ${rule.organizationId}.`,
        snapshot: cloneSnapshot(snapshot),
      })
      seenAlphaNodes.add(alphaNode.id)
    })

    if (sortedConditions.length === 1 || rule.primaryOperator === 'OR') {
      alphaNodeIds.forEach((alphaNodeId) => {
        pushTimelineEvent(timeline, {
          type: 'network-production-linked',
          phase: 'build',
          nodeId: productionNodeId,
          edgeId: `${alphaNodeId}->${productionNodeId}`,
          ruleId: rule.id,
          label: `Production node ${productionNodeId} attached`,
          detail:
            sortedConditions.length === 1
              ? `${rule.name} ends directly at production from ${alphaNodeId} because the rule only needs one alpha filter.`
              : `${rule.name} keeps ${alphaNodeId} as an independent OR branch that feeds straight into the production terminal.`,
          snapshot: cloneSnapshot(snapshot),
        })
      })
      continue
    }

    for (let index = 0; index < alphaNodeIds.length - 1; index += 1) {
      const betaKey = getBetaKey(rule, index, joinConditions)
      const betaNodeId = network.betaIndex[betaKey]
      const leftNodeId = index === 0 ? alphaNodeIds[0] : network.betaIndex[getBetaKey(rule, index - 1, joinConditions)]
      const rightNodeId = alphaNodeIds[index + 1]
      const leftNode = network.nodes[leftNodeId]
      const rightNode = network.nodes[rightNodeId]

      if (!betaNodeId || !leftNode || !rightNode) continue

      pushTimelineEvent(timeline, {
        type: 'network-beta-linked',
        phase: 'build',
        nodeId: betaNodeId,
        edgeId: `${leftNode.id}->${betaNodeId}`,
        ruleId: rule.id,
        label: `Beta node ${betaNodeId} links left branch`,
        detail: `${rule.name} feeds ${leftNode.id} into ${betaNodeId} as the left side of the AND-chain join.`,
        snapshot: cloneSnapshot(snapshot),
      })

      pushTimelineEvent(timeline, {
        type: 'network-beta-linked',
        phase: 'build',
        nodeId: betaNodeId,
        edgeId: `${rightNode.id}->${betaNodeId}`,
        ruleId: rule.id,
        label: `Beta node ${betaNodeId} links right branch`,
        detail: `${rule.name} feeds ${rightNode.id} into ${betaNodeId} as the right side. The beta node joins both branches on user_id equality.`,
        snapshot: cloneSnapshot(snapshot),
      })
    }

    const finalParentId = alphaNodeIds.length > 1 ? network.betaIndex[getBetaKey(rule, alphaNodeIds.length - 2, joinConditions)] : alphaNodeIds[0]
    pushTimelineEvent(timeline, {
      type: 'network-production-linked',
      phase: 'build',
      nodeId: productionNodeId,
      edgeId: `${finalParentId}->${productionNodeId}`,
      ruleId: rule.id,
      label: `Production node ${productionNodeId} attached`,
      detail: `${rule.name} terminates at production after the beta chain succeeds, where the engine emits the activation fact.`,
      snapshot: cloneSnapshot(snapshot),
    })
  }
}

function processNode(
  network: CompiledNetwork,
  nodeId: string,
  fact: Fact,
  snapshot: MemorySnapshot,
  timeline: SimulationRun['timeline'],
  activations: ActivationFact[],
): void {
  const node = network.nodes[nodeId]
  if (!node) return

  if (node.type === 'alpha') {
    const evaluation = evaluateConditionDetailed(node.condition, fact)
    pushTimelineEvent(timeline, {
      type: 'alpha-evaluated',
      phase: 'execute',
      nodeId: node.id,
      edgeId: fact.sentBy ? `${fact.sentBy}->${node.id}` : undefined,
      ruleId: node.relatedRuleIds[0],
      label: `${node.condition.field} evaluated`,
      detail: evaluation.availability === 'unavailable'
        ? `Condition could not run because ${evaluation.unavailableReason}.`
        : evaluation.matched
          ? `Condition passed with actual value ${String(evaluation.actualValue)}`
          : `Condition failed with actual value ${String(evaluation.actualValue)}`,
      factId: fact.id,
      snapshot: cloneSnapshot(snapshot),
    })
    if (!evaluation.matched) return

    const alphaBucket = ensureAlphaBucket(snapshot, node)
    alphaBucket.push(deepClone(fact))
    pushTimelineEvent(timeline, {
      type: 'alpha-memory-added',
      phase: 'execute',
      nodeId: node.id,
      edgeId: fact.sentBy ? `${fact.sentBy}->${node.id}` : undefined,
      ruleId: node.relatedRuleIds[0],
      label: `${node.condition.field} stored fact`,
      detail: `Alpha memory now holds ${alphaBucket.length} fact(s)`,
      factId: fact.id,
      snapshot: cloneSnapshot(snapshot),
    })

    for (const childId of node.children) {
      processNode(network, childId, { ...deepClone(fact), sentBy: node.id }, snapshot, timeline, activations)
    }
    return
  }

  if (node.type === 'beta') {
    const betaBucket = ensureBetaBucket(snapshot, node)
    const isLeft = fact.sentBy === node.leftAlphaId || fact.sentBy !== node.rightAlphaId
    const side = isLeft ? betaBucket.left : betaBucket.right
    side.push(deepClone(fact))

    pushTimelineEvent(timeline, {
      type: 'beta-activated',
      phase: 'execute',
      nodeId: node.id,
      edgeId: fact.sentBy ? `${fact.sentBy}->${node.id}` : undefined,
      ruleId: node.relatedRuleIds[0],
      label: `Beta ${isLeft ? 'left' : 'right'} activation`,
      detail: `${isLeft ? 'Left' : 'Right'} memory now holds ${side.length} fact(s)`,
      factId: fact.id,
      snapshot: cloneSnapshot(snapshot),
    })

    const opposite = isLeft ? betaBucket.right : betaBucket.left
    for (const candidate of opposite) {
      const left = isLeft ? fact : candidate
      const right = isLeft ? candidate : fact
      if (!evaluateJoin(node, left, right)) {
        pushTimelineEvent(timeline, {
          type: 'beta-join-rejected',
          phase: 'execute',
          nodeId: node.id,
          edgeId: fact.sentBy ? `${fact.sentBy}->${node.id}` : undefined,
          ruleId: node.relatedRuleIds[0],
          label: 'Beta join rejected',
          detail: 'Join failed because org, transaction, or user_id alignment did not match',
          factId: fact.id,
          relatedFactIds: [left.id, right.id],
          snapshot: cloneSnapshot(snapshot),
        })
        continue
      }

      const joined = createJoinedFact(left, right)
      pushTimelineEvent(timeline, {
        type: 'beta-join-success',
        phase: 'execute',
        nodeId: node.id,
        edgeId: fact.sentBy ? `${fact.sentBy}->${node.id}` : undefined,
        ruleId: node.relatedRuleIds[0],
        label: 'Beta join succeeded',
        detail: `Joined ${left.id} with ${right.id} into ${joined.id}`,
        factId: joined.id,
        relatedFactIds: [left.id, right.id],
        snapshot: cloneSnapshot(snapshot),
      })

      for (const childId of node.children) {
        processNode(network, childId, joined, snapshot, timeline, activations)
      }
    }
    return
  }

  if (node.type === 'production') {
    const activation = createActivationFact(node.rule, fact)
    snapshot.activations.push(deepClone(activation))
    activations.push(activation)
    pushTimelineEvent(timeline, {
      type: 'production-activated',
      phase: 'execute',
      nodeId: node.id,
      edgeId: fact.sentBy ? `${fact.sentBy}->${node.id}` : undefined,
      ruleId: node.rule.id,
      label: `${node.rule.name} activated`,
      detail: `Production node emitted activation fact ${activation.id}`,
      factId: activation.id,
      snapshot: cloneSnapshot(snapshot),
    })
  }
}

export function simulateFact(network: CompiledNetwork, input: SimulationInput): SimulationRun {
  const fact = createFact(input.transaction, input.userProfile, input.analysisSeed)
  const snapshot = createEmptySnapshot()
  const timeline: SimulationRun['timeline'] = []
  const activations: ActivationFact[] = []

  pushCompilationReplay(network, timeline, snapshot)

  pushTimelineEvent(timeline, {
    type: 'fact-created',
    phase: 'execute',
    label: 'Fact created',
    detail: `Transaction fact ${fact.id} created from ${input.transaction.id}`,
    factId: fact.id,
    snapshot: cloneSnapshot(snapshot),
  })

  snapshot.workingMemory.push(deepClone(fact))
  pushTimelineEvent(timeline, {
    type: 'working-memory-added',
    phase: 'execute',
    label: 'Working memory updated',
    detail: `Working memory now holds ${snapshot.workingMemory.length} fact`,
    factId: fact.id,
    snapshot: cloneSnapshot(snapshot),
  })

  const root = network.nodes[network.rootId]
  if (root.type !== 'root') throw new Error('compiled network root is invalid')

  for (const childId of root.children) {
    const child = network.nodes[childId] as CompiledNode
    if (child.type === 'alpha' && fact.transaction?.organizationId !== child.organizationId) {
      pushTimelineEvent(timeline, {
        type: 'root-skipped',
        phase: 'execute',
        nodeId: child.id,
        ruleId: child.relatedRuleIds[0],
        label: 'Root skipped alpha branch',
        detail: `Fact org ${fact.transaction?.organizationId} does not match alpha org ${child.organizationId}`,
        factId: fact.id,
        snapshot: cloneSnapshot(snapshot),
      })
      continue
    }

    pushTimelineEvent(timeline, {
      type: 'root-dispatch',
      phase: 'execute',
      nodeId: child.id,
      edgeId: `root->${child.id}`,
      ruleId: child.type === 'alpha' ? child.relatedRuleIds[0] : undefined,
      label: 'Root dispatched fact to alpha',
      detail: `Root forwarded ${fact.id} into ${child.id}, where the alpha filter evaluates the rule condition for org ${fact.transaction?.organizationId}.`,
      factId: fact.id,
      snapshot: cloneSnapshot(snapshot),
    })
    processNode(network, childId, fact, snapshot, timeline, activations)
  }

  const dedupedRules = new Map<string, Rule>()
  for (const activation of activations) {
    const ruleId = String(activation.analysis.rule_id ?? '')
    const node = ruleId ? (network.nodes[ruleId] as ProductionCompiledNode | undefined) : undefined
    if (node?.rule) dedupedRules.set(node.rule.id, node.rule)
  }

  const evaluations = buildEvaluationResults(fact, [...dedupedRules.values()])
  const result = buildSimulationResult(fact, [...dedupedRules.values()], evaluations)

  pushTimelineEvent(timeline, {
    type: 'simulation-complete',
    phase: 'execute',
    label: 'Simulation complete',
    detail: `Decision: ${result.decision}. Triggered ${result.triggeredRules.length} rule(s).`,
    factId: fact.id,
    snapshot: cloneSnapshot(snapshot),
  })

  return {
    input,
    fact,
    timeline,
    result,
    finalSnapshot: cloneSnapshot(snapshot),
  }
}

export function replayTimeline(
  network: CompiledNetwork,
  run: SimulationRun,
  stepIndex: number,
  selectedNodeId: string | null,
): SimulationSnapshot {
  const clamped = Math.max(0, Math.min(stepIndex, run.timeline.length - 1))
  const event = run.timeline[clamped] ?? null
  return {
    event,
    selectedNode: selectedNodeId ? network.nodes[selectedNodeId] ?? null : null,
    memory: event?.snapshot ?? run.finalSnapshot,
    result: run.result,
  }
}
