import { describe, expect, test } from 'vitest'
import { normalizeRuleInput } from '../lib/adapters/normalize'
import type { SimulationInput } from '../lib/simulator/types'

describe('normalizeRuleInput', () => {
  test('normalizes a Rayyan grouped payload', () => {
    const input: SimulationInput = {
      ruleSource: 'rayyan',
      rules: {
        rules: [
          {
            name: 'Grouped',
            organization_id: 7,
            primary_operator: 'AND',
            condition_groups: [
              {
                operator: 'OR',
                position: 1,
                conditions: [
                  {
                    field: 'transaction.amount',
                    operator: 'gt',
                    value: 5000,
                    value_type: 'number',
                    position: 1,
                  },
                ],
              },
            ],
            actions: [{ type: 'review', decision: 'review' }],
          },
        ],
      },
      transaction: { id: 't1', organizationId: 7, userId: 'u1' },
    }

    const output = normalizeRuleInput(input)
    expect(output.rules).toHaveLength(1)
    expect(output.rules[0].conditionGroups?.[0].operator).toBe('OR')
    expect(output.rules[0].conditions[0].operator).toBe('>')
  })

  test('passes through rules-engine rules while normalizing operators', () => {
    const input: SimulationInput = {
      ruleSource: 'rules-engine',
      rules: {
        rules: [
          {
            id: 'rule-1',
            name: 'Engine Rule',
            organization_id: 1,
            primary_operator: 'AND',
            conditions: [{ field: 'amount', operator: 'eq', value: 10 }],
            actions: [{ type: 'block', decision: 'block' }],
          },
        ],
      },
      transaction: { id: 't1', organizationId: 1, userId: 'u1' },
    }

    const output = normalizeRuleInput(input)
    expect(output.rules[0].conditions[0].operator).toBe('==')
    expect(output.rules[0].actions[0].type).toBe('block')
  })
})
