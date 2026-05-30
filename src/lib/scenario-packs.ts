import type { SavedFact } from './facts'
import type { RuleSource } from './simulator/types'

export type ScenarioPack = {
  id: string
  name: string
  description: string
  source: RuleSource
  rulesText: string
  selectedFact: SavedFact | null
  userProfileText: string
  analysisText: string
  expectedDecision: string
  expectedTriggeredRuleNames: string[]
  expectedReasons: string[]
  createdAt: string
}

export function isScenarioPack(value: unknown): value is ScenarioPack {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<ScenarioPack>
  return (
    typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.description === 'string'
    && (candidate.source === 'rayyan' || candidate.source === 'rules-engine')
    && typeof candidate.rulesText === 'string'
    && typeof candidate.userProfileText === 'string'
    && typeof candidate.analysisText === 'string'
    && typeof candidate.expectedDecision === 'string'
    && Array.isArray(candidate.expectedTriggeredRuleNames)
    && Array.isArray(candidate.expectedReasons)
    && typeof candidate.createdAt === 'string'
    && (
      candidate.selectedFact === null
      || candidate.selectedFact === undefined
      || typeof candidate.selectedFact === 'object'
    )
  )
}
