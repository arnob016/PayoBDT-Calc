import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { THEME_LIST, THEMES, type ThemeId } from '../lib/theme'
import { CheckIcon, ChevronIcon } from './icons'

/** Three colour dots (surface, accent, profit). Inline styles on purpose: each swatch previews ITS theme. */
function Swatch({ colors }: { colors: [string, string, string] }) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center">
      {colors.map((c, i) => (
        <span
          key={i}
          className="-ml-1 h-3.5 w-3.5 rounded-full border border-black/25 first:ml-0"
          style={{ background: c, boxShadow: '0 0 0 1px rgb(255 255 255 / 0.35)' }}
        />
      ))}
    </span>
  )
}

/**
 * Theme picker: a menu button that opens a listbox.
 * Keys: Enter/Space/ArrowDown open; ArrowUp/Down/Home/End move; Enter/Space choose; Esc/Tab close.
 */
export function ThemePicker({ theme, onChoose }: { theme: ThemeId; onChoose: (id: ThemeId) => void }) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const current = THEME_LIST.findIndex((t) => t.id === theme)

  const openMenu = () => {
    setActive(Math.max(0, current))
    setOpen(true)
  }
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) button.current?.focus()
  }
  const choose = (i: number) => {
    onChoose(THEME_LIST[i].id)
    close()
  }

  useEffect(() => {
    if (open) list.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const away = (e: Event) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openMenu()
    }
  }

  const onListKey = (e: KeyboardEvent) => {
    const n = THEME_LIST.length
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((a) => (a + 1) % n)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => (a - 1 + n) % n)
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(n - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(active)
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        close()
        break
      case 'Tab':
        close(false)
        break
    }
  }

  const meta = THEMES[theme]

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        aria-label={`Theme: ${meta.name}. Change theme`}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onButtonKey}
        className="t-fast flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-card hover:border-accent/60"
      >
        <Swatch colors={meta.swatch} />
        <span className="hidden sm:inline">{meta.name}</span>
        <ChevronIcon className={`h-4 w-4 text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          ref={list}
          id={`${uid}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label="Theme"
          aria-activedescendant={`${uid}-opt-${active}`}
          onKeyDown={onListKey}
          className="theme-popover absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-line bg-surface p-1 shadow-card outline-none"
        >
          {THEME_LIST.map((t, i) => {
            const selected = t.id === theme
            return (
              <li
                key={t.id}
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium ${
                  i === active ? 'bg-accent-soft text-accent-ink' : 'text-ink'
                }`}
              >
                <Swatch colors={t.swatch} />
                <span className="flex-1">{t.name}</span>
                {selected && <CheckIcon className="h-4 w-4" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
