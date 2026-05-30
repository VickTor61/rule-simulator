import type { SimulationInput } from '../simulator/types'

const sharedTransaction = {
  id: 'txn-001',
  organizationId: 42,
  userId: 'user-123',
  amount: 7500,
  currency: 'NGN',
  country: 'NG',
  transactionType: 'withdrawal',
  channel: 'mobile',
  customerReferenceId: 'cust-123',
  reference: 'REF-001',
  externalId: 'EXT-001',
  createdAt: '2026-03-30T10:30:00.000Z',
  transactionDate: '2026-03-30T10:30:00.000Z',
}

const sharedProfile = {
  overallRiskScore: 72,
  avgTransactionAmount: 1200,
  maxTransactionAmount: 5000,
  transactionCount: 12,
  riskLevel: 'medium',
  isVerified: true,
}

export interface PresetScenario {
  id: string
  label: string
  description: string
  input: SimulationInput
}

export const presetScenarios: PresetScenario[] = [
  {
    id: 'single-condition',
    label: 'Single Condition Rule',
    description: 'Root to shared alpha to production for one amount threshold rule.',
    input: {
      ruleSource: 'rules-engine',
      rules: {
        rules: [
          {
            id: 'rule-single',
            name: 'Large Amount Review',
            organization_id: 42,
            primary_operator: 'AND',
            status: 'active',
            conditions: [{ field: 'amount', operator: '>', value: 5000, position: 1 }],
            actions: [{ type: 'review', decision: 'review', priority: 'high' }],
          },
        ],
      },
      transaction: sharedTransaction,
      userProfile: sharedProfile,
    },
  },
  {
    id: 'multi-and',
    label: 'Multi Condition AND',
    description: 'Two alpha nodes join through a beta node and then activate production.',
    input: {
      ruleSource: 'rules-engine',
      rules: {
        rules: [
          {
            id: 'rule-and',
            name: 'High Amount Weekend Withdrawal',
            organization_id: 42,
            primary_operator: 'AND',
            status: 'active',
            conditions: [
              { field: 'amount', operator: '>', value: 5000, position: 1 },
              { field: 'is_weekend', operator: '==', value: false, position: 2 },
            ],
            actions: [{ type: 'block', decision: 'block', priority: 'critical' }],
          },
        ],
      },
      transaction: sharedTransaction,
      userProfile: sharedProfile,
    },
  },
  {
    id: 'multi-or',
    label: 'Multi Condition OR',
    description: 'Two alpha branches connect directly to the same production node.',
    input: {
      ruleSource: 'rules-engine',
      rules: {
        rules: [
          {
            id: 'rule-or',
            name: 'Country Or Channel Escalation',
            organization_id: 42,
            primary_operator: 'OR',
            status: 'active',
            conditions: [
              { field: 'country', operator: '==', value: 'NG', position: 1 },
              { field: 'channel', operator: '==', value: 'web', position: 2 },
            ],
            actions: [{ type: 'review', decision: 'review', priority: 'medium' }],
          },
        ],
      },
      transaction: sharedTransaction,
      userProfile: sharedProfile,
    },
  },
  {
    id: 'shared-alpha',
    label: 'Shared Alpha Nodes',
    description: 'Two rules reuse the same alpha node when they share a condition and org.',
    input: {
      ruleSource: 'rules-engine',
      rules: {
        rules: [
          {
            id: 'rule-shared-a',
            name: 'Shared Amount Review',
            organization_id: 42,
            primary_operator: 'AND',
            status: 'active',
            conditions: [{ field: 'amount', operator: '>', value: 5000, position: 1 }],
            actions: [{ type: 'review', decision: 'review', priority: 'high' }],
          },
          {
            id: 'rule-shared-b',
            name: 'Shared Amount Alert',
            organization_id: 42,
            primary_operator: 'AND',
            status: 'active',
            conditions: [{ field: 'amount', operator: '>', value: 5000, position: 1 }],
            actions: [{ type: 'alert', decision: 'review', priority: 'medium' }],
          },
        ],
      },
      transaction: sharedTransaction,
      userProfile: sharedProfile,
    },
  },
  {
    id: 'compare-field',
    label: 'Compare Field Condition',
    description: 'Compares a live field against another field path in match replay mode.',
    input: {
      ruleSource: 'rules-engine',
      rules: {
        rules: [
          {
            id: 'rule-compare',
            name: 'Amount Exceeds Historical Max',
            organization_id: 42,
            primary_operator: 'AND',
            status: 'active',
            conditions: [
              {
                field: 'amount',
                operator: '>',
                value: 'max_transaction_amount',
                evaluation_type: 'compare',
                position: 1,
              },
            ],
            actions: [{ type: 'review', decision: 'review', priority: 'high' }],
          },
        ],
      },
      transaction: sharedTransaction,
      userProfile: sharedProfile,
    },
  },
  {
    id: 'velocity',
    label: 'Velocity Condition',
    description: 'Uses the fact count field to drive a velocity-style alpha condition.',
    input: {
      ruleSource: 'rules-engine',
      rules: {
        rules: [
          {
            id: 'rule-velocity',
            name: 'Hourly Count Spike',
            organization_id: 42,
            primary_operator: 'AND',
            status: 'active',
            conditions: [
              {
                field: 'transaction.count',
                operator: '>=',
                value: 3,
                position: 1,
                velocity: true,
                time_window: '1_hour',
              },
            ],
            actions: [{ type: 'review', decision: 'review', priority: 'high' }],
          },
        ],
      },
      transaction: {
        ...sharedTransaction,
        count: 4,
      },
      userProfile: sharedProfile,
    },
  },
  {
    id: 'rayyan-grouped',
    label: 'Rayyan Grouped Rule',
    description: 'Shows the authored group structure next to the flattened engine compilation.',
    input: {
      ruleSource: 'rayyan',
      rules: {
        rules: [
          {
            id: 'rayyan-1',
            name: 'Grouped Transaction Risk',
            description: 'Authored in Rayyan with group-level operators.',
            organization_id: 42,
            primary_operator: 'AND',
            rule_category: 'transaction',
            status: 'active',
            condition_groups: [
              {
                position: 1,
                operator: 'OR',
                conditions: [
                  { field: 'transaction.amount', operator: 'gt', value: 5000, value_type: 'number', position: 1 },
                  { field: 'transaction.country', operator: 'eq', value: 'NG', value_type: 'string', position: 2 },
                ],
              },
              {
                position: 2,
                operator: 'AND',
                conditions: [
                  { field: 'customer.max_transaction_amount', operator: 'lt', value: 8000, value_type: 'number', position: 1 },
                ],
              },
            ],
            conditions: [
              { field: 'transaction.amount', operator: 'gt', value: 5000, value_type: 'number', position: 1 },
              { field: 'transaction.country', operator: 'eq', value: 'NG', value_type: 'string', position: 2 },
              { field: 'customer.max_transaction_amount', operator: 'lt', value: 8000, value_type: 'number', position: 3 },
            ],
            actions: [{ type: 'review', decision: 'review', priority: 'medium' }],
          },
        ],
      },
      transaction: sharedTransaction,
      userProfile: sharedProfile,
    },
  },
  {
    id: 'engine-fidelity',
    label: 'Engine Fidelity Demo',
    description: 'Mirrors the current Go engine with shared alpha, beta chaining, compare, and fact-driven velocity checks.',
    input: {
      ruleSource: 'rules-engine',
      rules: {
        rules: [
          {
            id: 'fidelity-a',
            name: 'Review On High Amount',
            organization_id: 42,
            primary_operator: 'AND',
            status: 'active',
            conditions: [{ field: 'amount', operator: '>', value: 5000, position: 1 }],
            actions: [{ type: 'review', decision: 'review', priority: 'high' }],
          },
          {
            id: 'fidelity-b',
            name: 'Block On Joined Conditions',
            organization_id: 42,
            primary_operator: 'AND',
            status: 'active',
            conditions: [
              { field: 'amount', operator: '>', value: 5000, position: 1 },
              { field: 'max_transaction_amount', operator: '<', value: 8000, position: 2 },
              { field: 'transaction.count', operator: '>=', value: 2, position: 3, velocity: true, time_window: '1_hour' },
            ],
            actions: [{ type: 'block', decision: 'block', priority: 'critical' }],
          },
        ],
      },
      transaction: {
        ...sharedTransaction,
        count: 2,
      },
      userProfile: sharedProfile,
    },
  },
]
