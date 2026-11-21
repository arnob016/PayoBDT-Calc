import { describe, expect, it } from 'vitest'
import { calculate, DEFAULT_INPUTS, type Inputs, type Result } from './calc'

// The larger 1850 case; the app default (100) has its own describe block below.
const D: Inputs = { ...DEFAULT_INPUTS, payoneerUsd: 1850 }
const base = calculate(D)

/** every numeric field is finite (null is allowed only for the two nullable ones) */
const noBadNumbers = (r: Result) =>
  Object.entries(r).every(([k, v]) =>
    v === null ? k === 'profitPct' || k === 'breakEvenRate' : Number.isFinite(v),
  )

describe('app defaults (100 / 123 / 1.015 / 1% loss / 131 / charges 0)', () => {
  const r = calculate(DEFAULT_INPUTS)
  it('uses 100 as the default Payoneer Sending', () => {
    expect(DEFAULT_INPUTS.payoneerUsd).toBe(100)
  })
  it('USDT received ≈ 97.54, BDT via USDT ≈ 12,777.34, BDT direct = 12,300', () => {
    expect(r.usdtReceived).toBeCloseTo(97.54, 2)
    expect(r.bdtViaUsdt).toBeCloseTo(12777.34, 1)
    expect(r.bdtDirect).toBe(12300)
  })
  it('profit ≈ +477.34 and break-even sell rate ≈ 126.11', () => {
    expect(r.profitBdt).toBeCloseTo(477.34, 1)
    expect(r.breakEvenRate).toBeCloseTo(126.11, 2)
  })
})

describe('larger case (1850 / 123 / 1.015 / 1% loss / 131 / added 0)', () => {
  it('profit ≈ 8,830.78 BDT', () => {
    expect(base.profitBdt).toBeCloseTo(8830.78, 1)
    expect(base.bdtDirect).toBe(227550)
  })
  it('USDT received ≈ 1,804.43', () => {
    expect(base.usdtReceived).toBeCloseTo(1804.43, 2)
    expect(base.usdAfterFee).toBeCloseTo(1831.5, 8)
    expect(base.payoneerFeeUsd).toBeCloseTo(-18.5, 8)
  })
  it('break-even ≈ 126.11 and it really gives zero profit', () => {
    expect(base.breakEvenRate).toBeCloseTo(126.11, 2)
    const again = calculate({ ...D, usdtToBdtRate: base.breakEvenRate! })
    expect(again.profitBdt).toBeCloseTo(0, 6)
  })
  it('profit % is relative to the direct route', () => {
    expect(base.profitPct).toBeCloseTo((8830.78 / 227550) * 100, 3)
  })
})

describe('Payoneer fee', () => {
  it('flat $18.50 loss equals 1% loss', () => {
    const r = calculate({ ...D, payoneerFee: { type: 'flat', value: 18.5, sign: 'loss' } })
    expect(r.profitBdt).toBeCloseTo(base.profitBdt, 8)
    expect(r.usdtReceived).toBeCloseTo(base.usdtReceived, 8)
  })
  it('flipped to profit: usdAfterFee = 1868.5 and profit is higher', () => {
    const r = calculate({ ...D, payoneerFee: { type: 'percent', value: 1, sign: 'profit' } })
    expect(r.usdAfterFee).toBeCloseTo(1868.5, 8)
    expect(r.profitBdt).toBeGreaterThan(base.profitBdt)
  })
  it('flat profit adds to the balance', () => {
    const r = calculate({ ...D, payoneerFee: { type: 'flat', value: 5, sign: 'profit' } })
    expect(r.usdAfterFee).toBe(1855)
    expect(r.payoneerFeeUsd).toBe(5)
  })
  it('a loss can never push the balance below zero', () => {
    const r = calculate({ ...D, payoneerFee: { type: 'flat', value: 99999, sign: 'loss' } })
    expect(r.usdAfterFee).toBe(0)
    expect(noBadNumbers(r)).toBe(true)
  })
})

