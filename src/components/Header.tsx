import { LogoMark, MoonIcon, SunIcon } from './icons'

export function Header({ theme, onToggle }: { theme: 'light' | 'dark'; onToggle: () => void }) {
  const dark = theme === 'dark'
  return (
    <header className="flex items-center justify-between gap-4 py-4 lg:py-6">
      <div className="flex min-w-0 items-center gap-3">
        <LogoMark />
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold leading-tight tracking-tight lg:text-xl">
            Payoneer → USDT → BDT
          </h1>
          <p className="text-xs leading-snug text-muted lg:text-sm">
            Is converting via USDT better than the direct route?
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={dark}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="t-fast grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-muted shadow-card hover:text-ink"
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
  )
}
