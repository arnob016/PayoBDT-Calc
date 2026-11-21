import { useEffect } from 'react'
import { fmt, takaSigned } from '../lib/format'
import type { Scenario } from '../lib/scenarios'
import { BookmarkIcon, CheckIcon, CopyIcon, TrashIcon } from './icons'

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [message, onDone])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" role="status" aria-live="polite">
      {message && (
        <div key={message} className="toast-in flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-bg shadow-card">
          <CheckIcon className="h-4 w-4" /> {message}
        </div>
      )}
    </div>
  )
}

export function ActionButtons({ onCopy, onSave }: { onCopy: () => void; onSave: () => void }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onCopy}
        className="t-fast flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold hover:border-accent/50"
      >
        <CopyIcon className="h-4 w-4" /> Copy summary
      </button>
      <button
        type="button"
        onClick={onSave}
        className="t-fast flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white hover:brightness-110"
      >
        <BookmarkIcon className="h-4 w-4" /> Save scenario
      </button>
    </div>
  )
}

export function ScenarioList({
  items,
  onLoad,
  onDelete,
}: {
  items: Scenario[]
  onLoad: (s: Scenario) => void
  onDelete: (id: string) => void
}) {
  return (
    <section aria-labelledby="hist-title" className="rounded-2xl border border-line bg-surface p-4 shadow-card lg:p-6">
      <h2 id="hist-title" className="text-sm font-semibold tracking-tight">
        Saved scenarios
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Nothing saved yet. Use “Save scenario” to keep a set of numbers for later.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {items.map((s) => {
            const f = s.state.form
            return (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold ${s.profit >= 0 ? 'text-pos' : 'text-neg'}`}>
                    {takaSigned(s.profit)}
                  </div>
                  <div className="truncate text-xs text-muted">
                    ${fmt(Number(f.payoneerUsd) || 0, 0)} · {f.usdtToBdtRate} BDT/USDT ·{' '}
                    {new Date(s.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onLoad(s)}
                  className="t-fast h-9 rounded-lg border border-line px-3 text-xs font-semibold text-accent-ink hover:bg-accent-soft"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  aria-label="Delete scenario"
                  className="t-fast grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-neg-soft hover:text-neg"
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
