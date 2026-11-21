import type { ReactNode } from 'react'
import type { Adjustment, Inputs, Result } from '../lib/calc'
import { fmt, taka } from '../lib/format'
import { ArrowDownIcon } from './icons'

interface Step {
  label: string
  value: string
  unit: string
  note?: ReactNode
}

/** A signed amount coloured by direction: profit green, loss red. */
function Amt({ sign, children }: { sign: Adjustment['sign']; children: ReactNode }) {
  return (
    <span className={`font-semibold ${sign === 'profit' ? 'text-pos' : 'text-neg'}`}>
      {sign === 'profit' ? '+' : '−'}
      {children}
    </span>
  )
}

function buildSteps(i: Inputs, r: Result): Step[] {
  const f = i.payoneerFee
  const mark = f.sign === 'profit' ? '+' : '−'
  const nice = (n: number) => fmt(n, n % 1 ? 2 : 0)
  const feeLabel = f.type === 'percent' ? `${mark}${nice(f.value)}%` : `${mark}$${nice(f.value)} flat`
  const feeAmount = Math.abs(r.payoneerFeeUsd)

  const w = i.usdtWithdrawal
  const sf = i.sellFee
  const add = i.bdtAddedToRate

  return [
    { label: 'Payoneer Sending', value: `$${fmt(i.payoneerUsd)}`, unit: 'USD' },
    {
      label: `After Payoneer fee (${feeLabel})`,
      value: `$${fmt(r.usdAfterFee)}`,
      unit: 'USD',
      note: (
        <>
          <Amt sign={f.sign}>${fmt(feeAmount)}</Amt> fee {f.sign === 'profit' ? 'added' : 'taken'}
        </>
      ),
    },
    {
      label: 'USDT received',
      value: fmt(r.usdtReceived),
      unit: 'USDT',
      note: (
        <>
          at ${fmt(i.payoneerPerUsdt, 3)} per USDT
          {w.value > 0 && (
            <>
              , <Amt sign={w.sign}>{fmt(w.value)}</Amt> withdrawal
            </>
          )}
        </>
      ),
    },
    {
      label: 'BDT via USDT',
      value: taka(r.bdtViaUsdt),
      unit: 'BDT',
      note: (
        <>
          at {taka(r.effectiveRate, 2)}/USDT
          {add.value > 0 && (
            <>
              {' '}
              (<Amt sign={add.sign}>{fmt(add.value)}</Amt> charges)
            </>
          )}
          {sf.value > 0 && (
            <>
              , <Amt sign={sf.sign}>{fmt(sf.value, sf.value % 1 ? 2 : 0)}%</Amt> sell fee
            </>
          )}
        </>
      ),
    },
  ]
}

