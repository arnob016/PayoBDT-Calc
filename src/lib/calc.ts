export type Sign = 'profit' | 'loss'
export type FeeType = 'percent' | 'flat'

/** A non-negative amount plus the direction it pushes the result. */
export interface Adjustment {
  value: number
  sign: Sign
}

export interface PayoneerFee extends Adjustment {
  /** percent of the USD balance, or a flat USD amount */
  type: FeeType
}

export interface Inputs {
  /** USD balance in Payoneer */
  payoneerUsd: number
  /** Direct Payoneer -> BDT rate (BDT per USD) */
  directRate: number
  /** Payoneer USD needed per 1 USDT */
  payoneerPerUsdt: number
  /** USDT -> BDT sell rate (BDT per USDT) */
  usdtToBdtRate: number

  /** Payoneer-to-Payoneer fee, taken from the USD balance before converting */
  payoneerFee: PayoneerFee
  /** bKash/Nagad charge: BDT per USDT added to (profit) or taken from (loss) the sell rate */
  bdtAddedToRate: Adjustment
  /** Flat USDT withdrawal / network fee */
  usdtWithdrawal: Adjustment
  /** % applied when selling USDT for BDT */
  sellFee: Adjustment
  /** % applied on the direct Payoneer -> BDT route */
  directFee: Adjustment
}

export interface Result {
  /** Signed USD effect of the Payoneer fee (loss is negative) */
  payoneerFeeUsd: number
  /** USD balance after the Payoneer fee */
  usdAfterFee: number
  /** USDT bought with usdAfterFee, before the withdrawal adjustment */
  usdtGross: number
  /** USDT that ends up in hand */
  usdtReceived: number
  /** usdtToBdtRate with the bKash/Nagad adjustment applied */
  effectiveRate: number
  bdtViaUsdt: number
  bdtDirect: number
  profitBdt: number
  /** Percent of the direct route; null when the direct route pays nothing */
  profitPct: number | null
  /** usdtToBdtRate at which profit = 0; null when it cannot be solved */
  breakEvenRate: number | null
}

export const DEFAULT_INPUTS: Inputs = {
  payoneerUsd: 100,
  directRate: 123,
  payoneerPerUsdt: 1.015,
  usdtToBdtRate: 131,
  payoneerFee: { type: 'percent', value: 1, sign: 'loss' },
  bdtAddedToRate: { value: 0, sign: 'profit' },
  usdtWithdrawal: { value: 0, sign: 'loss' },
  sellFee: { value: 0, sign: 'loss' },
  directFee: { value: 0, sign: 'loss' },
}

export const signOf = (s: Sign): 1 | -1 => (s === 'profit' ? 1 : -1)

/** Any non-finite or negative value becomes 0. */
const clean = (n: unknown): number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0

const finiteOr0 = (n: number) => (Number.isFinite(n) ? n : 0)

/** Division that returns 0 instead of NaN/Infinity. */
const safeDiv = (a: number, b: number): number => finiteOr0(b === 0 ? 0 : a / b)

const pct = (a: Adjustment | undefined) =>
  (Math.min(clean(a?.value), 100) / 100) * signOf(a?.sign ?? 'loss')

export function calculate(inputs: Inputs): Result {
  const usd = clean(inputs.payoneerUsd)
  const directRate = clean(inputs.directRate)
  const perUsdt = clean(inputs.payoneerPerUsdt)
  const sellRate = clean(inputs.usdtToBdtRate)

  const fee = inputs.payoneerFee
  const feeValue =
    fee?.type === 'flat' ? clean(fee.value) : usd * (Math.min(clean(fee?.value), 100) / 100)
  const payoneerFeeUsd = feeValue * signOf(fee?.sign ?? 'loss')
  const usdAfterFee = Math.max(0, usd + payoneerFeeUsd)

  const usdtGross = safeDiv(usdAfterFee, perUsdt)
  const withdrawal = clean(inputs.usdtWithdrawal?.value) * signOf(inputs.usdtWithdrawal?.sign ?? 'loss')
  const usdtReceived = Math.max(0, usdtGross + withdrawal)

  const added = clean(inputs.bdtAddedToRate?.value) * signOf(inputs.bdtAddedToRate?.sign ?? 'profit')
  const effectiveRate = Math.max(0, sellRate + added)

  const sellMult = 1 + pct(inputs.sellFee)
  const directMult = 1 + pct(inputs.directFee)

  const bdtViaUsdt = finiteOr0(usdtReceived * effectiveRate * sellMult)
  const bdtDirect = finiteOr0(usd * directRate * directMult)
  const profitBdt = bdtViaUsdt - bdtDirect

  // usdtReceived * (R + added) * sellMult = bdtDirect  =>  R = bdtDirect / (usdtReceived * sellMult) - added
  const denom = usdtReceived * sellMult
  const be = denom > 0 && bdtDirect > 0 ? bdtDirect / denom - added : NaN

  return {
    payoneerFeeUsd,
    usdAfterFee,
    usdtGross,
    usdtReceived,
    effectiveRate,
    bdtViaUsdt,
    bdtDirect,
    profitBdt,
    profitPct: bdtDirect > 0 ? (profitBdt / bdtDirect) * 100 : null,
    breakEvenRate: Number.isFinite(be) ? be : null,
  }
}

