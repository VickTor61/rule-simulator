import { describe, expect, test } from 'vitest'
import { compileNetwork } from '../lib/simulator/compiler'
import { normalizeRuleInput } from '../lib/adapters/normalize'
import { presetScenarios } from '../lib/presets/scenarios'

describe('compileNetwork', () => {
  test('builds a single-condition graph shape', () => {
    const preset = presetScenarios.find((scenario) => scenario.id === 'single-condition')
    const network = compileNetwork(normalizeRuleInput(preset!.input))
    expect(Object.values(network.nodes).filter((node) => node.type === 'alpha')).toHaveLength(1)
    expect(Object.values(network.nodes).filter((node) => node.type === 'beta')).toHaveLength(0)
  })

  test('builds OR direct fanout to production', () => {
    const preset = presetScenarios.find((scenario) => scenario.id === 'multi-or')
    const network = compileNetwork(normalizeRuleInput(preset!.input))
    const productionId = preset!.input.ruleSource === 'rules-engine' ? 'rule-or' : ''
    const incoming = network.flowEdges.filter((edge) => edge.target === productionId)
    expect(incoming).toHaveLength(2)
  })

  test('shares alpha nodes across rules with matching org and condition signature', () => {
    const preset = presetScenarios.find((scenario) => scenario.id === 'shared-alpha')
    const network = compileNetwork(normalizeRuleInput(preset!.input))
    expect(Object.values(network.nodes).filter((node) => node.type === 'alpha')).toHaveLength(1)
  })

  test('tracks related rule ids on shared alpha nodes', () => {
    const preset = presetScenarios.find((scenario) => scenario.id === 'shared-alpha')
    const network = compileNetwork(normalizeRuleInput(preset!.input))
    const alphaNode = Object.values(network.nodes).find((node) => node.type === 'alpha')
    expect(alphaNode && 'relatedRuleIds' in alphaNode ? alphaNode.relatedRuleIds.sort() : []).toEqual([
      'rule-shared-a',
      'rule-shared-b',
    ])
  })

  test('only compiles active rules into the network', () => {
    const network = compileNetwork(
      normalizeRuleInput({
        ruleSource: 'rules-engine',
        rules: {
          rules: [
            {
              id: 'rule-active',
              name: 'Active Rule',
              organization_id: 42,
              status: 'active',
              primary_operator: 'AND',
              conditions: [{ field: 'amount', operator: '>', value: 5000, position: 1 }],
              actions: [{ type: 'review', decision: 'review' }],
            },
            {
              id: 'rule-draft',
              name: 'Draft Rule',
              organization_id: 42,
              status: 'draft',
              primary_operator: 'AND',
              conditions: [{ field: 'country', operator: '==', value: 'NG', position: 1 }],
              actions: [{ type: 'review', decision: 'review' }],
            },
          ],
        },
        transaction: { id: 'txn-1', organizationId: 42, userId: 'user-1' },
      }),
    )

    expect(network.productionIndex['rule-active']).toBe('rule-active')
    expect(network.productionIndex['rule-draft']).toBeUndefined()
    expect(Object.values(network.nodes).filter((node) => node.type === 'alpha')).toHaveLength(1)
  })
})
