import type { ReactNode } from 'react'
import type { Inputs, Options, Result } from '../lib/calc'
import { fmt, taka } from '../lib/format'
import { ArrowDownIcon } from './icons'

interface Step {
  label: string
  value: string
  unit: string
  note?: string
  tone?: 'fee'
}

function buildSteps(i: Inputs, o: Options, r: Result): Step[] {
  const feeUsd = i.payoneerUsd * (Math.min(i.p2pFeePct, 100) / 100)
  const steps: Step[] = [{ label: 'Payoneer balance', value: `$${fmt(i.payoneerUsd)}`, unit: 'USD' }]

  if (o.feeMode === 'legacy') {
    steps.push({
      label: `P2P fee (${fmt(i.p2pFeePct, i.p2pFeePct % 1 ? 2 : 0)}%)`,
      value: `−$${fmt(feeUsd)}`,
      unit: 'USD',
      note: 'Legacy: deducted in USDT after converting',
      tone: 'fee',
    })
  } else {
    steps.push({
      label: `After P2P fee (${fmt(i.p2pFeePct, i.p2pFeePct % 1 ? 2 : 0)}%)`,
      value: `$${fmt(i.payoneerUsd - feeUsd)}`,
      unit: 'USD',
      note: `−$${fmt(feeUsd)} fee`,
      tone: 'fee',
    })
  }

  steps.push({
    label: 'USDT received',
    value: fmt(r.usdtReceived),
    unit: 'USDT',
    note:
      `at $${fmt(i.payoneerPerUsdt, 3)} per USDT` +
      (o.withdrawalFeeUsdt > 0 ? `, after ${fmt(o.withdrawalFeeUsdt)} USDT withdrawal fee` : ''),
  })

  steps.push({
    label: 'BDT via USDT',
    value: taka(r.bdtViaUsdt),
    unit: 'BDT',
    note:
      `at ${taka(i.usdtToBdtRate, 2)}/USDT` +
      (o.sellFeePct > 0 ? `, after ${fmt(o.sellFeePct, 2)}% sell fee` : ''),
  })
  return steps
}

function Flow({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        return (
          <li key={s.label} className="relative pl-9">
            {/* connector line + arrow to the next step */}
            {!last && (
              <span aria-hidden="true" className="absolute left-[11px] top-7 bottom-0 w-px bg-line" />
            )}
            <span
              aria-hidden="true"
              className={`absolute left-0 top-1 grid h-6 w-6 place-items-center rounded-full border text-[11px] font-bold ${
                last ? 'border-accent bg-accent text-white' : 'border-line bg-surface-2 text-muted'
              }`}
            >
              {i + 1}
            </span>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted">{s.label}</span>
              <span className={`text-base font-semibold ${s.tone === 'fee' ? '' : ''}`}>
                {s.value}
                <span className="ml-1 text-xs font-medium text-muted">{s.unit}</span>
              </span>
            </div>
            <p className="min-h-4 text-xs leading-4 text-muted">{s.note ?? ''}</p>
            {!last && (
              <span aria-hidden="true" className="flex h-3.5 items-center text-line">
                <ArrowDownIcon className="-ml-[26px] h-3.5 w-3.5 bg-surface text-muted" />
              </span>
            )}
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
    <div className="mt-4" role="img" aria-label={`Current rate ${fmt(current)} is ${fmt(Math.abs(diff))} ${winning ? 'above' : 'below'} break-even ${fmt(breakEven)}`}>
      <div className="relative h-8">
        <span
          className="absolute -top-0.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-bg transition-[left] duration-300 ease-out"
          style={{ left: `${labelPos}%` }}
        >
          You {taka(current, 2)}
        </span>
      </div>
      <div className="relative -mt-4 h-2.5 rounded-full" style={{
        background:
          'linear-gradient(90deg, color-mix(in oklab, var(--neg) 55%, var(--surface-2)), var(--surface-2) 50%, color-mix(in oklab, var(--pos) 55%, var(--surface-2)))',
      }}>
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
  options,
  result,
  footer,
}: {
  inputs: Inputs
  options: Options
  result: Result
  footer?: ReactNode
}) {
  const steps = buildSteps(inputs, options, result)
  const be = result.breakEvenRate
  const diff = inputs.usdtToBdtRate - be
  const hasBE = be > 0

  return (
    <section
      aria-labelledby="breakdown-title"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card lg:p-6"
    >
      <h2 id="breakdown-title" className="mb-3 text-sm font-semibold tracking-tight">
        How the money flows
      </h2>
      <Flow steps={steps} />

      <div className="mt-4 rounded-xl bg-surface-2 p-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted">Break-even USDT rate</span>
          <span className="text-lg font-bold">
            {hasBE ? taka(be, 2) : '—'}
            <span className="ml-1 text-xs font-medium text-muted">/USDT</span>
          </span>
        </div>
        {hasBE ? (
          <>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Below {taka(be, 2)}/USDT the direct route wins.{' '}
              <span className={diff >= 0 ? 'font-medium text-pos' : 'font-medium text-neg'}>
                You’re {taka(Math.abs(diff), 2)} {diff >= 0 ? 'above' : 'below'} it.
              </span>
            </p>
            <Gauge current={inputs.usdtToBdtRate} breakEven={be} />
          </>
        ) : (
          <p className="mt-1 text-xs text-muted">Enter valid values to see the break-even rate.</p>
        )}
      </div>

      {footer}
    </section>
  )
}
