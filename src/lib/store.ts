import { create } from 'zustand'
import { buildSavedFactFromTransaction, type SavedFact } from './facts'
import { normalizeRuleInput } from './adapters/normalize'
import { presetScenarios } from './presets/scenarios'
import { removeRuleFromBundle } from './rule-editor'
import { isScenarioPack, type ScenarioPack } from './scenario-packs'
import { compileNetwork } from './simulator/compiler'
import { buildCompiledNetworkDiff } from './simulator/diff'
import { replayTimeline, simulateFact } from './simulator/runtime'
import type {
  CompiledNetworkDiff,
  CompiledNetwork,
  RuleSource,
  SimulationInput,
  SimulationRun,
  SimulationSnapshot,
} from './simulator/types'

interface SimulatorState {
  workspaceMode: 'simulator' | 'diff'
  source: RuleSource
  rulesText: string
  baselineRulesText: string
  candidateRulesText: string
  transactionText: string
  userProfileText: string
  analysisText: string
  savedFacts: SavedFact[]
  selectedFactId: string | null
  scenarioPacks: ScenarioPack[]
  selectedScenarioPackId: string | null
  isFactModalOpen: boolean
  editingFactId: string | null
  network: CompiledNetwork | null
  diff: CompiledNetworkDiff | null
  run: SimulationRun | null
  stepIndex: number
  isPlaying: boolean
  isEngineEnabled: boolean
  activeRuleId: string | null
  playbackSpeed: 0.5 | 1 | 1.5 | 2 | 3
  isLooping: boolean
  isMemoryOpen: boolean
  selectedMemoryTab: 'summary' | 'facts' | 'activations'
  selectedNodeId: string | null
  error: string | null
  activePresetId: string
  setWorkspaceMode: (mode: 'simulator' | 'diff') => void
  setSource: (source: RuleSource) => void
  setRulesText: (value: string) => void
  setBaselineRulesText: (value: string) => void
  setCandidateRulesText: (value: string) => void
  setTransactionText: (value: string) => void
  setUserProfileText: (value: string) => void
  setAnalysisText: (value: string) => void
  openFactModal: (factId?: string | null) => void
  closeFactModal: () => void
  saveFact: (fact: SavedFact, options?: { runAfterSave?: boolean }) => void
  selectFact: (factId: string | null) => void
  deleteFact: (factId: string) => void
  runSelectedFact: () => void
  saveScenarioPack: (name: string, description: string) => void
  loadScenarioPack: (scenarioPackId: string) => void
  deleteScenarioPack: (scenarioPackId: string) => void
  appendRule: () => void
  appendConditionToRule: (ruleId: string) => void
  deleteRule: (ruleId: string) => void
  loadPreset: (presetId: string) => void
  compileFromEditor: () => void
  runSimulation: () => void
  toggleEngine: () => void
  setActiveRuleId: (value: string | null) => void
  setPlaybackSpeed: (value: 0.5 | 1 | 1.5 | 2 | 3) => void
  toggleLooping: () => void
  setStepIndex: (value: number) => void
  scrubToStep: (value: number) => void
  playTraversal: () => void
  pauseTraversal: () => void
  advanceTraversal: () => void
  resetTraversal: () => void
  selectNode: (nodeId: string | null) => void
  setMemoryOpen: (value: boolean) => void
  setSelectedMemoryTab: (value: 'summary' | 'facts' | 'activations') => void
  getSnapshot: () => SimulationSnapshot | null
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export const SIMULATOR_STORAGE_KEY = 'rules-simulator-editor-v1'

type PersistedEditorState = Pick<
  SimulatorState,
  | 'source'
  | 'rulesText'
  | 'baselineRulesText'
  | 'candidateRulesText'
  | 'transactionText'
  | 'userProfileText'
  | 'analysisText'
  | 'savedFacts'
  | 'selectedFactId'
  | 'scenarioPacks'
  | 'selectedScenarioPackId'
>

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isSavedFact(value: unknown): value is SavedFact {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<SavedFact>
  return (
    typeof candidate.id === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.organizationId === 'number'
    && typeof candidate.createdAt === 'string'
    && candidate.request !== null
    && typeof candidate.request === 'object'
    && candidate.transaction !== null
    && typeof candidate.transaction === 'object'
    && (
      candidate.userProfile === undefined
      || candidate.userProfile === null
      || typeof candidate.userProfile === 'object'
    )
  )
}

function buildEditorState(input: SimulationInput): Pick<
  SimulatorState,
  'source' | 'rulesText' | 'baselineRulesText' | 'candidateRulesText' | 'transactionText' | 'userProfileText' | 'analysisText' | 'savedFacts' | 'selectedFactId' | 'scenarioPacks' | 'selectedScenarioPackId' | 'isFactModalOpen' | 'editingFactId'
> {
  const initialFact = buildSavedFactFromTransaction(
    input.transaction,
    `preset-${input.transaction.id}`,
    input.userProfile ?? null,
  )
  return {
    source: input.ruleSource,
    rulesText: formatJson(input.rules),
    baselineRulesText: formatJson(input.rules),
    candidateRulesText: formatJson(input.rules),
    transactionText: formatJson(input.transaction),
    userProfileText: formatJson(input.userProfile ?? {}),
    analysisText: formatJson(input.analysisSeed ?? {}),
    savedFacts: [initialFact],
    selectedFactId: initialFact.id,
    scenarioPacks: [],
    selectedScenarioPackId: null,
    isFactModalOpen: false,
    editingFactId: null,
  }
}

function readPersistedEditorState(
  fallback: ReturnType<typeof buildEditorState>,
): ReturnType<typeof buildEditorState> {
  const storage = getLocalStorage()
  if (!storage) return fallback

  const raw = storage.getItem(SIMULATOR_STORAGE_KEY)
  if (!raw) return fallback

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedEditorState>
    const savedFacts = Array.isArray(parsed.savedFacts)
      ? parsed.savedFacts
          .filter(isSavedFact)
          .map((fact) => ({
            ...fact,
            userProfile: fact.userProfile ?? null,
          }))
      : fallback.savedFacts
    const selectedFactId = typeof parsed.selectedFactId === 'string' && savedFacts.some((fact) => fact.id === parsed.selectedFactId)
      ? parsed.selectedFactId
      : savedFacts[0]?.id ?? null
    const selectedFact = selectedFactId
      ? savedFacts.find((fact) => fact.id === selectedFactId) ?? null
      : null
    const scenarioPacks = Array.isArray(parsed.scenarioPacks)
      ? parsed.scenarioPacks.filter(isScenarioPack).map((pack) => ({
          ...pack,
          selectedFact: pack.selectedFact ?? null,
        }))
      : fallback.scenarioPacks
    const selectedScenarioPackId = typeof parsed.selectedScenarioPackId === 'string' && scenarioPacks.some((pack) => pack.id === parsed.selectedScenarioPackId)
      ? parsed.selectedScenarioPackId
      : fallback.selectedScenarioPackId

    return {
      ...fallback,
      source: parsed.source === 'rayyan' || parsed.source === 'rules-engine' ? parsed.source : fallback.source,
      rulesText: typeof parsed.rulesText === 'string' ? parsed.rulesText : fallback.rulesText,
      baselineRulesText: typeof parsed.baselineRulesText === 'string' ? parsed.baselineRulesText : fallback.baselineRulesText,
      candidateRulesText: typeof parsed.candidateRulesText === 'string' ? parsed.candidateRulesText : fallback.candidateRulesText,
      transactionText: selectedFact
        ? formatJson(selectedFact.transaction)
        : typeof parsed.transactionText === 'string'
          ? parsed.transactionText
          : fallback.transactionText,
      userProfileText: selectedFact?.userProfile
        ? formatJson(selectedFact.userProfile)
        : typeof parsed.userProfileText === 'string'
          ? parsed.userProfileText
          : fallback.userProfileText,
      analysisText: typeof parsed.analysisText === 'string' ? parsed.analysisText : fallback.analysisText,
      savedFacts,
      selectedFactId,
      scenarioPacks,
      selectedScenarioPackId,
      isFactModalOpen: false,
      editingFactId: null,
    }
  } catch {
    return fallback
  }
}

