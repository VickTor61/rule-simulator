import { act } from '@testing-library/react'
import { parseFactRequest } from '../lib/facts'
import { SIMULATOR_STORAGE_KEY, useSimulatorStore } from '../lib/store'

describe('store persistence', () => {
  test('persists saved facts to local storage and removes them on delete', () => {
    act(() => {
      const state = useSimulatorStore.getState()
      state.loadPreset('engine-fidelity')
      state.resetTraversal()
      state.setActiveRuleId(null)
    })

    const newFact = parseFactRequest(
      JSON.stringify({
        transaction: {
          transaction_reference: 'TX-PERSIST-1',
          customer_reference_id: 'persist-user-1',
          amount: 6400,
          currency: 'NGN',
          transaction_type: 'transfer',
          channel: 'mobile',
        },
      }),
      42,
    )

    act(() => {
      useSimulatorStore.getState().saveFact(newFact)
    })

    const persistedAfterSave = JSON.parse(localStorage.getItem(SIMULATOR_STORAGE_KEY) ?? '{}') as {
      savedFacts?: Array<{ id: string }>
    }
    expect(persistedAfterSave.savedFacts?.some((fact) => fact.id === newFact.id)).toBe(true)

    act(() => {
      useSimulatorStore.getState().deleteFact(newFact.id)
    })

    const persistedAfterDelete = JSON.parse(localStorage.getItem(SIMULATOR_STORAGE_KEY) ?? '{}') as {
      savedFacts?: Array<{ id: string }>
    }
    expect(persistedAfterDelete.savedFacts?.some((fact) => fact.id === newFact.id)).toBe(false)
  })

  test('persists appended rules and removes them on delete', () => {
    act(() => {
      const state = useSimulatorStore.getState()
      state.loadPreset('single-condition')
      state.resetTraversal()
      state.setActiveRuleId(null)
    })

    act(() => {
      useSimulatorStore.getState().appendRule()
    })

    const appendedRuleId = useSimulatorStore.getState().activeRuleId
    expect(appendedRuleId).toBeTruthy()

    const persistedAfterAppend = JSON.parse(localStorage.getItem(SIMULATOR_STORAGE_KEY) ?? '{}') as {
      rulesText?: string
    }
    const appendedRules = JSON.parse(persistedAfterAppend.rulesText ?? '{"rules":[]}') as {
      rules?: Array<{ id: string }>
    }
    expect(appendedRules.rules?.some((rule) => rule.id === appendedRuleId)).toBe(true)

    act(() => {
      useSimulatorStore.getState().deleteRule(appendedRuleId!)
    })

    const persistedAfterDelete = JSON.parse(localStorage.getItem(SIMULATOR_STORAGE_KEY) ?? '{}') as {
      rulesText?: string
    }
    const remainingRules = JSON.parse(persistedAfterDelete.rulesText ?? '{"rules":[]}') as {
      rules?: Array<{ id: string }>
    }
    expect(remainingRules.rules?.some((rule) => rule.id === appendedRuleId)).toBe(false)
  })

  test('lands on the completed execution state after a fact run', () => {
    act(() => {
      const state = useSimulatorStore.getState()
      state.loadPreset('single-condition')
      state.resetTraversal()
      state.setActiveRuleId(null)
      state.runSelectedFact()
    })

    const state = useSimulatorStore.getState()
    const currentEvent = state.run?.timeline[state.stepIndex]

    expect(currentEvent?.type).toBe('simulation-complete')
  })

  test('reset traversal returns the replay to the start of the full network timeline', () => {
    act(() => {
      const state = useSimulatorStore.getState()
      state.loadPreset('single-condition')
      state.resetTraversal()
      state.setActiveRuleId(null)
      state.runSelectedFact()
      state.resetTraversal()
    })

    const state = useSimulatorStore.getState()
    const currentEvent = state.run?.timeline[state.stepIndex]

    expect(state.stepIndex).toBe(0)
    expect(currentEvent?.phase).toBe('build')
  })

  test('play traversal rewinds to the start when invoked from a completed run', () => {
    act(() => {
      const state = useSimulatorStore.getState()
      state.loadPreset('single-condition')
      state.resetTraversal()
      state.setActiveRuleId(null)
      state.runSelectedFact()
      state.playTraversal()
    })

    const state = useSimulatorStore.getState()
    const currentEvent = state.run?.timeline[state.stepIndex]

    expect(state.isPlaying).toBe(true)
    expect(state.stepIndex).toBe(0)
    expect(currentEvent?.phase).toBe('build')
  })

  test('selected fact user_profile overrides the shared profile during a run', () => {
    act(() => {
      const state = useSimulatorStore.getState()
      state.loadPreset('engine-fidelity')
      state.resetTraversal()
      state.setActiveRuleId(null)
    })

    const factWithProfile = parseFactRequest(
      JSON.stringify({
        organization_id: 42,
        transaction: {
          transaction_reference: 'TX-PROFILE-OVERRIDE',
          customer_reference_id: 'cust-123',
          amount: 500,
          count: 1,
          currency: 'NGN',
          transaction_type: 'withdrawal',
          channel: 'mobile',
        },
        user_profile: {
          max_transaction_amount: 40000,
        },
      }),
      42,
    )

    act(() => {
      const state = useSimulatorStore.getState()
      state.saveFact(factWithProfile)
      state.runSelectedFact()
    })

    const state = useSimulatorStore.getState()
    const profileFailure = state.run?.timeline.find(
      (event) =>
        event.type === 'alpha-evaluated'
        && event.label === 'max_transaction_amount evaluated'
        && event.detail.includes('Condition failed with actual value 40000'),
    )

    expect(profileFailure).toBeTruthy()
    expect(state.run?.result.triggeredRules).toHaveLength(0)
  })

  test('persists and reloads scenario packs from current rules and selected fact', () => {
    act(() => {
      const state = useSimulatorStore.getState()
      state.loadPreset('engine-fidelity')
      state.resetTraversal()
      state.setActiveRuleId(null)
      state.saveScenarioPack('High-risk withdrawal', 'Saved from the current test case.')
    })

    const stateAfterSave = useSimulatorStore.getState()
    const savedScenarioPack = stateAfterSave.scenarioPacks[0]

    expect(savedScenarioPack?.name).toBe('High-risk withdrawal')
    expect(savedScenarioPack?.expectedDecision).toBeTruthy()

    act(() => {
      useSimulatorStore.getState().loadScenarioPack(savedScenarioPack.id)
    })

    const stateAfterLoad = useSimulatorStore.getState()
    expect(stateAfterLoad.selectedScenarioPackId).toBe(savedScenarioPack.id)
    expect(stateAfterLoad.selectedFactId).toBe(savedScenarioPack.selectedFact?.id ?? null)

    const persisted = JSON.parse(localStorage.getItem(SIMULATOR_STORAGE_KEY) ?? '{}') as {
      scenarioPacks?: Array<{ id: string }>
    }
    expect(persisted.scenarioPacks?.some((pack) => pack.id === savedScenarioPack.id)).toBe(true)
  })
})
