import type { Inputs, Result } from '../lib/calc'
import { fmt, pctSigned, taka, takaSigned } from '../lib/format'

/**
 * Trading theme only: a thin, static (non-scrolling) strip under the header that mirrors the live inputs.
 *   USDT/BDT 131.00 ▲ · PAYO/USDT 1.015 · PROFIT ▲ +৳477 (+3.88%)
 * It repeats what the results hero already says, so it is hidden from screen readers.
 */
export function Ticker({ inputs, result }: { inputs: Inputs; result: Result }) {
  const up = result.profitBdt >= 0
  const arrow = (good: boolean) => (good ? '▲' : '▼')
  const tone = (good: boolean) => (good ? 'text-pos' : 'text-neg')
  const beat = result.breakEvenRate === null ? up : inputs.usdtToBdtRate >= result.breakEvenRate

  return (
    <div
      aria-hidden="true"
      className="ticker num flex shrink-0 flex-wrap items-center gap-x-4 gap-y-0 border-y border-line bg-surface-2 px-3 py-1 text-[11px] leading-4 text-muted"
    >
      <span>
        <span className="text-ink">USDT/BDT</span> <span className="font-semibold text-ink">{fmt(inputs.usdtToBdtRate, 2)}</span>{' '}
        <span className={tone(beat)}>{arrow(beat)}</span>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        <span className="text-ink">PAYO/USDT</span> <span className="font-semibold text-ink">{fmt(inputs.payoneerPerUsdt, 3)}</span>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        <span className="text-ink">PROFIT</span>{' '}
        <span className={`font-semibold ${tone(up)}`}>
          {arrow(up)} {takaSigned(result.profitBdt)}
          {result.profitPct !== null && ` (${pctSigned(result.profitPct)})`}
        </span>
      </span>
      <span className="ml-auto hidden text-[10px] uppercase tracking-wider xl:inline">
        BE {result.breakEvenRate === null ? '—' : taka(result.breakEvenRate, 2)}
      </span>
    </div>
  )
}
