import { normalizeRuleInput } from '../adapters/normalize'
import { compileNetwork } from './compiler'
import type { CompiledNetwork, CompiledNetworkDiff, NodeDiffState, RuleDiffSummary, SimulationInput } from './types'

function getModifiedRuleIds(baseline: CompiledNetwork, candidate: CompiledNetwork): string[] {
  const baselineRules = new Map(baseline.canonicalRuleSet.rules.map((rule) => [rule.id, JSON.stringify(rule)]))
  const candidateRules = new Map(candidate.canonicalRuleSet.rules.map((rule) => [rule.id, JSON.stringify(rule)]))

  return [...candidateRules.keys()].filter((ruleId) => baselineRules.has(ruleId) && baselineRules.get(ruleId) !== candidateRules.get(ruleId))
}

function buildSummary(
  baseline: CompiledNetwork,
  candidate: CompiledNetwork,
  addedRuleIds: string[],
  removedRuleIds: string[],
  modifiedRuleIds: string[],
): RuleDiffSummary {
  const baselineRules = new Map(baseline.canonicalRuleSet.rules.map((rule) => [rule.id, rule]))
  const candidateRules = new Map(candidate.canonicalRuleSet.rules.map((rule) => [rule.id, rule]))

  const summaryLines = [
    ...addedRuleIds.map((ruleId) => `Added rule ${candidateRules.get(ruleId)?.name ?? ruleId}.`),
    ...removedRuleIds.map((ruleId) => `Removed rule ${baselineRules.get(ruleId)?.name ?? ruleId}.`),
    ...modifiedRuleIds.flatMap((ruleId) => {
      const before = baselineRules.get(ruleId)
      const after = candidateRules.get(ruleId)
      if (!before || !after) return []

      const lines: string[] = []
      if (before.primaryOperator !== after.primaryOperator) {
        lines.push(`${after.name} changed from ${before.primaryOperator} to ${after.primaryOperator}, changing its join structure.`)
      }
      if (before.conditions.length !== after.conditions.length) {
        lines.push(`${after.name} changed condition count from ${before.conditions.length} to ${after.conditions.length}.`)
      }
      if (lines.length === 0) lines.push(`${after.name} changed its rule definition.`)
      return lines
    }),
  ]

  return {
    addedRuleIds,
    removedRuleIds,
    modifiedRuleIds,
    summaryLines,
  }
}

export function buildCompiledNetworkDiff(
  baselineInput: SimulationInput,
  candidateInput: SimulationInput,
): CompiledNetworkDiff {
  const baseline = compileNetwork(normalizeRuleInput(baselineInput))
  const candidate = compileNetwork(normalizeRuleInput(candidateInput))

  const baselineRuleIds = new Set(baseline.canonicalRuleSet.rules.map((rule) => rule.id))
  const candidateRuleIds = new Set(candidate.canonicalRuleSet.rules.map((rule) => rule.id))

  const addedRuleIds = [...candidateRuleIds].filter((ruleId) => !baselineRuleIds.has(ruleId))
  const removedRuleIds = [...baselineRuleIds].filter((ruleId) => !candidateRuleIds.has(ruleId))
  const modifiedRuleIds = getModifiedRuleIds(baseline, candidate)

  const baselineNodeBySignature = new Map(
    Object.values(baseline.nodes)
      .filter((node) => node.type !== 'root')
      .map((node) => [node.signature, node]),
  )
  const diffStateByNodeId: Record<string, NodeDiffState> = {}

  Object.values(candidate.nodes).forEach((node) => {
    if (node.type === 'root') {
      diffStateByNodeId[node.id] = 'unchanged'
      return
    }
    if (!baselineNodeBySignature.has(node.signature)) {
      diffStateByNodeId[node.id] = 'added'
      return
    }
    diffStateByNodeId[node.id] = modifiedRuleIds.some((ruleId) => node.relatedRuleIds.includes(ruleId)) ? 'changed' : 'unchanged'
  })

  const diffStateByEdgeId: Record<string, NodeDiffState> = {}
  candidate.flowEdges.forEach((edge) => {
    const baselineEdge = baseline.flowEdges.find((candidateEdge) => candidateEdge.id === edge.id)
    diffStateByEdgeId[edge.id] = baselineEdge ? 'unchanged' : 'added'
  })

  return {
    baseline,
    candidate,
    diffStateByNodeId,
    diffStateByEdgeId,
    summary: buildSummary(baseline, candidate, addedRuleIds, removedRuleIds, modifiedRuleIds),
  }
}
