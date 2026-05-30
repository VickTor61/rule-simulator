import { describe, expect, test } from 'vitest'
import { factRequestToSimulationTransaction, parseFactRequest } from '../lib/facts'

describe('facts', () => {
  test('accepts the real API-shaped transaction payload', () => {
    const fact = parseFactRequest(
      JSON.stringify({
        transaction: {
          transaction_reference: 'TX-123',
          customer_reference_id: 'user-123',
          amount: 7500,
          currency: 'NGN',
          transaction_type: 'withdrawal',
          channel: 'mobile',
          country: 'NG',
        },
      }),
      42,
    )

    expect(fact.request.transaction.transaction_reference).toBe('TX-123')
    expect(fact.transaction.id).toBe('TX-123')
    expect(fact.transaction.organizationId).toBe(42)
    expect(fact.transaction.userId).toBe('user-123')
  })

  test('rejects malformed or incomplete fact payloads', () => {
    expect(() => parseFactRequest('{', 42)).toThrow()
    expect(() =>
      parseFactRequest(
        JSON.stringify({
          transaction: {
            customer_reference_id: 'user-123',
            amount: 7500,
            currency: 'NGN',
            transaction_type: 'withdrawal',
            channel: 'mobile',
          },
        }),
        42,
      ),
    ).toThrow(/transaction_reference is required/i)
  })

  test('maps request payloads into simulator transaction facts', () => {
    const transaction = factRequestToSimulationTransaction(
      {
        organization_id: 99,
        transaction: {
          transaction_reference: 'TX-999',
          customer_reference_id: 'user-999',
          amount: 1250,
          count: 1,
          amount_sum: 1250,
          currency: 'USD',
          transaction_type: 'transfer',
          channel: 'web',
          transaction_authenticated: true,
          device_id: 'device-1',
        },
      },
      1,
    )

    expect(transaction.externalId).toBe('TX-999')
    expect(transaction.customerReferenceId).toBe('user-999')
    expect(transaction.count).toBe(1)
    expect(transaction.amountSum).toBe(1250)
    expect(transaction.transactionAuthenticated).toBe(true)
    expect(transaction.deviceId).toBe('device-1')
    expect(transaction.organizationId).toBe(99)
  })

  test('preserves custom fact JSON fields when saving and reopening a fact', () => {
    const fact = parseFactRequest(
      JSON.stringify({
        organization_id: 42,
        callback_url: 'https://example.com/callback',
        ingestion_source: 'manual-test',
        transaction: {
          transaction_reference: 'TX-CUSTOM-1',
          customer_reference_id: 'user-custom-1',
          amount: 9100,
          currency: 'NGN',
          transaction_type: 'transfer',
          channel: 'mobile',
          merchant_category: 'gaming',
          extra_context: {
            reviewer: 'ops-user',
          },
        },
      }),
      42,
    )

    expect(fact.request.ingestion_source).toBe('manual-test')
    expect(fact.request.callback_url).toBe('https://example.com/callback')
    expect(fact.request.transaction.merchant_category).toBe('gaming')
    expect(fact.request.transaction.extra_context).toEqual({ reviewer: 'ops-user' })
    expect(fact.request.transaction.transaction_reference).toBe('TX-CUSTOM-1')
  })

  test('maps user_profile from fact JSON into the saved fact bundle', () => {
    const fact = parseFactRequest(
      JSON.stringify({
        organization_id: 42,
        transaction: {
          transaction_reference: 'TX-PROFILE-1',
          customer_reference_id: 'user-profile-1',
          amount: 500,
          currency: 'NGN',
          transaction_type: 'withdrawal',
          channel: 'mobile',
        },
        user_profile: {
          max_transaction_amount: 40000,
          overall_risk_score: 91,
        },
      }),
      42,
    )

    expect(fact.request.user_profile).toEqual({
      max_transaction_amount: 40000,
      overall_risk_score: 91,
    })
    expect(fact.userProfile).toEqual({
      maxTransactionAmount: 40000,
      overallRiskScore: 91,
    })
  })
})
