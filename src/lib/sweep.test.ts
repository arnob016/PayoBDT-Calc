import { describe, expect, it } from 'vitest'
import {
  atPayoneerRate,
  atUsdtRate,
  breakEvenPayoneerRate,
  calculate,
  DEFAULT_INPUTS,
  profitAtPayoneerRate,
  profitAtUsdtRate,
  type Inputs,
} from './calc'
import { snap, sweepDomain, SWEEP_FLOOR, type SweepKind } from './sweep'

// The larger 1850 case; the app default (100) is covered right below.
const D: Inputs = { ...DEFAULT_INPUTS, payoneerUsd: 1850 }
const base = calculate(D)

describe('sensitivity helpers at the app default (100)', () => {
  it('agree with the hero (profit ≈ +477.34, break-even ≈ 126.11)', () => {
    const hero = calculate(DEFAULT_INPUTS)
    expect(profitAtUsdtRate(DEFAULT_INPUTS, 131)).toBeCloseTo(hero.profitBdt, 8)
    expect(profitAtUsdtRate(DEFAULT_INPUTS, 131)).toBeCloseTo(477.34, 1)
    expect(profitAtPayoneerRate(DEFAULT_INPUTS, 1.015)).toBeCloseTo(hero.profitBdt, 8)
    expect(hero.breakEvenRate).toBeCloseTo(126.11, 2)
    const p = breakEvenPayoneerRate(DEFAULT_INPUTS)!
    expect(Math.abs(profitAtPayoneerRate(DEFAULT_INPUTS, p))).toBeLessThan(0.01)
  })
})

describe('sensitivity helpers', () => {
  it('profitAtUsdtRate(defaults, 131) equals the hero profit, and is ≈ 0 at the break-even', () => {
    expect(profitAtUsdtRate(D, 131)).toBeCloseTo(base.profitBdt, 8)
    expect(profitAtUsdtRate(D, 131)).toBeCloseTo(8830.78, 1)
    expect(base.breakEvenRate).toBeCloseTo(126.11, 2)
    expect(profitAtUsdtRate(D, base.breakEvenRate!)).toBeCloseTo(0, 6)
  })

  it('profitAtPayoneerRate(defaults, 1.015) equals the same profit and falls monotonically as p rises', () => {
    expect(profitAtPayoneerRate(D, 1.015)).toBeCloseTo(base.profitBdt, 8)
    let prev = Infinity
    for (let p = 0.9; p <= 1.2; p += 0.005) {
      const v = profitAtPayoneerRate(D, p)
      expect(v).toBeLessThan(prev)
      prev = v
    }
  })

  it('breakEvenPayoneerRate(defaults) plugs back to ±0.01 BDT of zero', () => {
    const p = breakEvenPayoneerRate(D)!
    expect(p).toBeGreaterThan(D.payoneerPerUsdt) // we are in profit, so the max acceptable rate is above ours
    expect(Math.abs(profitAtPayoneerRate(D, p))).toBeLessThan(0.01)
  })

  it('atUsdtRate / atPayoneerRate return the full result used by the readout', () => {
    const r = atUsdtRate(D, 128.5)
    expect(r.profitBdt).toBeCloseTo(profitAtUsdtRate(D, 128.5), 10)
    expect(r.usdtReceived).toBeCloseTo(base.usdtReceived, 8) // the sell rate does not change USDT received
    expect(atPayoneerRate(D, 1.03).usdtReceived).toBeLessThan(base.usdtReceived)
  })

  const variants: [string, Inputs][] = [
    ['fee flipped to profit', { ...D, payoneerFee: { type: 'percent', value: 1, sign: 'profit' } }],
    ['flat $18.50 fee', { ...D, payoneerFee: { type: 'flat', value: 18.5, sign: 'loss' } }],
    ['bKash +1', { ...D, bdtAddedToRate: { value: 1, sign: 'profit' } }],
    ['bKash −1', { ...D, bdtAddedToRate: { value: 1, sign: 'loss' } }],
    ['withdrawal loss 2', { ...D, usdtWithdrawal: { value: 2, sign: 'loss' } }],
    ['withdrawal profit 2', { ...D, usdtWithdrawal: { value: 2, sign: 'profit' } }],
    ['sell fee loss', { ...D, sellFee: { value: 0.5, sign: 'loss' } }],
    ['sell fee profit', { ...D, sellFee: { value: 0.5, sign: 'profit' } }],
    ['direct fee loss', { ...D, directFee: { value: 1, sign: 'loss' } }],
    ['direct fee profit', { ...D, directFee: { value: 1, sign: 'profit' } }],
  ]
  for (const [name, i] of variants) {
    it(`both charts agree with the hero: ${name}`, () => {
      const hero = calculate(i)
      expect(profitAtUsdtRate(i, i.usdtToBdtRate)).toBeCloseTo(hero.profitBdt, 8)
      expect(profitAtPayoneerRate(i, i.payoneerPerUsdt)).toBeCloseTo(hero.profitBdt, 8)
      expect(profitAtUsdtRate(i, hero.breakEvenRate!)).toBeCloseTo(0, 6)
      const p = breakEvenPayoneerRate(i)!
      expect(Math.abs(profitAtPayoneerRate(i, p))).toBeLessThan(0.01)
    })
  }

  it('sign toggles move both charts the same way', () => {
    const gain = { ...D, payoneerFee: { type: 'percent' as const, value: 1, sign: 'profit' as const } }
    expect(profitAtUsdtRate(gain, 131)).toBeGreaterThan(profitAtUsdtRate(D, 131))
    expect(profitAtPayoneerRate(gain, 1.015)).toBeGreaterThan(profitAtPayoneerRate(D, 1.015))
    expect(breakEvenPayoneerRate(gain)!).toBeGreaterThan(breakEvenPayoneerRate(D)!)
    expect(calculate(gain).breakEvenRate!).toBeLessThan(base.breakEvenRate!)
  })

  it('no NaN/Infinity for zero or empty inputs; unsolvable break-evens are null', () => {
    const zero: Inputs = { ...D, payoneerUsd: 0 }
    for (const i of [zero, { ...D, directRate: 0 }, { ...D, payoneerPerUsdt: 0 }, { ...D, usdtToBdtRate: 0 }]) {
      expect(Number.isFinite(profitAtUsdtRate(i, 0))).toBe(true)
      expect(Number.isFinite(profitAtUsdtRate(i, 130))).toBe(true)
      expect(Number.isFinite(profitAtPayoneerRate(i, 0))).toBe(true)
      expect(Number.isFinite(profitAtPayoneerRate(i, 1.02))).toBe(true)
      const p = breakEvenPayoneerRate(i)
      expect(p === null || (Number.isFinite(p) && p > 0)).toBe(true)
    }
    expect(breakEvenPayoneerRate(zero)).toBeNull()
    expect(breakEvenPayoneerRate({ ...D, directRate: 0 })).toBeNull()
  })
})

