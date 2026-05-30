import { describe, expect, test } from 'vitest'
import { normalizeRuleInput } from '../lib/adapters/normalize'
import { presetScenarios } from '../lib/presets/scenarios'
import { compileNetwork } from '../lib/simulator/compiler'
import { simulateFact } from '../lib/simulator/runtime'

describe('simulateFact', () => {
  test('adds matching facts to alpha memory and activates production', () => {
    const preset = presetScenarios.find((scenario) => scenario.id === 'single-condition')!
    const network = compileNetwork(normalizeRuleInput(preset.input))
    const run = simulateFact(network, preset.input)
    expect(run.finalSnapshot.workingMemory).toHaveLength(1)
    expect(Object.values(run.finalSnapshot.alphaMemory)[0]).toHaveLength(1)
    expect(run.result.triggeredRules).toHaveLength(1)
    expect(run.result.decision).toBe('review')
  })

  test('records beta join success for AND chains', () => {
    const preset = presetScenarios.find((scenario) => scenario.id === 'multi-and')!
    const network = compileNetwork(normalizeRuleInput(preset.input))
    const run = simulateFact(network, preset.input)
    expect(run.timeline.some((event) => event.type === 'beta-join-success')).toBe(true)
    expect(run.result.decision).toBe('block')
  })

  test('evaluates velocity conditions from explicit fact fields', () => {
    const preset = presetScenarios.find((scenario) => scenario.id === 'velocity')!
    const network = compileNetwork(normalizeRuleInput(preset.input))
    const run = simulateFact(network, preset.input)
    expect(run.result.triggeredRules).toHaveLength(1)
  })

  test('marks velocity alpha nodes unavailable when the fact does not define the field', () => {
    const input = {
      ruleSource: 'rules-engine' as const,
      rules: {
        rules: [
          {
            id: 'rule-velocity-missing',
            name: 'Missing Count Velocity',
            organization_id: 42,
            primary_operator: 'AND',
            status: 'active',
            conditions: [
              {
                field: 'transaction.count',
                operator: '>=',
                value: 2,
                position: 1,
                velocity: true,
                time_window: '1_hour',
              },
            ],
            actions: [{ type: 'review', decision: 'review' }],
          },
        ],
      },
      transaction: {
        id: 'txn-velocity-missing',
        organizationId: 42,
        userId: 'user-123',
        amount: 7500,
      },
      userProfile: null,
      analysisSeed: {
        velocity_count_1_hour: 7,
      },
    }
    const network = compileNetwork(normalizeRuleInput(input))
    const run = simulateFact(network, input)

    const unavailableEvent = run.timeline.find(
      (event) =>
        event.type === 'alpha-evaluated'
        && event.label === 'transaction.count evaluated'
        && event.detail.includes('could not run because the input fact does not define transaction.count'),
    )

    expect(unavailableEvent).toBeTruthy()
    expect(run.result.triggeredRules).toHaveLength(0)
  })

  test('uses explicit transaction count from the fact over seeded velocity count', () => {
    const preset = presetScenarios.find((scenario) => scenario.id === 'engine-fidelity')!
    const network = compileNetwork(normalizeRuleInput(preset.input))
    const run = simulateFact(network, {
      ...preset.input,
      transaction: {
        ...preset.input.transaction,
        amount: 500,
        count: 1,
      },
    })

    const amountFailure = run.timeline.find(
      (event) =>
        event.type === 'alpha-evaluated'
        && event.label === 'amount evaluated'
        && event.detail.includes('Condition failed'),
    )
    const velocityFailure = run.timeline.find(
      (event) =>
        event.type === 'alpha-evaluated'
        && event.label === 'transaction.count evaluated'
        && event.detail.includes('Condition failed'),
    )

    expect(amountFailure).toBeTruthy()
    expect(velocityFailure).toBeTruthy()
    expect(run.result.triggeredRules).toHaveLength(0)
  })

  test('splits replay events into build and execute phases', () => {
    const preset = presetScenarios.find((scenario) => scenario.id === 'multi-and')!
    const network = compileNetwork(normalizeRuleInput(preset.input))
    const run = simulateFact(network, preset.input)

    expect(run.timeline.some((event) => event.phase === 'build')).toBe(true)
    expect(run.timeline.some((event) => event.phase === 'execute')).toBe(true)
    expect(run.timeline.find((event) => event.type === 'network-beta-linked')?.phase).toBe('build')
    expect(run.timeline.find((event) => event.type === 'production-activated')?.phase).toBe('execute')
  })

  test('ignores draft rules during execution', () => {
    const input = {
      ruleSource: 'rules-engine' as const,
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
            actions: [{ type: 'block', decision: 'block' }],
          },
        ],
      },
      transaction: {
        id: 'txn-1',
        organizationId: 42,
        userId: 'user-1',
        amount: 6000,
        country: 'NG',
      },
      userProfile: null,
      analysisSeed: {},
    }
    const network = compileNetwork(normalizeRuleInput(input))
    const run = simulateFact(network, input)

    expect(run.result.triggeredRules.map((result) => result.rule.id)).toEqual(['rule-active'])
    expect(run.result.decision).toBe('review')
  })
})
