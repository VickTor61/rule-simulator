import { AlertCircle, Braces, CheckCircle2, ChevronsUpDown, Search, WandSparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { presetScenarios } from '../lib/presets/scenarios'
import { useSimulatorStore } from '../lib/store'
import { cn } from '../lib/utils'
import type { RuleSource } from '../lib/simulator/types'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Separator } from './ui/separator'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import { Textarea } from './ui/textarea'

const sources: RuleSource[] = ['rules-engine']

export function ImportPanel(): JSX.Element {
  const {
    workspaceMode,
    source,
    rulesText,
    baselineRulesText,
    candidateRulesText,
    transactionText,
    userProfileText,
    analysisText,
    activePresetId,
    isEngineEnabled,
    error,
    setWorkspaceMode,
    setSource,
    setRulesText,
    setBaselineRulesText,
    setCandidateRulesText,
    setTransactionText,
    setUserProfileText,
    setAnalysisText,
    loadPreset,
    compileFromEditor,
    runSimulation,
  } = useSimulatorStore()
  const [presetSearch, setPresetSearch] = useState('')

  const filteredPresets = useMemo(() => {
    const query = presetSearch.trim().toLowerCase()
    if (!query) return presetScenarios
    return presetScenarios.filter((scenario) => scenario.label.toLowerCase().includes(query))
  }, [presetSearch])

  const activePreset = presetScenarios.find((scenario) => scenario.id === activePresetId)

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="space-y-2.5">
        <div className="space-y-1">
          <p className="eyebrow">Inputs</p>
          <CardTitle>Import and presets</CardTitle>
          <CardDescription>Load a preset or paste rule, fact, and analysis payloads.</CardDescription>
        </div>

        <Tabs value={workspaceMode} onValueChange={(value) => setWorkspaceMode(value as 'simulator' | 'diff')}>
          <TabsList className="h-8 w-full">
            <TabsTrigger value="simulator" className="flex-1">Simulator</TabsTrigger>
            <TabsTrigger value="diff" className="flex-1">Diff</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-2.5">
          <div className="space-y-1">
            <label className="eyebrow">Preset scenario</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8 w-full justify-between px-3 text-sm font-normal">
                  <span className="truncate">{activePreset?.label ?? 'Select a preset'}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-0">
                <div className="border-b border-border p-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={presetSearch}
                      onChange={(event) => setPresetSearch(event.target.value)}
                      placeholder="Search preset scenario"
                      className="h-8 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    />
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto p-1">
                  {filteredPresets.length > 0 ? filteredPresets.map((scenario) => (
                    <button
                      key={scenario.id}
                      className={cn('flex w-full flex-col items-start rounded-md px-3 py-2 text-left transition-colors hover:bg-muted', scenario.id === activePresetId && 'bg-muted')}
                      onClick={() => {
                        loadPreset(scenario.id)
                        setPresetSearch('')
                      }}
                      type="button"
                    >
                      <span className="text-sm font-medium leading-6 text-foreground">{scenario.label}</span>
                      <span className="text-xs leading-5 text-muted-foreground">{scenario.description}</span>
                    </button>
                  )) : <div className="px-3 py-4 text-sm text-muted-foreground">No matching preset scenarios.</div>}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {sources.map((candidate) => (
              <Button key={candidate} size="sm" variant={source === candidate ? 'default' : 'outline'} onClick={() => setSource(candidate)}>
                {candidate}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto pt-4">
        {workspaceMode === 'diff' ? (
          <>
            <JsonEditor label="Baseline Rules JSON" description="Reference rule bundle used as the comparison baseline." value={baselineRulesText} minHeight="min-h-[240px]" onChange={setBaselineRulesText} />
            <JsonEditor label="Candidate Rules JSON" description="Updated rule bundle rendered as the candidate graph." value={candidateRulesText} minHeight="min-h-[240px]" onChange={setCandidateRulesText} />
          </>
        ) : (
          <JsonEditor label="Rules JSON" description="Paste a rules-engine rule bundle." value={rulesText} minHeight="min-h-[280px]" onChange={setRulesText} />
        )}

        <JsonEditor label="Transaction JSON" description="Transaction payload used to create the fact." value={transactionText} onChange={setTransactionText} />
        <JsonEditor label="User Profile JSON" description="Optional profile data merged into evaluation." value={userProfileText} onChange={setUserProfileText} />
        <JsonEditor label="Analysis Seed JSON" description="Optional analysis overrides such as velocity counters." value={analysisText} onChange={setAnalysisText} />

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={compileFromEditor}>
            {workspaceMode === 'diff' ? 'Compare' : 'Compile'}
          </Button>
          {workspaceMode === 'simulator' ? (
            <Button size="sm" onClick={runSimulation} disabled={!isEngineEnabled}>
              Run
            </Button>
          ) : null}
        </div>

        {error ? <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">{error}</div> : null}
      </CardContent>
    </Card>
  )
}

function JsonEditor({
  label,
  description,
  value,
  onChange,
  minHeight,
}: {
  label: string
  description: string
  value: string
  onChange: (value: string) => void
  minHeight?: string
}): JSX.Element {
  const analysis = useMemo(() => {
    const trimmed = value.trim()
    if (!trimmed) return { status: 'empty' as const, lineCount: 1, error: null as string | null }
    try {
      JSON.parse(trimmed)
      return { status: 'valid' as const, lineCount: trimmed.split('\n').length, error: null as string | null }
    } catch (error) {
      return { status: 'invalid' as const, lineCount: trimmed.split('\n').length, error: error instanceof Error ? error.message : 'Invalid JSON' }
    }
  }, [value])

  const formatJson = (): void => {
    if (analysis.status !== 'valid') return
    onChange(JSON.stringify(JSON.parse(value), null, 2))
  }

  return (
    <section className="space-y-1.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <label className="eyebrow">{label}</label>
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <StatusBadge status={analysis.status} />
          <Badge variant="outline">{analysis.lineCount} lines</Badge>
          <Button size="sm" variant="outline" onClick={formatJson} disabled={analysis.status !== 'valid'}>
            <WandSparkles className="mr-1.5 h-3.5 w-3.5" />
            Format
          </Button>
        </div>
      </div>

      <div className={cn('group rounded-lg border bg-zinc-50/80 transition-all duration-200', analysis.status === 'invalid' ? 'border-zinc-400' : 'border-border hover:border-zinc-300', 'focus-within:border-zinc-900 focus-within:bg-white focus-within:shadow-sm')}>
        <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Braces className="h-3.5 w-3.5" />
            <span>application/json</span>
          </div>
          {analysis.error ? (
            <span className="max-w-full truncate text-xs leading-5 text-muted-foreground sm:max-w-[220px]">{analysis.error}</span>
          ) : (
            <span className="text-xs leading-5 text-muted-foreground">{analysis.status === 'valid' ? 'Well-formed JSON' : 'Paste JSON content'}</span>
          )}
        </div>
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          className={cn('rounded-none border-0 bg-transparent px-3 py-3 shadow-none ring-0 transition-colors focus-visible:ring-0 focus-visible:ring-offset-0', minHeight ?? 'min-h-[164px]')}
        />
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: 'valid' | 'invalid' | 'empty' }): JSX.Element {
  if (status === 'valid') {
    return (
      <Badge variant="outline" className="border-zinc-300 bg-white text-zinc-700">
        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
        Valid
      </Badge>
    )
  }
  if (status === 'invalid') {
    return (
      <Badge variant="outline" className="border-zinc-300 bg-zinc-100 text-zinc-700">
        <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
        Needs fix
      </Badge>
    )
  }
  return <Badge variant="outline">Empty</Badge>
}