/** Vertical timeline (mobile / tablet). */
function FlowVertical({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        return (
          <li key={i} className="relative pl-9">
            {!last && <span aria-hidden="true" className="absolute left-[11px] top-7 bottom-0 w-px bg-line" />}
            <span
              aria-hidden="true"
              className={`absolute left-0 top-1 grid h-6 w-6 place-items-center rounded-full border text-[11px] font-bold ${
                last ? 'border-accent bg-accent text-accent-contrast' : 'border-line bg-surface-2 text-muted'
              }`}
            >
              {i + 1}
            </span>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted">{s.label}</span>
              <span className="text-base font-semibold">
                {s.value}
                <span className="ml-1 text-xs font-medium text-muted">{s.unit}</span>
              </span>
            </div>
            <p className="min-h-4 text-xs leading-4 text-muted">{s.note ?? ''}</p>
            {!last && (
              <span aria-hidden="true" className="flex h-3.5 items-center">
                <ArrowDownIcon className="-ml-[26px] h-3.5 w-3.5 bg-surface text-muted" />
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Connected tiles: 4 in a row from 1280px, 2×2 between 1024 and 1279px. */
function FlowTiles({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        // Arrow to the next tile; tile 2 wraps to a new row on the 2x2 layout, so it only shows from xl.
        const arrow = last ? 'hidden' : i === 1 ? 'hidden xl:grid' : 'grid'
        return (
          <li
            key={i}
            className={`relative min-w-0 rounded-xl border p-3 ${
              last ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface-2'
            }`}
          >
            <div className="flex items-start gap-1.5 text-xs leading-4 text-muted">
              <span
                aria-hidden="true"
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  last ? 'bg-accent text-accent-contrast' : 'bg-line text-muted'
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0">{s.label}</span>
            </div>
            <div className="num mt-1 truncate text-base font-bold leading-tight lg:text-lg">
              {s.value}
              <span className="ml-1 text-[11px] font-medium text-muted">{s.unit}</span>
            </div>
            <p className="mt-0.5 min-h-[14px] text-[11px] leading-[14px] text-muted">{s.note ?? ''}</p>
            <span
              aria-hidden="true"
              className={`${arrow} absolute -right-[13px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-muted`}
            >
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Where the current USDT→BDT rate sits relative to break-even (break-even is always centred). */
function Gauge({ current, breakEven }: { current: number; breakEven: number }) {
  const diff = current - breakEven
  const span = Math.max(5, Math.abs(diff) * 1.25)
  const pos = Math.min(100, Math.max(0, 50 + (diff / span) * 50))
  const labelPos = Math.min(88, Math.max(12, pos))
  const winning = diff > 0

  return (
    <div
      className="min-w-0"
      role="img"
      aria-label={`Current rate ${fmt(current)} is ${fmt(Math.abs(diff))} ${winning ? 'above' : 'below'} break-even ${fmt(breakEven)}`}
    >
      <div className="relative h-7">
        <span
          className="absolute -top-0.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-surface transition-[left] duration-300 ease-out"
          style={{ left: `${labelPos}%` }}
        >
          You {taka(current, 2)}
        </span>
      </div>
      <div
        className="relative h-2.5 rounded-full"
        style={{
          background:
            'linear-gradient(90deg, color-mix(in oklab, var(--neg) 55%, var(--surface-2)), var(--surface-2) 50%, color-mix(in oklab, var(--pos) 55%, var(--surface-2)))',
        }}
      >
        <span aria-hidden="true" className="absolute left-1/2 top-[-4px] h-[18px] w-0.5 -translate-x-1/2 rounded bg-muted" />
        <span
          aria-hidden="true"
          className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow transition-[left,background-color] duration-300 ease-out ${winning ? 'bg-pos' : diff < 0 ? 'bg-neg' : 'bg-muted'}`}
          style={{ left: `${pos}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted">
        <span>{taka(breakEven - span, 2)}</span>
        <span className="font-medium">Break-even {taka(breakEven, 2)}</span>
        <span>{taka(breakEven + span, 2)}</span>
      </div>
    </div>
  )
}

export function Breakdown({
  inputs,
  result,
  horizontal,
}: {
  inputs: Inputs
  result: Result
  /** desktop: tiles in a row with the gauge beside/under the break-even text */
  horizontal: boolean
}) {
  const steps = buildSteps(inputs, result)
  const be = result.breakEvenRate
  const hasBE = be !== null
  const diff = hasBE ? inputs.usdtToBdtRate - be : 0
  // the sell-rate adjustment is part of the break-even, so say so when one is set
  const addNote = inputs.bdtAddedToRate.value > 0 ? ` (includes ${inputs.bdtAddedToRate.sign === 'profit' ? '+' : '−'}${fmt(inputs.bdtAddedToRate.value)} BDT charges)` : ''

  return (
    <section aria-labelledby="breakdown-title" className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
      <h2 id="breakdown-title" className="mb-2 text-sm font-semibold tracking-tight">
        How the money flows
      </h2>
      {horizontal ? <FlowTiles steps={steps} /> : <FlowVertical steps={steps} />}

      <div className="mt-2 rounded-xl bg-surface-2 px-3 py-2">
        <div className={horizontal ? 'xl:grid xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] xl:items-center xl:gap-6' : ''}>
          <div>
            <div className="flex items-baseline justify-between gap-3 xl:block">
              <span className="text-sm text-muted xl:block xl:text-xs">Break-even sell rate</span>
              <span className="num text-lg font-bold">
                {hasBE ? taka(be, 2) : '—'}
                <span className="ml-1 text-xs font-medium text-muted">/USDT</span>
              </span>
            </div>
            {hasBE ? (
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Below {taka(be, 2)}/USDT the direct route wins{addNote}.{' '}
                <span className={diff >= 0 ? 'font-medium text-pos' : 'font-medium text-neg'}>
                  You’re {taka(Math.abs(diff), 2)} {diff >= 0 ? 'above' : 'below'} it.
                </span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted">Not available for these values.</p>
            )}
          </div>
          {hasBE && (
            <div className="mt-3 xl:mt-0">
              <Gauge current={inputs.usdtToBdtRate} breakEven={be} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
