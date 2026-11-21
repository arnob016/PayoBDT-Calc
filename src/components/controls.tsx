import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { Sign } from '../lib/calc'
import { ChevronIcon } from './icons'

interface MiniOption<T extends string> {
  value: T
  label: string
  /** accessible name and tooltip */
  aria: string
  /** classes for the selected state */
  on: string
}

/** Small two-state pill. Radio semantics: arrow keys move + select, roving tabindex. */
function MiniToggle<T extends string>({
  group,
  value,
  options,
  onChange,
  className = '',
}: {
  group: string
  value: T
  options: [MiniOption<T>, MiniOption<T>]
  onChange: (v: T) => void
  className?: string
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
      aria-label={group}
      onKeyDown={onKey}
      className={`inline-flex shrink-0 items-center rounded-full bg-surface-2 p-0.5 ${className}`}
    >
      {options.map((o, i) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.aria}
            title={o.aria}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`t-fast h-5 whitespace-nowrap rounded-full px-1.5 text-[11px] font-semibold leading-none lg:px-1 lg:text-[10.5px] ${
              selected ? o.on : 'text-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** [ + Profit | − Loss ]: green when Profit is selected, red when Loss is. */
export function SignToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: Sign
  onChange: (s: Sign) => void
}) {
  return (
    <MiniToggle<Sign>
      group={`${label}: profit or loss`}
      value={value}
      onChange={onChange}
      options={[
        {
          value: 'profit',
          label: '+ Profit',
          aria: `${label}: count as profit (adds)`,
          on: 'bg-pos-soft text-pos ring-1 ring-pos/40',
        },
        {
          value: 'loss',
          label: '− Loss',
          aria: `${label}: count as loss (subtracts)`,
          on: 'bg-neg-soft text-neg ring-1 ring-neg/40',
        },
      ]}
    />
  )
}

/** [ % | $ ]: percent of the balance, or a flat USD amount. */
export function UnitToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: 'percent' | 'flat'
  onChange: (v: 'percent' | 'flat') => void
}) {
  return (
    <MiniToggle<'percent' | 'flat'>
      group={`${label} unit`}
      value={value}
      onChange={onChange}
      options={[
        { value: 'percent', label: '%', aria: `${label}: percent of balance`, on: 'bg-surface text-accent-ink ring-1 ring-accent/40' },
        { value: 'flat', label: '$', aria: `${label}: flat USD amount`, on: 'bg-surface text-accent-ink ring-1 ring-accent/40' },
      ]}
    />
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
    <div className="border-t border-line">
      <button
        type="button"
        id={`${id}-btn`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className="t-fast flex h-10 w-full items-center justify-between rounded-xl px-1 text-sm font-semibold hover:text-accent-ink lg:text-[13px]"
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
        <ChevronIcon className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
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
          <div className="pt-1">{children}</div>
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
    <div role="group" aria-label={label} className="grid grid-cols-4 gap-1.5">
      {presets.map((p) => {
        const active = Number(current) === p && current.trim() !== ''
        return (
          <button
            key={p}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(String(p))}
            className={`t-fast h-8 rounded-full border text-xs font-medium lg:h-7 ${
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