function persistEditorState(state: SimulatorState): void {
  const storage = getLocalStorage()
  if (!storage) return

  const payload: PersistedEditorState = {
    source: state.source,
    rulesText: state.rulesText,
    baselineRulesText: state.baselineRulesText,
    candidateRulesText: state.candidateRulesText,
    transactionText: state.transactionText,
    userProfileText: state.userProfileText,
    analysisText: state.analysisText,
    savedFacts: state.savedFacts,
    selectedFactId: state.selectedFactId,
    scenarioPacks: state.scenarioPacks,
    selectedScenarioPackId: state.selectedScenarioPackId,
  }

  storage.setItem(SIMULATOR_STORAGE_KEY, JSON.stringify(payload))
}

function parseEditorState(state: SimulatorState): SimulationInput {
  const selectedFact = state.selectedFactId
    ? state.savedFacts.find((fact) => fact.id === state.selectedFactId) ?? null
    : null

  return {
    ruleSource: state.source,
    rules: JSON.parse(state.rulesText) as unknown,
    transaction: selectedFact
      ? selectedFact.transaction
      : (JSON.parse(state.transactionText) as SimulationInput['transaction']),
    userProfile: selectedFact?.userProfile
      ?? (state.userProfileText.trim()
        ? (JSON.parse(state.userProfileText) as SimulationInput['userProfile'])
        : null),
    analysisSeed: state.analysisText.trim()
      ? (JSON.parse(state.analysisText) as SimulationInput['analysisSeed'])
      : {},
  }
}

