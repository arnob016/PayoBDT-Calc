import type { Result } from '../lib/calc'
import { fmt, pctSigned, taka, takaSigned } from '../lib/format'
import { Glyph } from './Glyph'
import { useCountUp } from '../hooks/useCountUp'

export type Tone = 'pos' | 'neg' | 'neutral'

export function toneOf(profit: number): Tone {
  if (Math.abs(profit) < 0.5) return 'neutral'
  return profit > 0 ? 'pos' : 'neg'
}

const TONE_TEXT: Record<Tone, string> = {
  pos: 'text-pos',
  neg: 'text-neg',
  neutral: 'text-ink',
}
const TONE_BADGE: Record<Tone, string> = {
  pos: 'bg-pos-soft text-pos border-pos/30',
  neg: 'bg-neg-soft text-neg border-neg/30',
  neutral: 'bg-surface-2 text-muted border-line',
}

function verdictText(tone: Tone, profit: number, valid: boolean) {
  if (!valid) return 'Fix the highlighted fields'
  if (tone === 'pos') return `USDT route wins by ${taka(profit)}`
  if (tone === 'neg') return 'Direct route is better'
  return 'Both routes pay the same'
}

function CompareBars({ direct, viaUsdt, tone }: { direct: number; viaUsdt: number; tone: Tone }) {
  const max = Math.max(direct, viaUsdt, 1)
  const pct = (v: number) => (v / max) * 100
  const gap = Math.abs(viaUsdt - direct)
  const winnerColor = tone === 'neg' ? 'bg-neg' : 'bg-pos'

  const Bar = ({ label, value, isUsdt }: { label: string; value: number; isUsdt: boolean }) => {
    // The longer bar carries a highlighted tail that shows exactly how much it leads by.
    const leads = value >= (isUsdt ? direct : viaUsdt) && gap > 0
    const tail = leads ? (gap / max) * 100 : 0
    const base = pct(value) - tail
    return (
      <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-xs sm:grid-cols-[5rem_1fr_auto]">
        <span className="text-muted">{label}</span>
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div
            className={`h-full ${isUsdt ? 'bg-accent' : 'bg-muted/60'} transition-[width] duration-300 ease-out`}
            style={{ width: `${Math.max(base, 0)}%` }}
          />
          <div
            className={`h-full ${winnerColor} transition-[width] duration-300 ease-out`}
            style={{ width: `${tail}%` }}
          />
        </div>
        <span className="min-w-[5.5rem] text-right font-medium text-ink">{taka(value)}</span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5" role="group" aria-label="Route comparison">
      <Bar label="Direct" value={direct} isUsdt={false} />
      <Bar label="Via USDT" value={viaUsdt} isUsdt />
    </div>
  )
}

export function ResultsHero({ r, valid }: { r: Result; valid: boolean }) {
  const tone: Tone = valid ? toneOf(r.profitBdt) : 'neutral'
  const animated = useCountUp(r.profitBdt)
  const shownSign = animated < -0.5 ? '−' : animated > 0.5 ? '+' : ''
  const label = r.profitBdt < 0 ? 'Loss via USDT' : 'Profit via USDT'

  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
    >
      {/* Soft glow, cross-faded by sign */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: tone === 'pos' ? 1 : 0,
          background:
            'radial-gradient(120% 90% at 100% 0%, color-mix(in oklab, var(--pos-glow) 24%, transparent), transparent 60%), linear-gradient(135deg, color-mix(in oklab, var(--pos-glow) 8%, transparent), transparent 55%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: tone === 'neg' ? 1 : 0,
          background:
            'radial-gradient(120% 90% at 100% 0%, color-mix(in oklab, var(--neg-glow) 24%, transparent), transparent 60%), linear-gradient(135deg, color-mix(in oklab, var(--neg-glow) 8%, transparent), transparent 55%)',
        }}
      />

      <div className="relative p-4 lg:px-5 lg:py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="hero-title" className="text-xs font-semibold uppercase tracking-wider text-muted">
            {label}
          </h2>
          <span
            className={`t-fast inline-flex max-w-[70%] items-center truncate rounded-full border px-2.5 py-1 text-xs font-semibold ${TONE_BADGE[tone]}`}
          >
            {verdictText(tone, r.profitBdt, valid)}
          </span>
        </div>

        <div className="mt-2 flex items-end justify-between gap-3 lg:mt-1">
          <div
            aria-hidden="true"
            className={`hero-num num t-fast text-[2rem] font-bold leading-none tracking-tight sm:text-4xl lg:text-5xl ${TONE_TEXT[tone]} ${valid ? '' : 'opacity-50'}`}
          >
            <Glyph value={valid ? animated : 0} />
            {shownSign}
            {taka(animated)}
          </div>
          <span
            aria-hidden="true"
            className={`num t-fast mb-0.5 shrink-0 rounded-lg px-2 py-1 text-sm font-semibold ${TONE_BADGE[tone]}`}
          >
            {valid && <Glyph value={r.profitPct} />}
            {r.profitPct === null ? '—' : pctSigned(r.profitPct)}
            <span className="ml-1 hidden font-normal opacity-80 sm:inline">vs direct</span>
          </span>
        </div>

        {/* Screen readers get the settled value, not every animation frame */}
        <p className="sr-only" aria-live="polite" role="status">
          {valid
            ? `${label}: ${takaSigned(r.profitBdt)} BDT, ${r.profitPct === null ? 'no percentage available' : `${pctSigned(r.profitPct)} versus direct`}. ${verdictText(tone, r.profitBdt, valid)}.`
            : 'Some inputs are invalid. Fix the highlighted fields.'}
        </p>

        <div className="mt-3 border-t border-line pt-3 lg:mt-2 lg:pt-2.5">
          <CompareBars direct={r.bdtDirect} viaUsdt={r.bdtViaUsdt} tone={tone} />
          <p className="mt-2 hidden text-[11px] leading-snug text-muted sm:block lg:hidden">
            Bars share one zero-based scale; the coloured tail is the difference ({fmt(Math.abs(r.bdtViaUsdt - r.bdtDirect), 0)} BDT).
          </p>
        </div>
      </div>
    </section>
  )
}
