import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Circle,
  FilePlus2,
  Folder,
  GitBranch,
  Pencil,
  Play,
  Search,
  Trash2,
} from 'lucide-react'
import type { AlphaCompiledNode, Rule, RuleCondition } from '../lib/simulator/types'
import { normalizeRuleStatus } from '../lib/rule-status'
import { useSimulatorStore } from '../lib/store'
import { cn } from '../lib/utils'
import type { RuleEditorMode } from './RuleEditorModal'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

type TreeRow =
  | { id: string; kind: 'section'; label: string; depth: number; expandable: boolean; expanded: boolean; muted?: boolean }
  | { id: string; kind: 'ruleset'; label: string; depth: number; expandable: boolean; expanded: boolean; orgId: number }
  | {
      id: string
      kind: 'rule'
      label: string
      depth: number
      expandable: boolean
      expanded: boolean
      ruleId: string
      compileLabel: 'Live' | 'Draft' | 'Disabled'
      compileTone: 'live' | 'draft' | 'disabled'
      primaryOperator: 'AND' | 'OR'
      conditionCount: number
    }
  | { id: string; kind: 'group'; label: string; depth: number; expandable: boolean; expanded: boolean; ruleId: string }
  | { id: string; kind: 'condition'; label: string; depth: number; expandable: false; expanded: false; ruleId: string; condition: RuleCondition }

type RuleSection = 'rulesets' | 'drafts' | 'disabled'

function formatCondition(condition: RuleCondition): string {
  return `${condition.field} ${condition.operator} ${String(condition.value)}`
}

function getRuleSection(rule: Rule): RuleSection {
  if ((rule.status ?? '').toLowerCase() === 'disabled') return 'disabled'
  if ((rule.status ?? '').toLowerCase() === 'draft') return 'drafts'
  return 'rulesets'
}

function getCompileBadge(status: string | undefined): Pick<Extract<TreeRow, { kind: 'rule' }>, 'compileLabel' | 'compileTone'> {
  const normalized = normalizeRuleStatus(status)
  if (normalized === 'active') return { compileLabel: 'Live', compileTone: 'live' }
  if (normalized === 'draft') return { compileLabel: 'Draft', compileTone: 'draft' }
  return { compileLabel: 'Disabled', compileTone: 'disabled' }
}

function findAlphaForCondition(
  network: ReturnType<typeof useSimulatorStore.getState>['network'],
  ruleId: string,
  condition: RuleCondition,
): AlphaCompiledNode | null {
  if (!network) return null
  return Object.values(network.nodes).find((node): node is AlphaCompiledNode => {
    if (node.type !== 'alpha') return false
    if (!node.relatedRuleIds.includes(ruleId)) return false
    return (
      node.condition.field === condition.field
      && node.condition.operator === condition.operator
      && String(node.condition.value) === String(condition.value)
    )
  }) ?? null
}

