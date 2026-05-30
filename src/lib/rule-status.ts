export type RuleLifecycleStatus = 'active' | 'draft' | 'disabled' | 'inactive' | 'unknown'

export function normalizeRuleStatus(status: string | undefined | null): RuleLifecycleStatus {
  const normalized = (status ?? 'active').trim().toLowerCase()
  if (normalized === 'active') return 'active'
  if (normalized === 'draft') return 'draft'
  if (normalized === 'disabled') return 'disabled'
  if (normalized === 'inactive') return 'inactive'
  return 'unknown'
}

export function isRuleLiveInNetwork(status: string | undefined | null): boolean {
  return normalizeRuleStatus(status) === 'active'
}
