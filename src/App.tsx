import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { calculate, scenarioBreakdown, type FeeType, type Result, type Sign } from './lib/calc'
import {
  DEFAULT_STATE,
  loadState,
  saveState,
  toCalcInputs,
  validateAll,
  type AdjKey,
  type FieldKey,
  type FormState,
} from './lib/form'
import { useTheme } from './hooks/useTheme'
import { Ticker } from './components/Ticker'
import { useMediaQuery } from './hooks/useMediaQuery'
import { Header } from './components/Header'
import { ResultsHero } from './components/ResultsHero'
import { InputsPanel } from './components/InputsPanel'
import { Breakdown } from './components/Breakdown'
import { SweepChart } from './components/SweepChart'
import { ScenarioCard } from './components/ScenarioCard'
import {
  clampRate,
  inputsKey,
  rateText,
  resolveWhatIf,
  whatIfDomains,
  type StoredWhatIf,
} from './lib/whatif'
import { ScenarioList, Toast } from './components/Extras'
import {
  buildSummary,
  buildWhatIfSummary,
  copyText,
  loadScenarios,
  MAX_SCENARIOS,
  persistScenarios,
  type Scenario,
} from './lib/scenarios'

export default function App() {
  const { theme, choose } = useTheme()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  // Lock the page to the viewport only when there is enough height; short windows scroll normally.
  const fixed = useMediaQuery('(min-width: 1280px) and (min-height: 840px)')
  const [state, setState] = useState<FormState>(loadState)

  useEffect(() => saveState(state), [state])

  const [scenarios, setScenarios] = useState<Scenario[]>(loadScenarios)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const errors = useMemo(() => validateAll(state), [state])
  const valid = Object.keys(errors).length === 0

  // While inputs are invalid keep showing the last good result, so nothing jumps.
  const lastGood = useRef<Result | null>(null)
  const result = useMemo(() => {
    return calculate(toCalcInputs(state))
  }, [state])
  const lastGoodState = useRef<FormState>(state)
  if (valid) {
    lastGood.current = result
    lastGoodState.current = state
  }
  const shown = valid ? result : (lastGood.current ?? result)

  // Breakdown and chart reflect the same (last good) numbers as the hero.
  const calcIn = toCalcInputs(valid ? state : lastGoodState.current)

  const copy = async () => {
    if (!valid) return setToast('Fix the highlighted fields first')
    setToast((await copyText(buildSummary(calcIn, shown))) ? 'Summary copied' : 'Copy failed')
  }
  const save = () => {
    if (!valid) return setToast('Fix the highlighted fields first')
    const next = [{ id: crypto.randomUUID(), savedAt: Date.now(), state, profit: shown.profitBdt }, ...scenarios].slice(0, MAX_SCENARIOS)
    setScenarios(next)
    persistScenarios(next)
    setToast('Scenario saved')
  }
  const del = (id: string) => {
    const next = scenarios.filter((x) => x.id !== id)
    setScenarios(next)
    persistScenarios(next)
  }
  const load = (sc: Scenario) => {
    // sc.state was migrated when the scenario was loaded from storage
    setState(sc.state)
    setToast('Scenario loaded')
  }

  // ONE shared what-if scenario. It is stored with the key of the inputs it was made for, so
  // editing any main input discards it and both sliders return to the newly entered rates.
  const [stored, setStored] = useState<StoredWhatIf | null>(null)
  const calcKey = inputsKey(calcIn)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const domains = useMemo(() => whatIfDomains(calcIn), [calcKey])
  const scenario = resolveWhatIf(stored, calcIn, domains)
  const setRate = (kind: 'usdt' | 'payoneer') => (v: number) =>
    setStored({
      key: inputsKey(calcIn),
      value:
        kind === 'usdt'
          ? { ...scenario, sellRate: clampRate('usdt', v, domains.sell) }
          : { ...scenario, buyRate: clampRate('payoneer', v, domains.buy) },
    })
  const scenarioChanged =
    Math.abs(scenario.sellRate - calcIn.usdtToBdtRate) > 1e-9 ||
    Math.abs(scenario.buyRate - calcIn.payoneerPerUsdt) > 1e-9
  const resetScenario = () => setStored(null)

  /** the main form with both scenario rates written in */
  const withScenarioRates = (st: FormState): FormState => ({
    ...st,
    form: {
      ...st.form,
      usdtToBdtRate: rateText('usdt', scenario.sellRate),
      payoneerPerUsdt: rateText('payoneer', scenario.buyRate),
    },
  })
  const breakdown2 = scenarioBreakdown(calcIn, scenario)
  const applyScenario = () => {
    setState(withScenarioRates)
    setToast(`Applied sell ${rateText('usdt', scenario.sellRate)} · buy ${rateText('payoneer', scenario.buyRate)} to inputs`)
  }
  const saveScenario = () => {
    if (!valid) return setToast('Fix the highlighted fields first')
    const entry = { id: crypto.randomUUID(), savedAt: Date.now(), state: withScenarioRates(state), profit: breakdown2.pC }
    const next = [entry, ...scenarios].slice(0, MAX_SCENARIOS)
    setScenarios(next)
    persistScenarios(next)
    setToast('Scenario saved with the scenario rates')
  }
  const copyScenario = async () => {
    if (!valid) return setToast('Fix the highlighted fields first')
    setToast((await copyText(buildWhatIfSummary(calcIn, scenario, breakdown2))) ? 'Summary copied' : 'Copy failed')
  }

  const inputs = (
    <InputsPanel
      state={state}
      onField={(k: FieldKey, v: string) => setState((s) => ({ ...s, form: { ...s.form, [k]: v } }))}
      onSign={(k: AdjKey, sign: Sign) => setState((s) => ({ ...s, signs: { ...s.signs, [k]: sign } }))}
      onFeeType={(feeType: FeeType) => setState((s) => ({ ...s, feeType }))}
      onReset={() => setState(DEFAULT_STATE)}
      onCopy={copy}
      onSave={save}
    />
  )
  const hero = <ResultsHero r={shown} valid={valid} />
  const breakdown = <Breakdown inputs={calcIn} result={shown} horizontal={isDesktop} />
  const charts = (
    <>
      <div className={`grid gap-4 xl:grid-cols-2 ${fixed ? 'min-h-0 flex-1 grid-rows-[minmax(0,1fr)]' : ''}`}>
        <SweepChart
          kind="usdt"
          inputs={calcIn}
          value={scenario.sellRate}
          other={scenario.buyRate}
          range={domains.sell}
          yRange={domains.y}
          onChange={setRate('usdt')}
          fill={fixed}
        />
        <SweepChart
          kind="payoneer"
          inputs={calcIn}
          value={scenario.buyRate}
          other={scenario.sellRate}
          range={domains.buy}
          yRange={domains.y}
          onChange={setRate('payoneer')}
          fill={fixed}
        />
      </div>
      <ScenarioCard
        inputs={calcIn}
        scenario={scenario}
        changed={scenarioChanged}
        onReset={resetScenario}
        onApply={applyScenario}
        onSave={saveScenario}
        onCopy={copyScenario}
      />
    </>
  )
  const history = <ScenarioList items={scenarios} onLoad={load} onDelete={del} />

  if (isDesktop) {
    return (
      <div
        className={`mx-auto flex max-w-[1600px] flex-col px-6 xl:px-8 ${
          fixed ? 'h-dvh overflow-hidden' : 'min-h-dvh pb-6'
        }`}
      >
        <Header theme={theme} onChoose={choose} />
        {theme === 'trading' && <Ticker inputs={calcIn} result={shown} />}
        <div
          className={`grid grid-cols-12 gap-4 ${fixed ? 'min-h-0 flex-1 grid-rows-[minmax(0,1fr)] pb-4' : ''}`}
        >
          {/* LEFT: inputs + saved scenarios. Scrolls internally only if a tall state (extra fees open) outgrows the window. */}
          <div className={`col-span-6 xl:col-span-5 ${fixed ? 'min-h-0 overflow-y-auto p-1 -m-1' : ''}`}>
            <div className="space-y-4">
              {inputs}
              {history}
            </div>
          </div>
          {/* RIGHT: results, flow + break-even, two sensitivity charts (they stretch to the remaining height) */}
          <div className={`col-span-6 flex flex-col gap-4 xl:col-span-7 ${fixed ? 'min-h-0' : ''}`}>
            <div className="shrink-0">{hero}</div>
            <div className="shrink-0">{breakdown}</div>
            {charts}
          </div>
        </div>
        <Toast message={toast} onDone={clearToast} />
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[1100px] px-4 pb-16">
      <Header theme={theme} onChoose={choose} />
        {theme === 'trading' && <Ticker inputs={calcIn} result={shown} />}
      <div className="space-y-4">
        <div className="sticky top-0 z-20 -mx-4 bg-bg/90 px-4 py-2 backdrop-blur">{hero}</div>
        {inputs}
        {breakdown}
        {charts}
        {history}
      </div>
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
