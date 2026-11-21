import { resultAt, type Adjustment, type Inputs, type Result, type ScenarioBreakdown } from './calc'
import { fmt, pctSigned, taka, takaSigned } from './format'
import { migrateState, type FormState } from './form'
import type { WhatIf } from './whatif'

export interface Scenario {
  id: string
  savedAt: number
  state: FormState
  profit: number
}

const KEY = 'payoneer-scenarios-v1'
const MAX = 20

/** Old saves (feeMode / p2pFeePct, no signs) are migrated on read; bad entries are dropped. */
export function loadScenarios(): Scenario[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter((s) => s && typeof s === 'object' && s.state && typeof s.profit === 'number' && Number.isFinite(s.profit))
      .map((s, i) => ({
        id: typeof s.id === 'string' ? s.id : `legacy-${i}`,
        savedAt: typeof s.savedAt === 'number' ? s.savedAt : 0,
        state: migrateState(s.state),
        profit: s.profit as number,
      }))
  } catch {
    return []
  }
}

export function persistScenarios(list: Scenario[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* ignore */
  }
}

export const MAX_SCENARIOS = MAX

const mark = (a: Adjustment) => (a.sign === 'profit' ? '+' : '−')

export function buildSummary(i: Inputs, r: Result): string {
  const fee = i.payoneerFee
  const feeText = `${mark(fee)}${fee.type === 'percent' ? `${fmt(fee.value, fee.value % 1 ? 2 : 0)}%` : `$${fmt(fee.value)}`}`
  const verdict =
    Math.abs(r.profitBdt) < 0.5
      ? 'Both routes pay the same'
      : r.profitBdt > 0
        ? `USDT route wins by ${taka(r.profitBdt)}`
        : `Direct route is better by ${taka(r.profitBdt)}`

  const extras: string[] = []
  if (i.bdtAddedToRate.value > 0) extras.push(`BDT charges (bKash/Nagad): ${mark(i.bdtAddedToRate)}${fmt(i.bdtAddedToRate.value)} BDT/USDT`)
  if (i.usdtWithdrawal.value > 0) extras.push(`USDT withdrawal fee: ${mark(i.usdtWithdrawal)}${fmt(i.usdtWithdrawal.value)} USDT`)
  if (i.sellFee.value > 0) extras.push(`Selling fee: ${mark(i.sellFee)}${fmt(i.sellFee.value)}%`)
  if (i.directFee.value > 0) extras.push(`Direct route fee: ${mark(i.directFee)}${fmt(i.directFee.value)}%`)

  return [
    'Payoneer → USDT → BDT',
    verdict,
    '',
    `Payoneer Sending: $${fmt(i.payoneerUsd)} | Paying Customer (BDT): ${fmt(i.directRate, 2)} BDT/USD`,
    `Payoneer fee: ${feeText} → $${fmt(r.usdAfterFee)} after fee`,
    `Buying USDT rate: $${fmt(i.payoneerPerUsdt, 3)} Payo/USDT | USDT sell rate: ${fmt(i.usdtToBdtRate, 2)} BDT/USDT (effective sell rate ${fmt(r.effectiveRate, 2)})`,
    ...extras,
    '',
    `USDT received: ${fmt(r.usdtReceived)}`,
    `BDT via USDT: ${taka(r.bdtViaUsdt)}`,
    `BDT direct: ${taka(r.bdtDirect)}`,
    `Profit: ${takaSigned(r.profitBdt)} (${r.profitPct === null ? '—' : pctSigned(r.profitPct)})`,
    `Break-even rate: ${r.breakEvenRate === null ? '—' : `${taka(r.breakEvenRate, 2)}/USDT`}`,
  ].join('\n')
}

/** Summary of the combined what-if: the scenario's own numbers plus how it differs from the entered rates. */
export function buildWhatIfSummary(i: Inputs, w: WhatIf, b: ScenarioBreakdown): string {
  const r = resultAt(i, w)
  const head = buildSummary({ ...i, usdtToBdtRate: w.sellRate, payoneerPerUsdt: w.buyRate }, r)
  return [
    head,
    '',
    `What-if scenario: sell ${taka(w.sellRate, 2)} · buy ${fmt(w.buyRate, 3)} Payo/USDT`,
    `Entered rates: sell ${taka(i.usdtToBdtRate, 2)} · buy ${fmt(i.payoneerPerUsdt, 3)} Payo/USDT → ${takaSigned(b.p0, 2)}`,
    `vs your entered rates: ${takaSigned(b.pC - b.p0, 2)}`,
    `  Sell rate ${takaSigned(b.sellEffect, 2)}`,
    `  Buying rate ${takaSigned(b.buyEffect, 2)}`,
    `  Combined interaction ${takaSigned(b.interaction, 2)}`,
  ].join('\n')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
