import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { Sign } from '../lib/calc'
import type { FieldMeta } from '../lib/form'
import { SignToggle } from './controls'
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

/**
 * Label + "?" button + tooltip. Opens on hover, keyboard focus or tap; closes on
 * Escape / outside tap. `htmlFor` makes the text a real <label>; without it the
 * text is a plain span (used for section headings and the fee-mode group).
 */
export function LabelRow({
  text,
  hint,
  htmlFor,
  className = '',
  right,
  compact = false,
}: {
  text: string
  hint: string
  htmlFor?: string
  className?: string
  /** e.g. the + Profit / − Loss toggle, pinned to the end of the row */
  right?: ReactNode
  /** slightly smaller label (fields that also carry a sign toggle in the same row) */
  compact?: boolean
}) {
  const tipId = useId()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const Text = htmlFor ? 'label' : 'span'
  return (
    <div ref={ref} className="relative flex min-h-6 items-center justify-between gap-2">
      {/* the hover group is only label + "?", so hovering the toggle does not open the tooltip */}
      <div className="group/tip flex min-w-0 items-center gap-1">
        <Text htmlFor={htmlFor} title={text} className={`text-sm font-medium leading-4 lg:truncate ${compact ? 'lg:text-[11px]' : 'lg:text-xs'} ${className}`}>
          {text}
        </Text>
        <button
          type="button"
          aria-label={`About ${text}`}
          aria-describedby={tipId}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="t-fast grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted hover:text-accent-ink lg:w-5"
        >
          <HelpIcon />
        </button>
        <span
          id={tipId}
          role="tooltip"
          className={`t-fast pointer-events-none absolute left-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-line bg-surface px-3 py-2 text-xs font-normal leading-relaxed text-ink shadow-card ${
            open ? 'visible opacity-100' : 'invisible opacity-0 group-hover/tip:visible group-hover/tip:opacity-100'
          }`}
        >
          {hint}
        </span>
      </div>
      {right}
    </div>
  )
}

export function Field({
  meta,
  value,
  error,
  onChange,
  children,
  sign,
  onSign,
  unitSlot,
  tag,
}: {
  meta: FieldMeta
  value: string
  error?: string
  onChange: (v: string) => void
  /** adjustments only: the + Profit / − Loss state shown next to the label */
  sign?: Sign
  onSign?: (s: Sign) => void
  /** replaces the static unit text (e.g. the % / $ toggle) */
  unitSlot?: ReactNode
  /** small route pill shown above the label (rates only) */
  tag?: ReactNode
  /** e.g. preset chips rendered under the input */
  children?: ReactNode
}) {
  const uid = useId()
  const inputId = `${uid}-input`
  const errId = `${uid}-err`

  const invalid = Boolean(error)
  const atMin = !invalid && Number(value) <= (meta.allowZero ? 0 : meta.step)

  const stepBtn =
    't-fast grid h-full w-10 shrink-0 place-items-center text-muted hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent lg:w-9'

  return (
    <div className="min-w-0">
      {tag}
      <LabelRow
        text={meta.label}
        hint={meta.hint}
        htmlFor={inputId}
        compact={Boolean(sign)}
        right={sign && onSign ? <SignToggle label={meta.label} value={sign} onChange={onSign} /> : undefined}
      />

      <div
        className={`t-fast mt-0.5 flex h-11 items-stretch overflow-hidden rounded-xl border bg-surface focus-within:ring-2 lg:h-10 ${
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
          <MinusIcon className="h-4 w-4" />
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
            className={`h-full w-full bg-transparent pl-2.5 text-base font-medium outline-none lg:text-[15px] ${unitSlot ? 'pr-[4.5rem]' : 'pr-[4.25rem]'}`}
          />
          {unitSlot ? (
            <span className="absolute inset-y-0 right-1.5 grid place-items-center">{unitSlot}</span>
          ) : (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-2.5 grid place-items-center text-[11px] font-medium text-muted"
            >
              {meta.unit}
            </span>
          )}
        </div>

        <button
          type="button"
          tabIndex={-1}
          aria-label={`Increase ${meta.label}`}
          disabled={meta.max !== undefined && Number(value) >= meta.max}
          onClick={() => onChange(stepped(value, meta, 1))}
          className={`${stepBtn} border-l border-line`}
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Reserved line: appearing/disappearing errors never shift the layout */}
      <p id={errId} className="min-h-4 text-[11px] font-medium leading-4 text-neg" role={invalid ? 'alert' : undefined}>
        {error ?? ''}
      </p>

      {children}
    </div>
  )
}
