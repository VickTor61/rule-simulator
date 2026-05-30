import { useEffect, useMemo, useRef, useState } from 'react'
import type { Ref } from 'react'
import { useSimulatorStore } from '../lib/store'
import { cn } from '../lib/utils'
import { nodeTypePalette, type NodePaletteType } from '../lib/ui/node-colors'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { ScrollArea } from './ui/scroll-area'
import type { TimelineEvent } from '../lib/simulator/types'

function filterTimeline(events: TimelineEvent[], activeRuleId: string | null, relatedNodeIds: Set<string>): TimelineEvent[] {
  if (!activeRuleId) return events
  return events.filter((event) => {
    if (event.ruleId === activeRuleId) return true
    if (event.nodeId && relatedNodeIds.has(event.nodeId)) return true
    return event.phase === 'build' && event.nodeId === 'root'
  })
}

export function TimelinePanel({ embedded = false }: { embedded?: boolean } = {}): JSX.Element {
  const {
    network,
    run,
    stepIndex,
    isPlaying,
    activeRuleId,
    playbackSpeed,
    isLooping,
    scrubToStep,
    setStepIndex,
    setPlaybackSpeed,
    toggleLooping,
  } = useSimulatorStore()

  const activeEventRef = useRef<HTMLButtonElement | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const previousStepRef = useRef(stepIndex)
  const [shouldAnimateProgress, setShouldAnimateProgress] = useState(true)
  const currentEvent = run?.timeline[stepIndex] ?? null

  const relatedNodeIds = useMemo(() => {
    if (!network || !activeRuleId) return new Set<string>()
    return new Set(
      network.flowNodes
        .filter((node) => (node.data.relatedRuleIds ?? []).includes(activeRuleId))
        .map((node) => node.id),
    )
  }, [activeRuleId, network])

  const filteredTimeline = useMemo(
    () => filterTimeline(run?.timeline ?? [], activeRuleId, relatedNodeIds),
    [activeRuleId, relatedNodeIds, run?.timeline],
  )

  useEffect(() => {
    const previousStep = previousStepRef.current
    const isLoopReset = isLooping && isPlaying && stepIndex === 0 && previousStep > 0
    setShouldAnimateProgress(!isLoopReset)
    previousStepRef.current = stepIndex
  }, [isLooping, isPlaying, stepIndex])

  useEffect(() => {
    if (!activeEventRef.current || !scrollAreaRef.current) return
    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null
    if (!viewport) return
    const scrollViewport = (
      typeof viewport.scrollTo === 'function'
        ? viewport
        : null
    )

    const itemTop = activeEventRef.current.offsetTop
    const itemBottom = itemTop + activeEventRef.current.offsetHeight
    const targetTop = Math.max(0, itemTop - viewport.clientHeight * 0.28)
    const isLoopRestart = isPlaying && isLooping && stepIndex === 0

    if (isLoopRestart) {
      if (scrollViewport) {
        scrollViewport.scrollTo({ top: 0, behavior: 'auto' })
      } else {
        viewport.scrollTop = 0
      }
      window.requestAnimationFrame(() => {
        if (scrollViewport) {
          scrollViewport.scrollTo({ top: targetTop, behavior: 'smooth' })
        } else {
          viewport.scrollTop = targetTop
        }
      })
      return
    }

    const viewTop = viewport.scrollTop
    const viewBottom = viewTop + viewport.clientHeight

    if (itemTop < viewTop || itemBottom > viewBottom || isPlaying) {
      if (scrollViewport) {
        scrollViewport.scrollTo({ top: targetTop, behavior: isPlaying ? 'smooth' : 'auto' })
      } else {
        viewport.scrollTop = targetTop
      }
    }
  }, [isLooping, isPlaying, stepIndex])

  const phaseGroups = useMemo(
    () => [
      { label: 'Network build', events: filteredTimeline.filter((event) => event.phase === 'build') },
      { label: 'Fact execution', events: filteredTimeline.filter((event) => event.phase === 'execute') },
    ].filter((group) => group.events.length > 0),
    [filteredTimeline],
  )

  const progressPercent = run && run.timeline.length > 1 ? (stepIndex / (run.timeline.length - 1)) * 100 : 0

  const content = (
    <div className={cn('flex min-w-0 flex-col', embedded && 'h-full min-h-0 flex-1')}>
      {!embedded ? (
        <CardHeader>
          <div className="space-y-1">
            <p className="eyebrow">Replay</p>
            <CardTitle>Engine replay timeline</CardTitle>
          </div>
        </CardHeader>
      ) : (
        <div className="space-y-1 border-t border-border px-4 pb-0 pt-3">
          <p className="eyebrow">Replay</p>
          <h3>Engine replay timeline</h3>
        </div>
      )}

      <CardContent className={cn('min-w-0 pt-0', embedded && 'flex h-full min-h-0 flex-1 flex-col px-4 pb-4')}>
        {run ? (
          <>
            <div className="mb-2 grid min-w-0 gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {isPlaying ? 'Live engine replay' : 'Current replay step'}
                  </span>
                  <Badge variant="outline" className="h-5 rounded-full px-2 text-xs">
                    {stepIndex + 1}/{run.timeline.length}
                  </Badge>
                  <Badge variant="outline" className="h-5 rounded-full px-2 text-xs">
                    {currentEvent?.phase ?? 'execute'}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    aria-label="Timeline speed"
                    className="h-7 rounded-full border border-zinc-200 bg-white px-2.5 text-xs text-foreground"
                    value={String(playbackSpeed)}
                    onChange={(event) => setPlaybackSpeed(Number(event.target.value) as 0.5 | 1 | 1.5 | 2 | 3)}
                  >
                    {[0.5, 1, 1.5, 2, 3].map((speed) => (
                      <option key={speed} value={speed}>
                        {speed}x
                      </option>
                    ))}
                  </select>
                  <Button size="sm" variant={isLooping ? 'default' : 'outline'} className="h-7 rounded-full px-2.5 text-xs" onClick={toggleLooping}>
                    Loop
                  </Button>
                </div>
              </div>
              <div className="min-w-0 flex items-center gap-2 rounded-xl bg-zinc-50 px-2.5 py-2">
                <span className="truncate text-xs font-medium leading-5 text-foreground">
                  {currentEvent?.label ?? 'Waiting for playback'}
                </span>
                <span className="truncate text-xs leading-5 text-muted-foreground">
                  {currentEvent?.detail ?? 'Run a simulation to inspect traversal events.'}
                </span>
              </div>
              <div className="relative h-5">
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className={cn(
                      'h-full rounded-full bg-zinc-900',
                      shouldAnimateProgress && 'transition-[width] duration-500 ease-out',
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div
                  className={cn(
                    'pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-zinc-900 bg-white shadow-sm',
                    shouldAnimateProgress && 'transition-[left] duration-500 ease-out',
                  )}
                  style={{ left: `calc(${progressPercent}% - 0.375rem)` }}
                />
                <input
                  aria-label="Replay scrubber"
                  type="range"
                  min={0}
                  max={Math.max(0, run.timeline.length - 1)}
                  value={stepIndex}
                  onChange={(event) => scrubToStep(Number(event.target.value))}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                />
              </div>
            </div>
            <ScrollArea
              ref={scrollAreaRef}
              className={cn(
                embedded ? 'h-full min-h-0 min-w-0 flex-1 pr-3' : 'h-[280px] pr-3',
              )}
            >
              <div className="grid min-w-0 gap-3">
                {phaseGroups.map((group) => (
                  <div key={group.label} className="grid min-w-0 gap-1.5">
                    <div className="sticky top-0 z-10 rounded-full border border-zinc-200 bg-white/95 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground backdrop-blur">
                      {group.label}
                    </div>
                    {group.events.map((event) => (
                      <TimelineEventRow
                        key={`${event.type}-${event.index}`}
                        event={event}
                        active={stepIndex === event.index}
                        nodeType={(event.nodeId && network?.nodes[event.nodeId]?.type) || null}
                        rowRef={stepIndex === event.index ? activeEventRef : undefined}
                        onClick={() => setStepIndex(event.index)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-border bg-zinc-50 text-sm text-muted-foreground">
            Run a simulation to replay how the engine builds alpha, beta, and production nodes, then sends a fact through them.
          </div>
        )}
      </CardContent>
    </div>
  )

  if (embedded) return content
  return <Card>{content}</Card>
}

function TimelineEventRow({
  event,
  active,
  nodeType,
  onClick,
  rowRef,
}: {
  event: TimelineEvent
  active: boolean
  nodeType: NodePaletteType | null
  onClick: () => void
  rowRef?: Ref<HTMLButtonElement>
}): JSX.Element {
  const palette = nodeType ? nodeTypePalette[nodeType] : nodeTypePalette.root

  return (
    <Button
      ref={rowRef}
      variant="ghost"
      className={cn(
        'h-auto w-full min-w-0 max-w-full items-start justify-start rounded-2xl border px-2.5 py-2 text-left',
        active ? `${palette.soft} shadow-sm` : 'border-zinc-200 bg-white hover:bg-zinc-50',
      )}
      onClick={onClick}
    >
      <div className="grid min-w-0 gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={cn('truncate text-xs font-medium leading-5', palette.strong)}>{event.label}</span>
          <Badge variant="outline" className={cn('h-5 rounded-full px-2 text-xs', palette.badge)}>
            {event.type}
          </Badge>
          <Badge variant="outline" className="h-5 rounded-full px-2 text-xs">
            {event.phase}
          </Badge>
          {nodeType ? (
            <Badge variant="outline" className={cn('h-5 rounded-full px-2 text-xs', palette.badge)}>
              {nodeType}
            </Badge>
          ) : null}
        </div>
        <span className="min-w-0 truncate text-xs leading-4 text-muted-foreground">{event.detail}</span>
      </div>
    </Button>
  )
}
