import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookmarkPlus, X } from 'lucide-react'
import { Button } from './ui/button'

export function ScenarioPackModal({
  open,
  defaultName,
  defaultDescription,
  onOpenChange,
  onSave,
}: {
  open: boolean
  defaultName: string
  defaultDescription: string
  onOpenChange: (open: boolean) => void
  onSave: (name: string, description: string) => void
}): JSX.Element | null {
  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState(defaultDescription)

  useEffect(() => {
    if (!open) return
    setName(defaultName)
    setDescription(defaultDescription)
  }, [defaultDescription, defaultName, open])

  if (!open) return null

  const handleSave = (): void => {
    if (!name.trim()) return
    onSave(name.trim(), description.trim())
    onOpenChange(false)
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[1px]">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="space-y-1">
            <p className="eyebrow">Scenario pack</p>
            <h2 className="text-xl font-semibold leading-7 text-zinc-950">Save current business case</h2>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Save the current rules, selected fact, and expected engine outcome as a reusable simulation scenario.
            </p>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-md" onClick={() => onOpenChange(false)} aria-label="Close scenario modal">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-4 px-5 py-4">
          <div className="grid gap-1">
            <label htmlFor="scenario-pack-name" className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
              Scenario name
            </label>
            <input
              id="scenario-pack-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="High-risk withdrawal"
              className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-zinc-400"
            />
          </div>

          <div className="grid gap-1">
            <label htmlFor="scenario-pack-description" className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
              Notes
            </label>
            <textarea
              id="scenario-pack-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Summarize what this scenario is proving."
              className="min-h-[120px] rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <div className="text-sm leading-6 text-muted-foreground">
            Scenario packs let you reload a known rule bundle and fact without re-entering them manually.
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-8" onClick={handleSave} disabled={!name.trim()}>
              <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
              Save scenario
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return modal
  return createPortal(modal, document.body)
}
