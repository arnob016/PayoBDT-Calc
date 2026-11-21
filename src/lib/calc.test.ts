import { describe, expect, it } from 'vitest'
import { calculate, DEFAULT_INPUTS, DEFAULT_OPTIONS, type Result } from './calc'

const allFinite = (r: Result) =>
  Object.values(r).every((v) => Number.isFinite(v))

describe('calculate', () => {
  it('legacy mode matches reference (~8,795 BDT)', () => {
    const r = calculate(DEFAULT_INPUTS, { ...DEFAULT_OPTIONS, feeMode: 'legacy' })
    expect(r.profitBdt).toBeCloseTo(8795, -1)
    expect(Math.round(r.profitBdt)).toBe(8795)
  })

  it('before-conversion mode matches reference (~8,831 BDT)', () => {
    const r = calculate(DEFAULT_INPUTS, DEFAULT_OPTIONS)
    expect(Math.round(r.profitBdt)).toBe(8831)
    expect(r.bdtDirect).toBe(227550)
  })

  it('break-even rate gives zero profit', () => {
    const r = calculate(DEFAULT_INPUTS)
    const again = calculate({ ...DEFAULT_INPUTS, usdtToBdtRate: r.breakEvenRate })
    expect(again.profitBdt).toBeCloseTo(0, 6)
  })

  it('0% fee', () => {
    const r = calculate({ ...DEFAULT_INPUTS, p2pFeePct: 0 })
    expect(r.usdtReceived).toBeCloseTo(1850 / 1.015, 8)
  })

  it('zero amount gives zeros, no NaN', () => {
    const r = calculate({ ...DEFAULT_INPUTS, payoneerUsd: 0 })
    expect(allFinite(r)).toBe(true)
    expect(r.profitBdt).toBe(0)
    expect(r.profitPct).toBe(0)
    expect(r.breakEvenRate).toBe(0)
  })

  it('invalid input never yields NaN/Infinity', () => {
    const bad = [NaN, Infinity, -Infinity, -5, 0, undefined as unknown as number]
    for (const b of bad) {
      for (const key of Object.keys(DEFAULT_INPUTS) as (keyof typeof DEFAULT_INPUTS)[]) {
        for (const mode of ['legacy', 'before-conversion'] as const) {
          const r = calculate({ ...DEFAULT_INPUTS, [key]: b }, { ...DEFAULT_OPTIONS, feeMode: mode })
          expect(allFinite(r)).toBe(true)
        }
      }
    }
  })

  it('extra fees reduce profit', () => {
    const base = calculate(DEFAULT_INPUTS)
    const r = calculate(DEFAULT_INPUTS, {
      ...DEFAULT_OPTIONS,
      withdrawalFeeUsdt: 1,
      sellFeePct: 0.5,
      directFeePct: 0,
    })
    expect(r.usdtReceived).toBeCloseTo(base.usdtReceived - 1, 8)
    expect(r.profitBdt).toBeLessThan(base.profitBdt)
  })

  it('direct fee lowers direct BDT', () => {
    const r = calculate(DEFAULT_INPUTS, { ...DEFAULT_OPTIONS, directFeePct: 1 })
    expect(r.bdtDirect).toBeCloseTo(227550 * 0.99, 6)
  })
})
