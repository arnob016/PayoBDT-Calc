import { DEFAULT_INPUTS, type FeeType, type Inputs, type Sign } from './calc'

export type FieldKey =
  | 'payoneerUsd' | 'directRate' | 'payoneerPerUsdt' | 'usdtToBdtRate'
  | 'payoneerFee' | 'bdtFeeProfit' | 'withdrawalFeeUsdt' | 'sellFeePct' | 'directFeePct'

/** The adjustments that carry a + Profit / − Loss sign. */
export type AdjKey = 'payoneerFee' | 'bdtFeeProfit' | 'withdrawal' | 'sellFee' | 'directFee'

export type Form = Record<FieldKey, string>
export type Signs = Record<AdjKey, Sign>

export interface FormState {
  form: Form
  /** unit of the Payoneer fee: percent of balance, or flat USD */
  feeType: FeeType
  signs: Signs
}

/** Which field is controlled by which sign. Base inputs have no entry. */
export const ADJ_OF: Partial<Record<FieldKey, AdjKey>> = {
  payoneerFee: 'payoneerFee',
  bdtFeeProfit: 'bdtFeeProfit',
  withdrawalFeeUsdt: 'withdrawal',
  sellFeePct: 'sellFee',
  directFeePct: 'directFee',
}

export const DEFAULT_SIGNS: Signs = {
  payoneerFee: DEFAULT_INPUTS.payoneerFee.sign,
  bdtFeeProfit: DEFAULT_INPUTS.bdtAddedToRate.sign,
  withdrawal: DEFAULT_INPUTS.usdtWithdrawal.sign,
  sellFee: DEFAULT_INPUTS.sellFee.sign,
  directFee: DEFAULT_INPUTS.directFee.sign,
}

export const DEFAULT_FORM: Form = {
  payoneerUsd: String(DEFAULT_INPUTS.payoneerUsd),
  directRate: String(DEFAULT_INPUTS.directRate),
  payoneerPerUsdt: String(DEFAULT_INPUTS.payoneerPerUsdt),
  usdtToBdtRate: String(DEFAULT_INPUTS.usdtToBdtRate),
  payoneerFee: String(DEFAULT_INPUTS.payoneerFee.value),
  bdtFeeProfit: String(DEFAULT_INPUTS.bdtAddedToRate.value),
  withdrawalFeeUsdt: String(DEFAULT_INPUTS.usdtWithdrawal.value),
  sellFeePct: String(DEFAULT_INPUTS.sellFee.value),
  directFeePct: String(DEFAULT_INPUTS.directFee.value),
}

export const DEFAULT_STATE: FormState = {
  form: DEFAULT_FORM,
  feeType: DEFAULT_INPUTS.payoneerFee.type,
  signs: DEFAULT_SIGNS,
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const asText = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : undefined
const asSign = (v: unknown, d: Sign): Sign => (v === 'profit' || v === 'loss' ? v : d)

/**
 * Turns anything that was ever saved (current shape, the old { form.p2pFeePct, feeMode } shape,
 * or garbage) into a valid FormState. Never throws.
 *   - feeMode is ignored
 *   - p2pFeePct  ->  payoneerFee { type: 'percent', value: p2pFeePct, sign: 'loss' }
 */
export function migrateState(raw: unknown): FormState {
  try {
    const o = isObj(raw) ? raw : {}
    const f = isObj(o.form) ? o.form : {}
    const form: Form = { ...DEFAULT_FORM }
    for (const k of Object.keys(DEFAULT_FORM) as FieldKey[]) {
      const t = asText(f[k])
      if (t !== undefined) form[k] = t
    }

    let feeType: FeeType = o.feeType === 'flat' ? 'flat' : 'percent'
    const signs: Signs = { ...DEFAULT_SIGNS }
    if (isObj(o.signs)) {
      for (const k of Object.keys(signs) as AdjKey[]) signs[k] = asSign(o.signs[k], signs[k])
    }

    // legacy: percent fee stored under p2pFeePct, always a loss
    if (f.payoneerFee === undefined) {
      const legacy = asText(f.p2pFeePct)
      if (legacy !== undefined) {
        form.payoneerFee = legacy
        feeType = 'percent'
        signs.payoneerFee = 'loss'
      }
    }

    // object form: payoneerFee = { type, value, sign }
    if (isObj(o.payoneerFee)) {
      const t = asText(o.payoneerFee.value)
      if (t !== undefined) form.payoneerFee = t
      feeType = o.payoneerFee.type === 'flat' ? 'flat' : 'percent'
      signs.payoneerFee = asSign(o.payoneerFee.sign, 'loss')
    }
    return { form, feeType, signs }
  } catch {
    return DEFAULT_STATE
  }
}

// v2: the default amount changed to 100, so last-used inputs restart from the new defaults.
// Saved scenarios live under their own key and are not touched.
const STORAGE_KEY = 'payoneer-calc-v2'

export function loadState(): FormState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return migrateState(JSON.parse(raw))
  } catch {
    /* storage unavailable or corrupt: fall back to defaults */
  }
  return DEFAULT_STATE
}

