import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronIcon } from './icons'

export function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-card lg:p-6">
      <header className="mb-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </header>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const idx = options.findIndex((o) => o.value === value)

  const onKey = (e: KeyboardEvent) => {
    const move = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!move) return
    e.preventDefault()
    const next = (idx + move + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className="relative grid h-11 grid-cols-2 rounded-xl bg-surface-2 p-1"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-surface shadow-card transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          className={`t-fast relative z-10 rounded-lg text-sm font-medium ${
            o.value === value ? 'text-ink' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Accordion({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const id = useId()
  return (
    <div className="border-t border-line pt-3">
      <button
        type="button"
        id={`${id}-btn`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className="t-fast flex h-11 w-full items-center justify-between rounded-xl px-1 text-sm font-semibold hover:text-accent-ink"
      >
        <span className="flex items-center gap-2">
          {title}
          <span
            className={`t-fast grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white ${
              count > 0 ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
            }`}
            aria-label={count > 0 ? `${count} set` : undefined}
            aria-hidden={count === 0}
          >
            {count}
          </span>
        </span>
        <ChevronIcon className={`h-5 w-5 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-btn`}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        {/* px/-mx leaves room for focus rings that would otherwise be clipped */}
        <div className="-mx-1 overflow-hidden px-1">
          <div className="space-y-2 pt-2">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function PresetChips({
  label,
  presets,
  current,
  onPick,
}: {
  label: string
  presets: number[]
  current: string
  onPick: (v: string) => void
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-4 gap-2">
      {presets.map((p) => {
        const active = Number(current) === p && current.trim() !== ''
        return (
          <button
            key={p}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(String(p))}
            className={`t-fast h-9 rounded-full border text-sm font-medium ${
              active
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-surface text-muted hover:border-accent/50 hover:text-ink'
            }`}
          >
            ${p.toLocaleString('en-US')}
          </button>
        )
      })}
    </div>
  )
}
