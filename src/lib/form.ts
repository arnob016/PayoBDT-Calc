import {
  DEFAULT_INPUTS,
  DEFAULT_OPTIONS,
  type FeeMode,
  type Inputs,
  type Options,
} from './calc'

export type FieldKey =
  | 'payoneerUsd' | 'directRate' | 'payoneerPerUsdt' | 'p2pFeePct' | 'usdtToBdtRate'
  | 'withdrawalFeeUsdt' | 'sellFeePct' | 'directFeePct'

export type Form = Record<FieldKey, string>

export interface FormState {
  form: Form
  feeMode: FeeMode
}

export const DEFAULT_FORM: Form = {
  payoneerUsd: String(DEFAULT_INPUTS.payoneerUsd),
  directRate: String(DEFAULT_INPUTS.directRate),
  payoneerPerUsdt: String(DEFAULT_INPUTS.payoneerPerUsdt),
  p2pFeePct: String(DEFAULT_INPUTS.p2pFeePct),
  usdtToBdtRate: String(DEFAULT_INPUTS.usdtToBdtRate),
  withdrawalFeeUsdt: String(DEFAULT_OPTIONS.withdrawalFeeUsdt),
  sellFeePct: String(DEFAULT_OPTIONS.sellFeePct),
  directFeePct: String(DEFAULT_OPTIONS.directFeePct),
}

export const DEFAULT_STATE: FormState = {
  form: DEFAULT_FORM,
  feeMode: DEFAULT_OPTIONS.feeMode,
}

const STORAGE_KEY = 'payoneer-calc-v1'

export function loadState(): FormState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return {
        form: { ...DEFAULT_FORM, ...p.form },
        feeMode: p.feeMode === 'legacy' ? 'legacy' : 'before-conversion',
      }
    }
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

export function toCalcArgs({ form, feeMode }: FormState): { inputs: Inputs; options: Options } {
  return {
    inputs: {
      payoneerUsd: num(form.payoneerUsd),
      directRate: num(form.directRate),
      payoneerPerUsdt: num(form.payoneerPerUsdt),
      p2pFeePct: num(form.p2pFeePct),
      usdtToBdtRate: num(form.usdtToBdtRate),
    },
    options: {
      feeMode,
      withdrawalFeeUsdt: num(form.withdrawalFeeUsdt),
      sellFeePct: num(form.sellFeePct),
      directFeePct: num(form.directFeePct),
    },
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

export const FIELDS: Record<FieldKey, FieldMeta> = {
  payoneerUsd: {
    key: 'payoneerUsd', label: 'Payoneer balance', unit: 'USD', step: 50, allowZero: false,
    hint: 'The USD amount you plan to convert.',
  },
  directRate: {
    key: 'directRate', label: 'Direct rate', unit: 'BDT/USD', step: 0.5, allowZero: false,
    hint: 'BDT you get per 1 USD when withdrawing straight from Payoneer to your bank.',
  },
  payoneerPerUsdt: {
    key: 'payoneerPerUsdt', label: 'Payoneer per 1 USDT', unit: 'USD', step: 0.001, allowZero: false,
    hint: 'How many Payoneer USD the seller asks for 1 USDT (e.g. 1.015).',
  },
  usdtToBdtRate: {
    key: 'usdtToBdtRate', label: 'USDT → BDT rate', unit: 'BDT/USDT', step: 0.5, allowZero: false,
    hint: 'BDT you receive per 1 USDT when you sell it.',
  },
  p2pFeePct: {
    key: 'p2pFeePct', label: 'P2P fee', unit: '%', step: 0.1, allowZero: true, max: 100,
    hint: 'Payoneer-to-Payoneer transfer fee, as a percentage of the balance.',
  },
  withdrawalFeeUsdt: {
    key: 'withdrawalFeeUsdt', label: 'Withdrawal / network fee', unit: 'USDT', step: 0.1, allowZero: true,
    hint: 'Flat fee in USDT charged when moving USDT out.',
  },
  sellFeePct: {
    key: 'sellFeePct', label: 'Fee when selling USDT', unit: '%', step: 0.1, allowZero: true, max: 100,
    hint: 'Percentage fee taken when you sell USDT for BDT.',
  },
  directFeePct: {
    key: 'directFeePct', label: 'Fee on direct route', unit: '%', step: 0.1, allowZero: true, max: 100,
    hint: 'Percentage fee taken on the direct Payoneer → BDT withdrawal.',
  },
}

/** Returns an error message, or null when the text is a usable value. */
export function validateField(meta: FieldMeta, text: string): string | null {
  if (text.trim() === '') return 'Enter a value.'
  const n = Number(text)
  if (!Number.isFinite(n)) return 'Enter a valid number.'
  if (n < 0) return 'Must not be negative.'
  if (n === 0 && !meta.allowZero) return 'Must be greater than zero.'
  if (meta.max !== undefined && n > meta.max) return `Must be ${meta.max} or less.`
  return null
}

export function validateAll(form: Form): Partial<Record<FieldKey, string>> {
  const out: Partial<Record<FieldKey, string>> = {}
  for (const k of Object.keys(FIELDS) as FieldKey[]) {
    const e = validateField(FIELDS[k], form[k])
    if (e) out[k] = e
  }
  return out
}
