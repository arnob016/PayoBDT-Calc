export type SweepKind = 'usdt' | 'payoneer'

export const SWEEP_STEP: Record<SweepKind, number> = { usdt: 0.01, payoneer: 0.001 }
export const SWEEP_DECIMALS: Record<SweepKind, number> = { usdt: 2, payoneer: 3 }

/** Smallest x a sweep may ever use. Never 0 or negative. */
export const SWEEP_FLOOR: Record<SweepKind, number> = { usdt: 0.01, payoneer: 0.001 }

const ok = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0

/** Round to the slider step (and its decimals) so values never drift. */
export const snap = (kind: SweepKind, v: number) => {
  const step = SWEEP_STEP[kind]
  return +(Math.round(v / step) * step).toFixed(SWEEP_DECIMALS[kind])
}

/**
 * x-axis range of a sensitivity chart.
 *   usdt:     break-even ±5 BDT/USDT
 *   payoneer: break-even ±3 %
 * It always widens to include the user's current value, falls back to the current value when
 * there is no break-even, and is clamped so lo > 0 and hi > lo.
 */
export function sweepDomain(kind: SweepKind, current: number, breakEven: number | null) {
  const floor = SWEEP_FLOOR[kind]
  const cur = ok(current) ? current : null
  const be = ok(breakEven) ? breakEven : null
  const center = be ?? cur ?? (kind === 'usdt' ? 130 : 1)

  let lo: number
  let hi: number
  if (kind === 'usdt') {
    lo = center - 5
    hi = center + 5
    if (cur !== null) {
      lo = Math.min(lo, cur - 0.5)
      hi = Math.max(hi, cur + 0.5)
    }
  } else {
    lo = center * 0.97
    hi = center * 1.03
    if (cur !== null) {
      lo = Math.min(lo, cur * 0.985)
      hi = Math.max(hi, cur * 1.015)
    }
  }
  lo = Math.max(floor, lo)
  if (!(hi > lo)) hi = lo + (kind === 'usdt' ? 1 : 0.01)

  // lo rounds up and hi rounds down onto the step grid, but the range never collapses
  const s = SWEEP_STEP[kind]
  const sLo = snap(kind, Math.ceil(lo / s) * s)
  let sHi = snap(kind, Math.floor(hi / s) * s)
  if (!(sHi > sLo)) sHi = snap(kind, sLo + s * 10)
  return { lo: Math.max(floor, sLo), hi: sHi }
}
