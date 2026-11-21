import { useState, type ReactNode } from 'react'
import { signOf, type FeeType, type Sign } from '../lib/calc'
import { fmt } from '../lib/format'
import {
  ADJ_OF,
  fieldMeta,
  num,
  validateField,
  type AdjKey,
  type FieldKey,
  type FormState,
} from '../lib/form'
import { Field, LabelRow } from './Field'
import { Accordion, PresetChips, UnitToggle } from './controls'
import { BookmarkIcon, CopyIcon, ResetIcon } from './icons'

const EXTRA_KEYS: FieldKey[] = ['withdrawalFeeUsdt', 'sellFeePct', 'directFeePct']

/** Two columns from 480px up, one below. */
const GRID = 'grid grid-cols-1 gap-x-3 min-[480px]:grid-cols-2'
/**
 * Rates: Direct | Buy / Sell | Effective chip. Two columns at every width: the inputs column never
 * gets wider than ~630px (the page is capped at 1600px), so three columns would crush the numbers.
 */
const RATES_GRID = GRID

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div>
      <LabelRow text={title} hint={hint} className="!text-[11px] font-semibold uppercase tracking-wider text-muted" />
      {children}
    </div>
  )
}

/** Route pill: Direct is neutral, USDT route uses the accent colour. */
function RouteTag({ route, children }: { route: 'direct' | 'usdt'; children: ReactNode }) {
  return (
    <div className="h-[18px]">
      <span
        className={`inline-flex h-4 items-center rounded-full px-1.5 text-[10px] font-semibold leading-none ${
          route === 'direct' ? 'bg-surface-2 text-muted' : 'bg-accent-soft text-accent-ink'
        }`}
      >
        {children}
      </span>
    </div>
  )
}

export function InputsPanel({
  state,
  onField,
  onSign,
  onFeeType,
  onReset,
  onCopy,
  onSave,
}: {
  state: FormState
  onField: (k: FieldKey, v: string) => void
  onSign: (k: AdjKey, s: Sign) => void
  onFeeType: (t: FeeType) => void
  onReset: () => void
  onCopy: () => void
  onSave: () => void
}) {
  const { form, feeType, signs } = state
  const extraCount = EXTRA_KEYS.filter((k) => num(form[k]) > 0).length
  const [extraOpen, setExtraOpen] = useState(extraCount > 0)

  const field = (k: FieldKey, opts: { below?: ReactNode; unitSlot?: ReactNode; tag?: ReactNode } = {}) => {
    const meta = fieldMeta(k, feeType)
    const adj = ADJ_OF[k]
    return (
      <Field
        key={k}
        meta={meta}
        value={form[k]}
        error={validateField(meta, form[k]) ?? undefined}
        onChange={(v) => onField(k, v)}
        sign={adj ? signs[adj] : undefined}
        onSign={adj ? (s) => onSign(adj, s) : undefined}
        unitSlot={opts.unitSlot}
        tag={opts.tag}
      >
        {opts.below}
      </Field>
    )
  }

  const effective = Math.max(0, num(form.usdtToBdtRate) + signOf(signs.bdtFeeProfit) * num(form.bdtFeeProfit))
  const chargeSign = signs.bdtFeeProfit === 'profit' ? '+' : '−'

  const btn =
    't-fast flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-2 text-[13px] font-semibold hover:border-accent/50'

  return (
    <section aria-label="Inputs" className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="space-y-2">
        {/* A. AMOUNT */}
        <Section title="Amount" hint="How much you are sending from Payoneer.">
          {field('payoneerUsd', {
            below: (
              <PresetChips
                label="Amount presets"
                presets={[100, 500, 1000, 5000]}
                current={form.payoneerUsd}
                onPick={(v) => onField('payoneerUsd', v)}
              />
            ),
          })}
        </Section>

        {/* B. RATES: every rate, tagged with the route it belongs to */}
        <Section
          title="Rates"
          hint="The three rates that decide the result. Direct route: Payoneer straight to BDT. USDT route: buy USDT with Payoneer, then sell it for BDT."
        >
          <div className={RATES_GRID}>
            {field('directRate', { tag: <RouteTag route="direct">Direct route</RouteTag> })}
            {field('payoneerPerUsdt', { tag: <RouteTag route="usdt">USDT route · buy</RouteTag> })}
            {field('usdtToBdtRate', { tag: <RouteTag route="usdt">USDT route · sell</RouteTag> })}
            {/* read-only: the final sell rate once the BDT charges are applied */}
            <div className="min-w-0">
              <div className="h-[18px]" aria-hidden="true" />
              <div className="flex h-6 items-center text-sm font-medium text-muted lg:text-xs">Effective sell rate</div>
              <div
                className="mt-0.5 flex h-11 items-center justify-between rounded-xl bg-surface-2 px-3 lg:h-10"
                aria-live="polite"
              >
                <span className="num text-base font-bold lg:text-[15px]">৳{fmt(effective, 2)}</span>
                <span className="text-[11px] text-muted">
                  {fmt(num(form.usdtToBdtRate), 2)} {chargeSign} {fmt(num(form.bdtFeeProfit), 2)}
                </span>
              </div>
              <p className="min-h-4 text-[11px] leading-4 text-muted">sell rate ± BDT charges</p>
            </div>
          </div>
        </Section>

        {/* C. FEES & CHARGES: each keeps its + Profit / − Loss toggle */}
        <Section
          title="Fees & charges"
          hint="Money that is taken off (Loss) or added (Profit). The Payoneer fee is applied to the USD first; BDT charges adjust the sell rate."
        >
          {/* the BDT charges label is the longer one, so it gets a little more width */}
          {/* side by side where there is room (tablet single column, and ≥1440px); stacked in between */}
          <div className="grid grid-cols-1 gap-x-3 min-[768px]:grid-cols-2 lg:max-[1439px]:grid-cols-1 min-[1440px]:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            {field('payoneerFee', {
              unitSlot: <UnitToggle label="Payoneer Fee (P2P)" value={feeType} onChange={onFeeType} />,
            })}
            {field('bdtFeeProfit')}
          </div>
          <Accordion
            title="Extra fees"
            count={extraCount}
            open={extraOpen}
            onToggle={() => setExtraOpen((o) => !o)}
          >
            <div className={GRID}>{EXTRA_KEYS.map((k) => field(k))}</div>
          </Accordion>
        </Section>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-line pt-3">
        <button type="button" onClick={onReset} aria-label="Reset to defaults" className={`${btn} text-muted hover:text-ink`}>
          <ResetIcon className="h-4 w-4" /> Reset
        </button>
        <button type="button" onClick={onCopy} aria-label="Copy summary" className={btn}>
          <CopyIcon className="h-4 w-4" />
          <span>
            Copy<span className="hidden sm:inline"> summary</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onSave}
          aria-label="Save scenario"
          className="t-fast flex h-10 items-center justify-center gap-1.5 rounded-xl bg-accent px-2 text-[13px] font-semibold text-accent-contrast hover:brightness-110"
        >
          <BookmarkIcon className="h-4 w-4" />
          <span>
            Save<span className="hidden sm:inline"> scenario</span>
          </span>
        </button>
      </div>
    </section>
  )
}
