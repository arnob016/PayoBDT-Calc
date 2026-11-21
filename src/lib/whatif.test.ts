import { describe, expect, it } from 'vitest'
import {
  breakEvenBuyRate,
  breakEvenSellRate,
  calculate,
  DEFAULT_INPUTS,
  profitAt,
  scenarioBreakdown,
  type Inputs,
} from './calc'
import { clampRate, enteredWhatIf, inputsKey, resolveWhatIf, whatIfDomains } from './whatif'

const D: Inputs = DEFAULT_INPUTS
/** every fee type, sign and extra charge in play */
const FEES: Inputs = {
  payoneerUsd: 1850,
  directRate: 122.5,
  payoneerPerUsdt: 1.02,
  usdtToBdtRate: 129.4,
  payoneerFee: { type: 'flat', value: 7.5, sign: 'loss' },
  bdtAddedToRate: { value: 0.6, sign: 'loss' },
  usdtWithdrawal: { value: 1.2, sign: 'loss' },
  sellFee: { value: 0.4, sign: 'profit' },
  directFee: { value: 0.3, sign: 'loss' },
}
const CASES: [string, Inputs][] = [
  ['defaults', D],
  ['1850 case', { ...D, payoneerUsd: 1850 }],
  ['all fees', FEES],
]

describe.each(CASES)('profitAt / break-even helpers (%s)', (_n, I) => {
  it('profitAt with no overrides equals the hero profit', () => {
    expect(profitAt(I)).toBe(calculate(I).profitBdt)
    expect(profitAt(I, {})).toBe(calculate(I).profitBdt)
  })

  it('entered values for both give p0; moving only the sell rate gives pS', () => {
    const b = scenarioBreakdown(I, { sellRate: I.usdtToBdtRate, buyRate: I.payoneerPerUsdt })
    expect(b.p0).toBeCloseTo(calculate(I).profitBdt, 8)
    expect(b.pC).toBeCloseTo(b.p0, 8)
    const sell = I.usdtToBdtRate + 2
    const b2 = scenarioBreakdown(I, { sellRate: sell, buyRate: I.payoneerPerUsdt })
    expect(b2.pS).toBeCloseTo(calculate({ ...I, usdtToBdtRate: sell }).profitBdt, 8)
    expect(b2.pS).toBeCloseTo(profitAt(I, { sellRate: sell, buyRate: I.payoneerPerUsdt }), 8)
    expect(b2.buyEffect).toBeCloseTo(0, 8)
  })

  it('sellEffect + buyEffect + interaction = pC − p0 (±0.01)', () => {
    for (const [sellRate, buyRate] of [
      [125, 1.05],
      [140, 0.99],
      [131.37, 1.123],
      [I.usdtToBdtRate, 1.2],
    ]) {
      const b = scenarioBreakdown(I, { sellRate, buyRate })
      expect(Math.abs(b.sellEffect + b.buyEffect + b.interaction - (b.pC - b.p0))).toBeLessThan(0.01)
      expect(b.pC).toBeCloseTo(profitAt(I, { sellRate, buyRate }), 8)
    }
  })

  it('profit at the break-even sell rate is ≈ 0, for several buying rates', () => {
    for (const buy of [0.98, I.payoneerPerUsdt, 1.04, 1.1]) {
      const be = breakEvenSellRate(I, buy)
      expect(be).not.toBeNull()
      expect(Math.abs(profitAt(I, { sellRate: be!, buyRate: buy }))).toBeLessThan(0.01)
    }
  })

  it('profit at the break-even buying rate is ≈ 0, for several sell rates', () => {
    for (const sell of [127, I.usdtToBdtRate, 133, 140]) {
      const be = breakEvenBuyRate(I, sell)
      expect(be).not.toBeNull()
      expect(Math.abs(profitAt(I, { buyRate: be!, sellRate: sell }))).toBeLessThan(0.01)
    }
  })

  it('a higher buying rate raises the break-even sell rate; a higher sell rate raises the max buying rate', () => {
    expect(breakEvenSellRate(I, 1.1)!).toBeGreaterThan(breakEvenSellRate(I, 1.0)!)
    expect(breakEvenSellRate(I, 1.0)!).toBeGreaterThan(breakEvenSellRate(I, 0.95)!)
    expect(breakEvenBuyRate(I, 135)!).toBeGreaterThan(breakEvenBuyRate(I, 130)!)
  })
})

