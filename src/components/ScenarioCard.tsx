import { resultAt, scenarioBreakdown, type Inputs } from '../lib/calc'
import { fmt, pctSigned, taka, takaSigned } from '../lib/format'
import type { WhatIf } from '../lib/whatif'
import { toneOf, type Tone } from './ResultsHero'

const TONE_TEXT: Record<Tone, string> = { pos: 'text-pos', neg: 'text-neg', neutral: 'text-ink' }
const CHIP: Record<Tone, string> = {
  pos: 'bg-pos-soft text-pos border-pos/30',
  neg: 'bg-neg-soft text-neg border-neg/30',
  neutral: 'bg-surface-2 text-muted border-line',
}

/** Signed to the cent; a value that rounds to zero is shown as +৳0.00, never −৳0.00. */
const money = (n: number) => takaSigned(Math.abs(n) < 0.005 ? 0 : n, 2)
const chipTone = (n: number): Tone => (Math.abs(n) < 0.005 ? 'neutral' : n > 0 ? 'pos' : 'neg')

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] leading-4 text-muted">{label}</div>
      <div className="truncate text-sm font-semibold leading-5 tabular-nums">{value}</div>
    </div>
  )
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10.5px] font-semibold ${CHIP[chipTone(value)]}`}
    >
      <span className="font-medium opacity-80">{label}</span>
      {money(value)}
    </span>
  )
}

const BTN =
  't-fast h-6 rounded-lg border border-line bg-surface px-2 text-[11px] font-semibold hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-45'

/** One combined readout for the two linked charts. Replaces the old per-chart readouts. */
export function ScenarioCard({
  inputs,
  scenario,
  changed,
  onReset,
  onApply,
  onSave,
  onCopy,
}: {
  inputs: Inputs
  scenario: WhatIf
  /** the scenario differs from the entered values */
  changed: boolean
  onReset: () => void
  onApply: () => void
  onSave: () => void
  onCopy: () => void
}) {
  const r = resultAt(inputs, scenario)
  const b = scenarioBreakdown(inputs, scenario)
  const tone = toneOf(r.profitBdt)
  const delta = b.pC - b.p0
  // points of the direct route, the same unit as the "% vs direct" next to the profit
  const deltaPct = r.bdtDirect > 0 ? (delta / r.bdtDirect) * 100 : null

  return (
    <section
      aria-labelledby="whatif-title"
      className="shrink-0 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-card"
    >
      <div className="grid items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto]">
        <div className="min-w-0">
          <h2 id="whatif-title" className="truncate text-xs font-semibold text-muted">
            <span className="sr-only">Scenario: </span>
            Sell {taka(scenario.sellRate, 2)} · Buy {fmt(scenario.buyRate, 3)} Payo/USDT
          </h2>
          <div className="flex items-baseline gap-2 whitespace-nowrap" aria-live="polite">
            <span className={`text-xl font-bold leading-7 tracking-tight tabular-nums ${TONE_TEXT[tone]}`}>
              {takaSigned(r.profitBdt)}
            </span>
            <span className={`rounded-md border px-1.5 py-0.5 text-xs font-semibold ${CHIP[tone]}`}>
              {r.profitPct === null ? '—' : pctSigned(r.profitPct)}
              <span className="ml-1 font-normal opacity-80">vs direct</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="USDT received" value={fmt(r.usdtReceived)} />
          <Stat label="BDT via USDT" value={taka(r.bdtViaUsdt)} />
          <Stat label="BDT direct" value={taka(r.bdtDirect)} />
        </div>

        <div className="grid grid-cols-2 gap-1">
          <button type="button" className={BTN} disabled={!changed} onClick={onReset}>
            Reset both
          </button>
          <button
            type="button"
            disabled={!changed}
            onClick={onApply}
            className="t-fast h-6 rounded-lg bg-accent px-2 text-[11px] font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Apply to inputs
          </button>
          <button type="button" className={BTN} onClick={onCopy}>
            Copy summary
          </button>
          <button type="button" className={BTN} onClick={onSave}>
            Save as scenario
          </button>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-1.5 whitespace-nowrap text-[11px] text-muted">
          vs your entered rates
          <span className={`text-sm font-semibold tabular-nums ${TONE_TEXT[chipTone(delta)]}`}>
            {money(delta)}
            <span className="ml-1 text-xs">{deltaPct === null ? '' : `${pctSigned(deltaPct)} of direct`}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Effect breakdown">
          <Chip label="Sell rate" value={b.sellEffect} />
          <Chip label="Buying rate" value={b.buyEffect} />
          <Chip label="Combined interaction" value={b.interaction} />
        </div>
      </div>
    </section>
  )
}
