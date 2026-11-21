export type FeeMode = 'before-conversion' | 'legacy'

export interface Inputs {
  /** USD balance in Payoneer */
  payoneerUsd: number
  /** Direct Payoneer -> BDT rate (BDT per USD) */
  directRate: number
  /** Payoneer USD needed per 1 USDT */
  payoneerPerUsdt: number
  /** Payoneer-to-Payoneer fee, in percent (1 = 1%) */
  p2pFeePct: number
  /** USDT -> BDT sell rate (BDT per USDT) */
  usdtToBdtRate: number
}

export interface Options {
  feeMode: FeeMode
  /** Flat USDT withdrawal / network fee */
  withdrawalFeeUsdt: number
  /** % fee when selling USDT for BDT */
  sellFeePct: number
  /** % fee on the direct Payoneer -> BDT route */
  directFeePct: number
}

export interface Result {
  /** USDT that ends up in hand (after P2P fee, conversion and withdrawal fee) */
  usdtReceived: number
  bdtViaUsdt: number
  bdtDirect: number
  profitBdt: number
  profitPct: number
  /** USDT->BDT rate at which both routes pay the same */
  breakEvenRate: number
}

export const DEFAULT_INPUTS: Inputs = {
  payoneerUsd: 1850,
  directRate: 123,
  payoneerPerUsdt: 1.015,
  p2pFeePct: 1,
  usdtToBdtRate: 131,
}

export const DEFAULT_OPTIONS: Options = {
  feeMode: 'before-conversion',
  withdrawalFeeUsdt: 0,
  sellFeePct: 0,
  directFeePct: 0,
}

/** Any non-finite or negative value becomes 0. */
const clean = (n: unknown): number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0

/** Division that returns 0 instead of NaN/Infinity. */
const safeDiv = (a: number, b: number): number => {
  const r = b === 0 ? 0 : a / b
  return Number.isFinite(r) ? r : 0
}

export function calculate(
  inputs: Inputs,
  options: Options = DEFAULT_OPTIONS,
): Result {
  const usd = clean(inputs.payoneerUsd)
  const directRate = clean(inputs.directRate)
  const perUsdt = clean(inputs.payoneerPerUsdt)
  const fee = Math.min(clean(inputs.p2pFeePct), 100) / 100
  const sellRate = clean(inputs.usdtToBdtRate)

  const withdrawal = clean(options.withdrawalFeeUsdt)
  const sellFee = Math.min(clean(options.sellFeePct), 100) / 100
  const directFee = Math.min(clean(options.directFeePct), 100) / 100

  const feeUsd = usd * fee
  const grossUsdt =
    options.feeMode === 'legacy'
      ? safeDiv(usd, perUsdt) - feeUsd
      : safeDiv(usd - feeUsd, perUsdt)
  const usdtReceived = Math.max(0, grossUsdt - withdrawal)

  const bdtViaUsdt = usdtReceived * sellRate * (1 - sellFee)
  const bdtDirect = usd * directRate * (1 - directFee)
  const profitBdt = bdtViaUsdt - bdtDirect

  // Rate at which selling USDT exactly matches the direct route.
  const breakEvenRate = safeDiv(bdtDirect, usdtReceived * (1 - sellFee))

  return {
    usdtReceived,
    bdtViaUsdt,
    bdtDirect,
    profitBdt,
    profitPct: safeDiv(profitBdt, bdtDirect) * 100,
    breakEvenRate,
  }
}