// ---------------------------------------------------------------------------
// Sensitivity helpers: each sweeps ONE variable and holds everything else fixed.
// They go through calculate(), so they always agree with the results hero.
// ---------------------------------------------------------------------------

/** Full result when the USDT → BDT sell rate is `rate`. */
export const atUsdtRate = (inputs: Inputs, rate: number): Result =>
  calculate({ ...inputs, usdtToBdtRate: rate })

/** Full result when Payoneer USD per 1 USDT is `p`. */
export const atPayoneerRate = (inputs: Inputs, p: number): Result =>
  calculate({ ...inputs, payoneerPerUsdt: p })

export const profitAtUsdtRate = (inputs: Inputs, rate: number): number => atUsdtRate(inputs, rate).profitBdt

export const profitAtPayoneerRate = (inputs: Inputs, p: number): number => atPayoneerRate(inputs, p).profitBdt

/**
 * The Payoneer-USD-per-USDT rate at which profit = 0.
 * Profit falls as p rises, so this is the MAXIMUM acceptable rate.
 *
 *   usdtNet = usdAfterFee / p + w            (w = signed withdrawal)
 *   profit = 0  <=>  usdtNet = T,  T = bdtDirect / (effectiveRate × sellMult)
 *   p = usdAfterFee / (T − w)
 *
 * Returns null when it cannot be solved (no balance, no direct payout, zero rate, T ≤ w ...).
 */
export function breakEvenPayoneerRate(inputs: Inputs): number | null {
  const r = calculate(inputs)
  const sellMult = 1 + pct(inputs.sellFee)
  const withdrawal = clean(inputs.usdtWithdrawal?.value) * signOf(inputs.usdtWithdrawal?.sign ?? 'loss')
  const rateFactor = r.effectiveRate * sellMult
  if (!(r.bdtDirect > 0) || !(rateFactor > 0) || !(r.usdAfterFee > 0)) return null
  const target = r.bdtDirect / rateFactor - withdrawal
  if (!(target > 0)) return null
  const p = r.usdAfterFee / target
  return Number.isFinite(p) && p > 0 ? p : null
}

// ---------------------------------------------------------------------------
// What-if helpers: BOTH rates can move at once. Same code path as the hero (calculate()).
// ---------------------------------------------------------------------------

export interface RateOverrides {
  /** USDT sell rate (BDT per USDT) */
  sellRate?: number
  /** Buying USDT rate (Payoneer USD per USDT) */
  buyRate?: number
}

/** Full result with optional sell / buy rate overrides. No overrides = exactly the hero's result. */
export function resultAt(inputs: Inputs, o: RateOverrides = {}): Result {
  return calculate({
    ...inputs,
    usdtToBdtRate: o.sellRate ?? inputs.usdtToBdtRate,
    payoneerPerUsdt: o.buyRate ?? inputs.payoneerPerUsdt,
  })
}

/** Profit (BDT) with optional sell / buy rate overrides. */
export const profitAt = (inputs: Inputs, o: RateOverrides = {}): number => resultAt(inputs, o).profitBdt

const positive = (n: number | null): number | null => (n !== null && Number.isFinite(n) && n > 0 ? n : null)

/**
 * USDT sell rate at which profit = 0 for a given buying rate (solved algebraically, so every
 * sign and extra fee is already applied). Profit rises with the sell rate, so this is the MINIMUM.
 * Null when there is no positive solution.
 */
export const breakEvenSellRate = (inputs: Inputs, buyRate: number = inputs.payoneerPerUsdt): number | null =>
  positive(resultAt(inputs, { buyRate }).breakEvenRate)

/**
 * Buying USDT rate at which profit = 0 for a given sell rate. Profit falls as it rises, so this is
 * the MAXIMUM acceptable rate. Null when there is no positive solution.
 */
export const breakEvenBuyRate = (inputs: Inputs, sellRate: number = inputs.usdtToBdtRate): number | null =>
  positive(breakEvenPayoneerRate({ ...inputs, usdtToBdtRate: sellRate }))

export interface ScenarioBreakdown {
  /** profit at the entered rates */
  p0: number
  /** profit at (scenario sell, entered buy) */
  pS: number
  /** profit at (entered sell, scenario buy) */
  pB: number
  /** profit at (scenario sell, scenario buy) */
  pC: number
  sellEffect: number
  buyEffect: number
  /** what is left once the two single effects are removed; sellEffect + buyEffect + interaction = pC − p0 */
  interaction: number
}

export function scenarioBreakdown(inputs: Inputs, s: { sellRate: number; buyRate: number }): ScenarioBreakdown {
  const p0 = profitAt(inputs)
  const pS = profitAt(inputs, { sellRate: s.sellRate })
  const pB = profitAt(inputs, { buyRate: s.buyRate })
  const pC = profitAt(inputs, { sellRate: s.sellRate, buyRate: s.buyRate })
  const sellEffect = pS - p0
  const buyEffect = pB - p0
  return { p0, pS, pB, pC, sellEffect, buyEffect, interaction: pC - p0 - sellEffect - buyEffect }
}