describe('break-even edge cases return null, never NaN', () => {
  it('no balance / no direct payout / zero rate', () => {
    expect(breakEvenSellRate({ ...D, payoneerUsd: 0 }, 1.015)).toBeNull()
    expect(breakEvenSellRate({ ...D, directRate: 0 }, 1.015)).toBeNull()
    expect(breakEvenBuyRate({ ...D, payoneerUsd: 0 }, 131)).toBeNull()
    expect(breakEvenBuyRate(D, 0)).toBeNull()
    expect(breakEvenSellRate(D, 0)).toBeNull()
  })
  it('a break-even that would be ≤ 0 is null', () => {
    // a +500 BDT/USDT bonus makes the required base rate negative
    expect(breakEvenSellRate({ ...D, bdtAddedToRate: { value: 500, sign: 'profit' } }, 1.015)).toBeNull()
  })
})

describe('scenario state', () => {
  const dom = whatIfDomains(D)

  it('starts at the entered values', () => {
    expect(resolveWhatIf(null, D, dom)).toEqual(enteredWhatIf(D))
  })

  it('keeps a scenario made for the same inputs', () => {
    const w = { sellRate: 128.93, buyRate: 1.056 }
    expect(resolveWhatIf({ key: inputsKey(D), value: w }, D, dom)).toEqual(w)
  })

  it('editing any main input resets the scenario to the newly entered values', () => {
    const stored = { key: inputsKey(D), value: { sellRate: 128.93, buyRate: 1.056 } }
    for (const edited of [
      { ...D, usdtToBdtRate: 133 },
      { ...D, payoneerPerUsdt: 1.03 },
      { ...D, payoneerUsd: 500 },
      { ...D, sellFee: { value: 1, sign: 'loss' as const } },
    ]) {
      expect(resolveWhatIf(stored, edited, whatIfDomains(edited))).toEqual(enteredWhatIf(edited))
    }
  })

  it('x ranges depend only on the entered inputs, so they cannot move while scrubbing', () => {
    expect(whatIfDomains(D)).toEqual(whatIfDomains({ ...D }))
    expect(dom.sell.hi).toBeGreaterThan(dom.sell.lo)
    expect(dom.buy.hi).toBeGreaterThan(dom.buy.lo)
  })

  it('y range covers the four corners and 0, and every curve point stays inside it', () => {
    expect(dom.y.min).toBeLessThanOrEqual(0)
    expect(dom.y.max).toBeGreaterThanOrEqual(0)
    for (const s of [dom.sell.lo, dom.sell.hi]) {
      for (const b of [dom.buy.lo, dom.buy.hi]) {
        const p = profitAt(D, { sellRate: s, buyRate: b })
        expect(p).toBeGreaterThanOrEqual(dom.y.min - 1e-9)
        expect(p).toBeLessThanOrEqual(dom.y.max + 1e-9)
      }
    }
    for (let i = 0; i <= 10; i++) {
      for (let j = 0; j <= 10; j++) {
        const p = profitAt(D, {
          sellRate: dom.sell.lo + ((dom.sell.hi - dom.sell.lo) * i) / 10,
          buyRate: dom.buy.lo + ((dom.buy.hi - dom.buy.lo) * j) / 10,
        })
        expect(p).toBeGreaterThanOrEqual(dom.y.min - 1e-6)
        expect(p).toBeLessThanOrEqual(dom.y.max + 1e-6)
      }
    }
  })

  it('rates are always finite and > 0, whatever is thrown at them', () => {
    for (const v of [NaN, Infinity, -Infinity, -5, 0, 1e12]) {
      const s = clampRate('usdt', v, dom.sell)
      const b = clampRate('payoneer', v, dom.buy)
      expect(Number.isFinite(s) && s > 0).toBe(true)
      expect(Number.isFinite(b) && b > 0).toBe(true)
      expect(s).toBeGreaterThanOrEqual(dom.sell.lo)
      expect(s).toBeLessThanOrEqual(dom.sell.hi)
    }
  })

  it('degenerate inputs give finite domains and breakdowns', () => {
    for (const I of [
      { ...D, payoneerUsd: 0 },
      { ...D, usdtToBdtRate: 0, payoneerPerUsdt: 0 },
      { ...D, directRate: 0 },
    ]) {
      const d = whatIfDomains(I)
      const w = resolveWhatIf(null, I, d)
      const b = scenarioBreakdown(I, { sellRate: w.sellRate, buyRate: w.buyRate })
      for (const n of [d.sell.lo, d.sell.hi, d.buy.lo, d.buy.hi, d.y.min, d.y.max, ...Object.values(b)]) {
        expect(Number.isFinite(n)).toBe(true)
      }
      expect(d.sell.lo).toBeGreaterThan(0)
      expect(d.buy.lo).toBeGreaterThan(0)
    }
  })
})