function getCompletedRunIndex(run: SimulationRun | null): number {
  if (!run || run.timeline.length === 0) return 0
  return run.timeline.length - 1
}

function buildDefaultRulesEngineCondition(position: number): Record<string, unknown> {
  return {
    field: 'amount',
    operator: '>',
    value: 1000,
    position,
  }
}

function buildDefaultRayyanCondition(position: number): Record<string, unknown> {
  return {
    field: 'transaction.amount',
    operator: 'gt',
    value: 1000,
    value_type: 'number',
    position,
  }
}

const initialPreset = presetScenarios.find((scenario) => scenario.id === 'engine-fidelity') ?? presetScenarios[0]
const initialEditorState = readPersistedEditorState(buildEditorState(initialPreset.input))

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  workspaceMode: 'simulator',
  ...initialEditorState,
  network: null,
  diff: null,
  run: null,
  stepIndex: 0,
  isPlaying: false,
  isEngineEnabled: true,
  activeRuleId: null,
  playbackSpeed: 1,
  isLooping: false,
  isMemoryOpen: false,
  selectedMemoryTab: 'summary',
  selectedNodeId: 'root',
  error: null,
  activePresetId: initialPreset.id,
  setWorkspaceMode: (workspaceMode) => set({ workspaceMode }),
  setSource: (source) => set({ source }),
  setRulesText: (rulesText) => set({ rulesText }),
  setBaselineRulesText: (baselineRulesText) => set({ baselineRulesText }),
  setCandidateRulesText: (candidateRulesText) => set({ candidateRulesText }),
  setTransactionText: (transactionText) => set({ transactionText }),
  setUserProfileText: (userProfileText) => set({ userProfileText }),
  setAnalysisText: (analysisText) => set({ analysisText }),
  openFactModal: (factId = null) => set({ isFactModalOpen: true, editingFactId: factId }),
  closeFactModal: () => set({ isFactModalOpen: false, editingFactId: null }),
  saveFact: (fact, options) => {
    const current = get()
    const existingFacts = current.savedFacts.filter((savedFact) => savedFact.id !== fact.id)
    const nextFacts = [fact, ...existingFacts]
    set({
      savedFacts: nextFacts,
      selectedFactId: fact.id,
      transactionText: formatJson(fact.transaction),
      userProfileText: fact.userProfile ? formatJson(fact.userProfile) : current.userProfileText,
      selectedScenarioPackId: current.selectedScenarioPackId,
      isFactModalOpen: false,
      editingFactId: null,
      run: null,
      stepIndex: 0,
      isPlaying: false,
      selectedNodeId: 'root',
      error: null,
    })
    if (options?.runAfterSave) {
      get().runSelectedFact()
    }
  },
  selectFact: (factId) => {
    const current = get()
    const nextFact = factId ? current.savedFacts.find((fact) => fact.id === factId) ?? null : null
    set({
      selectedFactId: factId,
      transactionText: nextFact ? formatJson(nextFact.transaction) : current.transactionText,
      userProfileText: nextFact?.userProfile ? formatJson(nextFact.userProfile) : current.userProfileText,
      selectedScenarioPackId: current.selectedScenarioPackId,
      run: null,
      stepIndex: 0,
      isPlaying: false,
      selectedNodeId: 'root',
      error: null,
    })
  },
  deleteFact: (factId) => {
    const current = get()
    const nextFacts = current.savedFacts.filter((fact) => fact.id !== factId)
    const nextSelectedFactId = current.selectedFactId === factId
      ? (nextFacts[0]?.id ?? null)
      : current.selectedFactId
    const nextSelectedFact = nextSelectedFactId
      ? nextFacts.find((fact) => fact.id === nextSelectedFactId) ?? null
      : null

    set({
      savedFacts: nextFacts,
      selectedFactId: nextSelectedFactId,
      transactionText: nextSelectedFact ? formatJson(nextSelectedFact.transaction) : current.transactionText,
      userProfileText: nextSelectedFact?.userProfile ? formatJson(nextSelectedFact.userProfile) : current.userProfileText,
      selectedScenarioPackId: current.selectedScenarioPackId,
      isFactModalOpen: current.editingFactId === factId ? false : current.isFactModalOpen,
      editingFactId: current.editingFactId === factId ? null : current.editingFactId,
      run: null,
      stepIndex: 0,
      isPlaying: false,
      selectedNodeId: 'root',
      error: null,
    })
  },
  runSelectedFact: () => get().runSimulation(),
  saveScenarioPack: (name, description) => {
    const current = get()
    const trimmedName = name.trim()
    if (!trimmedName) return

    const input = parseEditorState(current)
    const canonicalRuleSet = normalizeRuleInput(input)
    const network = current.network ?? compileNetwork(canonicalRuleSet)
    const run = simulateFact(network, input)
    const selectedFact = current.selectedFactId
      ? current.savedFacts.find((fact) => fact.id === current.selectedFactId) ?? null
      : null

    const scenarioPack: ScenarioPack = {
      id: `scenario-${Date.now()}`,
      name: trimmedName,
      description: description.trim(),
      source: current.source,
      rulesText: current.rulesText,
      selectedFact: selectedFact ? JSON.parse(JSON.stringify(selectedFact)) as SavedFact : null,
      userProfileText: current.userProfileText,
      analysisText: current.analysisText,
      expectedDecision: run.result.decision,
      expectedTriggeredRuleNames: run.result.triggeredRules.map((evaluation) => evaluation.rule.name),
      expectedReasons: [...run.result.reasons],
      createdAt: new Date().toISOString(),
    }

    set((state) => ({
      scenarioPacks: [scenarioPack, ...state.scenarioPacks.filter((pack) => pack.id !== scenarioPack.id)],
      selectedScenarioPackId: scenarioPack.id,
    }))
  },
  loadScenarioPack: (scenarioPackId) => {
    const current = get()
    const scenarioPack = current.scenarioPacks.find((pack) => pack.id === scenarioPackId)
    if (!scenarioPack) return

    const selectedFact = scenarioPack.selectedFact
    const savedFacts = selectedFact
      ? [selectedFact, ...current.savedFacts.filter((fact) => fact.id !== selectedFact.id)]
      : current.savedFacts

    set({
      source: scenarioPack.source,
      rulesText: scenarioPack.rulesText,
      baselineRulesText: scenarioPack.rulesText,
      candidateRulesText: scenarioPack.rulesText,
      transactionText: selectedFact ? formatJson(selectedFact.transaction) : current.transactionText,
      userProfileText: selectedFact?.userProfile ? formatJson(selectedFact.userProfile) : scenarioPack.userProfileText,
      analysisText: scenarioPack.analysisText,
      savedFacts,
      selectedFactId: selectedFact?.id ?? current.selectedFactId,
      selectedScenarioPackId: scenarioPack.id,
      run: null,
      stepIndex: 0,
      isPlaying: false,
      activeRuleId: null,
      selectedNodeId: 'root',
      error: null,
    })
    get().compileFromEditor()
  },
  deleteScenarioPack: (scenarioPackId) => {
    const current = get()
    set({
      scenarioPacks: current.scenarioPacks.filter((pack) => pack.id !== scenarioPackId),
      selectedScenarioPackId: current.selectedScenarioPackId === scenarioPackId ? null : current.selectedScenarioPackId,
    })
  },
  appendRule: () => {
    const current = get()
    const parsed = JSON.parse(current.rulesText) as { rules?: Array<Record<string, unknown>> }
    const rules = Array.isArray(parsed.rules) ? [...parsed.rules] : []
    const organizationId = Number(
      (rules[0]?.organization_id as number | undefined)
        ?? (rules[0]?.organizationId as number | undefined)
        ?? 1,
    )
    const nextIndex = rules.length + 1
    const nextId = current.source === 'rayyan' ? `rayyan-draft-${nextIndex}` : `rules-engine-draft-${nextIndex}`
    const nextRule =
      current.source === 'rayyan'
        ? {
            id: nextId,
            name: `Draft Rule ${nextIndex}`,
            organization_id: organizationId,
            primary_operator: 'AND',
            rule_category: 'transaction',
            status: 'draft',
            condition_groups: [
              {
                position: 1,
                operator: 'AND',
                conditions: [buildDefaultRayyanCondition(1)],
              },
            ],
            conditions: [buildDefaultRayyanCondition(1)],
            actions: [{ type: 'review', decision: 'review', priority: 'medium' }],
          }
        : {
            id: nextId,
            name: `Draft Rule ${nextIndex}`,
            organization_id: organizationId,
            primary_operator: 'AND',
            status: 'draft',
            conditions: [buildDefaultRulesEngineCondition(1)],
            actions: [{ type: 'review', decision: 'review', priority: 'medium' }],
          }

    const nextRulesText = JSON.stringify({ ...parsed, rules: [...rules, nextRule] }, null, 2)
    set({ rulesText: nextRulesText, activeRuleId: nextId })
    get().compileFromEditor()
    set({ activeRuleId: nextId })
  },
  appendConditionToRule: (ruleId) => {
    const current = get()
    const parsed = JSON.parse(current.rulesText) as { rules?: Array<Record<string, unknown>> }
    const rules = Array.isArray(parsed.rules) ? [...parsed.rules] : []
    const ruleIndex = rules.findIndex((rule) => String(rule.id ?? '') === ruleId)
    if (ruleIndex < 0) return

    const nextRule = { ...rules[ruleIndex] }

    if (current.source === 'rayyan') {
      const flatConditions = Array.isArray(nextRule.conditions) ? [...(nextRule.conditions as Array<Record<string, unknown>>)] : []
      const nextPosition = flatConditions.reduce((max, condition) => {
        const currentPosition = typeof condition.position === 'number' ? condition.position : Number(condition.position ?? 0)
        return Math.max(max, Number.isFinite(currentPosition) ? currentPosition : 0)
      }, 0) + 1
      const nextCondition = buildDefaultRayyanCondition(nextPosition)
      nextRule.conditions = [...flatConditions, nextCondition]

      const groups = Array.isArray(nextRule.condition_groups) ? [...(nextRule.condition_groups as Array<Record<string, unknown>>)] : []
      if (groups.length === 0) {
        nextRule.condition_groups = [
          {
            position: 1,
            operator: 'AND',
            conditions: [nextCondition],
          },
        ]
      } else {
        const lastGroupIndex = groups.length - 1
        const lastGroup = { ...groups[lastGroupIndex] }
        const groupConditions = Array.isArray(lastGroup.conditions)
          ? [...(lastGroup.conditions as Array<Record<string, unknown>>)]
          : Array.isArray(lastGroup.rule_conditions)
            ? [...(lastGroup.rule_conditions as Array<Record<string, unknown>>)]
            : []
        lastGroup.conditions = [...groupConditions, nextCondition]
        groups[lastGroupIndex] = lastGroup
        nextRule.condition_groups = groups
      }
    } else {
      const flatConditions = Array.isArray(nextRule.conditions) ? [...(nextRule.conditions as Array<Record<string, unknown>>)] : []
      const nextPosition = flatConditions.reduce((max, condition) => {
        const currentPosition = typeof condition.position === 'number' ? condition.position : Number(condition.position ?? 0)
        return Math.max(max, Number.isFinite(currentPosition) ? currentPosition : 0)
      }, 0) + 1
      nextRule.conditions = [...flatConditions, buildDefaultRulesEngineCondition(nextPosition)]
    }

    rules[ruleIndex] = nextRule
    const nextRulesText = JSON.stringify({ ...parsed, rules }, null, 2)
    set({ rulesText: nextRulesText, activeRuleId: ruleId })
    get().compileFromEditor()
    set({ activeRuleId: ruleId })
  },
  deleteRule: (ruleId) => {
    const current = get()
    const result = removeRuleFromBundle(current.rulesText, ruleId)
    if (!result.removed) return
    set({
      rulesText: result.rulesText,
      activeRuleId: current.activeRuleId === ruleId ? null : current.activeRuleId,
      run: null,
      stepIndex: 0,
      isPlaying: false,
      selectedNodeId: 'root',
      error: null,
    })
    get().compileFromEditor()
  },
  loadPreset: (presetId) => {
    const preset = presetScenarios.find((scenario) => scenario.id === presetId)
    if (!preset) return
    set({
      ...buildEditorState(preset.input),
      network: null,
      diff: null,
      run: null,
      stepIndex: 0,
      isPlaying: false,
      isEngineEnabled: get().isEngineEnabled,
      activeRuleId: null,
      selectedNodeId: 'root',
      error: null,
      activePresetId: presetId,
      selectedScenarioPackId: null,
    })
  },
  compileFromEditor: () => {
    try {
      const current = get()
      const input = parseEditorState(current)
      if (current.workspaceMode === 'diff') {
        const baselineInput: SimulationInput = {
          ...input,
          rules: JSON.parse(current.baselineRulesText) as unknown,
        }
        const candidateInput: SimulationInput = {
          ...input,
          rules: JSON.parse(current.candidateRulesText) as unknown,
        }
        const diff = buildCompiledNetworkDiff(baselineInput, candidateInput)
        set({
          diff,
          network: diff.candidate,
          run: null,
          stepIndex: 0,
          isPlaying: false,
          selectedNodeId: 'root',
          error: null,
        })
        return
      }

      const canonicalRuleSet = normalizeRuleInput(input)
      const network = compileNetwork(canonicalRuleSet)
      set({
        diff: null,
        network,
        run: null,
        stepIndex: 0,
        isPlaying: false,
        activeRuleId: null,
        selectedNodeId: 'root',
        error: null,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to compile input',
      })
    }
  },
  runSimulation: () => {
    try {
      const current = get()
      if (!current.isEngineEnabled) return
      const input = parseEditorState(current)
      const canonicalRuleSet = normalizeRuleInput(input)
      const network = current.network ?? compileNetwork(canonicalRuleSet)
      const run = simulateFact(network, input)
      set({
        network,
        run,
        stepIndex: getCompletedRunIndex(run),
        isPlaying: false,
        selectedNodeId: current.selectedNodeId ?? 'root',
        error: null,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to run simulation',
      })
    }
  },
  toggleEngine: () =>
    set((state) => ({
      isEngineEnabled: !state.isEngineEnabled,
      isPlaying: !state.isEngineEnabled ? state.isPlaying : false,
    })),
  setActiveRuleId: (activeRuleId) => set({ activeRuleId, stepIndex: 0 }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  toggleLooping: () => set((state) => ({ isLooping: !state.isLooping })),
  setStepIndex: (stepIndex) => set({ stepIndex, isPlaying: false }),
  scrubToStep: (stepIndex) => set({ stepIndex }),
  playTraversal: () => {
    const { run, isEngineEnabled, stepIndex } = get()
    if (!isEngineEnabled || !run || run.timeline.length === 0) return
    const nextStepIndex = stepIndex >= run.timeline.length - 1
      ? 0
      : stepIndex
    set({ stepIndex: nextStepIndex, isPlaying: true })
  },
  pauseTraversal: () => set({ isPlaying: false }),
  advanceTraversal: () => {
    const { run, stepIndex, isEngineEnabled, isLooping } = get()
    if (!isEngineEnabled || !run) return
    if (stepIndex >= run.timeline.length - 1) {
      set(isLooping ? { stepIndex: 0 } : { isPlaying: false })
      return
    }
    set({ stepIndex: stepIndex + 1 })
  },
  resetTraversal: () => set({ stepIndex: 0, isPlaying: false }),
  selectNode: (selectedNodeId) => set({ selectedNodeId, isMemoryOpen: selectedNodeId !== null }),
  setMemoryOpen: (isMemoryOpen) => set({ isMemoryOpen }),
  setSelectedMemoryTab: (selectedMemoryTab) => set({ selectedMemoryTab }),
  getSnapshot: () => {
    const { network, run, stepIndex, selectedNodeId } = get()
    if (!network || !run) return null
    return replayTimeline(network, run, stepIndex, selectedNodeId)
  },
}))

useSimulatorStore.subscribe((state) => {
  persistEditorState(state)
})
