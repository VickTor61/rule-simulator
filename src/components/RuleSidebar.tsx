import {
  Database,
  FileText,
  GitBranch,
  Home,
  Settings2,
} from 'lucide-react'
import { useSimulatorStore } from '../lib/store'
import { cn } from '../lib/utils'

export type SidebarPage = 'home' | 'rulesets' | 'facts' | 'explanation' | 'core'

type SidebarItem = {
  id: SidebarPage
  label: string
  description: string
  icon: JSX.Element
}

const sidebarItems: SidebarItem[] = [
  {
    id: 'home',
    label: 'Home',
    description: 'Canvas and live replay',
    icon: <Home className="h-4 w-4" />,
  },
  {
    id: 'rulesets',
    label: 'Rulesets',
    description: 'Active, draft, and disabled rules',
    icon: <GitBranch className="h-4 w-4" />,
  },
  {
    id: 'facts',
    label: 'Facts',
    description: 'Saved requests and test inputs',
    icon: <Database className="h-4 w-4" />,
  },
  {
    id: 'explanation',
    label: 'Explanation',
    description: 'Replay details and node logic',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: 'core',
    label: 'Core features',
    description: 'Import, presets, and engine tools',
    icon: <Settings2 className="h-4 w-4" />,
  },
]

export function RuleSidebar({
  activePage,
  onChangePage,
}: {
  activePage: SidebarPage
  onChangePage: (page: SidebarPage) => void
}): JSX.Element {
  const { network, isEngineEnabled } = useSimulatorStore()

  const ruleCount = network?.canonicalRuleSet.rules.length ?? 0

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-3">
          <section className="space-y-0.5">
            {sidebarItems.map((item) => {
              const active = activePage === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangePage(item.id)}
                  aria-label={item.label}
                  title={item.label}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-2xl px-3 py-2 text-left transition-colors',
                    active
                      ? 'border border-zinc-200 bg-zinc-100/90 text-zinc-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
                      : 'border border-transparent text-zinc-700 hover:bg-zinc-50',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl',
                      active ? 'bg-white text-zinc-800 shadow-sm' : 'bg-zinc-100 text-zinc-600',
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-5">{item.label}</span>
                    <span className={cn('block truncate text-xs leading-5', active ? 'text-zinc-500' : 'text-zinc-400')}>
                      {item.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </section>
        </div>
      </div>

      <div className="border-t border-zinc-200/80 px-4 py-4">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3">
          <div className="hidden items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 md:flex">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-400">Network</p>
              <p className="truncate text-sm font-medium leading-5 text-zinc-950">{ruleCount} live rules</p>
            </div>
            <span className={cn('inline-flex h-2.5 w-2.5 rounded-full', isEngineEnabled ? 'bg-[#2F6B66]' : 'bg-zinc-300')} />
          </div>
        </div>
      </div>
    </aside>
  )
}
