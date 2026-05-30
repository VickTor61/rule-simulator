import { useEffect, useMemo, useState } from 'react'
import { PanelLeft } from 'lucide-react'
import { AddFactModal } from './components/AddFactModal'
import { CoreFeaturesWorkspace } from './components/CoreFeaturesWorkspace'
import { ExplanationPanel } from './components/ExplanationPanel'
import { FactsWorkspace } from './components/FactsWorkspace'
import { GraphCanvas } from './components/GraphCanvas'
import { RuleEditorModal, type RuleEditorMode } from './components/RuleEditorModal'
import { RuleSidebar, type SidebarPage } from './components/RuleSidebar'
import { RulesetsWorkspace } from './components/RulesetsWorkspace'
import { Button } from './components/ui/button'
import { useSimulatorStore } from './lib/store'

export default function App(): JSX.Element {
  const { network, diff, error, isEngineEnabled, toggleEngine, compileFromEditor } = useSimulatorStore()
  const [showSidebar, setShowSidebar] = useState(true)
  const [sidebarPage, setSidebarPage] = useState<SidebarPage>('home')
  const [displayedPage, setDisplayedPage] = useState<SidebarPage>('home')
  const [isPageVisible, setIsPageVisible] = useState(true)
  const [isRuleEditorOpen, setIsRuleEditorOpen] = useState(false)
  const [ruleEditorMode, setRuleEditorMode] = useState<RuleEditorMode>('edit')
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)

  useEffect(() => {
    if (!network && !diff && !error) {
      compileFromEditor()
    }
  }, [compileFromEditor, diff, error, network])

  useEffect(() => {
    if (sidebarPage === displayedPage) return

    setIsPageVisible(false)

    const swapTimer = window.setTimeout(() => {
      setDisplayedPage(sidebarPage)
      window.requestAnimationFrame(() => {
        setIsPageVisible(true)
      })
    }, 120)

    return () => window.clearTimeout(swapTimer)
  }, [displayedPage, sidebarPage])

  const layoutClassName = useMemo(() => {
    if (showSidebar) return 'xl:grid-cols-[320px_minmax(0,1fr)]'
    return 'xl:grid-cols-[minmax(0,1fr)]'
  }, [showSidebar])

  const handleOpenRuleEditor = (mode: RuleEditorMode, ruleId: string | null = null): void => {
    setRuleEditorMode(mode)
    setEditingRuleId(ruleId)
    setIsRuleEditorOpen(true)
  }

  const pageTitle = useMemo(() => {
    if (sidebarPage === 'rulesets') return 'Rulesets workspace'
    if (sidebarPage === 'facts') return 'Facts workspace'
    if (sidebarPage === 'explanation') return 'Explanation workspace'
    if (sidebarPage === 'core') return 'Core features'
    return 'Rules Engine Network Simulator'
  }, [sidebarPage])

  return (
    <div className="min-h-screen bg-[#f5f4f8]">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-3 px-3 py-3 md:px-5 md:py-5">
        <header className="flex flex-col gap-3 rounded-[24px] border border-zinc-200/80 bg-white/95 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 lg:flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">
              <span>Rules engine</span>
              <span>/</span>
              <span>Simulator</span>
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-zinc-950">{pageTitle}</h1>
              <span className="hidden rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-500 md:inline-flex">
                {sidebarPage === 'home' ? 'rete-like engine view' : 'workspace panel'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:flex-1 lg:justify-end">
            <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1.5">
              <button
                type="button"
                role="switch"
                aria-checked={isEngineEnabled}
                aria-label="Toggle engine"
                onClick={toggleEngine}
                className={[
                  'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2',
                  isEngineEnabled
                    ? 'border-zinc-900 bg-zinc-900'
                    : 'border-zinc-300 bg-zinc-200',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none inline-block h-5 w-5 rounded-full border border-black/5 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.14)] transition-transform duration-200 ease-out',
                    isEngineEnabled ? 'translate-x-6' : 'translate-x-1',
                  ].join(' ')}
                />
              </button>
              <span className="text-sm font-medium leading-5 text-zinc-900">
                {isEngineEnabled ? 'Running' : 'Engine off'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={showSidebar ? 'secondary' : 'outline'}
                className="h-9 rounded-full border-zinc-200 bg-zinc-50 px-3 text-zinc-700 hover:bg-zinc-100"
                onClick={() => setShowSidebar((current) => !current)}
              >
                <PanelLeft className="mr-1.5 h-4 w-4" />
                Sidebar
              </Button>
            </div>
          </div>
        </header>

        <main className={`grid min-h-0 flex-1 overflow-hidden border border-zinc-200/80 bg-white/95 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${layoutClassName} xl:grid-rows-[minmax(0,1fr)]`}>
          {showSidebar ? (
            <div className="min-h-0">
              <RuleSidebar activePage={sidebarPage} onChangePage={setSidebarPage} />
            </div>
          ) : null}
          <div className={showSidebar ? 'min-h-0 border-l border-zinc-200/80' : 'min-h-0'}>
            <div
              className={[
                'h-full min-h-0 transition-all duration-200 ease-out',
                isPageVisible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
              ].join(' ')}
            >
              {displayedPage === 'home' ? <GraphCanvas /> : null}
              {displayedPage === 'rulesets' ? <RulesetsWorkspace onOpenEditor={handleOpenRuleEditor} /> : null}
              {displayedPage === 'facts' ? <FactsWorkspace /> : null}
              {displayedPage === 'explanation' ? <ExplanationPanel /> : null}
              {displayedPage === 'core' ? <CoreFeaturesWorkspace /> : null}
            </div>
          </div>
        </main>

        <RuleEditorModal
          open={isRuleEditorOpen}
          mode={ruleEditorMode}
          editingRuleId={editingRuleId}
          onOpenChange={setIsRuleEditorOpen}
        />
        <AddFactModal />
      </div>
    </div>
  )
}