describe('bKash/Nagad added-to-rate', () => {
  it('+1 profit: profit = 1804.43 × 132 − 227,550', () => {
    const r = calculate({ ...D, bdtAddedToRate: { value: 1, sign: 'profit' } })
    expect(r.effectiveRate).toBe(132)
    expect(r.profitBdt).toBeCloseTo(base.usdtReceived * 132 - 227550, 6)
  })
  it('flipped to loss: effective rate = 130', () => {
    const r = calculate({ ...D, bdtAddedToRate: { value: 1, sign: 'loss' } })
    expect(r.effectiveRate).toBe(130)
    expect(r.profitBdt).toBeLessThan(base.profitBdt)
  })
  it('break-even is still the base-rate threshold with the add-on included', () => {
    for (const sign of ['profit', 'loss'] as const) {
      const i: Inputs = { ...D, bdtAddedToRate: { value: 1.5, sign } }
      const be = calculate(i).breakEvenRate!
      expect(calculate({ ...i, usdtToBdtRate: be }).profitBdt).toBeCloseTo(0, 6)
    }
    // +1 profit lowers the base rate you need by exactly 1
    const be1 = calculate({ ...D, bdtAddedToRate: { value: 1, sign: 'profit' } }).breakEvenRate!
    expect(be1).toBeCloseTo(base.breakEvenRate! - 1, 8)
  })
})

describe('extra fees: each sign flip moves profit the expected way', () => {
  const cases: [string, (sign: 'profit' | 'loss') => Inputs][] = [
    ['USDT withdrawal', (sign) => ({ ...D, usdtWithdrawal: { value: 2, sign } })],
    ['sell fee %', (sign) => ({ ...D, sellFee: { value: 0.5, sign } })],
  ]
  for (const [name, make] of cases) {
    it(`${name}: loss < base < profit`, () => {
      const loss = calculate(make('loss')).profitBdt
      const gain = calculate(make('profit')).profitBdt
      expect(loss).toBeLessThan(base.profitBdt)
      expect(gain).toBeGreaterThan(base.profitBdt)
    })
  }
  it('withdrawal loss subtracts USDT, profit adds it', () => {
    expect(calculate({ ...D, usdtWithdrawal: { value: 2, sign: 'loss' } }).usdtReceived).toBeCloseTo(base.usdtReceived - 2, 8)
    expect(calculate({ ...D, usdtWithdrawal: { value: 2, sign: 'profit' } }).usdtReceived).toBeCloseTo(base.usdtReceived + 2, 8)
  })
  it('direct fee: a loss lowers the direct payout (profit rises), a profit raises it', () => {
    const loss = calculate({ ...D, directFee: { value: 1, sign: 'loss' } })
    const gain = calculate({ ...D, directFee: { value: 1, sign: 'profit' } })
    expect(loss.bdtDirect).toBeCloseTo(227550 * 0.99, 6)
    expect(gain.bdtDirect).toBeCloseTo(227550 * 1.01, 6)
    expect(loss.profitBdt).toBeGreaterThan(base.profitBdt)
    expect(gain.profitBdt).toBeLessThan(base.profitBdt)
  })
})

describe('guards', () => {
  it('zero balance: zeros, no NaN, and "—" values are null', () => {
    const r = calculate({ ...D, payoneerUsd: 0 })
    expect(noBadNumbers(r)).toBe(true)
    expect(r.profitBdt).toBe(0)
    expect(r.profitPct).toBeNull()
    expect(r.breakEvenRate).toBeNull()
  })
  it('zero / empty / invalid values never produce NaN or Infinity', () => {
    const bad = [NaN, Infinity, -Infinity, -5, 0, undefined as unknown as number]
    const numeric = ['payoneerUsd', 'directRate', 'payoneerPerUsdt', 'usdtToBdtRate'] as const
    const adj = ['payoneerFee', 'bdtAddedToRate', 'usdtWithdrawal', 'sellFee', 'directFee'] as const
    for (const b of bad) {
      for (const k of numeric) expect(noBadNumbers(calculate({ ...D, [k]: b }))).toBe(true)
      for (const k of adj) {
        for (const sign of ['profit', 'loss'] as const) {
          expect(noBadNumbers(calculate({ ...D, [k]: { ...D[k], value: b, sign } }))).toBe(true)
        }
      }
    }
    expect(noBadNumbers(calculate({ ...D, payoneerFee: { type: 'flat', value: NaN, sign: 'loss' } }))).toBe(true)
  })
  it('zero price per USDT does not divide by zero', () => {
    const r = calculate({ ...D, payoneerPerUsdt: 0 })
    expect(noBadNumbers(r)).toBe(true)
    expect(r.breakEvenRate).toBeNull()
  })
})
