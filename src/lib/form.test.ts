import { describe, expect, it } from 'vitest'
import { calculate } from './calc'
import { DEFAULT_FORM, DEFAULT_SIGNS, migrateState, toCalcInputs, validateAll } from './form'

describe('migrateState', () => {
  it('old scenario with feeMode: "legacy" does not crash; feeMode is ignored, p2pFeePct becomes a % loss', () => {
    const old = {
      form: {
        payoneerUsd: '1850', directRate: '123', payoneerPerUsdt: '1.015',
        p2pFeePct: '2', usdtToBdtRate: '131',
        withdrawalFeeUsdt: '1', sellFeePct: '0.5', directFeePct: '0',
      },
      feeMode: 'legacy',
    }
    const s = migrateState(old)
    expect(s.form.payoneerFee).toBe('2')
    expect(s.feeType).toBe('percent')
    expect(s.signs.payoneerFee).toBe('loss')
    expect(s).not.toHaveProperty('feeMode')
    // old extras keep their values, with the default (loss) signs
    expect(s.form.withdrawalFeeUsdt).toBe('1')
    expect(s.signs).toEqual(DEFAULT_SIGNS)
    // and it calculates
    const r = calculate(toCalcInputs(s))
    expect(Number.isFinite(r.profitBdt)).toBe(true)
  })

  it('old shape with before-conversion mode matches the 1850 reference at 1%', () => {
    const s = migrateState({ form: { ...DEFAULT_FORM, payoneerUsd: '1850', p2pFeePct: '1' }, feeMode: 'before-conversion' })
    expect(calculate(toCalcInputs(s)).profitBdt).toBeCloseTo(8830.78, 1)
  })

  it('the default form is the new 100 Payoneer Sending', () => {
    expect(DEFAULT_FORM.payoneerUsd).toBe('100')
    expect(calculate(toCalcInputs(migrateState(null))).profitBdt).toBeCloseTo(477.34, 1)
  })

  it('accepts the { type, value, sign } object shape', () => {
    const s = migrateState({ payoneerFee: { type: 'flat', value: 5, sign: 'profit' } })
    expect(s.feeType).toBe('flat')
    expect(s.form.payoneerFee).toBe('5')
    expect(s.signs.payoneerFee).toBe('profit')
  })

  it('keeps a current-shape state intact', () => {
    const cur = {
      form: { ...DEFAULT_FORM, payoneerFee: '18.5', bdtFeeProfit: '1' },
      feeType: 'flat',
      signs: { ...DEFAULT_SIGNS, bdtFeeProfit: 'loss' },
    }
    expect(migrateState(cur)).toEqual(cur)
  })

  it('never throws on garbage and falls back to defaults', () => {
    for (const bad of [null, undefined, 42, 'x', [], { form: 5 }, { form: { payoneerUsd: {} }, signs: 'no' }, { payoneerFee: 'x' }]) {
      const s = migrateState(bad)
      expect(s.form.payoneerUsd.length).toBeGreaterThan(0)
      expect(['percent', 'flat']).toContain(s.feeType)
    }
    expect(migrateState(null)).toEqual({ form: DEFAULT_FORM, feeType: 'percent', signs: DEFAULT_SIGNS })
  })
})

describe('validation', () => {
  const st = migrateState(null)
  it('defaults are valid', () => {
    expect(validateAll(st)).toEqual({})
  })
  it('flat Payoneer fee has no 100 cap, percent does', () => {
    const big = { ...st, form: { ...st.form, payoneerFee: '150' } }
    expect(validateAll(big).payoneerFee).toBeDefined()
    expect(validateAll({ ...big, feeType: 'flat' }).payoneerFee).toBeUndefined()
  })
  it('negatives are rejected (the sign toggle expresses losses)', () => {
    expect(validateAll({ ...st, form: { ...st.form, bdtFeeProfit: '-1' } }).bdtFeeProfit).toBeDefined()
  })
})
