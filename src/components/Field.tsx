import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { FieldMeta } from '../lib/form'
import { HelpIcon, MinusIcon, PlusIcon } from './icons'

/** Keep digits, one dot and a leading minus (so a negative can be flagged inline). */
export function sanitizeNumeric(raw: string): string {
  let s = raw.replace(/,/g, '.').replace(/[^\d.-]/g, '')
  const neg = s.startsWith('-')
  s = s.replace(/-/g, '')
  const i = s.indexOf('.')
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '')
  return (neg ? '-' : '') + s
}

const decimalsOf = (step: number) => (String(step).split('.')[1] ?? '').length

function stepped(value: string, meta: FieldMeta, dir: 1 | -1): string {
  const d = decimalsOf(meta.step)
  const cur = Number(value)
  const base = Number.isFinite(cur) && value.trim() !== '' ? cur : 0
  const min = meta.allowZero ? 0 : meta.step
  let next = Math.max(min, +(base + dir * meta.step).toFixed(d + 1))
  if (meta.max !== undefined) next = Math.min(meta.max, next)
  return String(+next.toFixed(d))
}

function Tooltip({ id, open, children }: { id: string; open: boolean; children: ReactNode }) {
  return (
    <span
      id={id}
      role="tooltip"
      className={`t-fast pointer-events-none absolute left-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-4rem)] rounded-xl border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-ink shadow-card ${
        open ? 'visible opacity-100' : 'invisible opacity-0 group-hover/tip:visible group-hover/tip:opacity-100'
      }`}
    >
      {children}
    </span>
  )
}

export function Field({
  meta,
  value,
  error,
  onChange,
  children,
}: {
  meta: FieldMeta
  value: string
  error?: string
  onChange: (v: string) => void
  /** e.g. preset chips rendered under the input */
  children?: ReactNode
}) {
  const uid = useId()
  const inputId = `${uid}-input`
  const errId = `${uid}-err`
  const tipId = `${uid}-tip`
  const [tipOpen, setTipOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Tap-to-open tooltip closes on outside tap / Escape.
  useEffect(() => {
    if (!tipOpen) return
    const away = (e: Event) => {
      if (!wrapRef.current?.contains(e.target as Node)) setTipOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setTipOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [tipOpen])

  const invalid = Boolean(error)
  const atMin = !invalid && Number(value) <= (meta.allowZero ? 0 : meta.step)

  const stepBtn =
    't-fast grid h-full w-11 shrink-0 place-items-center text-muted hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <div ref={wrapRef} className="relative">
      <div className="group/tip relative flex items-center gap-1">
        <label htmlFor={inputId} className="text-sm font-medium">
          {meta.label}
        </label>
        <button
          type="button"
          aria-label={`About ${meta.label}`}
          aria-describedby={tipId}
          aria-expanded={tipOpen}
          onClick={() => setTipOpen((o) => !o)}
          className="t-fast grid h-6 w-6 place-items-center rounded-full text-muted hover:text-accent-ink"
        >
          <HelpIcon />
        </button>
        <Tooltip id={tipId} open={tipOpen}>
          {meta.hint}
        </Tooltip>
      </div>

      <div
        className={`t-fast mt-1 flex h-12 items-stretch overflow-hidden rounded-xl border bg-surface focus-within:ring-2 ${
          invalid
            ? 'border-neg focus-within:ring-neg/30'
            : 'border-line focus-within:border-accent focus-within:ring-accent/30'
        }`}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Decrease ${meta.label}`}
          disabled={atMin}
          onClick={() => onChange(stepped(value, meta, -1))}
          className={`${stepBtn} border-r border-line`}
        >
          <MinusIcon />
        </button>

        <div className="relative min-w-0 flex-1">
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={value}
            aria-invalid={invalid}
            aria-describedby={invalid ? errId : undefined}
            onChange={(e) => onChange(sanitizeNumeric(e.target.value))}
            onFocus={(e) => {
              const el = e.currentTarget
              setTimeout(() => el.select(), 0)
            }}
            className="h-full w-full bg-transparent pl-3 pr-[4.75rem] text-base font-medium outline-none"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs font-medium text-muted"
          >
            {meta.unit}
          </span>
        </div>

        <button
          type="button"
          tabIndex={-1}
          aria-label={`Increase ${meta.label}`}
          disabled={meta.max !== undefined && Number(value) >= meta.max}
          onClick={() => onChange(stepped(value, meta, 1))}
          className={`${stepBtn} border-l border-line`}
        >
          <PlusIcon />
        </button>
      </div>

      {/* Reserved line: appearing/disappearing errors never shift the layout */}
      <p id={errId} className="mt-1 min-h-4 text-xs font-medium leading-4 text-neg" role={invalid ? 'alert' : undefined}>
        {error ?? ''}
      </p>

      {children}
    </div>
  )
}
