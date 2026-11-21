import { useEffect, useState } from 'react'
import { fmt, takaSigned } from '../lib/format'
import type { Scenario } from '../lib/scenarios'
import { CheckIcon, TrashIcon } from './icons'

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [message, onDone])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" role="status" aria-live="polite">
      {message && (
        <div key={message} className="toast-in flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-surface shadow-card">
          <CheckIcon className="h-4 w-4" /> {message}
        </div>
      )}
    </div>
  )
}

const SHOWN = 3

/** Compact strip: latest 3 entries; "View all" turns it into a small scrolling panel. */
export function ScenarioList({
  items,
  onLoad,
  onDelete,
}: {
  items: Scenario[]
  onLoad: (s: Scenario) => void
  onDelete: (id: string) => void
}) {
  const [all, setAll] = useState(false)
  const expanded = all && items.length > SHOWN
  const visible = expanded ? items : items.slice(0, SHOWN)

  return (
    <section
      aria-labelledby="hist-title"
      className="shrink-0 rounded-2xl border border-line bg-surface p-3 shadow-card"
    >
      <div className="flex h-6 items-center justify-between gap-2">
        <h2 id="hist-title" className="text-sm font-semibold tracking-tight">
          Saved scenarios
          {items.length > 0 && <span className="ml-1.5 text-xs font-medium text-muted">{items.length}</span>}
        </h2>
        {items.length > SHOWN && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setAll((a) => !a)}
            className="t-fast rounded-md px-1.5 text-xs font-semibold text-accent-ink hover:underline"
          >
            {expanded ? 'Show latest 3' : `View all (${items.length})`}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-1 text-xs text-muted">Nothing saved yet. Use “Save” to keep a set of numbers for later.</p>
      ) : (
        <ul
          className={`mt-1.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 ${
            expanded ? 'max-h-44 overflow-y-auto pr-1' : ''
          }`}
        >
          {visible.map((s) => {
            const f = s.state.form
            return (
              <li key={s.id} className="flex items-center gap-2 rounded-xl bg-surface-2 py-1.5 pl-3 pr-1.5">
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold leading-tight ${s.profit >= 0 ? 'text-pos' : 'text-neg'}`}>
                    {takaSigned(s.profit)}
                  </div>
                  <div className="truncate text-[11px] text-muted">
                    ${fmt(Number(f.payoneerUsd) || 0, 0)} · {f.usdtToBdtRate} ·{' '}
                    {new Date(s.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onLoad(s)}
                  className="t-fast h-8 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-accent-ink hover:bg-accent-soft"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  aria-label="Delete scenario"
                  className="t-fast grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-neg-soft hover:text-neg"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
