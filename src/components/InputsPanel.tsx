import { useState } from 'react'
import type { FeeMode } from '../lib/calc'
import { FIELDS, num, validateField, type FieldKey, type FormState } from '../lib/form'
import { Field } from './Field'
import { Accordion, Card, PresetChips, Segmented } from './controls'
import { ResetIcon } from './icons'

const FEE_MODES: { value: FeeMode; label: string }[] = [
  { value: 'before-conversion', label: 'Before conversion' },
  { value: 'legacy', label: 'Legacy' },
]

const FEE_MODE_HELP: Record<FeeMode, string> = {
  'before-conversion':
    'The fee comes off your USD first, then the rest is converted: (USD − USD × fee) ÷ rate.',
  legacy:
    'The fee is subtracted in USDT after converting: USD ÷ rate − USD × fee.',
}

const EXTRA_KEYS: FieldKey[] = ['withdrawalFeeUsdt', 'sellFeePct', 'directFeePct']

export function InputsPanel({
  state,
  onField,
  onFeeMode,
  onReset,
}: {
  state: FormState
  onField: (k: FieldKey, v: string) => void
  onFeeMode: (m: FeeMode) => void
  onReset: () => void
}) {
  const { form, feeMode } = state
  const extraCount = EXTRA_KEYS.filter((k) => num(form[k]) > 0).length
  const [extraOpen, setExtraOpen] = useState(extraCount > 0)

  const field = (k: FieldKey, children?: React.ReactNode) => (
    <Field
      key={k}
      meta={FIELDS[k]}
      value={form[k]}
      error={validateField(FIELDS[k], form[k]) ?? undefined}
      onChange={(v) => onField(k, v)}
    >
      {children}
    </Field>
  )

  return (
    <div className="space-y-4">
      <Card title="Your money" subtitle="What you have and what the bank pays directly.">
        {field(
          'payoneerUsd',
          <div className="mt-1">
            <PresetChips
              label="Balance presets"
              presets={[500, 1000, 1850, 5000]}
              current={form.payoneerUsd}
              onPick={(v) => onField('payoneerUsd', v)}
            />
          </div>,
        )}
        {field('directRate')}
      </Card>

      <Card title="USDT leg" subtitle="Buying USDT with Payoneer, then selling it for BDT.">
        {field('payoneerPerUsdt')}
        {field('usdtToBdtRate')}
      </Card>

      <Card title="Fees" subtitle="Everything that eats into the USDT route.">
        {field('p2pFeePct')}

        <div className="space-y-2 pt-1">
          <span className="text-sm font-medium" id="fee-mode-label">
            Fee mode
          </span>
          <Segmented label="Fee mode" value={feeMode} options={FEE_MODES} onChange={onFeeMode} />
          <p className="min-h-12 text-xs leading-relaxed text-muted sm:min-h-8" aria-live="polite">
            {FEE_MODE_HELP[feeMode]}
          </p>
        </div>

        <Accordion
          title="Extra fees"
          count={extraCount}
          open={extraOpen}
          onToggle={() => setExtraOpen((o) => !o)}
        >
          {EXTRA_KEYS.map((k) => field(k))}
        </Accordion>
      </Card>

      <button
        type="button"
        onClick={onReset}
        className="t-fast flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-medium text-muted shadow-card hover:text-ink"
      >
        <ResetIcon className="h-4 w-4" /> Reset to defaults
      </button>
    </div>
  )
}
