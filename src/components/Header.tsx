import type { ThemeId } from '../lib/theme'
import { LogoMark } from './icons'
import { ThemePicker } from './ThemePicker'

export function Header({ theme, onChoose }: { theme: ThemeId; onChoose: (id: ThemeId) => void }) {
  return (
    <header className="app-header flex shrink-0 items-center justify-between gap-4 py-3 lg:h-[var(--header-h)] lg:py-0">
      <div className="flex min-w-0 items-center gap-3">
        <LogoMark size={30} />
        <div className="min-w-0 lg:flex lg:items-baseline lg:gap-3">
          <h1 className="font-display truncate text-base font-bold leading-tight tracking-tight text-page-ink lg:text-lg">
            Payoneer → USDT → BDT
          </h1>
          <p className="text-xs leading-snug text-page-muted lg:truncate lg:text-[13px]">
            Is converting via USDT better than the direct route?
          </p>
        </div>
      </div>
      <ThemePicker theme={theme} onChoose={onChoose} />
    </header>
  )
}