function WorkspaceRow({
  row,
  selected,
  onToggle,
  onSelect,
  onRunRule,
  onEditRule,
  onDeleteRule,
}: {
  row: TreeRow
  selected: boolean
  onToggle: (rowId: string) => void
  onSelect: (row: TreeRow) => void
  onRunRule: (ruleId: string) => void
  onEditRule: (ruleId: string) => void
  onDeleteRule: (ruleId: string) => void
}): JSX.Element {
  const paddingLeft = 12 + row.depth * 18
  const base = (
    <div
      role="button"
      tabIndex={-1}
      onClick={() => onSelect(row)}
      className={cn(
        'group flex min-h-11 w-full items-center rounded-2xl px-3 text-left transition-colors',
        selected ? 'bg-zinc-950 text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-zinc-700 hover:bg-zinc-50',
        row.kind === 'condition' && 'min-h-9',
      )}
      style={{ paddingLeft }}
    >
      <span className="mr-2 flex h-4 w-4 items-center justify-center text-zinc-500">
        {row.expandable ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation()
              onToggle(row.id)
            }}
            className={cn(
              'inline-flex h-4 w-4 items-center justify-center rounded-sm transition-colors',
              selected ? 'text-white/80 hover:bg-white/10' : 'hover:bg-zinc-200',
            )}
          >
            {row.expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </span>
      <span className={cn('mr-2 flex h-4 w-4 shrink-0 items-center justify-center', selected ? 'text-white/80' : 'text-zinc-500')}>
        {row.kind === 'section' || row.kind === 'ruleset' ? <Folder className="h-3.5 w-3.5" /> : row.kind === 'rule' ? <GitBranch className="h-3.5 w-3.5" /> : <Circle className={row.kind === 'condition' ? 'h-2.5 w-2.5 fill-current' : 'h-3 w-3'} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm leading-6">{row.label}</span>
      {row.kind === 'rule' ? (
        <span
          className={cn(
            'ml-3 inline-flex h-2.5 w-2.5 rounded-full',
            row.compileTone === 'live'
              ? selected ? 'bg-white' : 'bg-emerald-500'
              : row.compileTone === 'draft'
                ? selected ? 'bg-white/80' : 'bg-amber-400'
                : selected ? 'bg-white/60' : 'bg-zinc-300',
          )}
        />
      ) : null}
      {row.kind === 'rule' ? (
        <span className={cn('ml-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100', selected && 'opacity-100')}>
          <Button
            type="button"
            size="icon"
            variant={selected ? 'secondary' : 'ghost'}
            className="h-7 w-7 rounded-full"
            onClick={(event) => {
              event.stopPropagation()
              onRunRule(row.ruleId)
            }}
            aria-label="Test rule"
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={selected ? 'secondary' : 'ghost'}
            className="h-7 w-7 rounded-full"
            onClick={(event) => {
              event.stopPropagation()
              onEditRule(row.ruleId)
            }}
            aria-label="Edit rule"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={selected ? 'secondary' : 'ghost'}
            className="h-7 w-7 rounded-full"
            onClick={(event) => {
              event.stopPropagation()
              onDeleteRule(row.ruleId)
            }}
            aria-label="Delete rule"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </span>
      ) : null}
    </div>
  )

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{base}</TooltipTrigger>
        <TooltipContent side="right">
          {row.kind === 'condition'
            ? formatCondition(row.condition)
            : row.kind === 'rule'
              ? `${row.label} · ${row.primaryOperator} · ${row.conditionCount} condition${row.conditionCount === 1 ? '' : 's'}`
              : row.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function RulesetsWorkspace({
  onOpenEditor,
}: {
  onOpenEditor: (mode: RuleEditorMode, ruleId?: string | null) => void
}): JSX.Element {
  const { network, activeRuleId, selectedNodeId, setActiveRuleId, selectNode, deleteRule, runSimulation, source } = useSimulatorStore()
  const [query, setQuery] = useState('')
  const [activeRowId, setActiveRowId] = useState<string>('section:rulesets')
  const [ruleFilterId, setRuleFilterId] = useState<string>('__all__')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'section:rulesets': true,
    'section:drafts': true,
    'section:disabled': false,
  })
  const [expandedRulesets, setExpandedRulesets] = useState<Record<string, boolean>>({})
  const [expandedRules, setExpandedRules] = useState<Record<string, boolean>>({})

  const rules = network?.canonicalRuleSet.rules ?? []
  const filteredRules = useMemo(() => {
    const scopedRules = ruleFilterId === '__all__'
      ? rules
      : rules.filter((rule) => rule.id === ruleFilterId)

    if (!query.trim()) return scopedRules
    const lowerQuery = query.trim().toLowerCase()
    return scopedRules.filter((rule) => {
      if (rule.name.toLowerCase().includes(lowerQuery)) return true
      return rule.conditions.some((condition) => formatCondition(condition).toLowerCase().includes(lowerQuery))
    })
  }, [query, ruleFilterId, rules])

  const groupedRules = useMemo(() => {
    const rulesets = new Map<number, Rule[]>()
    const drafts: Rule[] = []
    const disabled: Rule[] = []

    filteredRules.forEach((rule) => {
      const section = getRuleSection(rule)
      if (section === 'drafts') {
        drafts.push(rule)
        return
      }
      if (section === 'disabled') {
        disabled.push(rule)
        return
      }
      rulesets.set(rule.organizationId, [...(rulesets.get(rule.organizationId) ?? []), rule])
    })

    return { rulesets, drafts, disabled }
  }, [filteredRules])

  useEffect(() => {
    if (!activeRuleId) return
    const activeRule = rules.find((rule) => rule.id === activeRuleId)
    if (!activeRule) return
    setExpandedSections((current) => ({ ...current, [`section:${getRuleSection(activeRule)}`]: true }))
    setExpandedRulesets((current) => ({ ...current, [`ruleset:${activeRule.organizationId}`]: true }))
    setExpandedRules((current) => ({ ...current, [`rule:${activeRule.id}`]: true }))
    setActiveRowId(`rule:${activeRule.id}`)
  }, [activeRuleId, rules])

  const rows = useMemo(() => {
    const nextRows: TreeRow[] = []

    const pushRuleChildren = (rule: Rule): void => {
      const ruleKey = `rule:${rule.id}`
      const isRuleExpanded = expandedRules[ruleKey] ?? rule.id === activeRuleId
      nextRows.push({
        id: ruleKey,
        kind: 'rule',
        label: rule.name,
        depth: 2,
        expandable: true,
        expanded: isRuleExpanded,
        ruleId: rule.id,
        ...getCompileBadge(rule.status),
        primaryOperator: rule.primaryOperator,
        conditionCount: rule.conditions.length,
      })
      if (!isRuleExpanded) return

      nextRows.push({
        id: `group:${rule.id}:conditions`,
        kind: 'group',
        label: `Conditions (${rule.conditions.length})`,
        depth: 3,
        expandable: false,
        expanded: false,
        ruleId: rule.id,
      })

      rule.conditions.forEach((condition, index) => {
        nextRows.push({
          id: `condition:${rule.id}:${index}`,
          kind: 'condition',
          label: formatCondition(condition),
          depth: 4,
          expandable: false,
          expanded: false,
          ruleId: rule.id,
          condition,
        })
      })
    }

    nextRows.push({ id: 'section:rulesets', kind: 'section', label: 'Rulesets', depth: 0, expandable: true, expanded: expandedSections['section:rulesets'] ?? true })
    if (expandedSections['section:rulesets'] ?? true) {
      groupedRules.rulesets.forEach((orgRules, orgId) => {
        const rulesetKey = `ruleset:${orgId}`
        const isExpanded = expandedRulesets[rulesetKey] ?? true
        nextRows.push({ id: rulesetKey, kind: 'ruleset', label: `Organization ${orgId}`, depth: 1, expandable: true, expanded: isExpanded, orgId })
        if (isExpanded) orgRules.forEach(pushRuleChildren)
      })
    }

    nextRows.push({ id: 'section:drafts', kind: 'section', label: 'Draft rules', depth: 0, expandable: true, expanded: expandedSections['section:drafts'] ?? true, muted: groupedRules.drafts.length === 0 })
    if (expandedSections['section:drafts'] ?? true) groupedRules.drafts.forEach(pushRuleChildren)

    nextRows.push({ id: 'section:disabled', kind: 'section', label: 'Disabled rules', depth: 0, expandable: true, expanded: expandedSections['section:disabled'] ?? false, muted: groupedRules.disabled.length === 0 })
    if (expandedSections['section:disabled'] ?? false) groupedRules.disabled.forEach(pushRuleChildren)

    return nextRows
  }, [activeRuleId, expandedRules, expandedRulesets, expandedSections, groupedRules])

  const rowIndex = rows.findIndex((row) => row.id === activeRowId)

  const toggleRow = (rowId: string): void => {
    if (rowId.startsWith('section:')) {
      setExpandedSections((current) => ({ ...current, [rowId]: !current[rowId] }))
      return
    }
    if (rowId.startsWith('ruleset:')) {
      setExpandedRulesets((current) => ({ ...current, [rowId]: !current[rowId] }))
      return
    }
    if (rowId.startsWith('rule:')) setExpandedRules((current) => ({ ...current, [rowId]: !current[rowId] }))
  }

  const handleSelectRow = (row: TreeRow): void => {
    setActiveRowId(row.id)
    if (row.kind === 'ruleset' || row.kind === 'section') {
      if (row.expandable) toggleRow(row.id)
      return
    }
    if (row.kind === 'rule') {
      setActiveRuleId(row.ruleId)
      selectNode('root')
      setExpandedRules((current) => ({ ...current, [row.id]: true }))
      return
    }
    if (row.kind === 'group') {
      setActiveRuleId(row.ruleId)
      selectNode('root')
      return
    }
    if (row.kind === 'condition') {
      setActiveRuleId(row.ruleId)
      const alphaNode = findAlphaForCondition(network, row.ruleId, row.condition)
      selectNode(alphaNode?.id ?? selectedNodeId ?? 'root')
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (rows.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const nextIndex = rowIndex < 0 ? 0 : Math.min(rows.length - 1, rowIndex + 1)
      handleSelectRow(rows[nextIndex])
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const nextIndex = rowIndex <= 0 ? 0 : rowIndex - 1
      handleSelectRow(rows[nextIndex])
      return
    }
  }

  const liveRuleCount = rules.filter((rule) => normalizeRuleStatus(rule.status) === 'active').length
  const draftRuleCount = rules.filter((rule) => normalizeRuleStatus(rule.status) === 'draft').length
  const disabledRuleCount = rules.filter((rule) => normalizeRuleStatus(rule.status) === 'disabled').length

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-0 bg-transparent shadow-none">
      <CardHeader className="gap-4 border-b border-zinc-200/80 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Rulesets</p>
            <CardTitle className="mt-1 text-lg font-semibold tracking-[-0.02em] text-zinc-950">Rule network sources</CardTitle>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Browse active, draft, and disabled rules. Select a condition to focus the matching alpha node on the canvas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-9 rounded-full px-4" onClick={() => onOpenEditor('new')}>
              <FilePlus2 className="mr-1.5 h-4 w-4" />
              Guided rule builder
            </Button>
            <Button size="sm" variant="outline" className="h-9 rounded-full border-zinc-200 px-4" onClick={() => onOpenEditor('json')}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Import rule JSON
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Source</p>
            <p className="mt-1 text-sm font-medium text-zinc-950">{source}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Live</p>
            <p className="mt-1 text-sm font-medium text-zinc-950">{liveRuleCount} active rules</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Drafts</p>
            <p className="mt-1 text-sm font-medium text-zinc-950">{draftRuleCount} draft rules</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Disabled</p>
            <p className="mt-1 text-sm font-medium text-zinc-950">{disabledRuleCount} disabled rules</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search rules or conditions"
              className="h-10 w-full rounded-2xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors focus:border-zinc-300 focus:bg-white"
            />
          </div>
          <select
            aria-label="Filter rules"
            value={ruleFilterId}
            onChange={(event) => {
              const nextRuleId = event.target.value
              setRuleFilterId(nextRuleId)
              setQuery('')
              if (nextRuleId === '__all__') {
                setActiveRuleId(null)
                setActiveRowId('section:rulesets')
                return
              }
              const nextRule = rules.find((rule) => rule.id === nextRuleId)
              if (!nextRule) return
              setActiveRuleId(nextRule.id)
              setExpandedSections((current) => ({ ...current, [`section:${getRuleSection(nextRule)}`]: true }))
              setExpandedRulesets((current) => ({ ...current, [`ruleset:${nextRule.organizationId}`]: true }))
              setExpandedRules((current) => ({ ...current, [`rule:${nextRule.id}`]: true }))
              setActiveRowId(`rule:${nextRule.id}`)
            }}
            className="h-10 min-w-[240px] rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none focus:border-zinc-300"
          >
            <option value="__all__">All rules</option>
            {rules.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {rule.name}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto p-4" tabIndex={0} onKeyDown={handleKeyDown}>
        <div className="space-y-1">
          {rows.map((row) => (
            <WorkspaceRow
              key={row.id}
              row={row}
              selected={activeRowId === row.id || (row.kind === 'rule' && activeRuleId === row.ruleId)}
              onToggle={toggleRow}
              onSelect={handleSelectRow}
              onRunRule={() => {
                if (row.kind === 'rule') {
                  setActiveRuleId(row.ruleId)
                  runSimulation()
                }
              }}
              onEditRule={(ruleId) => onOpenEditor('edit', ruleId)}
              onDeleteRule={(ruleId) => {
                deleteRule(ruleId)
                setActiveRowId('section:rulesets')
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