describe('sweepDomain', () => {
  const kinds: SweepKind[] = ['usdt', 'payoneer']
  it('never uses a rate ≤ 0 and always has hi > lo', () => {
    const odd = [null, 0, -3, NaN, Infinity, 0.0004, 1e-9, 1.015, 131, 500]
    for (const kind of kinds) {
      for (const cur of odd) {
        for (const be of odd) {
          const { lo, hi } = sweepDomain(kind, cur as number, be as number | null)
          expect(lo).toBeGreaterThan(0)
          expect(lo).toBeGreaterThanOrEqual(SWEEP_FLOOR[kind])
          expect(hi).toBeGreaterThan(lo)
          expect(Number.isFinite(lo) && Number.isFinite(hi)).toBe(true)
        }
      }
    }
  })

  it('A is break-even ±5; B is break-even ±3 %; both include the current rate', () => {
    const a = sweepDomain('usdt', 128, 126.11)
    expect(a.lo).toBeCloseTo(121.11, 2)
    expect(a.hi).toBeCloseTo(131.11, 2)
    const be = breakEvenPayoneerRate(D)!
    const b = sweepDomain('payoneer', 1.015, be)
    expect(b.lo).toBeLessThanOrEqual(1.015)
    expect(b.hi).toBeGreaterThanOrEqual(be * 1.03 - 0.001)
    expect(sweepDomain('usdt', 140, 126.11).hi).toBeGreaterThanOrEqual(140)
  })

  it('snap keeps values on the slider grid', () => {
    expect(snap('usdt', 128.504)).toBe(128.5)
    expect(snap('payoneer', 1.01549)).toBe(1.015)
  })
})
