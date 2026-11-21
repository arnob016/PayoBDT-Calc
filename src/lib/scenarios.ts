import type { Inputs, Options, Result } from './calc'
import { fmt, pctSigned, taka, takaSigned } from './format'
import type { FormState } from './form'

export interface Scenario {
  id: string
  savedAt: number
  state: FormState
  profit: number
}

const KEY = 'payoneer-scenarios-v1'
const MAX = 20

export function loadScenarios(): Scenario[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((s) => s && s.state?.form && typeof s.profit === 'number') : []
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

export function buildSummary(i: Inputs, o: Options, r: Result): string {
  const verdict =
    Math.abs(r.profitBdt) < 0.5
      ? 'Both routes pay the same'
      : r.profitBdt > 0
        ? `USDT route wins by ${taka(r.profitBdt)}`
        : `Direct route is better by ${taka(r.profitBdt)}`
  return [
    'Payoneer → USDT → BDT',
    verdict,
    '',
    `Balance: $${fmt(i.payoneerUsd)} | Direct rate: ${fmt(i.directRate, 2)} BDT/USD`,
    `Payoneer per USDT: $${fmt(i.payoneerPerUsdt, 3)} | P2P fee: ${fmt(i.p2pFeePct)}% (${o.feeMode === 'legacy' ? 'legacy' : 'before conversion'})`,
    `USDT → BDT: ${fmt(i.usdtToBdtRate, 2)}`,
    '',
    `USDT received: ${fmt(r.usdtReceived)}`,
    `BDT via USDT: ${taka(r.bdtViaUsdt)}`,
    `BDT direct: ${taka(r.bdtDirect)}`,
    `Profit: ${takaSigned(r.profitBdt)} (${pctSigned(r.profitPct)})`,
    `Break-even rate: ${taka(r.breakEvenRate, 2)}/USDT`,
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