export function saveState(s: FormState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

/** Empty / unparseable text becomes 0 (calc.ts also sanitises). */
export const num = (s: string) => {
  const n = s.trim() === '' ? 0 : Number(s)
  return Number.isFinite(n) ? n : 0
}

export function toCalcInputs({ form, feeType, signs }: FormState): Inputs {
  return {
    payoneerUsd: num(form.payoneerUsd),
    directRate: num(form.directRate),
    payoneerPerUsdt: num(form.payoneerPerUsdt),
    usdtToBdtRate: num(form.usdtToBdtRate),
    payoneerFee: { type: feeType, value: num(form.payoneerFee), sign: signs.payoneerFee },
    bdtAddedToRate: { value: num(form.bdtFeeProfit), sign: signs.bdtFeeProfit },
    usdtWithdrawal: { value: num(form.withdrawalFeeUsdt), sign: signs.withdrawal },
    sellFee: { value: num(form.sellFeePct), sign: signs.sellFee },
    directFee: { value: num(form.directFeePct), sign: signs.directFee },
  }
}

export interface FieldMeta {
  key: FieldKey
  label: string
  unit: string
  step: number
  hint: string
  /** zero is a legitimate value (fees) */
  allowZero: boolean
  max?: number
}

const FIELDS: Record<FieldKey, FieldMeta> = {
  payoneerUsd: {
    key: 'payoneerUsd', label: 'Payoneer Sending', unit: 'USD', step: 50, allowZero: false,
    hint: 'The USD amount you are sending from Payoneer.',
  },
  directRate: {
    key: 'directRate', label: 'Paying Customer (BDT)', unit: 'BDT/USD', step: 0.5, allowZero: false,
    hint: 'Direct route: BDT you receive per 1 USD when you withdraw straight from Payoneer to your bank.',
  },
  payoneerPerUsdt: {
    key: 'payoneerPerUsdt', label: 'Buying USDT rate (Payo/USDT)', unit: 'Payo/USDT', step: 0.001, allowZero: false,
    hint: 'USDT route, buy: how many Payoneer USD you pay for 1 USDT (e.g. 1.015).',
  },
  usdtToBdtRate: {
    key: 'usdtToBdtRate', label: 'USDT sell rate (BDT/USDT)', unit: 'BDT/USDT', step: 0.5, allowZero: false,
    hint: 'USDT route, sell: BDT you receive per 1 USDT when you sell it.',
  },
  payoneerFee: {
    key: 'payoneerFee', label: 'Payoneer Fee (P2P)', unit: '%', step: 0.1, allowZero: true, max: 100,
    hint: 'Applied to your USD balance first, then the rest is converted. Choose % or a flat $ amount; + Profit adds to the balance, − Loss subtracts.',
  },
  bdtFeeProfit: {
    key: 'bdtFeeProfit', label: 'BDT charges (bKash/Nagad)', unit: 'BDT/USDT', step: 0.1, allowZero: true,
    hint: 'bKash/Nagad cash-out charge in BDT per USDT, applied to the USDT sell rate. + Profit adds it, − Loss subtracts it.',
  },
  withdrawalFeeUsdt: {
    key: 'withdrawalFeeUsdt', label: 'Withdrawal fee', unit: 'USDT', step: 0.1, allowZero: true,
    hint: 'Flat USDT withdrawal / network fee. Loss subtracts it from your USDT, Profit adds it.',
  },
  sellFeePct: {
    key: 'sellFeePct', label: 'Selling fee', unit: '%', step: 0.1, allowZero: true, max: 100,
    hint: 'Percentage applied when you sell USDT for BDT. Loss reduces the BDT you get, Profit increases it.',
  },
  directFeePct: {
    key: 'directFeePct', label: 'Direct route fee', unit: '%', step: 0.1, allowZero: true, max: 100,
    hint: 'Percentage applied on the direct Payoneer → BDT withdrawal. Loss reduces the direct payout, Profit increases it.',
  },
}

/** Field metadata; the Payoneer fee changes unit, step and cap with its type. */
export function fieldMeta(key: FieldKey, feeType: FeeType): FieldMeta {
  const m = FIELDS[key]
  if (key === 'payoneerFee' && feeType === 'flat') {
    return { ...m, unit: 'USD', step: 1, max: undefined }
  }
  return m
}

export const ALL_FIELD_KEYS = Object.keys(FIELDS) as FieldKey[]

/** Returns an error message, or null when the text is a usable value. */
export function validateField(meta: FieldMeta, text: string): string | null {
  if (text.trim() === '') return 'Enter a value.'
  const n = Number(text)
  if (!Number.isFinite(n)) return 'Enter a valid number.'
  if (n < 0) return 'Must not be negative. Use the sign toggle for losses.'
  if (n === 0 && !meta.allowZero) return 'Must be greater than zero.'
  if (meta.max !== undefined && n > meta.max) return `Must be ${meta.max} or less.`
  return null
}

export function validateAll(state: FormState): Partial<Record<FieldKey, string>> {
  const out: Partial<Record<FieldKey, string>> = {}
  for (const k of ALL_FIELD_KEYS) {
    const e = validateField(fieldMeta(k, state.feeType), state.form[k])
    if (e) out[k] = e
  }
  return out
}
