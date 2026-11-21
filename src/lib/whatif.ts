import { breakEvenBuyRate, breakEvenSellRate, profitAt, type Inputs } from './calc'
import { snap, sweepDomain, SWEEP_FLOOR } from './sweep'

/** The one shared scenario both charts and both sliders read and write. */
export interface WhatIf {
  sellRate: number
  buyRate: number
}

export interface Range {
  lo: number
  hi: number
}

export interface WhatIfDomains {
  sell: Range
  buy: Range
  /** profit range over the four corners of both sweeps (always includes 0) */
  y: { min: number; max: number }
}

/** Identity of the entered inputs: when it changes, the scenario starts over. */
export const inputsKey = (i: Inputs) => JSON.stringify(i)

export const enteredWhatIf = (i: Inputs): WhatIf => ({ sellRate: i.usdtToBdtRate, buyRate: i.payoneerPerUsdt })

/**
 * Axis ranges depend ONLY on the entered inputs (break-even ± a margin), never on the scenario,
 * so the axes stay put while scrubbing. The y range is the profit at the four corners of the two
 * sweep ranges, which bounds both curves (profit is monotonic in each rate).
 */
export function whatIfDomains(i: Inputs): WhatIfDomains {
  const sell = sweepDomain('usdt', i.usdtToBdtRate, breakEvenSellRate(i, i.payoneerPerUsdt))
  const buy = sweepDomain('payoneer', i.payoneerPerUsdt, breakEvenBuyRate(i, i.usdtToBdtRate))
  const corners = [sell.lo, sell.hi].flatMap((sellRate) =>
    [buy.lo, buy.hi].map((buyRate) => profitAt(i, { sellRate, buyRate })),
  )
  const finite = corners.filter(Number.isFinite)
  return { sell, buy, y: { min: Math.min(0, ...finite), max: Math.max(0, ...finite) } }
}

/** Finite, on the slider grid, inside the axis range (so never ≤ 0). */
export function clampRate(kind: 'usdt' | 'payoneer', v: number, r: Range): number {
  const n = Number.isFinite(v) ? v : r.lo
  return snap(kind, Math.min(r.hi, Math.max(r.lo, Math.max(SWEEP_FLOOR[kind], n))))
}

export interface StoredWhatIf {
  /** inputsKey() at the time the user moved it */
  key: string
  value: WhatIf
}

/**
 * The scenario in effect. A stored scenario made for different inputs is discarded, which is how
 * "editing a main input resets the scenario" works with no effect and no stale frame.
 */
export function resolveWhatIf(stored: StoredWhatIf | null, i: Inputs, d: WhatIfDomains): WhatIf {
  const e = enteredWhatIf(i)
  const valid = (n: number) => Number.isFinite(n) && n > 0
  if (!stored || stored.key !== inputsKey(i)) {
    // untouched: exactly the entered values (off-grid ones are kept so the deltas start at 0)
    return {
      sellRate: valid(e.sellRate) ? e.sellRate : clampRate('usdt', e.sellRate, d.sell),
      buyRate: valid(e.buyRate) ? e.buyRate : clampRate('payoneer', e.buyRate, d.buy),
    }
  }
  return {
    sellRate: clampRate('usdt', stored.value.sellRate, d.sell),
    buyRate: clampRate('payoneer', stored.value.buyRate, d.buy),
  }
}

/** Decimal text for a main-input field. */
export const rateText = (kind: 'usdt' | 'payoneer', v: number) => String(+v.toFixed(kind === 'usdt' ? 2 : 3))
